// TEST FIXTURE ONLY.
// This validates customer-level aggregation from qualifying transactions.
// It must NOT become restaurant-specific business logic.

const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function getUnitPrice(item) {
  if (typeof item?.price === "number") {
    return item.price;
  }

  if (typeof item?.price?.amount === "number") {
    return item.price.amount;
  }

  if (typeof item?.amount === "number") {
    return item.amount;
  }

  return null;
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

function normalizeOrder(order) {
  return {
    orderId: getOrderId(order),
    contactId: order?.contactId || null,

    amount:
      typeof order?.amount === "number"
        ? order.amount
        : Number(order?.amount),

    createdAt:
      order?.createdAt ||
      order?.dateAdded ||
      order?.createdAtUtc ||
      null,

    items: Array.isArray(order?.items)
      ? order.items.map((item) => ({
          productId:
            item?.product?._id ||
            item?.productId ||
            null,

          productName:
            item?.product?.name ||
            item?.name ||
            null,

          qty:
            typeof item?.qty === "number"
              ? item.qty
              : Number(item?.qty) || 0,

          unitPrice: getUnitPrice(item),
        }))
      : [],
  };
}

async function fetchOrderDetail(orderId) {
  const path =
    `/payments/orders/${encodeURIComponent(orderId)}` +
    `?altId=${encodeURIComponent(LOCATION_ID)}` +
    "&altType=location";

  return request(path);
}

function aggregateCustomerOrders(transactions) {
  const customers = new Map();

  for (const transaction of transactions) {
    const contactId = transaction.contactId;

    if (!contactId) {
      continue;
    }

    if (!customers.has(contactId)) {
      customers.set(contactId, {
        contactId,
        totalOrders: 0,
        lifetimeValue: 0,
        firstOrderDate: null,
        lastOrderDate: null,
        highestOrderValue: null,
        lowestOrderValue: null,
        orderDates: [],
      });
    }

    const customer = customers.get(contactId);
    const amount = transaction.amount;
    const orderDate = transaction.createdAt;

    customer.totalOrders += 1;
    customer.lifetimeValue += amount;

    if (
      typeof customer.highestOrderValue !== "number" ||
      amount > customer.highestOrderValue
    ) {
      customer.highestOrderValue = amount;
    }

    if (
      typeof customer.lowestOrderValue !== "number" ||
      amount < customer.lowestOrderValue
    ) {
      customer.lowestOrderValue = amount;
    }

    if (orderDate) {
      customer.orderDates.push(orderDate);

      if (
        !customer.firstOrderDate ||
        new Date(orderDate) <
          new Date(customer.firstOrderDate)
      ) {
        customer.firstOrderDate = orderDate;
      }

      if (
        !customer.lastOrderDate ||
        new Date(orderDate) >
          new Date(customer.lastOrderDate)
      ) {
        customer.lastOrderDate = orderDate;
      }
    }
  }

  for (const customer of customers.values()) {
    customer.averageOrderValue =
      customer.totalOrders > 0
        ? customer.lifetimeValue /
          customer.totalOrders
        : 0;
  }

  return [...customers.values()];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("M06 V2 CUSTOMER AGGREGATION TEST #19");
  console.log("==============================================");

  const orders = await fetchOrders(LOCATION_ID);

  console.log("");
  console.log(`Orders acquired: ${orders.length}`);

  assert(
    orders.length > 0,
    "No orders acquired."
  );

  const transactions = [];
  const seenIds = new Set();

  for (const order of orders) {
    const orderId = getOrderId(order);

    if (!orderId) {
      continue;
    }

    if (seenIds.has(orderId)) {
      continue;
    }

    seenIds.add(orderId);

    const detail =
      await fetchOrderDetail(orderId);

    if (!isQualifyingOrder(detail)) {
      continue;
    }

    transactions.push(
      normalizeOrder(detail)
    );
  }

  console.log("");
  console.log("========== QUALIFYING TRANSACTIONS ==========");

  console.log(
    `Qualifying transactions: ${transactions.length}`
  );

  assert(
    transactions.length > 0,
    "No qualifying transactions found."
  );

  const customers =
    aggregateCustomerOrders(transactions);

  console.log("");
  console.log("========== CUSTOMER AGGREGATION ==========");

  console.log(
    `Unique customers: ${customers.length}`
  );

  const invalidCustomers = customers.filter(
    (customer) =>
      !customer.contactId ||
      customer.totalOrders <= 0 ||
      !Number.isFinite(customer.lifetimeValue) ||
      customer.lifetimeValue <= 0 ||
      !Number.isFinite(customer.averageOrderValue) ||
      customer.averageOrderValue <= 0 ||
      !Number.isFinite(customer.highestOrderValue) ||
      !Number.isFinite(customer.lowestOrderValue)
  );

  console.log(
    `Customers with valid core metrics: ${
      customers.length - invalidCustomers.length
    }`
  );

  const sumCustomerOrders =
    customers.reduce(
      (sum, customer) =>
        sum + customer.totalOrders,
      0
    );

  const sumCustomerSpend =
    customers.reduce(
      (sum, customer) =>
        sum + customer.lifetimeValue,
      0
    );

  console.log(
    `Aggregated order count: ${sumCustomerOrders}`
  );

  console.log(
    `Aggregated lifetime value: ${sumCustomerSpend}`
  );

  console.log("");
  console.log("========== SAMPLE CUSTOMER AGGREGATES ==========");

  for (const customer of customers) {
    console.log(
      JSON.stringify(
        customer,
        null,
        2
      )
    );
  }

  console.log("");
  console.log("========== RECONCILIATION ==========");

  const transactionSpend =
    transactions.reduce(
      (sum, transaction) =>
        sum + transaction.amount,
      0
    );

  console.log(
    `Transaction spend: ${transactionSpend}`
  );

  console.log(
    `Customer aggregate spend: ${sumCustomerSpend}`
  );

  console.log(
    `Transaction count: ${transactions.length}`
  );

  console.log(
    `Customer aggregate order count: ${sumCustomerOrders}`
  );

  const spendReconciles =
    Math.abs(
      transactionSpend - sumCustomerSpend
    ) < 0.000001;

  const orderCountReconciles =
    transactions.length === sumCustomerOrders;

  console.log(
    `Spend reconciles: ${spendReconciles}`
  );

  console.log(
    `Order count reconciles: ${orderCountReconciles}`
  );

  const pass =
    customers.length > 0 &&
    invalidCustomers.length === 0 &&
    spendReconciles &&
    orderCountReconciles;

  console.log("");

  if (pass) {
    console.log("TEST #19: PASS");
    return;
  }

  console.log("TEST #19: FAIL");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("");
  console.error("TEST #19: ERROR");
  console.error(error);
  process.exitCode = 1;
});
