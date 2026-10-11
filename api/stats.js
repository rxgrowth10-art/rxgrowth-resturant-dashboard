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

function getValidCreatedAt(order) {
  if (!order.createdAt) return null;

  const date = new Date(order.createdAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getCompletedOrders(orders) {
  return orders.filter(
    (order) => order.status === "completed"
  );
}

function sumAmount(orders) {
  return Number(
    orders.reduce((total, order) => {
      const amount = Number(order.amount);

      return total + (
        Number.isFinite(amount) ? amount : 0
      );
    }, 0).toFixed(2)
  );
}

function calculateMetrics(orders, startDate, endDate) {
  const endExclusive = new Date(
    endDate.getTime() + 86400000
  );

  const validDatedOrders = orders
    .map((order) => ({
      order,
      createdAt: getValidCreatedAt(order),
    }))
    .filter((entry) => entry.createdAt !== null);

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

  // Keep the existing order and payment metrics.
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

  /*
   * Customer analytics
   *
   * Customer metrics use completed orders only.
   * Historical comparisons use all available order history.
   */

  const allCompletedEntries = validDatedOrders.filter(
    ({ order }) => order.status === "completed"
  );

  const customerHistory = new Map();

  for (const { order, createdAt } of allCompletedEntries) {
    if (!order.contactId) continue;

    if (!customerHistory.has(order.contactId)) {
      customerHistory.set(order.contactId, {
        firstOrderAt: createdAt,
        ordersInPeriod: 0,
        ordersBeforePeriod: 0,
        totalOrders: 0,
      });
    }

    const customer = customerHistory.get(order.contactId);

    customer.totalOrders += 1;

    if (createdAt < startDate) {
      customer.ordersBeforePeriod += 1;
    }

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
    if (customer.ordersInPeriod === 0) continue;

    activeCustomers += 1;

    activeCustomerOrderCount += customer.ordersInPeriod;

    const hasPreviousOrder =
      customer.totalOrders > customer.ordersInPeriod;

    if (hasPreviousOrder) {
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
          returningCustomers /
          activeCustomers *
          100
        ).toFixed(2)
      )
    : 0;

  const repeatBuyerRate = activeCustomers > 0
    ? Number(
        (
          repeatBuyers /
          activeCustomers *
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

  
