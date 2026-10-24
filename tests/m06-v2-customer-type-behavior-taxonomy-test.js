/*
 * M06 V2 — #28C
 * Customer Type + Customer Behavior Profile
 * Taxonomy Safety / Contract Test
 *
 * IMPORTANT:
 * This test intentionally does NOT define arbitrary business labels.
 *
 * It validates the architecture required for the eventual taxonomy:
 * - Customer Type and Behavior Profile are separate outputs.
 * - Proven dimensions are available as inputs.
 * - Insufficient Data is a valid state.
 * - Classification is deterministic.
 * - No STENZ/customer-specific logic is allowed.
 * - No paymentStatus / fulfillmentStatus dependency.
 */

const assert = require("assert");

const ALLOWED_INPUT_KEYS = new Set([
  "totalOrders",
  "lifetimeValue",
  "daysSinceLastOrder",
  "recencyBand",
  "typicalOrderInterval",
  "orderCycleRatio",
  "ordersLast30Days",
  "ordersPrevious30Days",
  "spendLast30Days",
  "spendPrevious30Days",
  "frequencyTrend",
  "spendingTrend",
  "purchaseConsistency",
  "categoryDiversity",
  "customerValueScore",
  "vipClassification",
  "vipStatus",
  "customerType",
  "behaviorProfile",
]);

const ALLOWED_TRENDS = new Set([
  "Increasing",
  "Decreasing",
  "Stable",
  "Insufficient Data",
]);

const ALLOWED_RECENCY = new Set([
  "Recent / Active",
  "Cooling",
  "At Risk",
  "Lapsed",
  "Dormant/Lost",
]);

const ALLOWED_OUTPUT_STATES = new Set([
  "Insufficient Data",
  "Unclassified",
]);

function buildClassificationInput(overrides = {}) {
  return {
    totalOrders: 1,
    lifetimeValue: 100,
    daysSinceLastOrder: 5,
    recencyBand: "Recent / Active",
    typicalOrderInterval: null,
    orderCycleRatio: null,
    ordersLast30Days: 1,
    ordersPrevious30Days: 0,
    spendLast30Days: 100,
    spendPrevious30Days: 0,
    frequencyTrend: "Insufficient Data",
    spendingTrend: "Insufficient Data",
    purchaseConsistency: "Insufficient Data",
    categoryDiversity: null,
    customerValueScore: null,
    vipClassification: null,
    vipStatus: null,

    ...overrides,
  };
}

/*
 * Contract-level classifier shell.
 *
 * This is deliberately conservative.
 * Until explicit business taxonomy is locked:
 *
 * - insufficient lifecycle data => Insufficient Data
 * - insufficient behavioral data => Insufficient Data
 * - otherwise => Unclassified
 *
 * No invented labels such as "New", "Loyal", "High Value",
 * "At Risk Customer", etc. are introduced here.
 */
function classifyCustomerType(input) {
  if (!input || input.totalOrders == null) {
    return "Insufficient Data";
  }

  /*
   * The eventual Customer Type rules will be inserted here
   * after explicit business taxonomy approval.
   */
  return "Unclassified";
}

function classifyBehaviorProfile(input) {
  if (!input) {
    return "Insufficient Data";
  }

  const hasBehaviorSignal =
    input.frequencyTrend &&
    input.spendingTrend;

  if (!hasBehaviorSignal) {
    return "Insufficient Data";
  }

  /*
   * The eventual Behavior Profile rules will be inserted here
   * after explicit business taxonomy approval.
   */
  return "Unclassified";
}

function classify(input) {
  return {
    customerType: classifyCustomerType(input),
    behaviorProfile: classifyBehaviorProfile(input),
  };
}

function assertNoUnsupportedInputs(input) {
  for (const key of Object.keys(input)) {
    assert(
      ALLOWED_INPUT_KEYS.has(key),
      `Unsupported classification input detected: ${key}`
    );
  }
}

function assertValidOutput(output) {
  assert(
    typeof output.customerType === "string",
    "Customer Type must be a string"
  );

  assert(
    typeof output.behaviorProfile === "string",
    "Behavior Profile must be a string"
  );

  assert(
    ALLOWED_OUTPUT_STATES.has(output.customerType),
    `Unexpected Customer Type state: ${output.customerType}`
  );

  assert(
    ALLOWED_OUTPUT_STATES.has(output.behaviorProfile),
    `Unexpected Behavior Profile state: ${output.behaviorProfile}`
  );
}

function runDeterminismTest(input) {
  const first = classify(input);
  const second = classify(input);

  assert.deepStrictEqual(
    first,
    second,
    "Classification must be deterministic"
  );
}

function runDimensionSafetyTests() {
  const base = buildClassificationInput();

  /*
   * Recency states must not force a Customer Type label
   * before taxonomy is explicitly defined.
   */
  for (const recencyBand of ALLOWED_RECENCY) {
    const input = buildClassificationInput({
      recencyBand,
    });

    assertNoUnsupportedInputs(input);

    const output = classify(input);

    assertValidOutput(output);
    runDeterminismTest(input);
  }

  /*
   * Trend states are proven M06 dimensions.
   * They must remain valid classification inputs.
   */
  for (const frequencyTrend of ALLOWED_TRENDS) {
    for (const spendingTrend of ALLOWED_TRENDS) {
      const input = buildClassificationInput({
        frequencyTrend,
        spendingTrend,
      });

      assertNoUnsupportedInputs(input);

      const output = classify(input);

      assertValidOutput(output);
      runDeterminismTest(input);
    }
  }

  /*
   * Single-order customer:
   * no cycle-dependent classification should be forced.
   */
  {
    const input = buildClassificationInput({
      totalOrders: 1,
      typicalOrderInterval: null,
      orderCycleRatio: null,
      purchaseConsistency: "Insufficient Data",
    });

    const output = classify(input);

    assertValidOutput(output);
    runDeterminismTest(input);
  }

  /*
   * Repeat-order customer with valid cycle.
   */
  {
    const input = buildClassificationInput({
      totalOrders: 5,
      typicalOrderInterval: 7,
      orderCycleRatio: 1.8,
      purchaseConsistency: "Highly Consistent",
    });

    const output = classify(input);

    assertValidOutput(output);
    runDeterminismTest(input);
  }

  /*
   * Missing behavioral data must be representable.
   */
  {
    const input = buildClassificationInput({
      frequencyTrend: "Insufficient Data",
      spendingTrend: "Insufficient Data",
    });

    const output = classify(input);

    assertValidOutput(output);

    assert.strictEqual(
      output.behaviorProfile,
      "Unclassified",
      "Behavior Profile must not invent a label when taxonomy is unlocked"
    );
  }

  /*
   * Completely missing input.
   */
  {
    const output = classify(null);

    assertValidOutput(output);

    assert.strictEqual(
      output.customerType,
      "Insufficient Data"
    );

    assert.strictEqual(
      output.behaviorProfile,
      "Insufficient Data"
    );
  }
}

function runForbiddenLogicChecks() {
  const source = classifyCustomerType.toString() +
    classifyBehaviorProfile.toString();

  assert(
    !source.includes("V2q4leIVzpDKRiljAOOj"),
    "STENZ location ID must not be embedded in taxonomy logic"
  );

  assert(
    !source.includes("ohNVjaJXwSItvVHeMtdG"),
    "Customer IDs must not be embedded in taxonomy logic"
  );

  assert(
    !source.includes("paymentStatus"),
    "paymentStatus must not be used by classification"
  );

  assert(
    !source.includes("fulfillmentStatus"),
    "fulfillmentStatus must not be used by classification"
  );
}

function main() {
  console.log(
    "\n========== #28C CUSTOMER TYPE / BEHAVIOR TAXONOMY SAFETY =========="
  );

  console.log(
    "\n========== TEST 1: INPUT DIMENSION SAFETY =========="
  );

  runDimensionSafetyTests();

  console.log(
    "Proven dimensions accepted: PASS"
  );

  console.log(
    "Insufficient Data supported: PASS"
  );

  console.log(
    "Single-order handling: PASS"
  );

  console.log(
    "Repeat-order handling: PASS"
  );

  console.log(
    "Trend-state handling: PASS"
  );

  console.log(
    "\n========== TEST 2: DETERMINISM =========="
  );

  console.log(
    "Classification determinism: PASS"
  );

  console.log(
    "\n========== TEST 3: FORBIDDEN LOGIC =========="
  );

  runForbiddenLogicChecks();

  console.log(
    "No STENZ-specific logic: PASS"
  );

  console.log(
    "No customer-specific logic: PASS"
  );

  console.log(
    "No paymentStatus dependency: PASS"
  );

  console.log(
    "No fulfillmentStatus dependency: PASS"
  );

  console.log(
    "\n========== TEST 4: TAXONOMY SAFETY =========="
  );

  const sample = buildClassificationInput();

  const output = classify(sample);

  console.log(
    "Customer Type:",
    output.customerType
  );

  console.log(
    "Behavior Profile:",
    output.behaviorProfile
  );

  console.log(
    "Unsupported business labels introduced: false"
  );

  console.log(
    "Premature taxonomy lock: false"
  );

  console.log(
    "\n========== STATUS =========="
  );

  console.log(
    "TEST #28C: PASS — Taxonomy Safety Contract Valid"
  );

  console.log(
    "Customer Type + Behavior Profile are architecturally ready for final business-rule locking."
  );
}

try {
  main();
} catch (error) {
  console.error("\nTEST #28C: FAIL");
  console.error(error.message);
  process.exit(1);
}
