const assert = require("assert");

const {
  buildCustomerIntelligenceSummary,
} = require("../lib/intelligence-summary");

function runTest() {
  console.log("\n========== #29 CUSTOMER INTELLIGENCE SUMMARY ==========");

  const customer = {
    contactId: "CUSTOMER_TEST_001",

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
    vipClassification: null,
    vipStatus: null,

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

    favoriteCategory: null,
    topCategories: [],
    favoriteItem: "Americano",
    topItems: [
      { name: "Americano", quantity: 4, spend: 440 },
      { name: "Latte", quantity: 1, spend: 155 },
    ],

    categoryDiversity: null,
    purchaseConsistency: "Highly Consistent",

    orderSourceMix: "STENZ STORE",
    primaryOrderSource: "STENZ STORE",
    preferredOrderType: null,
    preferredLocation: null,
    lastOrderType: null,
    lastOrderLocation: null,
    lastCouponCode: "MOHA25",

    winbackEligible: false,
    winbackTier: "None",

    customerType: "Unclassified",
    behaviorProfile: "Unclassified",
  };

  const summary = buildCustomerIntelligenceSummary(customer);

  console.log("\n---------- SUMMARY ----------");
  console.log(summary);
  console.log("-----------------------------\n");

  // 1. Must return a human-readable string.
  assert.strictEqual(typeof summary, "string");
  assert.ok(summary.trim().length > 0);

  // 2. Must be multiline.
  assert.ok(summary.includes("\n"));

  // 3. Required intelligence sections.
  const requiredSections = [
    "Customer Intelligence",
    "Lifecycle",
    "Value",
    "Frequency",
    "Behavior",
    "Action Signals",
  ];

  for (const section of requiredSections) {
    assert.ok(
      summary.includes(section),
      `Missing required section: ${section}`
    );
  }

  // 4. Core values must survive into the narrative.
  const requiredValues = [
    "5",
    "595",
    "119",
    "Americano",
    "Highly Consistent",
    "Increasing",
    "STENZ STORE",
    "MOHA25",
  ];

  for (const value of requiredValues) {
    assert.ok(
      summary.includes(value),
      `Missing expected value in summary: ${value}`
    );
  }

  // 5. Null/unavailable values must NOT become invented business data.
  assert.ok(!summary.includes("Unknown"));
  assert.ok(!summary.includes("N/A"));

  // 6. Unsupported taxonomy labels must not be promoted as intelligence.
  assert.ok(!summary.includes("Customer Type: Unclassified"));
  assert.ok(!summary.includes("Behavior Profile: Unclassified"));

  // 7. Summary must not be a raw JSON dump.
  assert.ok(!summary.trim().startsWith("{"));
  assert.ok(!summary.includes('"totalOrders"'));
  assert.ok(!summary.includes('"lifetimeValue"'));

  // 8. No STENZ-specific business logic.
  // STENZ STORE is only fixture data, not a required value.
  const secondCustomer = {
    ...customer,
    contactId: "CUSTOMER_TEST_002",
    orderSourceMix: "OTHER RESTAURANT",
    primaryOrderSource: "OTHER RESTAURANT",
  };

  const secondSummary = buildCustomerIntelligenceSummary(secondCustomer);

  assert.ok(secondSummary.includes("OTHER RESTAURANT"));
  assert.ok(!secondSummary.includes("STENZ STORE"));

  // 9. Insufficient Data must be preserved explicitly.
  const insufficientCustomer = {
    ...customer,
    frequencyTrend: "Insufficient Data",
    spendingTrend: "Insufficient Data",
    favoriteCategory: null,
    topCategories: [],
    purchaseConsistency: "Insufficient Data",
    preferredOrderType: null,
    preferredLocation: null,
    lastOrderType: null,
    lastOrderLocation: null,
    lastCouponCode: null,
  };

  const insufficientSummary =
    buildCustomerIntelligenceSummary(insufficientCustomer);

  assert.ok(insufficientSummary.includes("Insufficient Data"));
  assert.ok(!insufficientSummary.includes("Unknown"));
  assert.ok(!insufficientSummary.includes("N/A"));

  // 10. Determinism.
  const repeatSummary = buildCustomerIntelligenceSummary(customer);

  assert.strictEqual(summary, repeatSummary);

  console.log("Human-readable summary: PASS");
  console.log("Multiline structure: PASS");
  console.log("Required sections: PASS");
  console.log("Core intelligence preservation: PASS");
  console.log("Null/unavailable safety: PASS");
  console.log("Taxonomy safety: PASS");
  console.log("No raw JSON dump: PASS");
  console.log("Restaurant-agnostic behavior: PASS");
  console.log("Insufficient Data preservation: PASS");
  console.log("Determinism: PASS");

  console.log("\nTEST #29: PASS — Customer Intelligence Summary Contract Valid\n");
}

runTest();
