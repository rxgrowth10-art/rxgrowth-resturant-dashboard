const assert = require("assert");

const {
  M06_FIELD_KEYS,
  getM06FieldContract,
} = require("../lib/m06-field-contract");

const {
  resolveField,
} = require("../lib/field-resolver");

const LOCATIONS = {
  STENZ: "V2q4leIVzpDKRiljAOOj",
  KOI: "A0gpQEZUjXc6m3mzsCUH",
};

async function runTest() {
  console.log(
    "\n========== #32 M06 FIELD CONTRACT REGISTRY =========="
  );

  const contract = getM06FieldContract();

  console.log("M06 logical fields:", contract.length);

  assert.ok(
    contract.length > 0,
    "M06 field contract is empty."
  );

  // Every contract entry must be logical only.
  for (const field of contract) {
    assert.ok(
      field.fieldKey,
      "Field contract contains an empty fieldKey."
    );

    assert.ok(
      field.fieldKey.startsWith("contact."),
      `Invalid contact fieldKey: ${field.fieldKey}`
    );

    assert.strictEqual(
      field.model,
      "contact"
    );

    // The contract must never contain location-specific IDs.
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(field, "id"),
      false
    );

    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(field, "fieldId"),
      false
    );
  }

  console.log("Logical key format: PASS");
  console.log("No location-specific field IDs: PASS");

  // No duplicate logical keys.
  const uniqueKeys = new Set(M06_FIELD_KEYS);

  assert.strictEqual(
    uniqueKeys.size,
    M06_FIELD_KEYS.length,
    "Duplicate M06 fieldKey detected."
  );

  console.log("Unique field keys: PASS");

  // Critical M06 contract keys.
  const requiredKeys = [
    "contact.total_orders",
    "contact.first_order_date",
    "contact.last_order_date",
    "contact.lifetime_value",
    "contact.average_order_value",
    "contact.typical_order_interval_days",
    "contact.days_since_last_order",
    "contact.expected_next_order_date",
    "contact.days_overdue",
    "contact.overdue_ratio",
    "contact.orders_last_30_days",
    "contact.orders_previous_30_days",
    "contact.order_frequency_trend",
    "contact.spend_last_30_days",
    "contact.spend_previous_30_days",
    "contact.spending_trend",
    "contact.favorite_category",
    "contact.favorite_item",
    "contact.preferred_order_type",
    "contact.preferred_location",
    "contact.last_order_type",
    "contact.last_order_location",
    "contact.last_coupon_code",
    "contact.customer_status",
    "contact.customer_type",
    "contact.winback_eligibility",
    "contact.winback_tier",
  ];

  for (const key of requiredKeys) {
    assert.ok(
      uniqueKeys.has(key),
      `Required M06 field missing from registry: ${key}`
    );
  }

  console.log("Required M06 keys present: PASS");

  // Prove the registry is actually location-portable
  // by resolving logical keys against STENZ.
  const stenzApiKey = process.env.M06_STENZ_API_KEY;

  assert.ok(
    stenzApiKey,
    "M06_STENZ_API_KEY is missing."
  );

  let stenzResolved = 0;
  const stenzMissing = [];

  for (const fieldKey of M06_FIELD_KEYS) {
    try {
      const field = await resolveField(
        LOCATIONS.STENZ,
        stenzApiKey,
        fieldKey
      );

      assert.ok(field.id);
      assert.strictEqual(field.fieldKey, fieldKey);

      stenzResolved += 1;
    } catch (error) {
      stenzMissing.push(fieldKey);
    }
  }

  console.log(
    `STENZ resolved: ${stenzResolved}/${M06_FIELD_KEYS.length}`
  );

  if (stenzMissing.length > 0) {
    console.log("STENZ missing:", stenzMissing);
  }

  assert.strictEqual(
    stenzMissing.length,
    0,
    "STENZ is missing one or more M06 contract fields."
  );

  console.log("STENZ contract resolution: PASS");

  // Koi is intentionally allowed to be incomplete right now.
  // This is expected because the M06 V2 fields have not all been
  // created in Koi Roll yet.
  const koiApiKey = process.env.M06_KOI_API_KEY;

  assert.ok(
    koiApiKey,
    "M06_KOI_API_KEY is missing."
  );

  let koiResolved = 0;
  const koiMissing = [];

  for (const fieldKey of M06_FIELD_KEYS) {
    try {
      const field = await resolveField(
        LOCATIONS.KOI,
        koiApiKey,
        fieldKey
      );

      assert.ok(field.id);
      assert.strictEqual(field.fieldKey, fieldKey);

      koiResolved += 1;
    } catch (error) {
      koiMissing.push(fieldKey);
    }
  }

  console.log(
    `Koi resolved: ${koiResolved}/${M06_FIELD_KEYS.length}`
  );

  console.log(
    `Koi missing: ${koiMissing.length}`
  );

  if (koiMissing.length > 0) {
    console.log("\nKoi fields not created yet:");
    for (const fieldKey of koiMissing) {
      console.log(`  - ${fieldKey}`);
    }
  }

  console.log("\n---------- CONTRACT PRINCIPLES ----------");

  console.log(
    "Registry contains logical fieldKeys only: PASS"
  );

  console.log(
    "Location-specific IDs excluded from contract: PASS"
  );

  console.log(
    "STENZ resolves through generic resolver: PASS"
  );

  console.log(
    "Koi can be partially provisioned without changing M06 code: PASS"
  );

  console.log(
    "\nTEST #32: PASS — M06 Field Contract Registry Valid\n"
  );
}

runTest().catch((error) => {
  console.error("\nTEST #32: FAIL");
  console.error(error);
  process.exit(1);
});
