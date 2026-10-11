const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

function parseDate(value, fieldName) {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return date;
}

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
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.error("HighLevel request failed", {
      endpoint: path,
      status: response.status,
    });

    throw new Error("HighLevel API request failed");
  }

  return response.json();
}

async function fetchAllOrders() {
  const orders = [];
  const seenIds = new Set();

  let offset = 0;
  let totalCount = null;
  let pageCount = 0;

  while (totalCount === null || offset < totalCount) {
    if (++pageCount > MAX_PAGES) {
      throw new Error("Orders pagination limit exceeded");
    }

    const result = await ghlRequest("/payments/orders", {
      locationId: LOCATION_ID,
      altId: LOCATION_ID,
      altType: "location",
      limit: PAGE_SIZE,
      offset,
    });

    if (!Array.isArray(result.data)) {
      throw new Error("Unexpected Orders API response");
    }

    if (!Number.isFinite(result.totalCount)) {
      throw new Error("Orders API totalCount is missing");
    }

    if (totalCount === null) {
      totalCount = result.totalCount;
    }

    const page = result.data;

    for (const order of page) {
      if (!order._id || seenIds.has(order._id)) {
        continue;
      }

      seenIds.add(order._id);
      orders.push(order);
    }

    if (page.length === 0) {
      break;
    }

    offset += page.length;
  }

  return {
    orders,
    reportedTotal: totalCount,
    pagesFetched: pageCount,
  };
}

function calculateMetrics(orders, startDate, endDate) {
  const endExclusive = endDate
    ? new Date(endDate.getTime() + 86400000)
    : null;

  const filteredOrders = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    if (startDate && createdAt < startDate) {
      return false;
    }

    if (endExclusive && createdAt >= endExclusive) {
      return false;
    }

    return true;
  });

  const completedOrders = filteredOrders.filter(
    (order) => order.status === "completed"
  );

  const paidOrders = completedOrders.filter(
    (order) => order.paymentStatus === "paid"
  );

  const unpaidOrders = completedOrders.filter(
    (order) => order.paymentStatus === "unpaid"
  );

  const unknownPaymentOrders = completedOrders.filter(
    (order) =>
      order.paymentStatus !== "paid" &&
      order.paymentStatus !== "unpaid"
  );

  const sumAmount = (items) =>
    Number(
      items
        .reduce((total, order) => {
          const amount = Number(order.amount);

          return total + (
            Number.isFinite(amount) ? amount : 0
          );
        }, 0)
        .toFixed(2)
    );

  return {
    orders: {
      total: completedOrders.length,
      paid: paidOrders.length,
      unpaid: unpaidOrders.length,
      otherPaymentStatus: unknownPaymentOrders.length,
      otherOrderStatuses:
        filteredOrders.length - completedOrders.length,
    },

    orderValue: {
      total: sumAmount(completedOrders),
      paid: sumAmount(paidOrders),
      unpaid: sumAmount(unpaidOrders),
      currency: "EGP",
    },

    dataQuality: {
      ordersInSelectedPeriod: filteredOrders.length,
      completedOrders: completedOrders.length,
      unknownPaymentStatus:
        unknownPaymentOrders.length,
    },
  };
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
    const now = new Date();

    const defaultEndDate = now.toISOString().slice(0, 10);

    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

    const defaultStartDate =
      defaultStart.toISOString().slice(0, 10);

    const requestedStart = req.query.startDate;
    const requestedEnd = req.query.endDate;

    const startDate = parseDate(
      requestedStart || defaultStartDate,
      "startDate"
    );

    const endDate = parseDate(
      requestedEnd || defaultEndDate,
      "endDate"
    );

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate must not be after endDate",
      });
    }

    const { orders, reportedTotal, pagesFetched } =
      await fetchAllOrders();

    const metrics = calculateMetrics(
      orders,
      startDate,
      endDate
    );

    return res.status(200).json({
      success: true,
      source: "highlevel_payments_orders",

      period: {
        startDate: requestedStart || defaultStartDate,
        endDate: requestedEnd || defaultEndDate,
        timezone: "UTC",
      },

      data: {
        ...metrics,
        currency: "EGP",
      },

      diagnostics: {
        ordersFetched: orders.length,
        apiReportedTotal: reportedTotal,
        pagesFetched,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Dashboard API failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Unable to calculate dashboard metrics",
    });
  }
}
