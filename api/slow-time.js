const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "v3";
const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";
const OBJECT_KEY = "custom_objects.slow_time_campaigns";
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

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

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function parseNumber(value) {
  if (!hasValue(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[, EGP£$]/g, "").trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function getProperties(record) {
  return record?.properties || record?.fieldValues || record?.fields || {};
}

function normalizeRecord(record) {
  const properties = getProperties(record);
  const raw = {};

  for (const [outputKey, fieldKey] of Object.entries(FIELD_KEYS)) {
    const qualifiedKey = `${OBJECT_KEY}.${fieldKey}`;
    raw[outputKey] = Object.prototype.hasOwnProperty.call(properties, fieldKey)
      ? properties[fieldKey]
      : Object.prototype.hasOwnProperty.call(properties, qualifiedKey)
        ? properties[qualifiedKey]
        : null;
  }

  const normalized = {
    id: String(record?.id || record?._id || ""),
    campaignName: hasValue(raw.campaignName) ? String(raw.campaignName).trim() : "",
    campaignStatus: hasValue(raw.campaignStatus) ? String(raw.campaignStatus).trim() : null,
    startDateTime: hasValue(raw.startDateTime) ? raw.startDateTime : null,
    endDateTime: hasValue(raw.endDateTime) ? raw.endDateTime : null,
    lastActivatedAt: hasValue(raw.lastActivatedAt) ? raw.lastActivatedAt : null,
    ordersGenerated: parseNumber(raw.ordersGenerated),
    revenueGenerated: parseNumber(raw.revenueGenerated),
    discountCost: parseNumber(raw.discountCost),
    redemptionCount: parseNumber(raw.redemptionCount),
    conversionRate: parseNumber(raw.conversionRate),
    dataQuality: {},
  };

  for (const key of Object.keys(FIELD_KEYS)) {
    normalized.dataQuality[`${key}Recorded`] = hasValue(raw[key]);
  }
  return normalized;
}

async function ghlSearchRecords(page) {
  const token = process.env.GHL_API_KEY;
  if (!token) throw new Error("GHL_API_KEY is not configured");

  const url = `${GHL_BASE_URL}/objects/${OBJECT_KEY}/records/search`;
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
    console.error("HighLevel Slow-Time records request failed", {
      endpoint: `/objects/${OBJECT_KEY}/records/search`,
      status: response.status,
      page,
    });
    throw new Error(`HighLevel Slow-Time API request failed (${response.status})`);
  }
  return response.json();
}

async function fetchAllCampaignRecords() {
  const records = [];
  const seenIds = new Set();
  let reportedTotal = null;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await ghlSearchRecords(page);
    if (page === 1 && result.records?.length) {
  const samples = result.records.slice(0, 5).map(record => {
    const properties = getProperties(record);

    return {
      id: record.id || record._id,
      propertyKeys: Object.keys(properties),
      properties,
    };
  });

  console.log(
    "SLOW_TIME_RAW_RECORD_SAMPLES:",
    JSON.stringify(samples, null, 2)
  );
}
    pagesFetched++;

    if (!Array.isArray(result.records)) {
      throw new Error("Unexpected Slow-Time records API response");
    }

    const total = Number(result.total);
    if (reportedTotal === null && Number.isFinite(total) && total >= 0) {
      reportedTotal = total;
    }

    for (const record of result.records) {
      const id = record?.id || record?._id;
      const dedupeKey = id ? String(id) : JSON.stringify(record);
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      records.push(record);
    }

    if (result.records.length === 0) break;
    if (reportedTotal !== null && records.length >= reportedTotal) break;
    if (result.records.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) throw new Error("Slow-Time campaign pagination limit exceeded");
  }

  return {
    records,
    reportedTotal: reportedTotal ?? records.length,
    pagesFetched,
    partial: reportedTotal !== null && records.length < reportedTotal,
  };
}

function sumKnownValues(records, key) {
  const known = records.map(record => record[key])
    .filter(value => typeof value === "number" && Number.isFinite(value));
  return {
    value: Number(known.reduce((sum, value) => sum + value, 0).toFixed(2)),
    recordsIncluded: known.length,
    recordsMissingValue: records.length - known.length,
  };
}

function buildResponse(fetched) {
  const campaigns = fetched.records.map(normalizeRecord);
  const countStatus = target => campaigns.filter(
    campaign => String(campaign.campaignStatus || "").trim().toLowerCase() === target
  ).length;

  const statusCounts = {};
  for (const campaign of campaigns) {
    const status = campaign.campaignStatus || "Not recorded";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const fieldPopulation = {};
  for (const field of Object.keys(FIELD_KEYS)) {
    fieldPopulation[field] = campaigns.filter(
      campaign => campaign.dataQuality[`${field}Recorded`]
    ).length;
  }

  return {
    success: true,
    source: "highlevel_slow_time_custom_object",
    mode: "read_only_custom_object_records",
    object: {
      key: OBJECT_KEY,
      id: "6ac233e9d65f09dff80b81a6",
      name: "Slow-Time Campaign",
    },
    metrics: {
      totalCampaigns: campaigns.length,
      campaignsWithName: campaigns.filter(c => c.dataQuality.campaignNameRecorded).length,
      activeCampaigns: countStatus("active"),
      scheduledCampaigns: countStatus("scheduled"),
      expiredCampaigns: countStatus("expired"),
      completedCampaigns: countStatus("completed"),
      campaignsWithUnrecordedStatus: campaigns.filter(c => !c.dataQuality.campaignStatusRecorded).length,
      ordersGenerated: sumKnownValues(campaigns, "ordersGenerated"),
      revenueGenerated: sumKnownValues(campaigns, "revenueGenerated"),
      discountCost: sumKnownValues(campaigns, "discountCost"),
      redemptionCount: sumKnownValues(campaigns, "redemptionCount"),
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const fetched = await fetchAllCampaignRecords();
    return res.status(200).json(buildResponse(fetched));
  } catch (error) {
    console.error("Slow-Time API failed:", error.message);
    return res.status(500).json({
      success: false,
      error: "Unable to fetch Slow-Time campaign records",
    });
  }
}
