const { fetchOrders } = require("../lib/acquisition");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

const DAY_MS = 24 * 60 * 60 * 1000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function getOrderDate(order) {
  return (
    order?.createdAt ||
    order?.dateCreated ||
    order?.created_at ||
    order?.updatedAt ||
    null
  );
}

function isQualifyingOrder(order) {
  return (
    order?.contactId &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    Number(order?.amount) > 0
  );
}

function getAmount(order) {
  const amount = Number(order?.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

/*
  Locked spending contract:

  Last 30 days:
    now - 30 days < orderDate <= now

  Previous 30 days:
    now - 60 days < orderDate <= now - 30 days

  Trend:
    - Insufficient Data if either period has zero spend
    - Increasing if current > previous
    - Decreasing if current < previous
    - Stable if current === previous
*/
function calculateSpending(orders, now) {
  const currentBoundary =
    now.getTime() - 30 * DAY_MS;

  const previousBoundary =
    now.getTime() - 60 * DAY_MS;

  let spendLast30Days = 0;
  let spendPrevious30Days = 0;

  for (const order of orders) {
    const date = new Date(getOrderDate(order));
    const amount = getAmount(order);

    if (
      Number.isNaN(date.getTime()) ||
      amount === null
    ) {
      continue;
    }

    const timestamp = date.getTime();

    if (
      timestamp > currentBoundary &&
      timestamp <= now.getTime()
    ) {
      spendLast30Days += amount;
      continue;
    }

    if (
      timestamp > previousBoundary &&
      timestamp <= currentBoundary
    ) {
      spendPrevious30Days += amount;
    }
  }

  let spendingTrend;

  if (
    spendLast30Days === 0 ||
    spendPrevious30Days === 0
  ) {
    spendingTrend = "Insufficient Data";
  } else if (
    spendLast30Days > spendPrevious30Days
  ) {
    spendingTrend = "Increasing";
  } else if (
    spendLast30Days < spendPrevious30Days
  ) {
    spendingTrend = "Decreasing";
  } else {
    spendingTrend = "Stable";
  }

  return {
    spendLast30Days,
    spendPrevious30Days,
    spendingTrend,
  };
}

function makeSyntheticOrder(
  contactId,
  timestamp,
  amount
) {
  return {
    _id: `${contactId}-${timestamp}-${amount}`,
    contactId,
    status: "completed",
    liveMode: true,
    markAsTest: false,
    amount,
    createdAt: new Date(timestamp).toISOString(),
  };
}

function buildSyntheticOrders(
  now,
  currentOrders,
  previousOrders
) {
  const orders = [];

  for (const item of currentOrders) {
    orders.push(
      makeSyntheticOrder(
        "synthetic",
        now.getTime() - item.daysAgo * DAY_MS,
        item.amount
      )
    );
  }

  for (const item of previousOrders) {
    orders.push(
      makeSyntheticOrder(
        "synthetic",
        now.getTime() - item.daysAgo * DAY_MS,
        item.amount
      )
    );
  }

  return orders;
}

function testSyntheticCase(
  name,
  now,
  currentOrders,
  previousOrders,
  expectedCurrent,
  expectedPrevious,
  expectedTrend
) {
  const orders = buildSyntheticOrders(
    now,
    currentOrders,
    previousOrders
  );

  const result = calculateSpending(
    orders,
    now
  );

  assert(
    Math.abs(
      result.spendLast30Days -
        expectedCurrent
    ) < 0.000001,
    `${name}: expected current=${expectedCurrent}, got ${result.spendLast30Days}`
  );

  assert(
    Math.abs(
      result.spendPrevious30Days -
        expectedPrevious
    ) < 0.000001,
    `${name}: expected previous=${expectedPrevious}, got ${result.spendPrevious30Days}`
  );

  assert(
    result.spendingTrend === expectedTrend,
    `${name}: expected trend="${expectedTrend}", got "${result.spendingTrend}"`
  );
}

async function main() {
  const now = new Date();

  const orders = await fetchOrders(LOCATION_ID);

  const qualifyingOrders =
    orders.filter(isQualifyingOrder);

  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers.get(contactId).push(order);
  }

  const customerResults = [];

  for (const [
    contactId,
    customerOrders,
  ] of customers.entries()) {
    const result =
      calculateSpending(
        customerOrders,
        now
      );

    assert(
      Number.isFinite(
        result.spendLast30Days
      ),
      `${contactId}: current spend must be numeric`
    );

    assert(
      Number.isFinite(
        result.spendPrevious30Days
      ),
      `${contactId}: previous spend must be numeric`
    );

    assert(
      result.spendLast30Days >= 0,
      `${contactId}: current spend cannot be negative`
    );

    assert(
      result.spendPrevious30Days >= 0,
      `${contactId}: previous spend cannot be negative`
    );

    if (
      result.spendLast30Days === 0 ||
      result.spendPrevious30Days === 0
    ) {
      assert(
        result.spendingTrend ===
          "Insufficient Data",
        `${contactId}: zero-spend period must produce Insufficient Data`
      );
    } else {
      assert(
        [
          "Increasing",
          "Decreasing",
          "Stable",
        ].includes(result.spendingTrend),
        `${contactId}: invalid spending trend`
      );
    }

    customerResults.push({
      contactId,
      totalOrders: customerOrders.length,
      ...result,
    });
  }

  /*
    ================================
    SYNTHETIC CONTRACT TESTS
    ================================
  */

  const syntheticNow =
    new Date("2026-10-23T12:00:00.000Z");

  /*
    Increasing:
    current spend = 450
    previous spend = 200
  */
  testSyntheticCase(
    "Increasing",
    syntheticNow,
    [
      { daysAgo: 5, amount: 150 },
      { daysAgo: 10, amount: 300 },
    ],
    [
      { daysAgo: 40, amount: 200 },
    ],
    450,
    200,
    "Increasing"
  );

  /*
    Decreasing:
    current spend = 100
    previous spend = 500
  */
  testSyntheticCase(
    "Decreasing",
    syntheticNow,
    [
      { daysAgo: 10, amount: 100 },
    ],
    [
      { daysAgo: 40, amount: 200 },
      { daysAgo: 50, amount: 300 },
    ],
    100,
    500,
    "Decreasing"
  );

  /*
    Stable:
    current spend = 300
    previous spend = 300
  */
  testSyntheticCase(
    "Stable",
    syntheticNow,
    [
      { daysAgo: 5, amount: 100 },
      { daysAgo: 20, amount: 200 },
    ],
    [
      { daysAgo: 35, amount: 150 },
      { daysAgo: 55, amount: 150 },
    ],
    300,
    300,
    "Stable"
  );

  /*
    Current period empty.
  */
  testSyntheticCase(
    "Current Empty",
    syntheticNow,
    [],
    [
      { daysAgo: 40, amount: 250 },
    ],
    0,
    250,
    "Insufficient Data"
  );

  /*
    Previous period empty.
  */
  testSyntheticCase(
    "Previous Empty",
    syntheticNow,
    [
      { daysAgo: 5, amount: 250 },
    ],
    [],
    250,
    0,
    "Insufficient Data"
  );

  /*
    Both periods empty.
  */
  testSyntheticCase(
    "Both Empty",
    syntheticNow,
    [],
    [],
    0,
    0,
    "Insufficient Data"
  );

  /*
    Exactly 30 days ago belongs to Previous 30 Days.
  */
  const boundaryOrder =
    makeSyntheticOrder(
      "boundary",
      syntheticNow.getTime() - 30 * DAY_MS,
      175
    );

  const boundaryResult =
    calculateSpending(
      [boundaryOrder],
      syntheticNow
    );

  assert(
    boundaryResult.spendLast30Days === 0,
    "Exactly 30 days ago must not count in Last 30 Days"
  );

  assert(
    boundaryResult.spendPrevious30Days === 175,
    "Exactly 30 days ago must count in Previous 30 Days"
  );

  assert(
    boundaryResult.spendingTrend ===
      "Insufficient Data",
    "Boundary case must produce Insufficient Data"
  );

  /*
    Future order must not count.
  */
  const futureOrder =
    makeSyntheticOrder(
      "future",
      syntheticNow.getTime() + DAY_MS,
      999
    );

  const futureResult =
    calculateSpending(
      [futureOrder],
      syntheticNow
    );

  assert(
    futureResult.spendLast30Days === 0,
    "Future order must not count in Last 30 Days"
  );

  assert(
    futureResult.spendPrevious30Days === 0,
    "Future order must not count in Previous 30 Days"
  );

  /*
    Invalid amount must not enter spend.
  */
  const invalidAmountOrder = {
    ...makeSyntheticOrder(
      "invalid",
      syntheticNow.getTime() - 5 * DAY_MS,
      100
    ),
    amount: "not-a-number",
  };

  const invalidAmountResult =
    calculateSpending(
      [invalidAmountOrder],
      syntheticNow
    );

  assert(
    invalidAmountResult.spendLast30Days === 0,
    "Invalid amount must not enter spend"
  );

  /*
    ================================
    OUTPUT
    ================================
  */

  console.log("");
  console.log("========== SPENDING RESULTS ==========");
  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );
  console.log(
    `Unique customers: ${customerResults.length}`
  );

  console.log("");
  console.log(
    "========== CUSTOMER SPENDING RESULTS =========="
  );

  for (const customer of customerResults) {
    console.log(
      `${customer.contactId} | ` +
      `orders=${customer.totalOrders} | ` +
      `last30=${customer.spendLast30Days.toFixed(2)} | ` +
      `previous30=${customer.spendPrevious30Days.toFixed(2)} | ` +
      `trend=${customer.spendingTrend}`
    );
  }

  const distribution = {};

  for (const customer of customerResults) {
    distribution[customer.spendingTrend] =
      (distribution[customer.spendingTrend] || 0) + 1;
  }

  console.log("");
  console.log(
    "Spending trend distribution:"
  );
  console.log(
    JSON.stringify(
      distribution,
      null,
      2
    )
  );

  console.log("");
  console.log("========== CONTRACT CHECK ==========");
  console.log(
    "Spend Last 30 Days calculation: PASS"
  );
  console.log(
    "Spend Previous 30 Days calculation: PASS"
  );
  console.log(
    "Insufficient Data rule: PASS"
  );
  console.log(
    "Increasing trend: PASS"
  );
  console.log(
    "Decreasing trend: PASS"
  );
  console.log(
    "Stable trend: PASS"
  );
  console.log(
    "30-day boundary: PASS"
  );
  console.log(
    "Future-date exclusion: PASS"
  );
  console.log(
    "Invalid amount exclusion: PASS"
  );
  console.log(
    "Current-time calculation: PASS"
  );

  console.log("");
  console.log("TEST #24: PASS");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #24: FAIL");
  console.error(error);
  process.exit(1);
});
