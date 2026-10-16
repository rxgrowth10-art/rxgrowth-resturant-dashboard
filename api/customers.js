const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;

const { getRestaurantConnection } = require("./restaurant.js");

async function ghlGet(urlOrPath, apiKey) {
  if (!apiKey) {
    throw new Error("Missing GHL API key for restaurant connection.");
  }

  const url =
    urlOrPath instanceof URL
      ? urlOrPath
      : new URL(urlOrPath, GHL_BASE_URL);

  if (url.origin !== GHL_BASE_URL) {
    throw new Error("Unexpected HighLevel API host");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error("HighLevel customer request failed", {
      path: url.pathname,
      status: response.status,
    });

    throw new Error(
      `HighLevel Contacts API request failed (${response.status})`
    );
  }

  return response.json();
}

function normalizeFieldKey(key) {
  return String(key || "").replace(/^contact\./, "");
}

async function fetchFieldDefinitions(restaurant) {
  const url = new URL(
    `/locations/${restaurant.locationId}/customFields`,
    GHL_BASE_URL
  );

  const data = await ghlGet(url, restaurant.apiKey);

  if (!Array.isArray(data.customFields)) {
    throw new Error("Unexpected Custom Fields API response");
  }

  const map = new Map();

  for (const field of data.customFields) {
    if (field && field.id && field.fieldKey) {
      map.set(field.id, normalizeFieldKey(field.fieldKey));
    }
  }

  return {
    map,
    count: data.customFields.length,
  };
}

async function fetchAllContacts(restaurant) {
  const contacts = [];
  const seenIds = new Set();

  let nextUrl = new URL("/contacts/", GHL_BASE_URL);

  nextUrl.searchParams.set(
    "locationId",
    restaurant.locationId
  );

  nextUrl.searchParams.set(
    "limit",
    String(PAGE_SIZE)
  );

  let reportedTotal = null;
  let pagesFetched = 0;
  let partial = false;

  while (nextUrl && pagesFetched < MAX_PAGES) {
    pagesFetched += 1;

    const data = await ghlGet(
      nextUrl,
      restaurant.apiKey
    );

    if (!Array.isArray(data.contacts)) {
      throw new Error(
        "Unexpected Contacts API response"
      );
    }

    const meta = data.meta || {};

    if (
      reportedTotal === null &&
      Number.isFinite(Number(meta.total))
    ) {
      reportedTotal = Number(meta.total);
    }

    for (const contact of data.contacts) {
      if (
        !contact ||
        !contact.id ||
        seenIds.has(contact.id)
      ) {
        continue;
      }

      seenIds.add(contact.id);
      contacts.push(contact);
    }

    if (
      reportedTotal !== null &&
      contacts.length >= reportedTotal
    ) {
      break;
    }

    if (!meta.nextPageUrl) {
      break;
    }

    const candidate = new URL(
      meta.nextPageUrl,
      GHL_BASE_URL
    );

    if (
      candidate.origin !== GHL_BASE_URL ||
      !candidate.pathname.startsWith("/contacts")
    ) {
      throw new Error(
        "HighLevel returned an unexpected contacts pagination URL"
      );
    }

    if (candidate.href === nextUrl.href) {
      break;
    }

    nextUrl = candidate;
  }

  if (
    pagesFetched >= MAX_PAGES &&
    reportedTotal !== null &&
    contacts.length < reportedTotal
  ) {
    partial = true;
  }

  if (
    reportedTotal !== null &&
    contacts.length < reportedTotal
  ) {
    partial = true;
  }

  return {
    contacts,
    reportedTotal,
    pagesFetched,
    partial,
  };
}

function normalizeContact(contact, fieldMap) {
  const fields = {};

  const customFields = Array.isArray(contact.customFields)
    ? contact.customFields
    : [];

  for (const field of customFields) {
    if (!field || !field.id) {
      continue;
    }

    const key = fieldMap.get(field.id);

    if (key) {
      fields[key] = field.value ?? null;
    }
  }

  const firstName = contact.firstName || "";
  const lastName = contact.lastName || "";

  const name =
    contact.contactName ||
    [firstName, lastName]
      .filter(Boolean)
      .join(" ") ||
    "";

  return {
    id: String(contact.id),
    name,
    firstName,
    lastName,
    email: contact.email || "",
    phone: contact.phone || "",
    city: contact.city || "",
    country: contact.country || "",
    source: contact.source || "",
    dateAdded: contact.dateAdded || null,
    dateUpdated: contact.dateUpdated || null,
    tags: Array.isArray(contact.tags)
      ? contact.tags
      : [],

    fields: {
      customer_type:
        fields.customer_type ?? null,

      customer_status:
        fields.customer_status ?? null,

      first_order_date:
        fields.first_order_date ?? null,

      last_order_date:
        fields.last_order_date ?? null,

      total_orders:
        fields.total_orders ?? null,

      lifetime_value:
        fields.lifetime_value ?? null,

      average_order_value:
        fields.average_order_value ?? null,

      last_order_type:
        fields.last_order_type ?? null,

      last_order_location:
        fields.last_order_location ?? null,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const restaurant =
      getRestaurantConnection(req);

    const [
      definitionResult,
      contactResult,
    ] = await Promise.all([
      fetchFieldDefinitions(restaurant),
      fetchAllContacts(restaurant),
    ]);

    const customers =
      contactResult.contacts.map(
        (contact) =>
          normalizeContact(
            contact,
            definitionResult.map
          )
      );

    return res.status(200).json({
      success: true,
      source: "highlevel_contacts_api",
      customerFieldSource:
        "m06_contact_fields_read_only",

      customers,

      diagnostics: {
        contactsFetched:
          customers.length,

        apiReportedTotal:
          contactResult.reportedTotal,

        pagesFetched:
          contactResult.pagesFetched,

        customFieldDefinitions:
          definitionResult.count,

        partial:
          contactResult.partial,

        calculatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "Customers API failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to retrieve customer records from HighLevel",
    });
  }
}
