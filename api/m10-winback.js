const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const WORKFLOW_API_VERSION = "v3";
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;
const BUSINESS_TIMEZONE = "Africa/Cairo";
const M10_WORKFLOW_ID =
  "9da63be7-ddb1-4cc5-ba8c-c467eaadebaa";
const { getRestaurantConnection } = require("./restaurant.js");
async function ghlGet(urlOrPath, apiKey) {
  if (!apiKey) {
    throw new Error("Missing GHL API key.");
  }
  const url =
    urlOrPath instanceof URL
      ? urlOrPath
      : new URL(urlOrPath, GHL_BASE_URL);
  if (url.origin !== GHL_BASE_URL) {
    throw new Error("Unexpected HighLevel API host.");
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(
      REQUEST_TIMEOUT_MS
    ),
  });
  if (!response.ok) {
    throw new Error(
      `HighLevel API request failed (${response.status})`
    );
  }
  return response.json();
}
async function addContactToWorkflow(
  contactId,
  workflowId,
  restaurant
) {
  if (!contactId) {
    throw new Error(
      "Missing contactId for workflow enrollment."
    );
  }
  if (!workflowId) {
    throw new Error(
      "Missing workflowId for workflow enrollment."
    );
  }
  const url = new URL(
    `/contacts/${encodeURIComponent(
      contactId
    )}/workflow/${encodeURIComponent(
      workflowId
    )}`,
    GHL_BASE_URL
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restaurant.apiKey}`,
      Version: WORKFLOW_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      eventStartTime:
        new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(
      REQUEST_TIMEOUT_MS
    ),
  });
  const responseText =
    await response.text();
  let data = null;
  try {
    data = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    data = {
      raw: responseText,
    };
  }
  if (!response.ok) {
    throw new Error(
      `HighLevel workflow enrollment failed (${response.status}): ${responseText}`
    );
  }
  return data;
}
function getBusinessDateString(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    return null;
  }
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
  const parts =
    formatter.formatToParts(date);
  const result = {};
  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day"
    ) {
      result[part.type] = part.value;
    }
  }
  if (
    !result.year ||
    !result.month ||
    !result.day
  ) {
    return null;
  }
  return `${result.year}-${result.month}-${result.day}`;
}
function businessDateToCalendarUTC(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }
  const date = new Date(
    `${value}T00:00:00Z`
  );
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
function calendarDayDifference(
  currentDate,
  previousDate
) {
  const current =
    businessDateToCalendarUTC(currentDate);
  const previous =
    businessDateToCalendarUTC(previousDate);
  if (!current || !previous) {
    return null;
  }
  return Math.floor(
    (current.getTime() -
      previous.getTime()) /
      86400000
  );
}
/*
 * HighLevel Date fields may arrive as:
 *
 * - Unix milliseconds
 * - Numeric strings containing Unix milliseconds
 * - YYYY-MM-DD
 * - ISO datetime strings
 *
 * Normalize all supported forms into:
 *
 * YYYY-MM-DD
 *
 * using the restaurant business timezone.
 */
function normalizeBusinessDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return getBusinessDateString(date);
  }
  const stringValue =
    String(value).trim();
  /*
   * Numeric Unix timestamp returned as a string.
   */
  if (/^\d+$/.test(stringValue)) {
    const numericValue =
      Number(stringValue);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    const date = new Date(
      numericValue
    );
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return getBusinessDateString(date);
  }
  /*
   * Date-only value.
   * Preserve the calendar date exactly.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      stringValue
    )
  ) {
    return stringValue;
  }
  /*
   * ISO / datetime value.
   */
  const date = new Date(
    stringValue
  );
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return getBusinessDateString(date);
}
async function fetchFieldDefinitions(
  restaurant
) {
  const url = new URL(
    `/locations/${restaurant.locationId}/customFields`,
    GHL_BASE_URL
  );
  const data = await ghlGet(
    url,
    restaurant.apiKey
  );
  if (
    !Array.isArray(data.customFields)
  ) {
    throw new Error(
      "Unexpected Custom Fields API response."
    );
  }
  const map = new Map();
  for (
    const field of data.customFields
  ) {
    if (
      !field ||
      !field.id ||
      !field.fieldKey
    ) {
      continue;
    }
    const normalizedKey =
      String(field.fieldKey).replace(
        /^contact\./,
        ""
      );
    map.set(
      field.id,
      normalizedKey
    );
  }
  return map;
}
async function fetchAllContacts(
  restaurant
) {
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
  let pagesFetched = 0;
  let reportedTotal = null;
  let partial = false;
  while (
    nextUrl &&
    pagesFetched < MAX_PAGES
  ) {
    pagesFetched += 1;
    const data = await ghlGet(
      nextUrl,
      restaurant.apiKey
    );
    if (
      !Array.isArray(data.contacts)
    ) {
      throw new Error(
        "Unexpected Contacts API response."
      );
    }
    const meta = data.meta || {};
    if (
      reportedTotal === null &&
      Number.isFinite(
        Number(meta.total)
      )
    ) {
      reportedTotal =
        Number(meta.total);
    }
    for (
      const contact of data.contacts
    ) {
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
      contacts.length >=
        reportedTotal
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
      candidate.origin !==
        GHL_BASE_URL ||
      !candidate.pathname.startsWith(
        "/contacts"
      )
    ) {
      throw new Error(
        "HighLevel returned an unexpected contacts pagination URL."
      );
    }
    if (
      candidate.href ===
      nextUrl.href
    ) {
      break;
    }
    nextUrl = candidate;
  }
  if (
    reportedTotal !== null &&
    contacts.length <
      reportedTotal
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
function extractFields(
  contact,
  fieldMap
) {
  const fields = {};
  const customFields =
    Array.isArray(
      contact.customFields
    )
      ? contact.customFields
      : [];
  for (
    const field of customFields
  ) {
    if (
      !field ||
      !field.id
    ) {
      continue;
    }
    const key =
      fieldMap.get(field.id);
    if (key) {
      fields[key] =
        field.value ?? null;
    }
  }
  return fields;
}
function calculateM10(fields) {
  const totalOrders =
    Number(fields.total_orders);
  const lastOrderDate =
    fields.last_order_date ||
    null;
  const typicalOrderIntervalDays =
    Number(
      fields.typical_order_interval_days
    );
  const todayBusinessDate =
    getBusinessDateString(
      new Date()
    );
  let daysSinceLastOrder =
    null;
  if (
    lastOrderDate !== null &&
    lastOrderDate !== undefined &&
    todayBusinessDate
  ) {
    const normalizedLastOrderDate =
      normalizeBusinessDate(
        lastOrderDate
      );
    const difference =
      normalizedLastOrderDate
        ? calendarDayDifference(
            todayBusinessDate,
            normalizedLastOrderDate
          )
        : null;
    if (difference !== null) {
      daysSinceLastOrder =
        Math.max(0, difference);
    }
  }
  let orderCycleRatio = null;
  if (
    daysSinceLastOrder !== null &&
    Number.isFinite(
      typicalOrderIntervalDays
    ) &&
    typicalOrderIntervalDays > 0
  ) {
    orderCycleRatio =
      daysSinceLastOrder /
      typicalOrderIntervalDays;
    orderCycleRatio =
      Math.round(
        (orderCycleRatio +
          Number.EPSILON) *
          100
      ) / 100;
  }
  const eligible =
    Number.isFinite(totalOrders) &&
    totalOrders >= 3 &&
    daysSinceLastOrder !== null &&
    daysSinceLastOrder >= 21 &&
    Number.isFinite(
      typicalOrderIntervalDays
    ) &&
    typicalOrderIntervalDays > 0 &&
    orderCycleRatio !== null &&
    orderCycleRatio >= 1.5;
  let winBackTier = "None";
  if (eligible) {
    if (
      orderCycleRatio >= 2
    ) {
      winBackTier = "High";
    } else {
      winBackTier = "Medium";
    }
  }
  return {
    totalOrders:
      Number.isFinite(totalOrders)
        ? totalOrders
        : null,
    lastOrderDate,
    typicalOrderIntervalDays:
      Number.isFinite(
        typicalOrderIntervalDays
      )
        ? typicalOrderIntervalDays
        : null,
    todayBusinessDate,
    daysSinceLastOrder,
    orderCycleRatio,
    winBackEligibility:
      eligible
        ? "Eligible"
        : "Not Eligible",
    winBackTier,
  };
}
function getContactName(
  contact
) {
  return (
    contact.contactName ||
    [
      contact.firstName,
      contact.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    contact.email ||
    contact.phone ||
    contact.id
  );
}
export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );
  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }
  try {
    /*
     * Security:
     * Vercel Deployment Protection is used
     * through the x-vercel-protection-bypass
     * header.
     *
     * HighLevel must send:
     *
     * X-RX-RESTAURANT: <locationId>
     */
    const restaurantLocationId =
      req.headers[
        "x-rx-restaurant"
      ];
    if (
      typeof restaurantLocationId !==
        "string" ||
      !restaurantLocationId.trim()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "X-RX-RESTAURANT header is required.",
      });
    }
    /*
     * Default mode is ALWAYS read_only.
     *
     * Only an explicit:
     *
     * { "mode": "write" }
     *
     * enables workflow enrollment.
     */
    const requestedMode =
      req.body &&
      typeof req.body === "object" &&
      req.body.mode === "write"
        ? "write"
        : "read_only";
    /*
     * Reuse the existing restaurant
     * routing layer.
     *
     * No Dashboard files are changed.
     */
    const restaurant =
      getRestaurantConnection({
        headers: {
          "x-rx-restaurant":
            restaurantLocationId.trim(),
        },
      });
    const [
      fieldMap,
      contactResult,
    ] = await Promise.all([
      fetchFieldDefinitions(
        restaurant
      ),
      fetchAllContacts(
        restaurant
      ),
    ]);
    const eligible = [];
    const notEligible = [];
    const inProgress = [];
    /*
     * Enrollment results are kept separate
     * from the calculation results.
     */
    const enrollmentResults = [];
    for (
      const contact of
        contactResult.contacts
    ) {
      const fields =
        extractFields(
          contact,
          fieldMap
        );
      const cycleStatus =
        fields.winback_cycle_status ??
        fields.win_back_cycle_status ??
        null;
      /*
       * Never interfere with
       * an active M10 cycle.
       */
      if (
        String(
          cycleStatus || ""
        ).trim() ===
        "In Progress"
      ) {
        inProgress.push({
          id: contact.id,
          name:
            getContactName(
              contact
            ),
          cycleStatus,
        });
        continue;
      }
      const result =
        calculateM10(
          fields
        );
      const record = {
        id: contact.id,
        name:
          getContactName(
            contact
          ),
        email:
          contact.email || "",
        phone:
          contact.phone || "",
        ...result,
      };
      if (
        result.winBackEligibility ===
        "Eligible"
      ) {
        eligible.push(
          record
        );
      } else {
        notEligible.push(
          record
        );
      }
    }
    /*
     * WRITE MODE
     *
     * Only explicitly requested by:
     *
     * { "mode": "write" }
     *
     * At this stage the only write operation
     * is adding Eligible Contacts to the
     * existing M10 workflow.
     *
     * Enrollment is intentionally sequential
     * for safer first-write testing and clearer
     * diagnostics.
     */
    if (
      requestedMode ===
      "write"
    ) {
      for (
        const contact of
          eligible
      ) {
        try {
          const workflowResponse =
            await addContactToWorkflow(
              contact.id,
              M10_WORKFLOW_ID,
              restaurant
            );
          enrollmentResults.push({
            id: contact.id,
            name:
              contact.name,
            status:
              "enrolled",
            workflowResponse,
          });
        } catch (
          error
        ) {
          enrollmentResults.push({
            id: contact.id,
            name:
              contact.name,
            status:
              "failed",
            error:
              error.message ||
              "Unable to add contact to workflow.",
          });
        }
      }
    }
    return res.status(200).json({
      success: true,
      mode: "read_only",
      restaurant: {
        id:
          restaurant.restaurantId,
        name:
          restaurant.restaurantName,
        locationId:
          restaurant.locationId,
      },
      workflow: {
        id:
          M10_WORKFLOW_ID,
        name:
          "ROS | M10 | WIN-BACK | Customer Reactivation",
      },
      calculation: {
        timezone:
          BUSINESS_TIMEZONE,
        minimumOrders: 3,
        minimumDaysSinceLastOrder:
          21,
        minimumCycleRatio:
          1.5,
      },
      summary: {
        contactsFetched:
          contactResult
            .contacts
            .length,
        apiReportedTotal:
          contactResult
            .reportedTotal,
        pagesFetched:
          contactResult
            .pagesFetched,
        partial:
          contactResult
            .partial,
        eligible:
          eligible.length,
        notEligible:
          notEligible.length,
        inProgress:
          inProgress.length,
        enrolled:
          enrollmentResults.filter(
            (item) =>
              item.status ===
              "enrolled"
          ).length,
        enrollmentFailed:
          enrollmentResults.filter(
            (item) =>
              item.status ===
              "failed"
          ).length,
      },
      eligible,
      notEligible,
      inProgress,
      enrollmentMode:
        requestedMode,
      enrollmentResults,
      diagnostics: {
        calculatedAt:
          new Date().toISOString(),
      },
    });
  } catch (
    error
  ) {
    console.error(
      "M10 Win-Back API failed:",
      error
    );
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to calculate M10 Win-Back eligibility.",
    });
  }
}
