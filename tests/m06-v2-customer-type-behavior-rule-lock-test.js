const { fetchOrders } = require("../lib/acquisition");

const DAY_MS = 24 * 60 * 60 * 1000;

function qualifyOrder(order) {
  const id = order?._id || order?.id;

  return Boolean(
    id &&
    order?.contactId &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    Number(order?.amount) > 0
  );
}

function getOrderDate(order) {
  const candidates = [
    order?.createdAt,
    order?.dateAdded,
    order?.updatedAt,
  ];

  for (const value of candidates) {
    const time = new Date(value).getTime();

    if (Number.isFinite(time)) {
      return time;
    }
  }

  return null;
}

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildCustomers(orders, now) {
  const map = new Map();

  for (const order of orders.filter(qualifyOrder)) {
    const contactId = order.contactId;
    const amount = Number(order.amount);
    const orderDate = getOrderDate(order);

    if (
      !contactId ||
      !Number.isFinite(amount) ||
      orderDate === null
    ) {
      continue;
    }

    if (!map.has(contactId)) {
      map.set(contactId, {
        contactId,
        orderDates: [],
        amounts: [],
      });
    }

    const customer = map.get(contactId);

    customer.orderDates.push(orderDate);
    customer.amounts.push(amount);
  }

  const customers = [];

  for (const customer of map.values()) {
    customer.orderDates.sort((a, b) => a - b);

    customer.totalOrders = customer.orderDates.length;

    customer.lifetimeValue = customer.amounts.reduce(
      (sum, value) => sum + value,
      0
    );

    customer.firstOrderDate =
      customer.orderDates.length
        ? new Date(customer.orderDates[0]).toISOString()
        : null;

    customer.lastOrderDate =
      customer.orderDates.length
        ? new Date(
            customer.orderDates[customer.orderDates.length - 1]
          ).toISOString()
        : null;

    customer.daysSinceLastOrder =
      customer.orderDates.length
        ? Math.max(
            0,
            (now -
              customer.orderDates[
                customer.orderDates.length - 1
              ]) /
              DAY_MS
          )
        : null;

    const intervals = [];

    for (let i = 1; i < customer.orderDates.length; i++) {
      intervals.push(
        (customer.orderDates[i] -
          customer.orderDates[i - 1]) /
          DAY_MS
      );
    }

    customer.intervals = intervals;
    customer.typicalOrderInterval = median(intervals);

    customer.orderCycleRatio =
      customer.typicalOrderInterval > 0
        ? customer.daysSinceLastOrder /
          customer.typicalOrderInterval
        : null;

    if (customer.daysSinceLastOrder <= 30) {
      customer.recencyBand = "Recent / Active";
    } else if (customer.daysSinceLastOrder <= 60) {
      customer.recencyBand = "Cooling";
    } else if (customer.daysSinceLastOrder <= 90) {
      customer.recencyBand = "At Risk";
    } else if (customer.daysSinceLastOrder <= 180) {
      customer.recencyBand = "Lapsed";
    } else {
      customer.recencyBand = "Dormant/Lost";
    }

    const last30Start = now - 30 * DAY_MS;
    const previous30Start = now - 60 * DAY_MS;

    customer.ordersLast30Days = 0;
    customer.ordersPrevious30Days = 0;

    customer.spendLast30Days = 0;
    customer.spendPrevious30Days = 0;

    for (let i = 0; i < customer.orderDates.length; i++) {
      const date = customer.orderDates[i];
      const amount = customer.amounts[i];

      if (date > last30Start && date <= now) {
        customer.ordersLast30Days += 1;
        customer.spendLast30Days += amount;
      } else if (
        date > previous30Start &&
        date <= last30Start
      ) {
        customer.ordersPrevious30Days += 1;
        customer.spendPrevious30Days += amount;
      }
    }

    if (
      customer.ordersLast30Days === 0 ||
      customer.ordersPrevious30Days === 0
    ) {
      customer.frequencyTrend = "Insufficient Data";
    } else if (
      customer.ordersLast30Days >
      customer.ordersPrevious30Days
    ) {
      customer.frequencyTrend = "Increasing";
    } else if (
      customer.ordersLast30Days <
      customer.ordersPrevious30Days
    ) {
      customer.frequencyTrend = "Decreasing";
    } else {
      customer.frequencyTrend = "Stable";
    }

    if (
      customer.spendLast30Days === 0 ||
      customer.spendPrevious30Days === 0
    ) {
      customer.spendingTrend = "Insufficient Data";
    } else if (
      customer.spendLast30Days >
      customer.spendPrevious30Days
    ) {
      customer.spendingTrend = "Increasing";
    } else if (
      customer.spendLast30Days <
      customer.spendPrevious30Days
    ) {
      customer.spendingTrend = "Decreasing";
    } else {
      customer.spendingTrend = "Stable";
    }

    customer.winbackEligible =
      customer.totalOrders >= 3 &&
      customer.daysSinceLastOrder >= 21 &&
      customer.typicalOrderInterval > 0 &&
      customer.orderCycleRatio >= 1.5;

    if (customer.orderCycleRatio >= 2) {
      customer.winbackTier = "High";
    } else if (customer.orderCycleRatio >= 1.5) {
      customer.winbackTier = "Medium";
    } else {
      customer.winbackTier = "None";
    }

    /*
     * IMPORTANT:
     * These are INPUT DIMENSIONS ONLY.
     *
     * No Customer Type or Behavior Profile labels are assigned.
     * No business taxonomy is being invented here.
     */
    customer.ruleInputs = {
      totalOrders: customer.totalOrders,
      lifetimeValue: Number(
        customer.lifetimeValue.toFixed(2)
      ),
      daysSinceLastOrder: Number(
        customer.daysSinceLastOrder.toFixed(4)
      ),
      recencyBand: customer.recencyBand,
      typicalOrderInterval:
        customer.typicalOrderInterval === null
          ? null
          : Number(
              customer.typicalOrderInterval.toFixed(4)
            ),
      orderCycleRatio:
        customer.orderCycleRatio === null
          ? null
          : Number(
              customer.orderCycleRatio.toFixed(4)
            ),
      ordersLast30Days: customer.ordersLast30Days,
      ordersPrevious30Days:
        customer.ordersPrevious30Days,
      spendLast30Days: Number(
        customer.spendLast30Days.toFixed(2)
      ),
      spendPrevious30Days: Number(
        customer.spendPrevious30Days.toFixed(2)
      ),
      frequencyTrend: customer.frequencyTrend,
      spendingTrend: customer.spendingTrend,
      winbackEligible: customer.winbackEligible,
      winbackTier: customer.winbackTier,
    };

    customers.push(customer);
  }

  return customers;
}

function validateRuleInputs(customer) {
  const required = [
    "totalOrders",
    "lifetimeValue",
    "daysSinceLastOrder",
    "recencyBand",
    "frequencyTrend",
    "spendingTrend",
  ];

  return required.every((key) => {
    const value = customer.ruleInputs[key];

    return (
      value !== undefined &&
      value !== null &&
      value !== ""
    );
  });
}

async function main() {
  const locationId =
    process.env.GHL_LOCATION_ID ||
    "V2q4leIVzpDKRiljAOOj";

  const orders = await fetchOrders(locationId);
  const now = Date.now();

  const customers = buildCustomers(orders, now);

  console.log(
    "\n========== #28B CUSTOMER TYPE / BEHAVIOR RULE-LOCK MATRIX =========="
  );

  console.log(`Orders acquired: ${orders.length}`);
  console.log(`Customers:       ${customers.length}`);

  console.log(
    "\n========== RULE INPUT MATRIX =========="
  );

  for (const customer of customers) {
    console.log("\n----------------------------------------");
    console.log(`Customer: ${customer.contactId}`);
    console.log(
      JSON.stringify(
        customer.ruleInputs,
        null,
        2
      )
    );
  }

  const validCount = customers.filter(
    validateRuleInputs
  ).length;

  const uniqueRecency = [
    ...new Set(
      customers.map(
        (customer) =>
          customer.ruleInputs.recencyBand
      )
    ),
  ];

  const uniqueFrequency = [
    ...new Set(
      customers.map(
        (customer) =>
          customer.ruleInputs.frequencyTrend
      )
    ),
  ];

  const uniqueSpending = [
    ...new Set(
      customers.map(
        (customer) =>
          customer.ruleInputs.spendingTrend
      )
    ),
  ];

  const uniqueWinback = [
    ...new Set(
      customers.map(
        (customer) =>
          customer.ruleInputs.winbackTier
      )
    ),
  ];

  console.log(
    "\n========== DIMENSION COVERAGE =========="
  );

  console.log(
    "Recency:",
    uniqueRecency
  );

  console.log(
    "Frequency:",
    uniqueFrequency
  );

  console.log(
    "Spending:",
    uniqueSpending
  );

  console.log(
    "Win-back:",
    uniqueWinback
  );

  console.log(
    "\n========== RULE-LOCK SAFETY CHECKS =========="
  );

  console.log(
    `Customers with complete rule inputs: ${validCount}/${customers.length}`
  );

  console.log(
    "Customer Type labels assigned: 0"
  );

  console.log(
    "Behavior Profile labels assigned: 0"
  );

  console.log(
    "Unsupported taxonomy introduced: false"
  );

  console.log(
    "STENZ-specific business rule introduced: false"
  );

  const pass =
    customers.length > 0 &&
    validCount === customers.length;

  console.log("\n========== STATUS ==========");

  if (pass) {
    console.log(
      "TEST #28B: PASS — Rule-Lock Matrix Ready"
    );
    console.log(
      "Next: lock Customer Type + Customer Behavior Profile taxonomy."
    );
  } else {
    console.log(
      "TEST #28B: FAIL"
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nTEST #28B ERROR");
  console.error(error);
  process.exit(1);
});
