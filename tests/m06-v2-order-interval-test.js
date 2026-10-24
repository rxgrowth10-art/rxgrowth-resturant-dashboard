// TEST FIXTURE ONLY.
// This validates customer order-interval calculations.
// It must NOT become restaurant-specific business logic.

const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function isQualifyingOrder(order) {
  const amount =
    typeof order?.amount === "number"
      ? order.amount
      : Number(order?.amount);

  return (
    Boolean(order?.contactId) &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    Number.isFinite(amount) &&
    amount > 0
  );
}

function getOrderDate(order) {
  const value =
    order?.createdAt ||
    order?.dateAdded ||
    order?.createdAtUtc ||
    null;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

async function fetchOrderDetail(orderId) {
  const path =
    `/payments/orders/${encodeURIComponent(orderId)}` +
    `?altId=${encodeURIComponent(LOCATION_ID)}` +
    "&altType=location";

  return request(path);
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] + sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

function calculateIntervals(orderDates) {
  const timestamps = orderDates
    .map((date) => date.getTime())
    .sort((a, b) => a - b);

  const intervals = [];

  for (let i = 1; i < timestamps.length; i++) {
    const diffMs =
      timestamps[i] - timestamps[i - 1];

    const diffDays =
      diffMs / (1000 * 60 * 60 * 24);

    intervals.push(diffDays);
  }

  if (!intervals.length) {
    return {
      intervals: [],
      averageOrderInterval: null,
      typicalOrderInterval: null,
    };
  }

  const averageOrderInterval =
    intervals.reduce(
      (sum, value) => sum + value,
      0
    ) / intervals.length;

  return {
    intervals,
    averageOrderInterval,
    typicalOrderInterval: median(intervals),
  };
}

function groupByCustomer(orders) {
  const customers = new Map();

  for (const order of orders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers.get(contactId).push(order);
  }

  return customers;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("M06 V2 ORDER INTERVAL TEST #20");
  console.log("==============================================");

  const orders = await fetchOrders(LOCATION_ID);

  console.log("");
  console.log(`Orders acquired: ${orders.length}`);

  assert(
    orders.length > 0,
    "No orders acquired."
  );

  const qualifyingOrders = [];
  const seenIds = new Set();

  for (const order of orders) {
    const orderId = getOrderId(order);

    if (!orderId || seenIds.has(orderId)) {
      continue;
    }

    seenIds.add(orderId);

    const detail =
      await fetchOrderDetail(orderId);

    if (!isQualifyingOrder(detail)) {
      continue;
    }

    const orderDate =
      getOrderDate(detail);

    assert(
      orderDate,
      `Order ${orderId} has no valid order date.`
    );

    qualifyingOrders.push({
      orderId,
      contactId: detail.contactId,
      orderDate,
    });
  }

  console.log("");
  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  const customerMap =
    groupByCustomer(qualifyingOrders);

  console.log(
    `Unique customers: ${customerMap.size}`
  );

  const results = [];

  for (const [contactId, customerOrders] of customerMap) {
    const orderDates =
      customerOrders.map(
        (order) => order.orderDate
      );

    const calculated =
      calculateIntervals(orderDates);

    results.push({
      contactId,
      totalOrders: customerOrders.length,
      orderDates: orderDates
        .sort((a, b) => a - b)
        .map((date) => date.toISOString()),
      ...calculated,
    });
  }

  console.log("");
  console.log("========== INTERVAL RESULTS ==========");

  for (const result of results) {
    console.log("");
    console.log(
      `Customer: ${result.contactId}`
    );

    console.log(
      `Orders: ${result.totalOrders}`
    );

    console.log(
      `Intervals: ${
        result.intervals.length
      }`
    );

    console.log(
      `Average Order Interval: ${
        result.averageOrderInterval === null
          ? "null"
          : result.averageOrderInterval.toFixed(4)
      } days`
    );

    console.log(
      `Typical Order Interval: ${
        result.typicalOrderInterval === null
          ? "null"
          : result.typicalOrderInterval.toFixed(4)
      } days`
    );

    console.log(
      `Order dates: ${result.orderDates.join(" | ")}`
    );
  }

  console.log("");
  console.log("========== CONTRACT CHECK ==========");

  const singleOrderCustomers =
    results.filter(
      (customer) =>
        customer.totalOrders === 1
    );

  const multiOrderCustomers =
    results.filter(
      (customer) =>
        customer.totalOrders >= 2
    );

  const invalidSingleOrderCustomers =
    singleOrderCustomers.filter(
      (customer) =>
        customer.intervals.length !== 0 ||
        customer.averageOrderInterval !== null ||
        customer.typicalOrderInterval !== null
    );

  const invalidMultiOrderCustomers =
    multiOrderCustomers.filter(
      (customer) =>
        customer.intervals.length !==
          customer.totalOrders - 1 ||
        !Number.isFinite(
          customer.averageOrderInterval
        ) ||
        customer.averageOrderInterval <= 0 ||
        !Number.isFinite(
          customer.typicalOrderInterval
        ) ||
        customer.typicalOrderInterval <= 0
    );

  console.log(
    `Single-order customers: ${singleOrderCustomers.length}`
  );

  console.log(
    `Multi-order customers: ${multiOrderCustomers.length}`
  );

  console.log(
    `Invalid single-order intervals: ${
      invalidSingleOrderCustomers.length
    }`
  );

  console.log(
    `Invalid multi-order intervals: ${
      invalidMultiOrderCustomers.length
    }`
  );

  const intervalCount =
    results.reduce(
      (sum, customer) =>
        sum + customer.intervals.length,
      0
    );

  const expectedIntervalCount =
    qualifyingOrders.length -
    customerMap.size;

  console.log(
    `Calculated intervals: ${intervalCount}`
  );

  console.log(
    `Expected intervals: ${expectedIntervalCount}`
  );

  const intervalCountReconciles =
    intervalCount ===
    expectedIntervalCount;

  console.log(
    `Interval count reconciles: ${intervalCountReconciles}`
  );

  const pass =
    results.length === customerMap.size &&
    invalidSingleOrderCustomers.length === 0 &&
    invalidMultiOrderCustomers.length === 0 &&
    intervalCountReconciles;

  console.log("");

  if (pass) {
    console.log("TEST #20: PASS");
    return;
  }

  console.log("TEST #20: FAIL");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("");
  console.error("TEST #20: ERROR");
  console.error(error);
  process.exitCode = 1;
});
