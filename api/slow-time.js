const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "v3";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";
const OBJECT_KEY = "custom_objects.slow_time_campaigns";
const OBJECT_ID = "6ac233e9d65f09dff80b81a6";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * Custom fields belonging to the Slow-Time Campaign object.
 */
const FIELD_KEYS = {
  campaignName: "campaign_name",
  ordersGenerated: "orders_generated",
  revenueGenerated: "revenue_generated",
  campaignStatus: "campaign_status",
  discountCost: "discount_cost",
  redemptionCount: "redemption_count",
  conversionRate: "conversion_rate",
  lastActivatedAt: "last_activated_at",
  startDateTime: "start_datetime",
  endDateTime: "end_datetime",
};

/**
 * Check whether a value exists.
 *
 * Zero is a valid value and must not be treated as missing.
 */
function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

/**
 * Convert a HighLevel field value to a number.
 *
 * Supports:
 * 1. Ordinary numbers: 16
 * 2. Numeric strings: "1158"
 * 3. Currency strings: "EGP 1158"
 * 4. Monetary objects: { currency: "default", value: 1158 }
 *
 * Missing or invalid values return null.
 */
function parseNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  // Ordinary numeric values.
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  // HighLevel Monetary fields may be objects.
  if (typeof value === "object" && value !== null) {
    if (
      !Object.prototype.hasOwnProperty.call(value, "value")
    ) {
      return null;
    }

    return parseNumber(value.value);
  }

  // Numeric strings and formatted currency strings.
  const cleaned = String(value)
    .replace(/[, EGP£$]/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

/**
 * Return the properties container from a custom object record.
 *
 * The API may expose record values under different containers.
 */
function getProperties(record) {
  return (
    record?.properties ||
    record?.fieldValues ||
    record?.fields ||
    {}
  );
}

/**
 * Normalize one Slow-Time Campaign record.
 *
 * Reads the expected field keys from the record properties
 * and preserves missing values as null.
 */
function normalizeRecord(record) {
  const properties = getProperties(record);
  const raw = {};

  for (const [outputKey, fieldKey] of Object.entries(FIELD_KEYS)) {
    const qualifiedKey = `${OBJECT_KEY}.${fieldKey}`;

    if (
      Object.prototype.hasOwnProperty.call(
        properties,
        fieldKey
      )
    ) {
      raw[outputKey] = properties[fieldKey];
    } else if (
      Object.prototype.hasOwnProperty.call(
        properties,
        qualifiedKey
      )
    ) {
      raw[outputKey] = properties[qualifiedKey];
    } else {
      raw[outputKey] = null;
    }
  }

  const normalized = {
    id: String(record?.id || record?._id || ""),

    campaignName: hasValue(raw.campaignName)
      ? String(raw.campaignName).trim()
      : "",

    campaignStatus: hasValue(raw.campaignStatus)
      ? String(raw.campaignStatus).trim()
      : null,

    startDateTime: hasValue(raw.startDateTime)
      ? raw.startDateTime
      : null,

    endDateTime: hasValue(raw.endDateTime)
      ? raw.endDateTime
      : null,

    lastActivatedAt: hasValue(raw.lastActivatedAt)
      ? raw.lastActivatedAt
      : null,

    ordersGenerated: parseNumber(raw.ordersGenerated),

    revenueGenerated: parseNumber(raw.revenueGenerated),

    discountCost: parseNumber(raw.discountCost),

    redemptionCount: parseNumber(raw.redemptionCount),

    conversionRate: parseNumber(raw.conversionRate),

    dataQuality: {},
  };

  // Record whether each expected field contains a value.
  for (const key of Object.keys(FIELD_KEYS)) {
    normalized.dataQuality[`${key}Recorded`] =
      hasValue(raw[key]);
  }

  return normalized;
}

/**
 * Search one page of Slow-Time Campaign records.
 */
async function ghlSearchRecords(page) {
  const token = process.env.GHL_API_KEY;

  if (!token) {
    throw new Error("GHL_API_KEY is not configured");
  }

  const url =
    `${GHL_BASE_URL}/objects/${OBJECT_KEY}/records/search`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify({
      locationId: LOCATION_ID,
      page,
      pageLimit: PAGE_SIZE,
      query: "",
    }),

    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.error(
      "HighLevel Slow-Time records request failed",
      {
        endpoint: `/objects/${OBJECT_KEY}/records/search`,
        status: response.status,
        page,
      }
    );

    throw new Error(
      `HighLevel Slow-Time API request failed (${response.status})`
    );
  }

  return response.json();
}

/**
 * Fetch all available campaign records.
 *
 * Supports pagination and ignores duplicate records.
 */
async function fetchAllCampaignRecords() {
  const records = [];
  const seenIds = new Set();

  let reportedTotal = null;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await ghlSearchRecords(page);

    pagesFetched++;

    if (!Array.isArray(result.records)) {
      throw new Error(
        "Unexpected Slow-Time records API response"
      );
    }

    const total = Number(result.total);

    if (
      reportedTotal === null &&
      Number.isFinite(total) &&
      total >= 0
    ) {
      reportedTotal = total;
    }

    for (const record of result.records) {
      const id = record?.id || record?._id;

      const dedupeKey = id
        ? String(id)
        : JSON.stringify(record);

      if (seenIds.has(dedupeKey)) {
        continue;
      }

      seenIds.add(dedupeKey);
      records.push(record);
    }

    // No more records.
    if (result.records.length === 0) {
      break;
    }

    // All reported records have been fetched.
    if (
      reportedTotal !== null &&
      records.length >= reportedTotal
    ) {
      break;
    }

    // A short page indicates the end of pagination.
    if (result.records.length < PAGE_SIZE) {
      break;
    }

    if (page === MAX_PAGES) {
      throw new Error(
        "Slow-Time campaign pagination limit exceeded"
      );
    }
  }

  return {
    records,
    reportedTotal: reportedTotal ?? records.length,
    pagesFetched,

    partial:
      reportedTotal !== null &&
      records.length < reportedTotal,
  };
}

/**
 * Sum known numeric values while preserving data-quality counts.
 *
 * Missing values are excluded from the sum rather than treated
 * as actual zero values.
 */
function sumKnownValues(records, key) {
  const known = records
    .map(record => record[key])
    .filter(
      value =>
        typeof value === "number" &&
        Number.isFinite(value)
    );

  return {
    value: Number(
      known
        .reduce((sum, value) => sum + value, 0)
        .toFixed(2)
    ),

    recordsIncluded: known.length,

    recordsMissingValue:
      records.length - known.length,
  };
}

/**
 * Build the read-only API response.
 */
function buildResponse(fetched) {
  const campaigns = fetched.records.map(normalizeRecord);

  /**
   * Count campaigns by status, case-insensitively.
   */
  const countStatus = target =>
    campaigns.filter(
      campaign =>
        String(campaign.campaignStatus || "")
          .trim()
          .toLowerCase() === target
    ).length;

  /**
   * Count records by their recorded status.
   */
  const statusCounts = {};

  for (const campaign of campaigns) {
    const status =
      campaign.campaignStatus || "Not recorded";

    statusCounts[status] =
      (statusCounts[status] || 0) + 1;
  }

  /**
   * Count how many campaigns contain each expected field.
   */
  const fieldPopulation = {};

  for (const field of Object.keys(FIELD_KEYS)) {
    fieldPopulation[field] = campaigns.filter(
      campaign =>
        campaign.dataQuality[`${field}Recorded`]
    ).length;
  }

  return {
    success: true,

    source: "highlevel_slow_time_custom_object",

    mode: "read_only_custom_object_records",

    object: {
      key: OBJECT_KEY,
      id: OBJECT_ID,
      name: "Slow-Time Campaign",
    },

    metrics: {
      totalCampaigns: campaigns.length,

      campaignsWithName: campaigns.filter(
        campaign =>
          campaign.dataQuality.campaignNameRecorded
      ).length,

      activeCampaigns: countStatus("active"),

      scheduledCampaigns: countStatus("scheduled"),

      expiredCampaigns: countStatus("expired"),

      completedCampaigns: countStatus("completed"),

      campaignsWithUnrecordedStatus: campaigns.filter(
        campaign =>
          !campaign.dataQuality.campaignStatusRecorded
      ).length,

      ordersGenerated: sumKnownValues(
        campaigns,
        "ordersGenerated"
      ),

      revenueGenerated: sumKnownValues(
        campaigns,
        "revenueGenerated"
      ),

      discountCost: sumKnownValues(
        campaigns,
        "discountCost"
      ),

      redemptionCount: sumKnownValues(
        campaigns,
        "redemptionCount"
      ),

      statusCounts,

      fieldPopulation,
    },

    campaigns,

    diagnostics: {
      recordsFetched: campaigns.length,

      apiReportedTotal: fetched.reportedTotal,

      pagesFetched: fetched.pagesFetched,

      partial: fetched.partial,

      fieldKeysExpected: Object.values(FIELD_KEYS),

      calculatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Vercel serverless function handler.
 *
 * GET only.
 * This endpoint reads campaign records without modifying them.
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const fetched = await fetchAllCampaignRecords();

    return res.status(200).json(
      buildResponse(fetched)
    );
  } catch (error) {
    console.error(
      "Slow-Time API failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "Unable to fetch Slow-Time campaign records",
    });
  }
}
