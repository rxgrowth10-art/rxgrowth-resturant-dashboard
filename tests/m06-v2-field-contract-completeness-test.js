const assert = require("assert");

const {
  M06_FIELD_KEYS,
  getM06FieldContract,
} = require("../lib/m06-field-contract");

const EXPECTED_M06_V2_KEYS = [
  // Core Commerce
  "contact.total_orders",
  "contact.first_order_date",
  "contact.last_order_date",
  "contact.lifetime_value",
  "contact.average_order_value",
  "contact.highest_order_value",
  "contact.lowest_order_value",
  "contact.average_order_interval_days",
  "contact.typical_order_interval_days",
  "contact.days_since_last_order",
  "contact.expected_next_order_date",
  "contact.days_overdue",
  "contact.overdue_ratio",

  // Recency / Lifecycle
  "contact.customer_status",

  // Frequency
  "contact.orders_last_30_days",
  "contact.orders_previous_30_days",
  "contact.order_frequency_trend",

  // Spending
  "contact.spend_last_30_days",
  "contact.spend_previous_30_days",
  "contact.spending_trend",

  // Product / Category
  "contact.favorite_category",
  "contact.top_categories",
  "contact.favorite_item",
  "contact.top_items",
  "contact.category_diversity",
  "contact.purchase_consistency",

  // Channel / Location
  "contact.order_source_mix",
  "contact.primary_order_source",
  "contact.preferred_order_type",
  "contact.preferred_location",
  "contact.last_order_type",
  "contact.last_order_location",
  "contact.last_coupon_code",

  // Value / VIP
  "contact.lifetime_spend_percentile",
  "contact.order_frequency_percentile",
  "contact.customer_value_score",
  "contact.vip_classification",
  "contact.vip_status",
  "contact.customer_type",
  "contact.customer_behavior_profile",

  // Win-back
  "contact.winback_eligibility",
  "contact.winback_tier",

  // Summary / Technical
  "contact.customer_intelligence_summary",
  "contact.m06_intelligence_updated_at",
];

async function runTest() {
  console.log(
    "\n========== #32B M06 FIELD CONTRACT COMPLETENESS =========="
  );

  console.log(
    "Expected original M06 V2 logical fields:",
    EXPECTED_M06_V2_KEYS.length
  );

  console.log(
    "Current registry logical fields:",
    M06_FIELD_KEYS.length
  );

  assert.strictEqual(
    EXPECTED_M06_V2_KEYS.length,
    44,
    "Expected M06 V2 contract must contain exactly 44 logical fields."
  );

  assert.strictEqual(
    M06_FIELD_KEYS.length,
    EXPECTED_M06_V2_KEYS.length,
    "M06 registry is not complete."
  );

  console.log("44 logical fields: PASS");

  const expectedSet = new Set(EXPECTED_M06_V2_KEYS);
  const actualSet = new Set(M06_FIELD_KEYS);

  const missing = EXPECTED_M06_V2_KEYS.filter(
    (key) => !actualSet.has(key)
  );

  const unexpected = M06_FIELD_KEYS.filter(
    (key) => !expectedSet.has(key)
  );

  assert.deepStrictEqual(
    missing,
    [],
    `Missing M06 logical fields: ${missing.join(", ")}`
  );

  assert.deepStrictEqual(
    unexpected,
    [],
    `Unexpected logical fields: ${unexpected.join(", ")}`
  );

  console.log("Original contract coverage: PASS");
  console.log("No unexpected fields: PASS");

  assert.strictEqual(
    new Set(M06_FIELD_KEYS).size,
    M06_FIELD_KEYS.length,
    "Duplicate logical fieldKey detected."
  );

  console.log("No duplicate fieldKeys: PASS");

  const contract = getM06FieldContract();

  assert.strictEqual(
    contract.length,
    44,
    "M06 field contract must contain exactly 44 entries."
  );

  for (const field of contract) {
    assert.ok(field.fieldKey);
    assert.strictEqual(field.model, "contact");

    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(field, "id"),
      false
    );

    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(field, "fieldId"),
      false
    );
  }

  console.log("No location-specific IDs: PASS");
  console.log("Contact model contract: PASS");

  console.log("\n---------- MISSING 12 NOW COVERED ----------");

  for (const key of [
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
  ]) {
    console.log(`✓ ${key}`);
  }

  console.log(
    "\nTEST #32B: PASS — M06 V2 44-Field Logical Contract Complete\n"
  );
}

runTest().catch((error) => {
  console.error("\nTEST #32B: FAIL");
  console.error(error);
  process.exit(1);
});
