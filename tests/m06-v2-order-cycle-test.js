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

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function calculateTypicalOrderInterval(orders) {
  if (orders.length < 2) return null;

  const dates = orders
    .map((order) => new Date(getOrderDate(order)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  if (dates.length < 2) return null;

  const intervals = [];

  for (let i = 1; i < dates.length; i += 1) {
    intervals.push(
      (dates[i].getTime() - dates[i - 1].getTime()) / DAY_MS
    );
  }

  return median(intervals);
}

function calculateDaysSinceLastOrder(lastOrderDate, now) {
  return Math.max(
    0,
    (now.getTime() - lastOrderDate.getTime()) / DAY_MS
  );
}

function calculateExpectedNextOrderDate(
  lastOrderDate,
  typicalOrderInterval
) {
  if (
    !Number.isFinite(typicalOrderInterval) ||
    typicalOrderInterval <= 0
  ) {
    return null;
  }

  return new Date(
    lastOrderDate.getTime() +
      typicalOrderInterval * DAY_MS
  );
}

function calculateDaysOverdue(expectedNextOrderDate, now) {
  if (!expectedNextOrderDate) return null;

  return Math.max(
    0,
    (now.getTime() - expectedNextOrderDate.getTime()) / DAY_MS
  );
}

function calculateOrderCycleRatio(
  daysSinceLastOrder,
  typicalOrderInterval
) {
  if (
    !Number.isFinite(typicalOrderInterval) ||
    typicalOrderInterval <= 0
  ) {
    return null;
  }

  return daysSinceLastOrder / typicalOrderInterval;
}

async function main() {
  const now = new Date();

  const orders = await fetchOrders(LOCATION_ID);

  const qualifyingOrders = orders.filter((order) => {
    return (
      order?.contactId &&
      order?.status === "completed" &&
      order?.liveMode === true &&
      order?.markAsTest !== true &&
      Number(order?.amount) > 0
    );
  });

  const customerOrders = new Map();

  for (const order of qualifyingOrders) {
    if (!customerOrders.has(order.contactId)) {
      customerOrders.set(order.contactId, []);
    }

    customerOrders.get(order.contactId).push(order);
  }

  const customers = [];

  for (const [contactId, ordersForCustomer] of customerOrders.entries()) {
    const sortedOrders = ordersForCustomer
      .map((order) => ({
        order,
        date: new Date(getOrderDate(order)),
      }))
      .filter((x) => !Number.isNaN(x.date.getTime()))
      .sort((a, b) => a.date - b.date);

    assert(
      sortedOrders.length > 0,
      `Customer ${contactId} has no valid dated orders`
    );

    const dates = sortedOrders.map((x) => x.date);

    const firstOrderDate = dates[0];
    const lastOrderDate = dates[dates.length - 1];

    const typicalOrderInterval =
      calculateTypicalOrderInterval(ordersForCustomer);

    const daysSinceLastOrder =
      calculateDaysSinceLastOrder(lastOrderDate, now);

    const expectedNextOrderDate =
      calculateExpectedNextOrderDate(
        lastOrderDate,
        typicalOrderInterval
      );

    const daysOverdue =
      calculateDaysOverdue(
        expectedNextOrderDate,
        now
      );

    const orderCycleRatio =
      calculateOrderCycleRatio(
        daysSinceLastOrder,
        typicalOrderInterval
      );

    if (ordersForCustomer.length === 1) {
      assert(
        typicalOrderInterval === null,
        `Single-order customer ${contactId} must have null Typical Order Interval`
      );

      assert(
        expectedNextOrderDate === null,
        `Single-order customer ${contactId} must have null Expected Next Order Date`
      );

      assert(
        daysOverdue === null,
        `Single-order customer ${contactId} must have null Days Overdue`
      );

      assert(
        orderCycleRatio === null,
        `Single-order customer ${contactId} must have null Order Cycle Ratio`
      );
    } else {
      assert(
        Number.isFinite(typicalOrderInterval),
        `Multi-order customer ${contactId} must have numeric Typical Order Interval`
      );

      assert(
        typicalOrderInterval > 0,
        `Multi-order customer ${contactId} must have positive Typical Order Interval`
      );

      assert(
        expectedNextOrderDate instanceof Date &&
          !Number.isNaN(expectedNextOrderDate.getTime()),
        `Customer ${contactId} must have valid Expected Next Order Date`
      );

      assert(
        Number.isFinite(daysOverdue),
        `Customer ${contactId} must have numeric Days Overdue`
      );

      assert(
        daysOverdue >= 0,
        `Customer ${contactId} has negative Days Overdue`
      );

      assert(
        Number.isFinite(orderCycleRatio),
        `Customer ${contactId} must have numeric Order Cycle Ratio`
      );

      assert(
        orderCycleRatio >= 0,
        `Customer ${contactId} has negative Order Cycle Ratio`
      );

      const expectedDateFromFormula =
        lastOrderDate.getTime() +
        typicalOrderInterval * DAY_MS;

      assert(
        Math.abs(
          expectedNextOrderDate.getTime() -
            expectedDateFromFormula
        ) < 1,
        `Customer ${contactId} has incorrect Expected Next Order Date`
      );

      const expectedOverdue =
        Math.max(
          0,
          (
            now.getTime() -
            expectedNextOrderDate.getTime()
          ) / DAY_MS
        );

      assert(
        Math.abs(daysOverdue - expectedOverdue) < 0.000001,
        `Customer ${contactId} has incorrect Days Overdue`
      );

      const expectedRatio =
        daysSinceLastOrder / typicalOrderInterval;

      assert(
        Math.abs(orderCycleRatio - expectedRatio) < 0.000001,
        `Customer ${contactId} has incorrect Order Cycle Ratio`
      );
    }

    customers.push({
      contactId,
      totalOrders: ordersForCustomer.length,
      firstOrderDate: firstOrderDate.toISOString(),
      lastOrderDate: lastOrderDate.toISOString(),
      typicalOrderInterval,
      daysSinceLastOrder,
      expectedNextOrderDate:
        expectedNextOrderDate?.toISOString() || null,
      daysOverdue,
      orderCycleRatio,
    });
  }

  // Synthetic contract tests.
  const syntheticNow = new Date("2026-10-23T12:00:00.000Z");
  const syntheticLastOrder = new Date(
    "2026-10-20T12:00:00.000Z"
  );

  const syntheticTypicalInterval = 5;

  const syntheticExpectedNext =
    calculateExpectedNextOrderDate(
      syntheticLastOrder,
      syntheticTypicalInterval
    );

  assert(
    syntheticExpectedNext.toISOString() ===
      "2026-10-25T12:00:00.000Z",
    "Synthetic Expected Next Order Date formula failed"
  );

  const syntheticOverdue =
    calculateDaysOverdue(
      syntheticExpectedNext,
      syntheticNow
    );

  assert(
    syntheticOverdue === 0,
    "Days Overdue must floor at zero before expected date"
  );

  const overdueNow = new Date(
    "2026-10-28T12:00:00.000Z"
  );

  const syntheticOverdueLater =
    calculateDaysOverdue(
      syntheticExpectedNext,
      overdueNow
    );

  assert(
    syntheticOverdueLater === 3,
    "Synthetic Days Overdue calculation failed"
  );

  const syntheticRatio =
    calculateOrderCycleRatio(
      7.5,
      5
    );

  assert(
    syntheticRatio === 1.5,
    "Synthetic Order Cycle Ratio calculation failed"
  );

  const invalidRatio =
    calculateOrderCycleRatio(
      20,
      null
    );

  assert(
    invalidRatio === null,
    "Order Cycle Ratio must be null without a valid interval"
  );

  console.log("");
  console.log("========== ORDER CYCLE RESULTS ==========");
  console.log(`Qualifying orders: ${qualifyingOrders.length}`);
  console.log(`Unique customers: ${customers.length}`);

  const multiOrderCustomers =
    customers.filter((c) => c.totalOrders >= 2);

  const singleOrderCustomers =
    customers.filter((c) => c.totalOrders === 1);

  const customersWithCycleRatio =
    customers.filter(
      (c) => Number.isFinite(c.orderCycleRatio)
    );

  const overdueCustomers =
    customers.filter(
      (c) =>
        Number.isFinite(c.daysOverdue) &&
        c.daysOverdue > 0
    );

  console.log(
    `Single-order customers: ${singleOrderCustomers.length}`
  );

  console.log(
    `Multi-order customers: ${multiOrderCustomers.length}`
  );

  console.log(
    `Customers with valid cycle ratio: ${customersWithCycleRatio.length}`
  );

  console.log(
    `Customers currently overdue: ${overdueCustomers.length}`
  );

  console.log("");
  console.log("========== CUSTOMER CYCLE RESULTS ==========");

  for (const customer of customers) {
    console.log(
      `${customer.contactId} | ` +
      `orders=${customer.totalOrders} | ` +
      `typical=${customer.typicalOrderInterval === null
        ? "null"
        : customer.typicalOrderInterval.toFixed(4)} | ` +
      `daysSinceLast=${customer.daysSinceLastOrder.toFixed(2)} | ` +
      `expectedNext=${customer.expectedNextOrderDate || "null"} | ` +
      `overdue=${customer.daysOverdue === null
        ? "null"
        : customer.daysOverdue.toFixed(2)} | ` +
      `ratio=${customer.orderCycleRatio === null
        ? "null"
        : customer.orderCycleRatio.toFixed(4)}`
    );
  }

  console.log("");
  console.log("========== CONTRACT CHECK ==========");
  console.log("Single-order null handling: PASS");
  console.log("Expected Next Order Date formula: PASS");
  console.log("Days Overdue floor-at-zero: PASS");
  console.log("Order Cycle Ratio formula: PASS");
  console.log("Current-time calculation: PASS");
  console.log("Synthetic boundary checks: PASS");

  console.log("");
  console.log("TEST #22: PASS");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #22: FAIL");
  console.error(error);
  process.exit(1);
});
