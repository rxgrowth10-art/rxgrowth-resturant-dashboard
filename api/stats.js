const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";
const TIME_ZONE = "Africa/Cairo";

const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validate a YYYY-MM-DD date.
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

  return value;
}

/**
 * Format a date using the restaurant's timezone.
 */
function getZonedParts(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),
    hour: Number(result.hour),
    minute: Number(result.minute),
    second: Number(result.second),
  };
}

/**
 * Return YYYY-MM-DD in the restaurant's timezone.
 */
function getZonedDateString(date) {
  const parts = getZonedParts(date);

  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

/**
 * Add calendar days to a YYYY-MM-DD date.
 *
 * UTC is used here only for calendar arithmetic.
 * The result is interpreted later in Africa/Cairo.
 */
function addCalendarDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * Convert a local date/time in a timezone to a UTC Date.
 *
 * Iterative conversion avoids assuming Cairo always has
 * the same UTC offset throughout the year.
 */
function zonedDateTimeToUtc(
  dateString,
  hour = 0,
  minute = 0,
  second = 0
) {
  const [year, month, day] = dateString.split("-").map(Number);

  const targetUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  let candidate = targetUtc;

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(candidate));

    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );

    const difference = targetUtc - representedUtc;

    if (difference === 0) {
      break;
    }

    candidate += difference;
  }

  return new Date(candidate);
}

/**
 * Send an authenticated GET request to HighLevel.
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
 *
 * We retain full available history because customer
 * classification requires checking previous orders.
 *
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
 * Safely convert a monetary amount to a number.
 */
function getAmount(order) {
  const amount = Number(order.amount);

  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Sum monetary amounts.
 */
function sumAmount(orders) {
  return Number(
    orders
      .reduce((total, order) => total + getAmount(order), 0)
      .toFixed(2)
  );
}

/**
 * Count orders by payment status.
 *
 * These counts do not depend on order completion status.
 */
function getPaymentMetrics(orders) {
  const paid = orders.filter(
    order => order.paymentStatus === "paid"
  );

  const unpaid = orders.filter(
    order => order.paymentStatus === "unpaid"
  );

  const refunded = orders.filter(
    order => order.paymentStatus === "refunded"
  );

  const partiallyPaid = orders.filter(
    order => order.paymentStatus === "partially_paid"
  );

  const knownStatuses = new Set([
    "paid",
    "unpaid",
    "refunded",
    "partially_paid",
  ]);

  const otherPaymentStatus = orders.filter(
    order => !knownStatuses.has(order.paymentStatus)
  );

  return {
    paid,
    unpaid,
    refunded,
    partiallyPaid,
    otherPaymentStatus,
  };
}

/**
 * Calculate the start of a selected date in Cairo time.
 *
 * Date query parameters represent calendar dates in
 * Africa/Cairo, not UTC dates.
 */
function getPeriodBoundaries(startDate, endDate) {
  const start = zonedDateTimeToUtc(startDate);

  const endExclusiveDate = addCalendarDays(endDate, 1);
  const endExclusive = zonedDateTimeToUtc(endExclusiveDate);

  return {
    start,
    endExclusive,
    endExclusiveDate,
  };
}

/**
 * Calculate dashboard metrics.
 */
function calculateMetrics(orders, startDate, endDate) {
  const {
    start,
    endExclusive,
  } = getPeriodBoundaries(startDate, endDate);

  const validEntries = orders
    .map(order => ({
      order,
      createdAt: getValidCreatedAt(order),
    }))
    .filter(entry => entry.createdAt !== null);

  const invalidDateCount = orders.length - validEntries.length;

  const periodEntries = validEntries.filter(
    ({ createdAt }) =>
      createdAt >= start &&
      createdAt < endExclusive
  );

  const periodOrders = periodEntries.map(
    entry => entry.order
  );

  /*
   * Main order metrics include every order created
   * within the selected period, regardless of status.
   */
  const totalOrderValue = sumAmount(periodOrders);

  const payment = getPaymentMetrics(periodOrders);

  const completedOrders = periodOrders.filter(
    order => order.status === "completed"
  );

  const orderStatusCounts = {};

  for (const order of periodOrders) {
    const status = order.status || "unknown";

    orderStatusCounts[status] =
      (orderStatusCounts[status] || 0) + 1;
  }

  const orderMetrics = {
    orders: {
      total: periodOrders.length,

      paid: payment.paid.length,
      unpaid: payment.unpaid.length,
      refunded: payment.refunded.length,
      partiallyPaid: payment.partiallyPaid.length,
      otherPaymentStatus: payment.otherPaymentStatus.length,

      completed: completedOrders.length,

      otherOrderStatuses:
        periodOrders.length - completedOrders.length,

      statusCounts: orderStatusCounts,
    },

    orderValue: {
      total: totalOrderValue,

      paid: sumAmount(payment.paid),
      unpaid: sumAmount(payment.unpaid),
      refunded: sumAmount(payment.refunded),
      partiallyPaid: sumAmount(payment.partiallyPaid),
      otherPaymentStatus: sumAmount(
        payment.otherPaymentStatus
      ),

      currency: "EGP",
    },
  };

  /*
   * Customer mix:
   *
   * Customers must have at least one order in the selected
   * period and a valid contactId.
   *
   * A customer is returning if an order exists before the
   * beginning of the selected period.
   *
   * Classification uses all available order statuses.
   */
  const customerHistory = new Map();

  for (const { order, createdAt } of validEntries) {
    if (!order.contactId) continue;

    if (!customerHistory.has(order.contactId)) {
      customerHistory.set(order.contactId, {
        firstOrderAt: createdAt,
        ordersInPeriod: 0,
        previousOrderCount: 0,
        totalOrders: 0,
      });
    }

    const customer = customerHistory.get(order.contactId);

    customer.totalOrders += 1;

    if (createdAt < customer.firstOrderAt) {
      customer.firstOrderAt = createdAt;
    }

    if (createdAt < start) {
      customer.previousOrderCount += 1;
    }

    if (
      createdAt >= start &&
      createdAt < endExclusive
    ) {
      customer.ordersInPeriod += 1;
    }
  }

  let activeCustomers = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let repeatBuyers = 0;
  let activeCustomerOrderCount = 0;

  for (const customer of customerHistory.values()) {
    if (customer.ordersInPeriod === 0) continue;

    activeCustomers += 1;
    activeCustomerOrderCount += customer.ordersInPeriod;

    if (customer.previousOrderCount > 0) {
      returningCustomers += 1;
    } else {
      newCustomers += 1;
    }

    if (customer.ordersInPeriod >= 2) {
      repeatBuyers += 1;
    }
  }

  const returningCustomerRate = activeCustomers > 0
    ? Number(
        (
          returningCustomers / activeCustomers * 100
        ).toFixed(2)
      )
    : 0;

  const repeatBuyerRate = activeCustomers > 0
    ? Number(
        (
          repeatBuyers / activeCustomers * 100
        ).toFixed(2)
      )
    : 0;

  const ordersPerCustomer = activeCustomers > 0
    ? Number(
        (
          activeCustomerOrderCount / activeCustomers
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

  /*
   * Orders by hour in the restaurant's timezone.
   *
   * The chart represents the selected period. For Today,
   * it naturally represents today's hourly distribution.
   */
  const hourlyCounts = Array.from(
    { length: 24 },
    (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      orders: 0,
    })
  );

  for (const { createdAt } of periodEntries) {
    const parts = getZonedParts(createdAt);
    hourlyCounts[parts.hour].orders += 1;
  }

  /*
   * Keep the existing completed-order payment breakdown
   * available for diagnostics and backward compatibility
   * while the frontend is being updated.
   */
  const completedPayment = getPaymentMetrics(completedOrders);

  const legacyMetrics = {
    completedOrderValue: {
      total: sumAmount(completedOrders),
      paid: sumAmount(completedPayment.paid),
      unpaid: sumAmount(completedPayment.unpaid),
    },

    completedOrders: {
      total: completedOrders.length,
      paid: completedPayment.paid.length,
      unpaid: completedPayment.unpaid.length,
      otherPaymentStatus:
        completedPayment.otherPaymentStatus.length,
    },
  };

  // Additive daily series for Reports. Existing response fields above remain unchanged.
  const dailyMap = new Map();
  for (let cursor = startDate; cursor <= endDate; cursor = addCalendarDays(cursor, 1)) {
    dailyMap.set(cursor, { date: cursor, orders: 0, orderValue: 0, newCustomers: 0 });
  }

  for (const { order, createdAt } of periodEntries) {
    const date = getZonedDateString(createdAt);
    const day = dailyMap.get(date);
    if (!day) continue;
    day.orders += 1;
    day.orderValue += getAmount(order);
  }

  // A new customer is counted on their first observed order date in available history.
  // Customers without a contactId cannot be reliably deduplicated and are excluded.
  for (const [contactId, customer] of customerHistory.entries()) {
    const firstOrderDate = getZonedDateString(customer.firstOrderAt);
    const day = dailyMap.get(firstOrderDate);
    if (day) day.newCustomers += 1;
  }

  const dailyMetrics = Array.from(dailyMap.values()).map(day => ({
    ...day,
    orderValue: Number(day.orderValue.toFixed(2))
  }));

  return {
    ...orderMetrics,
    ...customerMetrics,

    dailyMetrics,
    hourlyOrders: hourlyCounts,

    legacy: legacyMetrics,

    dataQuality: {
      ordersInSelectedPeriod: periodOrders.length,
      completedOrders: completedOrders.length,
      invalidOrderDates: invalidDateCount,
      ordersWithoutContactId: periodOrders.filter(
        order => !order.contactId
      ).length,
      unknownPaymentStatus:
        payment.otherPaymentStatus.length,
      customerHistoryScope: "all_available_orders",
    },
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

    const today = getZonedDateString(now);
    const defaultEndDate = today;
    const defaultStartDate = addCalendarDays(today, -29);

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
        startDate,
        endDate,
        timezone: TIME_ZONE,
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
