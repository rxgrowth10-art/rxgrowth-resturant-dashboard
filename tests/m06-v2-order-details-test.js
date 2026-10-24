const { request } = require("../lib/ghl");
const { fetchOrders } = require("../lib/acquisition");
const { fetchAllPages } = require("../lib/pagination");

// TEST FIXTURE ONLY.
// This is the current STENZ test restaurant.
// It must NOT become business logic inside M06.
const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function uniqueCount(items) {
  return new Set(
    items
      .map((item) => item?._id || item?.id)
      .filter(Boolean)
  ).size;
}

async function fetchOrderDetail(orderId) {
  const path =
    `/payments/orders/${encodeURIComponent(orderId)}` +
    `?altId=${encodeURIComponent(LOCATION_ID)}` +
    "&altType=location";

  return request(path);
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("M06 V2 ORDER DETAIL TEST #16");
  console.log("==============================================");

  const orders = await fetchOrders(LOCATION_ID);

  console.log("");
  console.log(`Orders acquired: ${orders.length}`);

  if (!orders.length) {
    throw new Error("No orders found.");
  }

  const details = [];
  const seenIds = new Set();

  for (const order of orders) {
    const orderId = order?._id || order?.id;

    if (!orderId) {
      console.log("Skipping order without ID.");
      continue;
    }

    if (seenIds.has(orderId)) {
      continue;
    }

    seenIds.add(orderId);

    const detail = await fetchOrderDetail(orderId);

    details.push(detail);

    console.log(
      `Order detail ${details.length}: ${orderId}`
    );
  }

  console.log("");
  console.log("========== DETAIL RESULTS ==========");

  console.log(`Orders: ${orders.length}`);
  console.log(`Details: ${details.length}`);
  console.log(`Unique details: ${uniqueCount(details)}`);

  const detailWithItems = details.filter(
    (order) => Array.isArray(order?.items)
  );

  const totalLineItems = details.reduce(
    (sum, order) =>
      sum + (Array.isArray(order?.items)
        ? order.items.length
        : 0),
    0
  );

  console.log(
    `Orders with items[]: ${detailWithItems.length}`
  );

  console.log(
    `Total line items: ${totalLineItems}`
  );

  const sample = details.find(
    (order) =>
      Array.isArray(order?.items) &&
      order.items.length > 0
  );

  if (sample) {
    console.log("");
    console.log("========== SAMPLE ORDER DETAIL ==========");

    console.log(
      JSON.stringify(
        {
          id: sample?._id,
          contactId: sample?.contactId,
          amount: sample?.amount,
          deliveryMethod: sample?.delivery?.method || null,
          sourceName: sample?.sourceName || null,
          couponCode:
            sample?.coupon?.code ||
            sample?.couponCode ||
            null,
          items: sample.items.map((item) => ({
            productId:
              item?.product?._id ||
              item?.productId ||
              null,
            productName:
              item?.product?.name ||
              item?.name ||
              null,
            qty: item?.qty ?? null,
            price: item?.price ?? null,
          })),
        },
        null,
        2
      )
    );
  }

  const pass =
    orders.length > 0 &&
    details.length === orders.length &&
    uniqueCount(details) === details.length &&
    detailWithItems.length > 0;

  console.log("");

  if (pass) {
    console.log("TEST #16: PASS");
    return;
  }

  console.log("TEST #16: FAIL");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("");
  console.error("TEST #16: ERROR");
  console.error(error);
  process.exitCode = 1;
});
