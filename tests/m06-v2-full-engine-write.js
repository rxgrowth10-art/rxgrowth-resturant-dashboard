const { request } = require("../lib/ghl");
const { fetchOrders } = require("../lib/acquisition");
const { resolveField } = require("../lib/field-resolver");
const { getM06FieldKeys } = require("../lib/m06-field-contract");
const { buildM06Values } = require("../lib/m06-value-builder");
const { buildProductCategoryMap } = require("../lib/product-category-intelligence");
const { writeContactFields } = require("../lib/contact-writer");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

const CONFIRM = process.argv.includes("--confirm");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateValue(fieldKey, value, field) {
  const dataType = field?.dataType;

  if (value === undefined) {
    return {
      ok: false,
      reason: "undefined",
    };
  }

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

function normalizeComparable(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function valuesEqual(expected, actual) {
  const a = normalizeComparable(expected);
  const b = normalizeComparable(actual);

  if (a === b) {
    return true;
  }

  // GHL may omit an empty TEXT custom field on read-back,
  // returning null instead of the empty string sent by M06.
  // Treat both representations as equivalent.
  if (
    (a === null && b === "") ||
    (a === "" && b === null)
  ) {
    return true;
  }

  if (
    typeof a === "number" &&
    typeof b === "string" &&
    b.trim() !== ""
  ) {
    return a === Number(b);
  }

  if (
    typeof b === "number" &&
    typeof a === "string" &&
    a.trim() !== ""
  ) {
    return b === Number(a);
  }

  return false;
}

async function fetchContact(contactId) {
  const response = await request(
    `/contacts/${encodeURIComponent(contactId)}`,
    API_KEY
  );

  return response?.contact || response;
}

function extractCustomFieldValue(contact, fieldId) {
  const fields = Array.isArray(contact?.customFields)
    ? contact.customFields
    : [];

  const field = fields.find(
    (item) => item?.id === fieldId
  );

  if (!field) {
    return null;
  }

  return field.value ?? null;
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

async function main() {
  assert(
    API_KEY,
    "M06_STENZ_API_KEY is required."
  );

  console.log("");
  console.log("========== #41 FULL M06 ENGINE WRITE ==========");
  console.log("");
  console.log(
    `Mode: ${CONFIRM ? "WRITE + READ-BACK" : "PRE-WRITE PREFLIGHT ONLY"}`
  );
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
  // CUSTOMER GROUPING
  // --------------------------------------------------

  console.log("");
  console.log("---------- CUSTOMER GROUPING ----------");

  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers
      .get(contactId)
      .push(order);
  }

  console.log(
    `Customers to process: ${customers.size}`
  );

  assert(
    customers.size > 0,
    "No customers found after qualification."
  );

  // --------------------------------------------------
  // BUILD ALL CUSTOMERS FIRST
  // --------------------------------------------------

  console.log("");
  console.log("---------- BUILD ALL CUSTOMERS ----------");

  const now = new Date();

  const results = [];
  const failures = [];

  let processed = 0;

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
    processed += 1;

    try {
      const built = await buildM06Values({
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

      const actualKeys =
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
        actualKeys.filter(
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
        const check =
          validateValue(
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
        const details =
          typeErrors
            .map(
              (item) =>
                `${item.fieldKey}: ${item.reason}`
            )
            .join(" | ");

        fail(
          `Type validation failed: ${details}`
        );
      }

      results.push({
        contactId,
        qualifyingOrders:
          customerOrders.length,
        fields: actualKeys.length,
        values,
      });

      console.log(
        `[${processed}/${customers.size}] ${contactId} → 44/44 BUILD PASS`
      );
    } catch (error) {
      failures.push({
        contactId,
        error:
          error?.stack ||
          error?.message ||
          String(error),
      });

      console.error(
        `[${processed}/${customers.size}] ${contactId} → BUILD FAIL`
      );

      console.error(
        error?.message ||
        String(error)
      );
    }
  }

  // --------------------------------------------------
  // PRE-WRITE GATE
  // --------------------------------------------------

  console.log("");
  console.log("========== PRE-WRITE GATE ==========");
  console.log("");

  console.log(
    `Customers discovered: ${customers.size}`
  );

  console.log(
    `Customers successfully built: ${results.length}/${customers.size}`
  );

  console.log(
    `Customers failed: ${failures.length}`
  );

  console.log(
    `Expected field builds: ${customers.size * 44}`
  );

  console.log(
    `Successful field builds: ${results.length * 44}`
  );

  assert(
    failures.length === 0,
    `${failures.length} customer(s) failed M06 build. NO WRITES PERFORMED.`
  );

  assert(
    results.length === customers.size,
    "Not all customers were successfully built. NO WRITES PERFORMED."
  );

  assert(
    results.every(
      (result) => result.fields === 44
    ),
    "One or more customers did not produce exactly 44 fields. NO WRITES PERFORMED."
  );

  console.log("");
  console.log(
    "PRE-WRITE BUILD GATE: PASS"
  );

  console.log(
    `All ${customers.size} customers passed 44/44 validation.`
  );

  console.log(
    `Total validated field builds: ${results.length * 44}/${customers.size * 44}`
  );

  // --------------------------------------------------
  // STOP HERE UNLESS --confirm
  // --------------------------------------------------

  if (!CONFIRM) {
    console.log("");
    console.log(
      "NO WRITES PERFORMED."
    );
    console.log("");
    console.log(
      "To perform the real multi-customer write, run:"
    );
    console.log("");
    console.log(
      "node tests/m06-v2-full-engine-write.js --confirm"
    );
    console.log("");

    return;
  }

  // --------------------------------------------------
  // FULL WRITE + READ-BACK
  // --------------------------------------------------

  console.log("");
  console.log("========== FULL WRITE + READ-BACK ==========");
  console.log("");

  let successfulWrites = 0;
  const writeFailures = [];

  for (let index = 0; index < results.length; index++) {
    const result = results[index];

    try {
      console.log(
        `[${index + 1}/${results.length}] ${result.contactId}`
      );

      console.log(
        "  Writing 44 fields..."
      );

      const writeResult =
        await writeContactFields({
          locationId:
            LOCATION_ID,

          apiKey:
            API_KEY,

          contactId:
            result.contactId,

          values:
            result.values,
        });

      assert(
        writeResult?.succeeded !== false,
        "Write request returned failure."
      );

      console.log(
        "  Write request: PASS"
      );

      console.log(
        "  Reading back..."
      );

      const contact =
        await fetchContact(
          result.contactId
        );

      const mismatches = [];

      for (const fieldKey of fieldKeys) {
        const field =
          resolved[fieldKey];

        const expected =
          result.values[fieldKey];

        const actual =
          extractCustomFieldValue(
            contact,
            field.id
          );

        if (
          !valuesEqual(
            expected,
            actual
          )
        ) {
          mismatches.push({
            fieldKey,
            fieldId: field.id,
            expected,
            actual,
          });
        }
      }

      console.log(
        `  Read-back fields: ${fieldKeys.length - mismatches.length}/${fieldKeys.length}`
      );

      console.log(
        `  Mismatches: ${mismatches.length}`
      );

      if (mismatches.length > 0) {
        console.error(
          "  READ-BACK: FAIL"
        );

        for (const mismatch of mismatches) {
          console.error(
            `    ${mismatch.fieldKey} | expected=${JSON.stringify(mismatch.expected)} | actual=${JSON.stringify(mismatch.actual)}`
          );
        }

        writeFailures.push({
          contactId:
            result.contactId,
          mismatches,
        });

        break;
      }

      successfulWrites += 1;

      console.log(
        "  44/44 WRITE + READ-BACK PASS"
      );
    } catch (error) {
      writeFailures.push({
        contactId:
          result.contactId,

        error:
          error?.stack ||
          error?.message ||
          String(error),
      });

      console.error(
        "  WRITE/READ-BACK: FAIL"
      );

      console.error(
        error?.message ||
        String(error)
      );

      break;
    }

    console.log("");
  }

  // --------------------------------------------------
  // RESULT
  // --------------------------------------------------

  console.log("");
  console.log("========== #41 RESULT ==========");
  console.log("");

  console.log(
    `Customers discovered: ${customers.size}`
  );

  console.log(
    `Customers successfully written: ${successfulWrites}/${customers.size}`
  );

  console.log(
    `Customers failed: ${writeFailures.length}`
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

  console.log(
    `Successful customer writes: ${successfulWrites * 44} fields`
  );

  console.log("");

  assert(
    writeFailures.length === 0,
    `${writeFailures.length} customer(s) failed during write/read-back.`
  );

  assert(
    successfulWrites === customers.size,
    "Not all customers were successfully written."
  );

  console.log(
    "44/44 field contract: PASS"
  );

  console.log(
    "DATE / NUMERICAL validation: PASS"
  );

  console.log(
    "Full customer build: PASS"
  );

  console.log(
    "Full customer write: PASS"
  );

  console.log(
    "Full customer read-back: PASS"
  );

  console.log("");
  console.log(
    "TEST #41: PASS — Full M06 Engine Write"
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #41: FAIL"
  );
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );
  process.exit(1);
});
