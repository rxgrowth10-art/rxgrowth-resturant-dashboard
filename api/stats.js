const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

async function ghlRequest(path, params = {}) {
  const token = process.env.GHL_API_KEY;

  if (!token) {
    throw new Error("GHL_API_KEY is not configured");
  }

  const url = new URL(`${GHL_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();

    console.error("HighLevel API error:", {
      status: response.status,
      endpoint: path,
    });

    throw new Error(`HighLevel API returned ${response.status}`);
  }

  return response.json();
}

async function fetchAllOrders() {
  const orders = [];
  const limit = 100;
  let offset = 0;
  let totalCount = null;

  while (totalCount === null || offset < totalCount) {
    const result = await ghlRequest("/payments/orders", {
      locationId: LOCATION_ID,
      altId: LOCATION_ID,
      altType: "location",
      limit,
      offset,
    });

    const page = result.data;

    if (!Array.isArray(page)) {
      throw new Error("Unexpected orders API response");
    }

    if (!Number.isFinite(result.totalCount)) {
      throw new Error("Orders API did not return totalCount");
    }

    if (totalCount === null) {
      totalCount = result.totalCount;
    }

    orders.push(...page);

    if (page.length === 0) {
      break;
    }

    offset += page.length;
  }

  return orders;
}

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
    const orders = await fetchAllOrders();

    return res.status(200).json({
      success: true,
      source: "highlevel_payments_orders",
      totalOrdersReturned: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Dashboard API failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve orders from HighLevel",
    });
  }
}
