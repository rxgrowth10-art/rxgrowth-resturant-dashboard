// TEST FIXTURE ONLY.
// This test validates canonical transaction extraction.
// It must NOT become restaurant-specific business logic.

const { request } = require("../lib/ghl");
const { fetchOrders } = require("../lib/acquisition");

// Current STENZ fixture only.
const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function getProductId(item) {
  return (
    item?.product?._id ||
    item?.productId ||
    item?.product?._id ||
    null
  );
}

function getProductName(item) {
  return (
    item?.product?.name ||
    item?.name ||
    null
  );
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

function normalizeOrder(order) {
  const orderId = getOrderId(order);

  return {
    orderId,
    contactId: order?.contactId || null,

    amount:
      typeof order?.amount === "number"
        ? order.amount
        : Number(order?.amount) || null,

    status: order?.status || null,
    liveMode: order?.liveMode ?? null,
    markAsTest: order?.markAsTest ?? null,

    source:
      order?.source ||
      order?.sourceName ||
      null,

    deliveryMethod:
      order?.delivery?.method ||
      null,

    couponCode:
      order?.coupon?.code ||
      order?.couponCode ||
      null,

    items: Array.isArray(order?.items)
      ? order.items.map((item) => ({
          productId: getProductId(item),
          productName: getProductName(item),
          qty:
            typeof item?.qty === "number"
              ? item.qty
              : Number(item?.qty) || null,
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("M06 V2 TRANSACTION NORMALIZATION TEST #17");
  console.log("==============================================");

  const orders = await fetchOrders(LOCATION_ID);

  console.log("");
  console.log(`Orders acquired: ${orders.length}`);

  assert(
    orders.length > 0,
    "No orders acquired."
  );

  const normalized = [];
  const seenOrderIds = new Set();

  for (const order of orders) {
    const orderId = getOrderId(order);

    assert(
      orderId,
      "Encountered order without ID."
    );

    if (seenOrderIds.has(orderId)) {
      continue;
    }

    seenOrderIds.add(orderId);

    const detail = await fetchOrderDetail(orderId);
    const transaction = normalizeOrder(detail);

    normalized.push(transaction);

    console.log(
      `Normalized transaction ${normalized.length}: ${orderId}`
    );
  }

  console.log("");
  console.log("========== NORMALIZATION RESULTS ==========");

  console.log(`Orders:              ${orders.length}`);
  console.log(`Transactions:        ${normalized.length}`);
  console.log(
    `Unique transactions: ${new Set(
      normalized.map((x) => x.orderId)
    ).size}`
  );

  const withContact = normalized.filter(
    (x) => Boolean(x.contactId)
  );

  const withValidAmount = normalized.filter(
    (x) =>
      typeof x.amount === "number" &&
      Number.isFinite(x.amount) &&
      x.amount > 0
  );

  const withItems = normalized.filter(
    (x) => Array.isArray(x.items) && x.items.length > 0
  );

  const totalLineItems = normalized.reduce(
    (sum, transaction) =>
      sum + transaction.items.length,
    0
  );

  const invalidItems = normalized.flatMap(
    (transaction) =>
      transaction.items.filter(
        (item) =>
          !item.productId ||
          !item.productName ||
          typeof item.qty !== "number" ||
          item.qty <= 0
      )
  );

  const pricesFound = normalized.flatMap(
    (transaction) =>
      transaction.items.filter(
        (item) =>
          typeof item.unitPrice === "number" &&
          Number.isFinite(item.unitPrice)
      )
  );

  console.log(
    `Transactions with contactId: ${withContact.length}`
  );

  console.log(
    `Transactions with valid amount: ${withValidAmount.length}`
  );

  console.log(
    `Transactions with items[]: ${withItems.length}`
  );

  console.log(
    `Total normalized line items: ${totalLineItems}`
  );

  console.log(
    `Line items with valid product/qty: ${
      totalLineItems - invalidItems.length
    }`
  );

  console.log(
    `Line items with numeric unitPrice: ${pricesFound.length}`
  );

  const sample = normalized.find(
    (transaction) => transaction.items.length > 0
  );

  if (sample) {
    console.log("");
    console.log("========== SAMPLE NORMALIZED TRANSACTION ==========");

    console.log(
      JSON.stringify(
        sample,
        null,
        2
      )
    );
  }

  const uniqueIds =
    new Set(normalized.map((x) => x.orderId)).size;

  const pass =
    normalized.length === orders.length &&
    uniqueIds === normalized.length &&
    withContact.length === normalized.length &&
    withValidAmount.length === normalized.length &&
    withItems.length > 0 &&
    totalLineItems > 0 &&
    invalidItems.length === 0 &&
    pricesFound.length > 0;

  console.log("");

  if (pass) {
    console.log("TEST #17: PASS");
    return;
  }

  console.log("TEST #17: FAIL");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("");
  console.error("TEST #17: ERROR");
  console.error(error);
  process.exitCode = 1;
});
