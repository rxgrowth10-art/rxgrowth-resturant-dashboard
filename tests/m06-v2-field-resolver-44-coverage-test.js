const {
  getM06FieldKeys,
} = require("../lib/m06-field-contract");

const {
  resolveField,
  clearFieldCache,
} = require("../lib/field-resolver");

const STENZ_LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const KOI_LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

const STENZ_API_KEY = process.env.M06_STENZ_API_KEY;
const KOI_API_KEY = process.env.M06_KOI_API_KEY;

async function testLocation(name, locationId, apiKey) {
  if (!apiKey) {
    throw new Error(
      `${name}: required M06 location API key environment variable is missing.`
    );
  }

  clearFieldCache();

  const fieldKeys = getM06FieldKeys();

  const resolved = [];
  const missing = [];
  const invalid = [];

  for (const fieldKey of fieldKeys) {
    try {
      const field = await resolveField(
        locationId,
        apiKey,
        fieldKey
      );

      if (!field?.id) {
        invalid.push(fieldKey);
        continue;
      }

      resolved.push({
        fieldKey,
        id: field.id,
      });
    } catch (error) {
      missing.push({
        fieldKey,
        error: error.message,
      });
    }
  }

  console.log("");
  console.log(`========== ${name} 44-FIELD RESOLUTION ==========`);

  console.log(`Expected fieldKeys: ${fieldKeys.length}`);
  console.log(`Resolved: ${resolved.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Invalid: ${invalid.length}`);

  if (missing.length > 0) {
    console.log("");
    console.log("Missing fields:");
    for (const item of missing) {
      console.log(`- ${item.fieldKey}`);
    }
  }

  if (invalid.length > 0) {
    console.log("");
    console.log("Invalid resolutions:");
    for (const fieldKey of invalid) {
      console.log(`- ${fieldKey}`);
    }
  }

  return {
    name,
    expected: fieldKeys.length,
    resolved,
    missing,
    invalid,
  };
}

async function main() {
  const stenz = await testLocation(
    "STENZ",
    STENZ_LOCATION_ID,
    STENZ_API_KEY
  );

  const koi = await testLocation(
    "KOI",
    KOI_LOCATION_ID,
    KOI_API_KEY
  );

  const stenzPass =
    stenz.resolved.length === stenz.expected &&
    stenz.missing.length === 0 &&
    stenz.invalid.length === 0;

  const koiExpectedMissing = new Set([
    "contact.customer_intelligence_summary",
    "contact.m06_intelligence_updated_at",
    "contact.top_categories",
    "contact.top_items",
    "contact.category_diversity",
    "contact.purchase_consistency",
    "contact.order_source_mix",
    "contact.primary_order_source",
    "contact.lifetime_spend_percentile",
    "contact.order_frequency_percentile",
    "contact.customer_value_score",
    "contact.vip_status",
    "contact.vip_classification",
    "contact.customer_behavior_profile",
  ]);

  const koiPass =
    koi.resolved.length === koi.expected - koiExpectedMissing.size &&
    koi.missing.length === koiExpectedMissing.size &&
    koi.missing.every((item) =>
      koiExpectedMissing.has(item.fieldKey)
    ) &&
    koi.invalid.length === 0;

  console.log("");
  console.log("========== #33B CONTRACT CHECKS ==========");

  console.log(
    `STENZ 44/44 resolution: ${stenzPass ? "PASS" : "FAIL"}`
  );

  console.log(
    `KOI expected availability: ${koiPass ? "PASS" : "FAIL"}`
  );

  console.log(
    `No invalid STENZ resolutions: ${
      stenz.invalid.length === 0 ? "PASS" : "FAIL"
    }`
  );

  console.log(
    `No unexpected KOI missing fields: ${
      koiPass ? "PASS" : "FAIL"
    }`
  );

  if (!stenzPass || !koiPass) {
    throw new Error(
      "TEST #33B FAILED — Full 44-field resolver coverage contract is not satisfied."
    );
  }

  console.log("");
  console.log(
    "TEST #33B: PASS — Full 44-Field Resolver Coverage Valid"
  );
}

main().catch((error) => {
  console.error("");
  console.error("TEST #33B: FAIL");
  console.error(error.message);
  process.exit(1);
});
