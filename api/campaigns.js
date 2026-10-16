const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const { getRestaurantConnection } = require("./restaurant.js");

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;

const BIRTHDAY_FIELD_KEYS = [
  "birthday_club_status",
  "birthday_club_joined_at",
  "birthday_campaign_status",
  "birthday_campaign_started_at",
  "birthday_campaign_completed_at",
  "birthday_campaign_year",
  "birthday_reward_code",
  "birthday_reward_expires_at",
  "birthday_reward_started_at",
  "birthday_coupon_discount",
  "birthday_coupon_id"
];

const WINBACK_FIELD_KEYS = [
  "typical_order_interval_days",
  "days_since_last_order",
  "expected_next_order_date",
  "days_overdue",
  "overdue_ratio",
  "winback_eligibility",
  "winback_tier",
  "winback_cycle_status",
  "winback_cycle_started_at",
  "last_winback_date"
];

async function ghlGet(urlOrPath, apiKey) {
  if (!apiKey) {
    throw new Error(
      "Missing GHL API key for restaurant connection."
    );
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
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    console.error("HighLevel campaign request failed", {
      path: url.pathname,
      status: response.status
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
  const data = await ghlGet(
    new URL(
      `/locations/${restaurant.locationId}/customFields`,
      GHL_BASE_URL
    ),
    restaurant.apiKey
  );

  if (!Array.isArray(data.customFields)) {
    throw new Error(
      "Unexpected Custom Fields API response"
    );
  }

  const byId = new Map();
  const byKey = new Map();

  for (const field of data.customFields) {
    if (!field) continue;

    const key = normalizeFieldKey(field.fieldKey);

    if (field.id && key) {
      byId.set(field.id, key);
    }

    if (key) {
      byKey.set(key, field.id || null);
    }
  }

  return {
    byId,
    byKey,
    count: data.customFields.length
  };
}

async function fetchAllContacts(restaurant) {
  const contacts = [];
  const seenIds = new Set();

  let nextUrl = new URL(
    "/contacts/",
    GHL_BASE_URL
  );

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

  while (
    nextUrl &&
    pagesFetched < MAX_PAGES
  ) {
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

  const partial =
    (
      pagesFetched >= MAX_PAGES &&
      reportedTotal !== null &&
      contacts.length < reportedTotal
    ) ||
    (
      reportedTotal !== null &&
      contacts.length < reportedTotal
    );

  return {
    contacts,
    reportedTotal,
    pagesFetched,
    partial
  };
}

function normalizeContact(
  contact,
  fieldDefinitions,
  selectedKeys
) {
  const fields = {};

  for (
    const item of Array.isArray(contact.customFields)
      ? contact.customFields
      : []
  ) {
    if (!item || !item.id) continue;

    const key =
      fieldDefinitions.byId.get(item.id);

    if (key) {
      fields[key] = item.value ?? null;
    }
  }

  const firstName =
    contact.firstName || "";

  const lastName =
    contact.lastName || "";

  const name =
    contact.contactName ||
    [firstName, lastName]
      .filter(Boolean)
      .join(" ") ||
    "";

  const selectedFields = {};

  for (const key of selectedKeys) {
    selectedFields[key] =
      fields[key] ?? null;
  }

  return {
    id: String(contact.id),
    name,
    email: contact.email || "",
    phone: contact.phone || "",
    birthDate:
      contact.dateOfBirth ||
      contact.date_of_birth ||
      contact.dob ||
      null,
    dateAdded:
      contact.dateAdded || null,
    fields: selectedFields
  };
}

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

function statusIs(value, target) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[ _-]+/g, " ") === target
  );
}

function buildBirthdayResponse(
  rawContacts,
  fieldDefinitions,
  contactResult
) {
  const contacts = rawContacts.map(
    contact =>
      normalizeContact(
        contact,
        fieldDefinitions,
        BIRTHDAY_FIELD_KEYS
      )
  );

  const birthdayContacts =
    contacts.filter(contact =>
      hasValue(contact.birthDate) ||
      BIRTHDAY_FIELD_KEYS.some(
        key =>
          hasValue(contact.fields[key])
      )
    );

  const clubActive =
    birthdayContacts.filter(contact =>
      statusIs(
        contact.fields.birthday_club_status,
        "active"
      )
    );

  const withJoinDate =
    birthdayContacts.filter(contact =>
      hasValue(
        contact.fields.birthday_club_joined_at
      )
    );

  const campaignsStarted =
    birthdayContacts.filter(contact =>
      hasValue(
        contact.fields.birthday_campaign_started_at
      )
    );

  const clubJoinedNotStarted =
    birthdayContacts.filter(contact =>
      statusIs(
        contact.fields.birthday_campaign_status,
        "active"
      )
    );

  const activeCampaigns =
    birthdayContacts.filter(contact =>
      statusIs(
        contact.fields.birthday_campaign_status,
        "in progress"
      )
    );

  const convertedCampaigns =
    birthdayContacts.filter(contact =>
      statusIs(
        contact.fields.birthday_campaign_status,
        "converted"
      )
    );

  const expiredCampaigns =
    birthdayContacts.filter(contact =>
      statusIs(
        contact.fields.birthday_campaign_status,
        "expired"
      )
    );

  const contactsWithCampaignStatus =
    birthdayContacts.filter(contact =>
      hasValue(
        contact.fields.birthday_campaign_status
      )
    );

  return {
    success: true,
    source: "highlevel_contacts_api",
    mode: "read_only_current_contact_fields",

    metrics: {
      activeClubMembers:
        clubActive.length,

      contactsWithJoinDate:
        withJoinDate.length,

      campaignsStarted:
        campaignsStarted.length,

      activeCampaigns:
        activeCampaigns.length,

      clubJoinedNotStarted:
        clubJoinedNotStarted.length,

      convertedCampaigns:
        convertedCampaigns.length,

      expiredCampaigns:
        expiredCampaigns.length,

      contactsWithCampaignStatus:
        contactsWithCampaignStatus.length,

      contactsWithBirthdayData:
        birthdayContacts.length
    },

    contacts: birthdayContacts,

    diagnostics: {
      contactsFetched:
        contacts.length,

      apiReportedTotal:
        contactResult.reportedTotal,

      pagesFetched:
        contactResult.pagesFetched,

      customFieldDefinitions:
        fieldDefinitions.count,

      birthdayFieldDefinitionsFound:
        BIRTHDAY_FIELD_KEYS.filter(
          key =>
            fieldDefinitions.byKey.has(key)
        ).length,

      birthdayFieldDefinitionsExpected:
        BIRTHDAY_FIELD_KEYS.length,

      partial:
        contactResult.partial,

      calculatedAt:
        new Date().toISOString()
    }
  };
}

function buildWinbackResponse(
  rawContacts,
  fieldDefinitions,
  contactResult
) {
  const contacts = rawContacts.map(
    contact =>
      normalizeContact(
        contact,
        fieldDefinitions,
        WINBACK_FIELD_KEYS
      )
  );

  const winbackContacts =
    contacts.filter(contact =>
      WINBACK_FIELD_KEYS.some(
        key =>
          hasValue(contact.fields[key])
      )
    );

  const eligible =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_eligibility,
        "eligible"
      )
    );

  const mediumTier =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_tier,
        "medium"
      )
    );

  const highTier =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_tier,
        "high"
      )
    );

  const inProgress =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_cycle_status,
        "in progress"
      )
    );

  const completed =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_cycle_status,
        "completed"
      )
    );

  const converted =
    winbackContacts.filter(contact =>
      statusIs(
        contact.fields.winback_cycle_status,
        "converted"
      )
    );

  const contactsWithIntelligence =
    winbackContacts.filter(contact =>
      [
        "typical_order_interval_days",
        "days_since_last_order",
        "expected_next_order_date",
        "days_overdue",
        "overdue_ratio",
        "winback_eligibility",
        "winback_tier"
      ].some(
        key =>
          hasValue(contact.fields[key])
      )
    );

  return {
    success: true,
    source: "highlevel_contacts_api",
    mode: "read_only_current_contact_fields",
    campaign: "winback",

    metrics: {
      eligibleCustomers:
        eligible.length,

      mediumTierCustomers:
        mediumTier.length,

      highTierCustomers:
        highTier.length,

      cyclesInProgress:
        inProgress.length,

      cyclesCompleted:
        completed.length,

      convertedCycles:
        converted.length,

      contactsWithIntelligence:
        contactsWithIntelligence.length,

      contactsWithWinbackData:
        winbackContacts.length
    },

    contacts: winbackContacts,

    diagnostics: {
      contactsFetched:
        contacts.length,

      apiReportedTotal:
        contactResult.reportedTotal,

      pagesFetched:
        contactResult.pagesFetched,

      customFieldDefinitions:
        fieldDefinitions.count,

      winbackFieldDefinitionsFound:
        WINBACK_FIELD_KEYS.filter(
          key =>
            fieldDefinitions.byKey.has(key)
        ).length,

      winbackFieldDefinitionsExpected:
        WINBACK_FIELD_KEYS.length,

      missingWinbackFieldKeys:
        WINBACK_FIELD_KEYS.filter(
          key =>
            !fieldDefinitions.byKey.has(key)
        ),

      partial:
        contactResult.partial,

      calculatedAt:
        new Date().toISOString()
    }
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
      error: "Method not allowed"
    });
  }

  const campaign = String(
    req.query?.campaign || "birthday"
  )
    .trim()
    .toLowerCase();

  if (
    !["birthday", "winback"].includes(
      campaign
    )
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Unsupported campaign. Use campaign=birthday or campaign=winback."
    });
  }

  try {
    const restaurant =
      getRestaurantConnection(req);

    const [
      fieldDefinitions,
      contactResult
    ] = await Promise.all([
      fetchFieldDefinitions(restaurant),
      fetchAllContacts(restaurant)
    ]);

    const response =
      campaign === "winback"
        ? buildWinbackResponse(
            contactResult.contacts,
            fieldDefinitions,
            contactResult
          )
        : buildBirthdayResponse(
            contactResult.contacts,
            fieldDefinitions,
            contactResult
          );

    return res.status(200).json(response);
  } catch (error) {
    console.error(
      `${campaign} campaign API failed:`,
      error.message
    );

    return res.status(500).json({
      success: false,
      error:
        `Unable to retrieve ${
          campaign === "winback"
            ? "Win-Back"
            : "Birthday"
        } campaign data from HighLevel`
    });
  }
}
