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

/*
  Locked frequency contract:

  Last 30 days:
    now - 30 days < orderDate <= now

  Previous 30 days:
    now - 60 days < orderDate <= now - 30 days

  Trend:
    - Insufficient Data if either period has zero orders
    - Increasing if current > previous
    - Decreasing if current < previous
    - Stable if current === previous
*/
function calculateFrequency(
  orders,
  now
) {
  const currentBoundary =
    now.getTime() - 30 * DAY_MS;

  const previousBoundary =
    now.getTime() - 60 * DAY_MS;

  let ordersLast30Days = 0;
  let ordersPrevious30Days = 0;

  for (const order of orders) {
    const date = new Date(getOrderDate(order));

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const timestamp = date.getTime();

    if (
      timestamp > currentBoundary &&
      timestamp <= now.getTime()
    ) {
      ordersLast30Days += 1;
      continue;
    }

    if (
      timestamp > previousBoundary &&
      timestamp <= currentBoundary
    ) {
      ordersPrevious30Days += 1;
    }
  }

  let frequencyTrend;

  if (
    ordersLast30Days === 0 ||
    ordersPrevious30Days === 0
  ) {
    frequencyTrend = "Insufficient Data";
  } else if (
    ordersLast30Days > ordersPrevious30Days
  ) {
    frequencyTrend = "Increasing";
  } else if (
    ordersLast30Days < ordersPrevious30Days
  ) {
    frequencyTrend = "Decreasing";
  } else {
    frequencyTrend = "Stable";
  }

  return {
    ordersLast30Days,
    ordersPrevious30Days,
    frequencyTrend,
  };
}

function makeSyntheticOrder(
  contactId,
  timestamp
) {
  return {
    _id: `${contactId}-${timestamp}`,
    contactId,
    status: "completed",
    liveMode: true,
    markAsTest: false,
    amount: 100,
    createdAt: new Date(timestamp).toISOString(),
  };
}

function buildSyntheticOrders(
  now,
  currentDaysAgo,
  previousDaysAgo
) {
  const orders = [];

  for (const daysAgo of currentDaysAgo) {
    orders.push(
      makeSyntheticOrder(
        "synthetic",
        now.getTime() - daysAgo * DAY_MS
      )
    );
  }

  for (const daysAgo of previousDaysAgo) {
    orders.push(
      makeSyntheticOrder(
        "synthetic",
        now.getTime() - daysAgo * DAY_MS
      )
    );
  }

  return orders;
}

function testSyntheticCase(
  name,
  now,
  currentDaysAgo,
  previousDaysAgo,
  expectedCurrent,
  expectedPrevious,
  expectedTrend
) {
  const orders = buildSyntheticOrders(
    now,
    currentDaysAgo,
    previousDaysAgo
  );

  const result = calculateFrequency(
    orders,
    now
  );

  assert(
    result.ordersLast30Days === expectedCurrent,
    `${name}: expected current=${expectedCurrent}, got ${result.ordersLast30Days}`
  );

  assert(
    result.ordersPrevious30Days === expectedPrevious,
    `${name}: expected previous=${expectedPrevious}, got ${result.ordersPrevious30Days}`
  );

  assert(
    result.frequencyTrend === expectedTrend,
    `${name}: expected trend="${expectedTrend}", got "${result.frequencyTrend}"`
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
      calculateFrequency(
        customerOrders,
        now
      );

    /*
      Core numeric contract.
    */
    assert(
      Number.isInteger(
        result.ordersLast30Days
      ),
      `${contactId}: Orders Last 30 Days must be integer`
    );

    assert(
      Number.isInteger(
        result.ordersPrevious30Days
      ),
      `${contactId}: Orders Previous 30 Days must be integer`
    );

    assert(
      result.ordersLast30Days >= 0,
      `${contactId}: current frequency cannot be negative`
    );

    assert(
      result.ordersPrevious30Days >= 0,
      `${contactId}: previous frequency cannot be negative`
    );

    /*
      Locked Insufficient Data rule.
    */
    if (
      result.ordersLast30Days === 0 ||
      result.ordersPrevious30Days === 0
    ) {
      assert(
        result.frequencyTrend ===
          "Insufficient Data",
        `${contactId}: zero period must produce Insufficient Data`
      );
    } else {
      assert(
        [
          "Increasing",
          "Decreasing",
          "Stable",
        ].includes(result.frequencyTrend),
        `${contactId}: invalid frequency trend`
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
    current = 3
    previous = 1
  */
  testSyntheticCase(
    "Increasing",
    syntheticNow,
    [1, 10, 20],
    [40],
    3,
    1,
    "Increasing"
  );

  /*
    Decreasing:
    current = 1
    previous = 3
  */
  testSyntheticCase(
    "Decreasing",
    syntheticNow,
    [10],
    [40, 50, 55],
    1,
    3,
    "Decreasing"
  );

  /*
    Stable:
    current = 2
    previous = 2
  */
  testSyntheticCase(
    "Stable",
    syntheticNow,
    [5, 20],
    [35, 55],
    2,
    2,
    "Stable"
  );

  /*
    Current period empty:
    MUST NOT be called Decreasing.
  */
  testSyntheticCase(
    "Current Empty",
    syntheticNow,
    [],
    [40, 50],
    0,
    2,
    "Insufficient Data"
  );

  /*
    Previous period empty:
    MUST NOT be called Increasing.
  */
  testSyntheticCase(
    "Previous Empty",
    syntheticNow,
    [5, 10],
    [],
    2,
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
    Boundary test:
    Exactly 30 days ago belongs to Previous 30 Days,
    not Last 30 Days.
  */
  const boundaryOrders = [
    makeSyntheticOrder(
      "boundary",
      syntheticNow.getTime() - 30 * DAY_MS
    ),
  ];

  const boundaryResult =
    calculateFrequency(
      boundaryOrders,
      syntheticNow
    );

  assert(
    boundaryResult.ordersLast30Days === 0,
    "Exactly 30 days ago must not be counted in Last 30 Days"
  );

  assert(
    boundaryResult.ordersPrevious30Days === 1,
    "Exactly 30 days ago must be counted in Previous 30 Days"
  );

  assert(
    boundaryResult.frequencyTrend ===
      "Insufficient Data",
    "Boundary case must produce Insufficient Data"
  );

  /*
    Future order must not be counted.
  */
  const futureOrder =
    makeSyntheticOrder(
      "future",
      syntheticNow.getTime() + DAY_MS
    );

  const futureResult =
    calculateFrequency(
      [futureOrder],
      syntheticNow
    );

  assert(
    futureResult.ordersLast30Days === 0,
    "Future order must not count in Last 30 Days"
  );

  assert(
    futureResult.ordersPrevious30Days === 0,
    "Future order must not count in Previous 30 Days"
  );

  assert(
    futureResult.frequencyTrend ===
      "Insufficient Data",
    "Future-only orders must produce Insufficient Data"
  );

  /*
    ================================
    OUTPUT
    ================================
  */

  console.log("");
  console.log("========== FREQUENCY RESULTS ==========");
  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );
  console.log(
    `Unique customers: ${customerResults.length}`
  );

  console.log("");
  console.log(
    "========== CUSTOMER FREQUENCY RESULTS =========="
  );

  for (const customer of customerResults) {
    console.log(
      `${customer.contactId} | ` +
      `orders=${customer.totalOrders} | ` +
      `last30=${customer.ordersLast30Days} | ` +
      `previous30=${customer.ordersPrevious30Days} | ` +
      `trend=${customer.frequencyTrend}`
    );
  }

  const distribution = {};

  for (const customer of customerResults) {
    distribution[customer.frequencyTrend] =
      (distribution[customer.frequencyTrend] || 0) + 1;
  }

  console.log("");
  console.log(
    "Frequency trend distribution:"
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
    "Last 30 Days calculation: PASS"
  );
  console.log(
    "Previous 30 Days calculation: PASS"
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
    "Current-time calculation: PASS"
  );

  console.log("");
  console.log("TEST #23: PASS");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #23: FAIL");
  console.error(error);
  process.exit(1);
});
