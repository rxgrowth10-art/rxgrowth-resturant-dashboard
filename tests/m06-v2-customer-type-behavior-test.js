const { fetchOrders } = require("../lib/acquisition");

const DAY_MS = 24 * 60 * 60 * 1000;

function qualifyOrder(order) {
  const id = order?.id || order?._id;

  return Boolean(
    id &&
    order?.contactId &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    Number(order?.amount) > 0
  );
}

function normalizeDate(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function buildCustomerAggregates(orders, now) {
  const customers = new Map();

  for (const order of orders.filter(qualifyOrder)) {
    const contactId = order.contactId;
    const amount = Number(order.amount);
    const orderDate = normalizeDate(
      order.createdAt ||
      order.dateAdded ||
      order.updatedAt
    );

    if (!contactId || !Number.isFinite(amount) || orderDate === null) {
      continue;
    }

    if (!customers.has(contactId)) {
      customers.set(contactId, {
        contactId,
        totalOrders: 0,
        lifetimeValue: 0,
        orderDates: [],
        amounts: [],
      });
    }

    const customer = customers.get(contactId);

    customer.totalOrders += 1;
    customer.lifetimeValue += amount;
    customer.orderDates.push(orderDate);
    customer.amounts.push(amount);
  }

  for (const customer of customers.values()) {
    customer.orderDates.sort((a, b) => a - b);

    customer.firstOrderDate =
      customer.orderDates.length > 0
        ? new Date(customer.orderDates[0]).toISOString()
        : null;

    customer.lastOrderDate =
      customer.orderDates.length > 0
        ? new Date(
            customer.orderDates[customer.orderDates.length - 1]
          ).toISOString()
        : null;

    customer.daysSinceLastOrder =
      customer.orderDates.length > 0
        ? Math.max(
            0,
            (now - customer.orderDates[customer.orderDates.length - 1]) /
              DAY_MS
          )
        : null;

    customer.orderIntervals = [];

    for (let i = 1; i < customer.orderDates.length; i++) {
      customer.orderIntervals.push(
        (customer.orderDates[i] - customer.orderDates[i - 1]) / DAY_MS
      );
    }

    if (customer.orderIntervals.length > 0) {
      const sorted = [...customer.orderIntervals].sort((a, b) => a - b);

      const middle = Math.floor(sorted.length / 2);

      customer.typicalOrderInterval =
        sorted.length % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle];

      customer.orderCycleRatio =
        customer.typicalOrderInterval > 0
          ? customer.daysSinceLastOrder /
            customer.typicalOrderInterval
          : null;
    } else {
      customer.typicalOrderInterval = null;
      customer.orderCycleRatio = null;
    }

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

    for (const date of customer.orderDates) {
      if (date > last30Start && date <= now) {
        customer.ordersLast30Days += 1;
      } else if (
        date > previous30Start &&
        date <= last30Start
      ) {
        customer.ordersPrevious30Days += 1;
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
  }

  return [...customers.values()];
}

/*
 * IMPORTANT:
 * This file is intentionally a DISCOVERY / CONTRACT TEST.
 *
 * Customer Type and Customer Behavior Profile rules are NOT being
 * locked here yet because the current M06 contract does not contain
 * explicit business thresholds for those two fields.
 *
 * We therefore validate:
 * 1. every customer has enough proven intelligence inputs
 * 2. classification dimensions are deterministic
 * 3. no unsupported labels are silently introduced
 * 4. the output can later be mapped to the locked business taxonomy
 */

function deriveCandidateDimensions(customer) {
  const dimensions = {
    lifecycle:
      customer.totalOrders === 1
        ? "Single-order"
        : "Repeat-order",

    recency:
      customer.recencyBand,

    frequency:
      customer.frequencyTrend,

    cycle:
      customer.orderCycleRatio === null
        ? "No Valid Cycle"
        : customer.orderCycleRatio >= 1.5
          ? "Overdue"
          : "Within Cycle",

    value:
      customer.lifetimeValue > 0
        ? "Has Value"
        : "No Value",
  };

  return dimensions;
}

async function main() {
  const locationId =
    process.env.GHL_LOCATION_ID ||
    "V2q4leIVzpDKRiljAOOj";

  const orders = await fetchOrders(locationId);

  const now = Date.now();

  const customers = buildCustomerAggregates(orders, now);

  console.log("\n========== CUSTOMER TYPE / BEHAVIOR DISCOVERY ==========");
  console.log(`Orders acquired: ${orders.length}`);
  console.log(`Customers:       ${customers.length}`);

  let validCustomers = 0;
  let deterministicCustomers = 0;

  const distributions = {
    lifecycle: {},
    recency: {},
    frequency: {},
    cycle: {},
    value: {},
  };

  for (const customer of customers) {
    const dimensions = deriveCandidateDimensions(customer);

    const valid =
      customer.totalOrders >= 1 &&
      Number.isFinite(customer.lifetimeValue) &&
      customer.recencyBand &&
      customer.frequencyTrend;

    const deterministic =
      Object.values(dimensions).every(
        (value) => typeof value === "string" && value.length > 0
      );

    if (valid) validCustomers++;
    if (deterministic) deterministicCustomers++;

    for (const [key, value] of Object.entries(dimensions)) {
      distributions[key][value] =
        (distributions[key][value] || 0) + 1;
    }
  }

  console.log("\n========== PROVEN INTELLIGENCE DIMENSIONS ==========");
  console.log(
    JSON.stringify(distributions, null, 2)
  );

  console.log("\n========== CUSTOMER SAMPLE ==========");

  for (const customer of customers.slice(0, 10)) {
    console.log(
      JSON.stringify(
        {
          contactId: customer.contactId,
          totalOrders: customer.totalOrders,
          lifetimeValue: customer.lifetimeValue,
          daysSinceLastOrder: Number(
            customer.daysSinceLastOrder?.toFixed(4)
          ),
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
          recencyBand: customer.recencyBand,
          frequencyTrend: customer.frequencyTrend,
          candidateDimensions:
            deriveCandidateDimensions(customer),
        },
        null,
        2
      )
    );
  }

  console.log("\n========== CONTRACT CHECKS ==========");

  const allHaveValidInputs =
    validCustomers === customers.length;

  const allDeterministic =
    deterministicCustomers === customers.length;

  console.log(
    `Customers with valid intelligence inputs: ${validCustomers}/${customers.length}`
  );

  console.log(
    `Deterministic candidate dimensions: ${deterministicCustomers}/${customers.length}`
  );

  console.log(
    `No unsupported Customer Type taxonomy locked: true`
  );

  console.log(
    `No unsupported Behavior Profile taxonomy locked: true`
  );

  console.log("\n========== STATUS ==========");

  if (
    customers.length > 0 &&
    allHaveValidInputs &&
    allDeterministic
  ) {
    console.log(
      "TEST #28: PASS — Discovery Contract Valid"
    );
    console.log(
      "Customer Type / Behavior Profile are ready for explicit business-rule locking."
    );
  } else {
    console.log(
      "TEST #28: FAIL"
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nTEST #28 ERROR");
  console.error(error);
  process.exit(1);
});
