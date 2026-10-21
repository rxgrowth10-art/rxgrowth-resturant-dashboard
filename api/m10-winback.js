const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const READ_API_VERSION = "2021-07-28";
const WRITE_API_VERSION = "v3";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;

const BUSINESS_TIMEZONE = "Africa/Cairo";

const M10_WORKFLOW_ID =
  "9da63be7-ddb1-4cc5-ba8c-c467eaadebaa";

const { getRestaurantConnection } = require("./restaurant.js");

async function ghlRequest(
  urlOrPath,
  apiKey,
  options = {}
) {
  if (!apiKey) {
    throw new Error("Missing GHL API key.");
  }

  const url =
    urlOrPath instanceof URL
      ? urlOrPath
      : new URL(urlOrPath, GHL_BASE_URL);

  if (url.origin !== GHL_BASE_URL) {
    throw new Error(
      "Unexpected HighLevel API host."
    );
  }

  const method = options.method || "GET";

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version:
      options.version ||
      READ_API_VERSION,
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    signal: AbortSignal.timeout(
      REQUEST_TIMEOUT_MS
    ),
  });

  const responseText =
    await response.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        raw: responseText,
      };
    }
  }

  if (!response.ok) {
    const detail =
      data?.message ||
      data?.error ||
      responseText ||
      "Unknown HighLevel API error.";

    throw new Error(
      `HighLevel API request failed (${response.status}): ${detail}`
    );
  }

  return data;
}

async function ghlGet(
  urlOrPath,
  apiKey
) {
  return ghlRequest(
    urlOrPath,
    apiKey,
    {
      method: "GET",
      version: READ_API_VERSION,
    }
  );
}

async function ghlPut(
  urlOrPath,
  apiKey,
  body
) {
  return ghlRequest(
    urlOrPath,
    apiKey,
    {
      method: "PUT",
      version: WRITE_API_VERSION,
      body,
    }
  );
}

async function ghlPost(
  urlOrPath,
  apiKey,
  body
) {
  return ghlRequest(
    urlOrPath,
    apiKey,
    {
      method: "POST",
      version: WRITE_API_VERSION,
      body,
    }
  );
}

function getBusinessDateString(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  const formatter =
    new Intl.DateTimeFormat(
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
      result[part.type] =
        part.value;
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

function normalizeBusinessDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  /*
   * HighLevel date custom fields may arrive as:
   * - YYYY-MM-DD
   * - ISO date string
   * - Unix milliseconds
   */
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const date = new Date(value);

    return getBusinessDateString(date);
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return null;
  }

  if (
    /^\d+$/.test(stringValue)
  ) {
    const numericValue =
      Number(stringValue);

    /*
     * Support Unix milliseconds.
     */
    if (
      Number.isFinite(numericValue)
    ) {
      const date =
        new Date(numericValue);

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return getBusinessDateString(
          date
        );
      }
    }
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      stringValue
    )
  ) {
    return stringValue;
  }

  const date =
    new Date(stringValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return getBusinessDateString(
    date
  );
}

function businessDateToCalendarUTC(
  value
) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function calendarDayDifference(
  currentDate,
  previousDate
) {
  const current =
    businessDateToCalendarUTC(
      currentDate
    );

  const previous =
    businessDateToCalendarUTC(
      previousDate
    );

  if (!current || !previous) {
    return null;
  }

  return Math.floor(
    (
      current.getTime() -
      previous.getTime()
    ) / 86400000
  );
}

async function fetchFieldDefinitions(
  restaurant
) {
  const url = new URL(
    `/locations/${restaurant.locationId}/customFields`,
    GHL_BASE_URL
  );

  const data =
    await ghlGet(
      url,
      restaurant.apiKey
    );

  if (
    !Array.isArray(
      data.customFields
    )
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
      String(
        field.fieldKey
      ).replace(
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

    const data =
      await ghlGet(
        nextUrl,
        restaurant.apiKey
      );

    if (
      !Array.isArray(
        data.contacts
      )
    ) {
      throw new Error(
        "Unexpected Contacts API response."
      );
    }

    const meta =
      data.meta || {};

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
        seenIds.has(
          contact.id
        )
      ) {
        continue;
      }

      seenIds.add(
        contact.id
      );

      contacts.push(
        contact
      );
    }

    if (
      reportedTotal !== null &&
      contacts.length >=
        reportedTotal
    ) {
      break;
    }

    if (
      !meta.nextPageUrl
    ) {
      break;
    }

    const candidate =
      new URL(
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
      fieldMap.get(
        field.id
      );

    if (key) {
      fields[key] =
        field.value ??
        null;
    }
  }

  return fields;
}

function calculateM10(
  fields
) {
  const totalOrders =
    Number(
      fields.total_orders
    );

  const rawLastOrderDate =
    fields.last_order_date ??
    null;

  const lastOrderDate =
    normalizeBusinessDate(
      rawLastOrderDate
    );

  const typicalOrderIntervalDays =
    Number(
      fields
        .typical_order_interval_days
    );

  const todayBusinessDate =
    getBusinessDateString(
      new Date()
    );

  let daysSinceLastOrder =
    null;

  if (
    lastOrderDate &&
    todayBusinessDate
  ) {
    const difference =
      calendarDayDifference(
        todayBusinessDate,
        lastOrderDate
      );

    if (
      difference !== null
    ) {
      daysSinceLastOrder =
        Math.max(
          0,
          difference
        );
    }
  }

  let orderCycleRatio =
    null;

  if (
    daysSinceLastOrder !==
      null &&
    Number.isFinite(
      typicalOrderIntervalDays
    ) &&
    typicalOrderIntervalDays >
      0
  ) {
    orderCycleRatio =
      daysSinceLastOrder /
      typicalOrderIntervalDays;

    orderCycleRatio =
      Math.round(
        (
          orderCycleRatio +
          Number.EPSILON
        ) * 100
      ) / 100;
  }

  const eligible =
    Number.isFinite(
      totalOrders
    ) &&
    totalOrders >= 3 &&
    daysSinceLastOrder !==
      null &&
    daysSinceLastOrder >= 21 &&
    Number.isFinite(
      typicalOrderIntervalDays
    ) &&
    typicalOrderIntervalDays >
      0 &&
    orderCycleRatio !==
      null &&
    orderCycleRatio >= 1.5;

  let winBackTier =
    "None";

  if (eligible) {
    if (
      orderCycleRatio >= 2
    ) {
      winBackTier =
        "High";
    } else {
      winBackTier =
        "Medium";
    }
  }

  return {
    totalOrders:
      Number.isFinite(
        totalOrders
      )
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

function getFieldIdByKey(
  fieldMap,
  desiredKey
) {
  for (
    const [
      fieldId,
      fieldKey,
    ] of fieldMap.entries()
  ) {
    if (
      fieldKey ===
      desiredKey
    ) {
      return fieldId;
    }
  }

  return null;
}

async function updateM10Fields(
  contact,
  fieldMap,
  result,
  apiKey
) {
  const eligibilityFieldId =
    getFieldIdByKey(
      fieldMap,
      "winback_eligibility"
    );

  const tierFieldId =
    getFieldIdByKey(
      fieldMap,
      "winback_tier"
    );

  if (
    !eligibilityFieldId
  ) {
    throw new Error(
      "Custom field 'winback_eligibility' was not found."
    );
  }

  if (!tierFieldId) {
    throw new Error(
      "Custom field 'winback_tier' was not found."
    );
  }

  const customFields = [
    {
      id: eligibilityFieldId,
      fieldValue:
        result.winBackEligibility,
    },
    {
      id: tierFieldId,
      fieldValue:
        result.winBackTier,
    },
  ];

  const url = new URL(
    `/contacts/${contact.id}`,
    GHL_BASE_URL
  );

  const response =
    await ghlPut(
      url,
      apiKey,
      {
        customFields,
      }
    );

  return {
    succeeded:
      response?.succeeded === true,
    response,
  };
}

async function addContactToM10Workflow(
  contactId,
  apiKey
) {
  const url = new URL(
    `/contacts/${contactId}/workflow/${M10_WORKFLOW_ID}`,
    GHL_BASE_URL
  );

  const response =
    await ghlPost(
      url,
      apiKey,
      {
        eventStartTime:
          new Date().toISOString(),
      }
    );

  return {
    succeeded:
      response?.succeeded === true,
    response,
  };
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      success: false,
      error:
        "Method not allowed",
    });
  }

  try {
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

    const restaurant =
      getRestaurantConnection({
        headers: {
          "x-rx-restaurant":
            restaurantLocationId.trim(),
        },
      });

    const mode =
      req.body?.mode ||
      "read_only";

    if (
      mode !== "read_only" &&
      mode !== "write"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid mode. Use read_only or write.",
      });
    }

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
    const writeResults = [];

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
       * Never interfere with an active M10 cycle.
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

        /*
         * WRITE MODE
         *
         * 1. Update Win-Back Eligibility
         * 2. Update Win-Back Tier
         * 3. Directly enroll contact into M10
         */
        if (
          mode === "write"
        ) {
          const writeRecord = {
            id: contact.id,
            name:
              getContactName(
                contact
              ),
            eligibilityUpdated:
              false,
            workflowEnrollment:
              false,
            status:
              "pending",
          };

          try {
            const updateResult =
              await updateM10Fields(
                contact,
                fieldMap,
                result,
                restaurant.apiKey
              );

            writeRecord.eligibilityUpdated =
              updateResult.succeeded;

            /*
             * Only enroll after the field update succeeds.
             */
            if (
              updateResult.succeeded
            ) {
              const workflowResult =
                await addContactToM10Workflow(
                  contact.id,
                  restaurant.apiKey
                );

              writeRecord.workflowEnrollment =
                workflowResult.succeeded;

              writeRecord.status =
                workflowResult.succeeded
                  ? "success"
                  : "workflow_enrollment_failed";
            } else {
              writeRecord.status =
                "field_update_failed";
            }
          } catch (writeError) {
            writeRecord.status =
              "failed";

            writeRecord.error =
              writeError.message;
          }

          writeResults.push(
            writeRecord
          );
        }
      } else {
        notEligible.push(
          record
        );
      }
    }

    return res.status(200).json({
      success: true,

      mode,

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
        minimumDaysSinceLastOrder: 21,
        minimumCycleRatio: 1.5,
      },

      summary: {
        contactsFetched:
          contactResult.contacts.length,

        apiReportedTotal:
          contactResult.reportedTotal,

        pagesFetched:
          contactResult.pagesFetched,

        partial:
          contactResult.partial,

        eligible:
          eligible.length,

        notEligible:
          notEligible.length,

        inProgress:
          inProgress.length,

        writeAttempted:
          mode === "write"
            ? writeResults.length
            : 0,

        writeSucceeded:
          mode === "write"
            ? writeResults.filter(
                (item) =>
                  item.status ===
                  "success"
              ).length
            : 0,

        writeFailed:
          mode === "write"
            ? writeResults.filter(
                (item) =>
                  item.status !==
                  "success"
              ).length
            : 0,
      },

      eligible,

      inProgress,

      ...(mode === "write"
        ? {
            writeResults,
          }
        : {}),

      diagnostics: {
        calculatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
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
