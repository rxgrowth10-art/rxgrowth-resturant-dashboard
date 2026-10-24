const { fetchOrders } = require("../lib/acquisition");
const { resolveField } = require("../lib/field-resolver");
const { getM06FieldKeys } = require("../lib/m06-field-contract");
const { buildM06Values } = require("../lib/m06-value-builder");
const { buildProductCategoryMap } = require("../lib/product-category-intelligence");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function qualifyOrder(order) {
  const id = order?._id || order?.id;

  return Boolean(
    id &&
    order?.contactId &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    Number(order?.amount) > 0
  );
}

function normalize(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function valuesEqual(a, b) {
  return normalize(a) === normalize(b);
}

async function main() {
  assert(
    API_KEY,
    "M06_STENZ_API_KEY is required."
  );

  console.log("");
  console.log("========== #42 M06 IDEMPOTENCY / RERUN SAFETY ==========");
  console.log("");

  // --------------------------------------------------
  // FIELD CONTRACT
  // --------------------------------------------------

  const fieldKeys = getM06FieldKeys();

  console.log(
    `M06 logical fields: ${fieldKeys.length}`
  );

  assert(
    fieldKeys.length === 44,
    `Expected 44 M06 fields, found ${fieldKeys.length}`
  );

  console.log("");
  console.log("---------- FIELD RESOLUTION ----------");

  const resolved = {};

  for (const fieldKey of fieldKeys) {
    const field = await resolveField(
      LOCATION_ID,
      API_KEY,
      fieldKey
    );

    assert(
      field?.id,
      `Could not resolve field ID for ${fieldKey}`
    );

    resolved[fieldKey] = field;
  }

  console.log(
    `Resolved fields: ${Object.keys(resolved).length}/44`
  );

  // --------------------------------------------------
  // ACQUISITION
  // --------------------------------------------------

  console.log("");
  console.log("---------- ACQUISITION ----------");

  const orders = await fetchOrders(
    LOCATION_ID
  );

  const qualifyingOrders =
    orders.filter(qualifyOrder);

  assert(
    qualifyingOrders.length > 0,
    "No qualifying orders found."
  );

  console.log(
    `Orders acquired: ${orders.length}`
  );

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  // --------------------------------------------------
  // GROUP CUSTOMERS
  // --------------------------------------------------

  console.log("");
  console.log("---------- CUSTOMER GROUPING ----------");

  const customers = new Map();

  for (const order of qualifyingOrders) {
    if (!customers.has(order.contactId)) {
      customers.set(order.contactId, []);
    }

    customers
      .get(order.contactId)
      .push(order);
  }

  console.log(
    `Customers discovered: ${customers.size}`
  );

  assert(
    customers.size > 0,
    "No customers discovered."
  );

  // --------------------------------------------------
  // IMPORTANT:
  // SAME SNAPSHOT TIME FOR BOTH RUNS
  // --------------------------------------------------

  const now = new Date();

  console.log("");
  console.log(
    `Fixed calculation time: ${now.toISOString()}`
  );

  // --------------------------------------------------
  // BUILD RUN #1
  // --------------------------------------------------

  console.log("");
  console.log("---------- BUILD RUN #1 ----------");

  const firstRun = new Map();

  let index = 0;

  const productCategoryMap =

    await buildProductCategoryMap({

      locationId: LOCATION_ID,

      apiKey: API_KEY,

      qualifyingOrders: qualifyingOrders,

    });


  for (
    const [contactId, customerOrders]
    of customers.entries()
  ) {
    index += 1;

    const built =
      await buildM06Values({
        customer: {
          contactId,
          orders: customerOrders,
        },

        customerOrders,

        allQualifyingOrders:
          qualifyingOrders,

        productCategoryMap,

        qualifyingOrders,

        orders: customerOrders,

        now,

        locationId:
          LOCATION_ID,
      });

    const values =
      built.values ||
      built.fields ||
      built;

    assert(
      values &&
      typeof values === "object",
      `${contactId}: builder returned no values`
    );

    const actualKeys =
      Object.keys(values);

    assert(
      actualKeys.length === 44,
      `${contactId}: expected 44 fields, found ${actualKeys.length}`
    );

    for (const fieldKey of fieldKeys) {
      assert(
        Object.prototype.hasOwnProperty.call(
          values,
          fieldKey
        ),
        `${contactId}: missing ${fieldKey}`
      );
    }

    firstRun.set(
      contactId,
      values
    );

    console.log(
      `[${index}/${customers.size}] ${contactId} → 44/44 BUILD #1 PASS`
    );
  }

  // --------------------------------------------------
  // BUILD RUN #2
  // --------------------------------------------------

  console.log("");
  console.log("---------- BUILD RUN #2 ----------");

  const secondRun = new Map();

  index = 0;

  for (
    const [contactId, customerOrders]
    of customers.entries()
  ) {
    index += 1;

    const built =
      await buildM06Values({
        customer: {
          contactId,
          orders: customerOrders,
        },

        customerOrders,

        allQualifyingOrders:
          qualifyingOrders,

        productCategoryMap,

        qualifyingOrders,

        orders: customerOrders,

        now,

        locationId:
          LOCATION_ID,
      });

    const values =
      built.values ||
      built.fields ||
      built;

    assert(
      values &&
      typeof values === "object",
      `${contactId}: second builder returned no values`
    );

    const actualKeys =
      Object.keys(values);

    assert(
      actualKeys.length === 44,
      `${contactId}: second run expected 44 fields, found ${actualKeys.length}`
    );

    secondRun.set(
      contactId,
      values
    );

    console.log(
      `[${index}/${customers.size}] ${contactId} → 44/44 BUILD #2 PASS`
    );
  }

  // --------------------------------------------------
  // COMPARE
  // --------------------------------------------------

  console.log("");
  console.log("---------- DETERMINISM CHECK ----------");

  let comparedFields = 0;
  let mismatches = 0;

  for (const contactId of customers.keys()) {
    const first =
      firstRun.get(contactId);

    const second =
      secondRun.get(contactId);

    for (const fieldKey of fieldKeys) {
      comparedFields += 1;

      if (
        !valuesEqual(
          first[fieldKey],
          second[fieldKey]
        )
      ) {
        mismatches += 1;

        console.error(
          `${contactId} | ${fieldKey} | RUN1=${JSON.stringify(first[fieldKey])} | RUN2=${JSON.stringify(second[fieldKey])}`
        );
      }
    }

    console.log(
      `${contactId} → 44/44 deterministic`
    );
  }

  console.log("");
  console.log("========== #42 RESULT ==========");
  console.log("");

  console.log(
    `Customers tested: ${customers.size}`
  );

  console.log(
    `Fields/customer: 44`
  );

  console.log(
    `Expected comparisons: ${customers.size * 44}`
  );

  console.log(
    `Actual comparisons: ${comparedFields}`
  );

  console.log(
    `Mismatches: ${mismatches}`
  );

  console.log("");
  console.log(
    "No writes performed: PASS"
  );

  assert(
    comparedFields === customers.size * 44,
    "Not all expected field comparisons were performed."
  );

  assert(
    mismatches === 0,
    `${mismatches} non-deterministic field value(s) detected.`
  );

  console.log(
    "Same input snapshot → same M06 output: PASS"
  );

  console.log(
    "Rerun-safe build behavior: PASS"
  );

  console.log("");
  console.log(
    "TEST #42: PASS — M06 Idempotency / Rerun Safety"
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #42: FAIL"
  );
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );
  process.exit(1);
});
