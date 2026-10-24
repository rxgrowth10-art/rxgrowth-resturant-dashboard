const assert = require("assert");

const { request } = require("../lib/ghl");
const {
  writeContactFields,
} = require("../lib/contact-writer");
const {
  resolveField,
  clearFieldCache,
} = require("../lib/field-resolver");

const LOCATION_ID =
  "V2q4leIVzpDKRiljAOOj";

async function getContacts(apiKey) {
  const response = await request(
    `/contacts/?locationId=${LOCATION_ID}&limit=100&page=1`,
    apiKey
  );

  return Array.isArray(response?.contacts)
    ? response.contacts
    : Array.isArray(response?.data)
      ? response.data
      : [];
}

async function getContact(contactId, apiKey) {
  return request(
    `/contacts/${encodeURIComponent(contactId)}`,
    apiKey
  );
}

function getCustomFieldValue(contact, fieldId) {
  const fields =
    Array.isArray(contact?.customFields)
      ? contact.customFields
      : [];

  const field = fields.find(
    (item) =>
      item?.id === fieldId ||
      item?.fieldId === fieldId
  );

  if (!field) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(field, "value")) {
    return field.value;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      field,
      "fieldValue"
    )
  ) {
    return field.fieldValue;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      field,
      "field_value"
    )
  ) {
    return field.field_value;
  }

  return undefined;
}

async function runTest() {
  console.log(
    "\n========== #35 GENERIC CONTACT WRITE LAYER ==========\n"
  );

  const apiKey = process.env.M06_STENZ_API_KEY;

  assert.ok(
    apiKey,
    "M06_STENZ_API_KEY is missing."
  );

  clearFieldCache();

  // We use an existing, already-proven M06 field.
  // The test temporarily writes a marker and restores
  // the original value afterward.
  const fieldKey =
    "contact.last_coupon_code";

  const field = await resolveField(
    LOCATION_ID,
    apiKey,
    fieldKey
  );

  console.log("Resolved logical field:");
  console.log(`  fieldKey: ${field.fieldKey}`);
  console.log(`  fieldId:  ${field.id}`);
  console.log(`  name:     ${field.name}`);

  assert.strictEqual(
    field.fieldKey,
    fieldKey
  );

  assert.ok(field.id);

  const contacts = await getContacts(apiKey);

  assert.ok(
    contacts.length > 0,
    "No STENZ contacts available for write test."
  );

  const contactId =
    contacts[0]?._id ||
    contacts[0]?.id;

  assert.ok(
    contactId,
    "Could not resolve a STENZ contactId."
  );

  console.log(`\nTest contactId: ${contactId}`);

  const before = await getContact(
    contactId,
    apiKey
  );

  const beforeContact =
    before?.contact || before;

  const originalValue =
    getCustomFieldValue(
      beforeContact,
      field.id
    );

  console.log(
    "Original value:",
    originalValue
  );

  const marker =
    `M06_WRITE_TEST_${Date.now()}`;

  console.log(
    "\n---------- WRITE ----------"
  );

  const writeResult =
    await writeContactFields({
      locationId: LOCATION_ID,
      apiKey,
      contactId,
      values: {
        [fieldKey]: marker,
      },
    });

  assert.strictEqual(
    writeResult.succeeded,
    true
  );

  assert.strictEqual(
    writeResult.updatedFields.length,
    1
  );

  assert.strictEqual(
    writeResult.updatedFields[0].fieldKey,
    fieldKey
  );

  assert.strictEqual(
    writeResult.updatedFields[0].fieldId,
    field.id
  );

  console.log(
    "Write succeeded: PASS"
  );

  console.log(
    "Resolved fieldKey → fieldId: PASS"
  );

  console.log(
    "Location-specific ID used: PASS"
  );

  console.log(
    "\n---------- READ BACK ----------"
  );

  const after = await getContact(
    contactId,
    apiKey
  );

  const afterContact =
    after?.contact || after;

  const persistedValue =
    getCustomFieldValue(
      afterContact,
      field.id
    );

  console.log(
    "Persisted value:",
    persistedValue
  );

  assert.strictEqual(
    String(persistedValue),
    marker
  );

  console.log(
    "Write persisted in GHL: PASS"
  );

  console.log(
    "\n---------- RESTORE ----------"
  );

  const restoreValue =
    originalValue === undefined
      ? ""
      : originalValue;

  await writeContactFields({
    locationId: LOCATION_ID,
    apiKey,
    contactId,
    values: {
      [fieldKey]: restoreValue,
    },
  });

  const restored = await getContact(
    contactId,
    apiKey
  );

  const restoredContact =
    restored?.contact || restored;

  const restoredValue =
    getCustomFieldValue(
      restoredContact,
      field.id
    );

  if (originalValue === undefined) {
    assert.ok(
      restoredValue === undefined ||
      restoredValue === null ||
      restoredValue === ""
    );
  } else {
    assert.strictEqual(
      String(restoredValue),
      String(originalValue)
    );
  }

  console.log(
    "Original value restored: PASS"
  );

  console.log(
    "\n---------- CONTRACT CHECKS ----------"
  );

  console.log(
    "M06 writes by fieldKey, not field ID: PASS"
  );

  console.log(
    "Field resolver owns location-specific ID resolution: PASS"
  );

  console.log(
    "Generic Contact Write Layer: PASS"
  );

  console.log(
    "\nTEST #35: PASS — Generic Contact Write Layer Valid\n"
  );
}

runTest().catch((error) => {
  console.error("\nTEST #35: FAIL");
  console.error(error);
  process.exit(1);
});
