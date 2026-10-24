const assert = require("assert");

const {
  CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY,
  attachCustomerIntelligenceSummary,
} = require("../lib/intelligence-summary");

function runTest() {
  console.log("\n========== #29B SUMMARY INTEGRATION CONTRACT ==========");

  const intelligence = {
    contactId: "CUSTOMER_29B_001",

    totalOrders: 5,
    firstOrderDate: "2026-01-10T10:00:00.000Z",
    lastOrderDate: "2026-10-20T10:00:00.000Z",

    customerStatus: "Active",
    recencyBand: "Recent / Active",
    daysSinceLastOrder: 3.5,

    lifetimeValue: 595,
    averageOrderValue: 119,
    highestOrderValue: 150,
    lowestOrderValue: 90,

    customerValueScore: 82.5,

    ordersLast30Days: 2,
    ordersPrevious30Days: 1,
    frequencyTrend: "Increasing",

    averageOrderInterval: 12.5,
    typicalOrderInterval: 10,
    expectedNextOrderDate: "2026-10-30T10:00:00.000Z",
    daysOverdue: 0,
    orderCycleRatio: 0.35,

    spendLast30Days: 240,
    spendPrevious30Days: 110,
    spendingTrend: "Increasing",

    favoriteItem: "Americano",
    topItems: [
      { name: "Americano", quantity: 4, spend: 440 },
      { name: "Latte", quantity: 1, spend: 155 },
    ],

    purchaseConsistency: "Highly Consistent",

    orderSourceMix: "OTHER RESTAURANT",
    primaryOrderSource: "OTHER RESTAURANT",
    lastCouponCode: "MOHA25",

    winbackEligible: false,
    winbackTier: "None",
  };

  const result = attachCustomerIntelligenceSummary(intelligence);

  // 1. Original intelligence object must remain intact.
  assert.strictEqual(result.totalOrders, 5);
  assert.strictEqual(result.lifetimeValue, 595);
  assert.strictEqual(result.favoriteItem, "Americano");

  // 2. Summary field must exist under the exact locked GHL field ID.
  assert.ok(
    Object.prototype.hasOwnProperty.call(
      result,
      CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY
    )
  );

  const summary = result[CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY];

  // 3. Summary must be a human-readable string.
  assert.strictEqual(typeof summary, "string");
  assert.ok(summary.trim().length > 0);
  assert.ok(summary.includes("\n"));

  // 4. It must contain actual intelligence.
  assert.ok(summary.includes("Customer Intelligence"));
  assert.ok(summary.includes("Total Orders: 5"));
  assert.ok(summary.includes("Lifetime Value: 595"));
  assert.ok(summary.includes("Favorite Item: Americano"));
  assert.ok(summary.includes("Highly Consistent"));
  assert.ok(summary.includes("OTHER RESTAURANT"));

  // 5. No raw JSON dump.
  assert.ok(!summary.includes('"totalOrders"'));
  assert.ok(!summary.includes('"lifetimeValue"'));

  // 6. No mutation of source intelligence into a different structure.
  assert.strictEqual(result.contactId, intelligence.contactId);
  assert.strictEqual(result.customerStatus, intelligence.customerStatus);

  // 7. Must be deterministic.
  const secondResult =
    attachCustomerIntelligenceSummary(intelligence);

  assert.strictEqual(
    result[CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY],
    secondResult[CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY]
  );

  // 8. Must work without STENZ-specific values.
  assert.ok(!summary.includes("STENZ STORE"));

  // 9. Insufficient Data must survive integration.
  const insufficient = attachCustomerIntelligenceSummary({
    ...intelligence,
    frequencyTrend: "Insufficient Data",
    spendingTrend: "Insufficient Data",
    purchaseConsistency: "Insufficient Data",
  });

  assert.ok(
    insufficient[CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY].includes(
      "Insufficient Data"
    )
  );

  console.log("Exact M06 Summary field ID: PASS");
  console.log("Intelligence → Summary integration: PASS");
  console.log("Human-readable field value: PASS");
  console.log("Source intelligence preservation: PASS");
  console.log("No raw JSON dump: PASS");
  console.log("Restaurant-agnostic behavior: PASS");
  console.log("Insufficient Data preservation: PASS");
  console.log("Determinism: PASS");

  console.log(
    "\nTEST #29B: PASS — Summary Integration Contract Valid\n"
  );
}

runTest();
