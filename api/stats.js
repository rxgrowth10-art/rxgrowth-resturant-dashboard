const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validate a YYYY-MM-DD date and parse it as UTC midnight.
 */
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

/**
 * Send an authenticated request to HighLevel.
 */
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

/**
 * Fetch all available orders using pagination.
 * Duplicate order IDs are ignored.
 */
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

    for (const order of result.data) {
      if (!order._id || seenIds.has(order._id)) {
        continue;
      }

      seenIds.add(order._id);
      orders.push(order);
    }

    if (result.data.length === 0) {
      break;
    }

    offset += result.data.length;
  }

  return {
    orders,
    reportedTotal: totalCount,
    pagesFetched: pageCount,
  };
}

/**
 * Parse an order's creation timestamp.
 */
function getValidCreatedAt(order) {
  if (!order.createdAt) return null;

  const date = new Date(order.createdAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Return orders with completed status.
 */
function getCompletedOrders(orders) {
  return orders.filter(
    (order) => order.status === "completed"
  );
}

/**
 * Sum order amounts safely.
 */
function sumAmount(orders) {
  return Number(
    orders
      .reduce((total, order) => {
        const amount = Number(order.amount);

        return (
          total +
          (Number.isFinite(amount) ? amount : 0)
        );
      }, 0)
      .toFixed(2)
  );
}

/**
 * Calculate order and customer analytics.
 *
 * Customer behavior metrics use completed orders.
 * Historical comparisons use all available fetched orders.
 */
function calculateMetrics(orders, startDate, endDate) {
  const endExclusive = new Date(
    endDate.getTime() + DAY_MS
  );

  const validDatedOrders = orders
    .map((order) => ({
      order,
      createdAt: getValidCreatedAt(order),
    }))
    .filter((entry) => entry.createdAt !== null);

  // Orders created inside the selected date range.
  const filteredEntries = validDatedOrders.filter(
    ({ createdAt }) =>
      createdAt >= startDate &&
      createdAt < endExclusive
  );

  const filteredOrders = filteredEntries.map(
    ({ order }) => order
  );

  const completedOrders = getCompletedOrders(
    filteredOrders
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

  // ----------------------------------------
  // 1. ORDER ANALYTICS
  // ----------------------------------------

  const orderMetrics = {
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

  // ----------------------------------------
  // 2. CUSTOMER ANALYTICS
  // ----------------------------------------

  const allCompletedEntries = validDatedOrders.filter(
    ({ order }) => order.status === "completed"
  );

  /*
   * Store order history for each customer.
   *
   * totalOrders:
   * All completed orders available for this customer.
   *
   * ordersInPeriod:
   * Completed orders within the selected period.
   *
   * firstOrderAt:
   * Earliest completed order available in the dataset.
   */
  const customerHistory = new Map();

  for (const { order, createdAt } of allCompletedEntries) {
    if (!order.contactId) continue;

    if (!customerHistory.has(order.contactId)) {
      customerHistory.set(order.contactId, {
        firstOrderAt: createdAt,
        ordersInPeriod: 0,
        totalOrders: 0,
      });
    }

    const customer = customerHistory.get(order.contactId);

    customer.totalOrders += 1;

    if (
      createdAt >= startDate &&
      createdAt < endExclusive
    ) {
      customer.ordersInPeriod += 1;
    }

    if (createdAt < customer.firstOrderAt) {
      customer.firstOrderAt = createdAt;
    }
  }

  let activeCustomers = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let repeatBuyers = 0;
  let activeCustomerOrderCount = 0;

  for (const customer of customerHistory.values()) {
    // Customers must have at least one completed order
    // within the selected period to be active.
    if (customer.ordersInPeriod === 0) continue;

    activeCustomers += 1;

    activeCustomerOrderCount += customer.ordersInPeriod;

    /*
     * A customer is returning if they have at least one
     * completed order before another completed order.
     *
     * This includes previous orders inside the selected
     * period or before the selected period.
     */
        const hasPreviousOrder =
      customer.totalOrders > 1;

    if (hasPreviousOrder) {
      returningCustomers += 1;
    } else {
      newCustomers += 1;
    }
    // Repeat buyers have at least two completed orders
    // within the selected period.
    if (customer.ordersInPeriod >= 2) {
      repeatBuyers += 1;
    }
  }

  const returningCustomerRate = activeCustomers > 0
    ? Number(
        (
          (returningCustomers / activeCustomers) *
          100
        ).toFixed(2)
      )
    : 0;

  const repeatBuyerRate = activeCustomers > 0
    ? Number(
        (
          (repeatBuyers / activeCustomers) *
          100
        ).toFixed(2)
      )
    : 0;

  const ordersPerCustomer = activeCustomers > 0
    ? Number(
        (
          activeCustomerOrderCount /
          activeCustomers
        ).toFixed(2)
      )
    : 0;

  const customerMetrics = {
    customers: {
      unique: customerHistory.size,
      active: activeCustomers,
      new: newCustomers,
      returning: returningCustomers,
      repeatBuyers,
      returningCustomerRate,
      repeatBuyerRate,
      ordersPerCustomer,
      currency: "EGP",
    },
  };

  return {
    ...orderMetrics,
    ...customerMetrics,
  };
}

/**
 * Vercel serverless function handler.
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
    const now = new Date();

    const defaultEndDate = now.toISOString().slice(0, 10);

    const defaultStart = new Date(now);
    defaultStart.setUTCDate(
      defaultStart.getUTCDate() - 29
    );

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

    const {
      orders,
      reportedTotal,
      pagesFetched,
    } = await fetchAllOrders();

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
    console.error(
      "Dashboard API failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "Unable to calculate dashboard metrics",
    });
  }
}
