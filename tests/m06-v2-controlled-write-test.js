const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");
const { resolveField } = require("../lib/field-resolver");
const { writeContactFields } = require("../lib/contact-writer");
const { getM06FieldKeys } = require("../lib/m06-field-contract");
const builder = require("../lib/m06-value-builder");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function getBuilderFunction() {
  if (typeof builder.buildM06Values === "function") {
    return builder.buildM06Values;
  }

  fail("buildM06Values export not found.");
}

async function fetchContact(contactId) {
  const response = await request(
    `/contacts/${encodeURIComponent(contactId)}?locationId=${encodeURIComponent(LOCATION_ID)}`,
    API_KEY
  );

  return response?.contact || response;
}

function extractCustomFieldValue(contact, fieldId, fieldKey) {
  const fields = Array.isArray(contact?.customFields)
    ? contact.customFields
    : [];

  const match = fields.find(
    (field) =>
      field?.id === fieldId ||
      field?.key === fieldKey
  );

  return match?.fieldValue;
}

async function readBackByResolvedFieldIds({
  contact,
  resolvedFields,
}) {
  const customFields = Array.isArray(contact?.contact?.customFields)
    ? contact.contact.customFields
    : Array.isArray(contact?.customFields)
      ? contact.customFields
      : [];

  const byId = new Map();

  for (const field of customFields) {
    if (!field?.id) continue;
    byId.set(field.id, field.value);
  }

  const result = {};

  for (const [fieldKey, resolved] of Object.entries(resolvedFields)) {
    result[fieldKey] = byId.has(resolved.id)
      ? byId.get(resolved.id)
      : undefined;
  }

  return result;
}



async function run39FFieldMetadataDiagnostic() {
  console.log("");
  console.log("========== #39F FIELD METADATA DIAGNOSTIC ==========");
  console.log("");

  const diagnosticKeys = [
    "contact.first_order_date",
    "contact.last_order_date",
    "contact.m06_intelligence_updated_at",
    "contact.category_diversity",
  ];

  for (const fieldKey of diagnosticKeys) {
    const field = await resolveField(
      LOCATION_ID,
      API_KEY,
      fieldKey
    );

    console.log(`FIELD: ${fieldKey}`);
    console.log(`  id:        ${field?.id}`);
    console.log(`  name:      ${field?.name}`);
    console.log(`  dataType:  ${field?.dataType}`);
    console.log(`  location:  ${field?.locationId}`);
    console.log("");
  }

  console.log("========== #39F CONTACT READ-BACK ==========");

  const contact = await fetchContact("ohNVjaJXwSItvVHeMtdG");

  const customFields =
    Array.isArray(contact?.contact?.customFields)
      ? contact.contact.customFields
      : Array.isArray(contact?.customFields)
        ? contact.customFields
        : [];

  const interestingIds = new Set();

  for (const fieldKey of diagnosticKeys) {
    const field = await resolveField(
      LOCATION_ID,
      API_KEY,
      fieldKey
    );

    interestingIds.add(field.id);
  }

  for (const field of customFields) {
    if (interestingIds.has(field?.id)) {
      console.log(
        JSON.stringify(
          {
            id: field.id,
            value: field.value,
          },
          null,
          2
        )
      );
    }
  }

  console.log("");
  console.log("========== #39F RESULT ==========");
  console.log("NO WRITE PERFORMED.");
  console.log("");
}

async function main() {
  assert(API_KEY, "M06_STENZ_API_KEY is required.");

  console.log("");
  console.log("========== #39 CONTROLLED SINGLE-CUSTOMER WRITE ==========");
  console.log("");

  const fieldKeys = getM06FieldKeys();

  console.log(`M06 logical fields: ${fieldKeys.length}`);
  assert(
    fieldKeys.length === 44,
    `Expected 44 M06 fields, found ${fieldKeys.length}`
  );

  console.log("");
  console.log("---------- ACQUISITION ----------");

  const orders = await fetchOrders(LOCATION_ID);

  const qualifyingOrders = orders.filter((order) => {
    const id = order?._id || order?.id;

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

  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers.get(contactId).push(order);
  }

  const targetContactId = [...customers.keys()][0];
  const targetOrders = customers.get(targetContactId);

  console.log(`Target contact: ${targetContactId}`);
  console.log(`Target qualifying orders: ${targetOrders.length}`);

  console.log("");
  console.log("---------- BUILDER ----------");

  /*
   * #38 already proved the exact builder contract.
   * This call intentionally uses the same context shape expected
   * by the existing builder integration.
   *
   * If the builder rejects this invocation shape, STOP.
   * No write happens before the builder succeeds.
   */
  let built;

  try {
    built = await getBuilderFunction()({
      customer: {
        contactId: targetContactId,
        orders: targetOrders,
      },
      customerOrders: targetOrders,
      allQualifyingOrders: targetOrders,
      qualifyingOrders: targetOrders,
      orders: targetOrders,
      now: new Date(),
      locationId: LOCATION_ID,
    });
  } catch (error) {
    fail(
      "Builder invocation did not match the existing #38 contract. " +
      "NO WRITE WAS ATTEMPTED.\n" +
      (error.stack || error.message)
    );
  }

  assert(
    built && typeof built === "object",
    "Builder returned no object."
  );

  const values =
    built.values ||
    built.fields ||
    built;

  assert(
    values && typeof values === "object",
    "Builder returned no field values."
  );

  const actualKeys = Object.keys(values);

  const missing = fieldKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(values, key)
  );

  const extra = actualKeys.filter(
    (key) => !fieldKeys.includes(key)
  );

  console.log(`Computed fields: ${actualKeys.length}/44`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Extra: ${extra.length}`);

  assert(
    missing.length === 0,
    `Builder missing fields: ${missing.join(", ")}`
  );

  assert(
    extra.length === 0,
    `Builder has extra fields: ${extra.join(", ")}`
  );

  console.log("Builder contract: PASS");

  console.log("");
  console.log("---------- FIELD RESOLUTION ----------");

  const resolved = {};

  for (const fieldKey of fieldKeys) {
    const field = await resolveField(
      LOCATION_ID,
      API_KEY,
      fieldKey
    );

    resolved[fieldKey] = field;

    assert(
      field?.id,
      `Could not resolve field ID for ${fieldKey}`
    );
  }

  console.log(`Resolved fields: ${Object.keys(resolved).length}/44`);

  console.log("");
  console.log("---------- SNAPSHOT BEFORE WRITE ----------");

  const before = await fetchContact(targetContactId);

  const beforeValues = {};

  for (const fieldKey of fieldKeys) {
    beforeValues[fieldKey] = extractCustomFieldValue(
      before,
      resolved[fieldKey].id,
      fieldKey
    );
  }

  console.log("Read-before: PASS");

  console.log("");
  console.log("---------- CONTROLLED WRITE ----------");
  console.log("WARNING: ONE CUSTOMER ONLY");
  console.log(`Customer: ${targetContactId}`);
  console.log(`Fields: ${fieldKeys.length}`);
  console.log("");

  const writeResult = await writeContactFields({
    locationId: LOCATION_ID,
    apiKey: API_KEY,
    contactId: targetContactId,
    values,
  });

  assert(
    writeResult?.succeeded !== false,
    "GHL write reported failure."
  );

  console.log("Write request: PASS");

  console.log("");
  console.log("---------- READ BACK ----------");

  const after = await fetchContact(targetContactId);

  /*
   * #39E CANONICAL READ-BACK
   *
   * GHL returns contact custom fields as:
   *   { id, value }
   *
   * The field resolver owns:
   *   logical fieldKey -> location-specific field ID
   *
   * Therefore read-back must use the resolved IDs, not the
   * logical fieldKey as if it were present in the GHL response.
   */
  const actualValues = await readBackByResolvedFieldIds({
    contact: after,
    resolvedFields: resolved,
  });

  const mismatches = [];

  for (const fieldKey of fieldKeys) {
    const expected = values[fieldKey];
    const actual = actualValues[fieldKey];

    const expectedString =
      expected === null || expected === undefined
        ? ""
        : String(expected);

    const actualString =
      actual === null || actual === undefined
        ? ""
        : String(actual);

    if (expectedString !== actualString) {
      mismatches.push({
        fieldKey,
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
        `${mismatch.fieldKey}: expected=${JSON.stringify(
          mismatch.expected
        )} actual=${JSON.stringify(mismatch.actual)}`
      );
    }

    fail("Controlled write read-back failed.");
  }

  console.log("Read-back: PASS");

  console.log("");
  console.log("========== #39 RESULT ==========");
  console.log("");
  console.log(`Customer written: ${targetContactId}`);
  console.log("Fields written: 44/44");
  console.log("Fields read back: 44/44");
  console.log("Mismatches: 0");
  console.log("");
  console.log("TEST #39: PASS — Controlled M06 Single-Customer Write");
  console.log("");
}

if (process.argv.includes("--39f")) {
  run39FFieldMetadataDiagnostic().catch((error) => {
    console.error("");
    console.error("TEST #39F: FAIL");
    console.error(error.stack || error.message);
    process.exit(1);
  });
} else {

main().catch((error) => {
  console.error("");
  console.error("TEST #39: FAIL");
  console.error(error.stack || error.message);
  console.error("");
  process.exit(1);
});
}
