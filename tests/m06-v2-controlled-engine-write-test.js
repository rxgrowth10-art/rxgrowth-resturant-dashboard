const { fetchOrders } = require("../lib/acquisition");
const { resolveField } = require("../lib/field-resolver");
const { getM06FieldKeys } = require("../lib/m06-field-contract");
const { buildM06Values } = require("../lib/m06-value-builder");
const { buildProductCategoryMap } = require("../lib/product-category-intelligence");
const { writeContactFields } = require("../lib/contact-writer");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function numeric(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function validateValue(fieldKey, value, field) {
  const dataType = field?.dataType;

  if (value === undefined) {
    return {
      ok: false,
      reason: "undefined",
    };
  }

  /*
   * GHL DATE fields:
   * Builder must output YYYY-MM-DD / null.
   */
  if (dataType === "DATE") {
    if (value === null) {
      return { ok: true };
    }

    const valid =
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value);

    return {
      ok: valid,
      reason: valid
        ? null
        : `DATE value is not YYYY-MM-DD: ${JSON.stringify(value)}`,
    };
  }

  /*
   * GHL NUMERICAL fields:
   * Never allow text such as "Insufficient Data".
   */
  if (dataType === "NUMERICAL") {
    if (value === null) {
      return { ok: true };
    }

    const valid = numeric(value);

    return {
      ok: valid,
      reason: valid
        ? null
        : `NUMERICAL value is not numeric/null: ${JSON.stringify(value)}`,
    };
  }

  return { ok: true };
}

async function main() {
  assert(
    API_KEY,
    "M06_STENZ_API_KEY is required."
  );

  console.log("");
  console.log("========== #41 CONTROLLED SINGLE-CUSTOMER WRITE ==========");
  console.log("");

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

  console.log("");
  console.log("---------- ACQUISITION ----------");

  const orders = await fetchOrders(LOCATION_ID);

  const qualifyingOrders = orders.filter((order) => {
    const id =
      order?._id ||
      order?.id;

    return Boolean(
      id &&
      order?.contactId &&
      order?.status === "completed" &&
      order?.liveMode === true &&
      order?.markAsTest !== true &&
      Number(order?.amount) > 0
    );
  });

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

  console.log("");
  console.log("---------- CUSTOMER GROUPING ----------");

  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers.get(contactId).push(order);
  }

  console.log(
    `Customers to process: ${customers.size}`
  );

  assert(
    customers.size > 0,
    "No customers found after qualification."
  );

  console.log("");
  console.log("---------- BUILD ALL CUSTOMERS ----------");

  const now = new Date();

  const results = [];
  let targetContactId = null;
  const failures = [];

  let processed = 0;

  const productCategoryMap =

    await buildProductCategoryMap({

      locationId: LOCATION_ID,

      apiKey: API_KEY,

      qualifyingOrders: qualifyingOrders,

    });


  for (const [contactId, customerOrders] of customers.entries()) {
    processed += 1;

    // #41: ONE CUSTOMER ONLY
    if (targetContactId === null) {
      targetContactId = contactId;
    }

    if (contactId !== targetContactId) {
      continue;
    }

    try {
      const built = await buildM06Values({
        customer: {
          contactId,
          orders: customerOrders,
        },

        customerOrders,

        /*
         * IMPORTANT:
         * Percentiles/value intelligence need the
         * complete qualifying population.
         */
        allQualifyingOrders: qualifyingOrders,
        productCategoryMap,
        qualifyingOrders,

        orders: customerOrders,

        now,
        locationId: LOCATION_ID,
      });

      assert(
        built &&
        typeof built === "object",
        "Builder returned no object."
      );

      const values =
        built.values ||
        built.fields ||
        built;

      assert(
        values &&
        typeof values === "object",
        "Builder returned no values object."
      );

      const actualKeys = Object.keys(values);

      const missing = fieldKeys.filter(
        (key) =>
          !Object.prototype.hasOwnProperty.call(
            values,
            key
          )
      );

      const extra = actualKeys.filter(
        (key) =>
          !fieldKeys.includes(key)
      );

      if (missing.length > 0) {
        fail(
          `Missing fields: ${missing.join(", ")}`
        );
      }

      if (extra.length > 0) {
        fail(
          `Extra fields: ${extra.join(", ")}`
        );
      }

      const typeErrors = [];

      for (const fieldKey of fieldKeys) {
        const check = validateValue(
          fieldKey,
          values[fieldKey],
          resolved[fieldKey]
        );

        if (!check.ok) {
          typeErrors.push({
            fieldKey,
            reason: check.reason,
          });
        }
      }

      if (typeErrors.length > 0) {
        const details = typeErrors
          .map(
            (item) =>
              `${item.fieldKey}: ${item.reason}`
          )
          .join(" | ");

        fail(
          `Type validation failed: ${details}`
        );
      }

      console.log("");
      console.log("---------- CONTROLLED WRITE ----------");
      console.log("WARNING: ONE CUSTOMER ONLY");
      console.log(`Customer: ${contactId}`);
      console.log(`Fields: ${actualKeys.length}/44`);

      const writeResult = await writeContactFields({
        locationId: LOCATION_ID,
        apiKey: API_KEY,
        contactId,
        values,
      });

      assert(
        writeResult?.succeeded !== false,
        "GHL contact write failed."
      );

      console.log("Write request: PASS");

      console.log("");
      console.log("---------- READ BACK ----------");

      const { request } = require("../lib/ghl");

      const after = await request(
        `/contacts/${encodeURIComponent(contactId)}`,
        API_KEY,
        {
          method: "GET",
          version: "2021-07-28",
        }
      );

      const customFields =
        Array.isArray(after?.contact?.customFields)
          ? after.contact.customFields
          : Array.isArray(after?.customFields)
            ? after.customFields
            : [];

      const byId = new Map();

      for (const field of customFields) {
        if (field?.id) {
          byId.set(field.id, field.value);
        }
      }

      const mismatches = [];

      for (const fieldKey of fieldKeys) {
        const fieldId = resolved[fieldKey].id;
        const expected = values[fieldKey];

        const actual =
          byId.has(fieldId)
            ? byId.get(fieldId)
            : undefined;

        const expectedString =
          expected === null ||
          expected === undefined
            ? ""
            : String(expected);

        const actualString =
          actual === null ||
          actual === undefined
            ? ""
            : String(actual);

        if (expectedString !== actualString) {
          mismatches.push({
            fieldKey,
            fieldId,
            expected,
            actual,
          });
        }
      }

      console.log(`Read-back fields: ${fieldKeys.length}/44`);
      console.log(`Mismatches: ${mismatches.length}`);

      if (mismatches.length > 0) {
        console.error("");
        console.error("READ-BACK MISMATCHES:");

        for (const mismatch of mismatches) {
          console.error(
            `${mismatch.fieldKey} (${mismatch.fieldId}): ` +
            `expected=${JSON.stringify(mismatch.expected)} ` +
            `actual=${JSON.stringify(mismatch.actual)}`
          );
        }

        fail("Controlled write read-back failed.");
      }

      console.log("Read-back: PASS");

      results.push({
        contactId,
        qualifyingOrders: customerOrders.length,
        fields: actualKeys.length,
        values,
      });

      console.log(
        `[${processed}/${customers.size}] ${contactId} → 44/44 WRITE + READ-BACK PASS`
      );

      // Stop after exactly one customer.
      break;
    } catch (error) {
      failures.push({
        contactId,
        error:
          error?.stack ||
          error?.message ||
          String(error),
      });

      console.error(
        `[${processed}/${customers.size}] ${contactId} → FAIL`
      );
      console.error(
        error?.message ||
        String(error)
      );
    }
  }

  console.log("");
  console.log("========== #41 RESULT ==========");
  console.log("");

  console.log(
    `Customers successfully written: ${results.length}/1`
  );

  console.log(
    `Customers failed: ${failures.length}`
  );

  console.log(
    `Total logical fields/customer: 44`
  );

  console.log(
    `Expected field builds: ${customers.size * 44}`
  );

  console.log(
    `Successful field builds: ${results.length * 44}`
  );

  console.log("");

  assert(
    failures.length === 0,
    `${failures.length} customer(s) failed M06 controlled write.`
  );

  assert(
    results.length === customers.size,
    "Not all customers were successfully built."
  );

  console.log(
    "44/44 field contract: PASS"
  );

  console.log(
    "DATE / NUMERICAL validation: PASS"
  );

  console.log(
    "Customer-by-customer build: PASS"
  );

  console.log(
    "Single-customer write only: PASS"
  );

  console.log(
    "44/44 read-back: PASS"
  );

  console.log("");
  console.log(
    "TEST #41: PASS — Controlled Single-Customer M06 Write"
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #40: FAIL");
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );
  process.exit(1);
});
