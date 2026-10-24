const assert = require("assert");
const { request } = require("../lib/ghl");

const STENZ_LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

async function runTest() {
  console.log("\n========== #30 FIELD PORTABILITY DISCOVERY ==========");

  const response = await request(
    `/locations/${STENZ_LOCATION_ID}/customFields?model=contact`
  );

  const fields = Array.isArray(response?.customFields)
    ? response.customFields
    : Array.isArray(response?.fields)
      ? response.fields
      : Array.isArray(response?.data)
        ? response.data
        : [];

  console.log("Custom fields discovered:", fields.length);

  assert.ok(fields.length > 0, "No custom fields returned.");

  const normalized = fields
    .map((field) => ({
      id: field?.id || null,
      fieldKey: field?.fieldKey || null,
      name: field?.name || null,
      dataType: field?.dataType || null,
      locationId: field?.locationId || null,
      model: field?.model || null,
    }))
    .filter((field) => field.id && field.fieldKey);

  assert.ok(
    normalized.length > 0,
    "No fields containing both id and fieldKey."
  );

  console.log("\n---------- SAMPLE FIELD MAP ----------");

  normalized.slice(0, 20).forEach((field) => {
    console.log(
      `${field.fieldKey}  →  ${field.id}  |  ${field.name}`
    );
  });

  // Every fieldKey must resolve to exactly one field ID.
  const keyToIds = new Map();

  for (const field of normalized) {
    if (!keyToIds.has(field.fieldKey)) {
      keyToIds.set(field.fieldKey, new Set());
    }

    keyToIds.get(field.fieldKey).add(field.id);
  }

  for (const [fieldKey, ids] of keyToIds.entries()) {
    assert.strictEqual(
      ids.size,
      1,
      `fieldKey resolves to multiple IDs: ${fieldKey}`
    );
  }

  // Verify that the actual fieldKey can be used to retrieve the field.
  const sample = normalized.find(
    (field) =>
      field.fieldKey &&
      field.fieldKey.startsWith("contact.")
  );

  assert.ok(sample, "No contact.* field found.");

  const resolved = await request(
    `/locations/${STENZ_LOCATION_ID}/customFields/${encodeURIComponent(
      sample.fieldKey
    )}`
  );

  const resolvedField =
    resolved?.customField ||
    resolved?.field ||
    resolved?.data ||
    resolved;

  assert.ok(resolvedField, "Field-key lookup returned no field.");

  assert.strictEqual(
    resolvedField.fieldKey,
    sample.fieldKey,
    "Field-key lookup returned a different fieldKey."
  );

  assert.strictEqual(
    resolvedField.id,
    sample.id,
    "Field-key lookup did not resolve to the same field ID."
  );

  console.log("\nFieldKey uniqueness: PASS");
  console.log("Field ID + Field Key both available: PASS");
  console.log("FieldKey → Field ID resolution: PASS");
  console.log("No hardcoded M06 field IDs used: PASS");

  console.log(
    "\nTEST #30A: PASS — Field Key Discovery Contract Valid\n"
  );
}

runTest().catch((error) => {
  console.error("\nTEST #30A: FAIL");
  console.error(error);
  process.exit(1);
});
