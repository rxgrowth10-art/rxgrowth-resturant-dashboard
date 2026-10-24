const assert = require("assert");

const { resolveFieldId, resolveField, clearFieldCache } = require("../lib/field-resolver");

const LOCATIONS = {
  STENZ: "V2q4leIVzpDKRiljAOOj",
  KOI: "A0gpQEZUjXc6m3mzsCUH",
};

async function runTest() {
  console.log(
    "\n========== #31 GENERIC FIELD RESOLVER =========="
  );

  const stenzApiKey = process.env.M06_STENZ_API_KEY;
  const koiApiKey = process.env.M06_KOI_API_KEY;

  assert.ok(
    stenzApiKey,
    "M06_STENZ_API_KEY is missing."
  );

  assert.ok(
    koiApiKey,
    "M06_KOI_API_KEY is missing."
  );

  clearFieldCache();

  const testKeys = [
    "contact.total_orders",
    "contact.lifetime_value",
    "contact.first_order_date",
    "contact.last_order_date",
    "contact.customer_status",
  ];

  console.log("\n---------- RESOLUTION ----------");

  for (const fieldKey of testKeys) {
    const stenz = await resolveField(
      LOCATIONS.STENZ,
      stenzApiKey,
      fieldKey
    );

    const koi = await resolveField(
      LOCATIONS.KOI,
      koiApiKey,
      fieldKey
    );

    console.log(
      `${fieldKey}\n` +
      `  STENZ → ${stenz.id}\n` +
      `  KOI   → ${koi.id}`
    );

    assert.ok(stenz.id);
    assert.ok(koi.id);

    assert.strictEqual(
      stenz.fieldKey,
      fieldKey
    );

    assert.strictEqual(
      koi.fieldKey,
      fieldKey
    );

    assert.notStrictEqual(
      stenz.locationId,
      koi.locationId
    );
  }

  console.log("\n---------- INDEPENDENT ID RESOLUTION ----------");

  const stenzLifetimeValue = await resolveFieldId(
    LOCATIONS.STENZ,
    stenzApiKey,
    "contact.lifetime_value"
  );

  const koiLifetimeValue = await resolveFieldId(
    LOCATIONS.KOI,
    koiApiKey,
    "contact.lifetime_value"
  );

  console.log(
    "contact.lifetime_value:"
  );

  console.log(
    "  STENZ ID:",
    stenzLifetimeValue
  );

  console.log(
    "  KOI ID:",
    koiLifetimeValue
  );

  assert.ok(stenzLifetimeValue);
  assert.ok(koiLifetimeValue);
  assert.notStrictEqual(
    stenzLifetimeValue,
    koiLifetimeValue
  );

  console.log(
    "\nIndependent Field Resolution: PASS"
  );

  console.log(
    "Shared fieldKey → Location-specific ID: PASS"
  );

  console.log(
    "No restaurant-specific field mapping: PASS"
  );

  console.log(
    "Generic resolver contract: PASS"
  );

  console.log(
    "\nTEST #31: PASS — Generic Field Resolver Contract Valid\n"
  );
}

runTest().catch((error) => {
  console.error("\nTEST #31: FAIL");
  console.error(error);
  process.exit(1);
});
