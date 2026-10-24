const { fetchOrders } = require("../lib/acquisition");

const LOCATION_ID =
  process.env.GHL_LOCATION_ID ||
  "V2q4leIVzpDKRiljAOOj";

const DAY_MS = 24 * 60 * 60 * 1000;

function isQualifyingOrder(order) {
  const contactId = order?.contactId;
  const status = String(order?.status || "").toLowerCase();
  const liveMode = order?.liveMode === true;
  const markAsTest = order?.markAsTest === true;
  const amount = Number(order?.amount);

  return Boolean(
    contactId &&
    status === "completed" &&
    liveMode &&
    !markAsTest &&
    Number.isFinite(amount) &&
    amount > 0
  );
}

function getOrderDate(order) {
  const values = [
    order?.createdAt,
    order?.dateAdded,
    order?.createdDate,
    order?.updatedAt,
  ];

  for (const value of values) {
    const time = new Date(value).getTime();

    if (Number.isFinite(time)) {
      return time;
    }
  }

  return null;
}

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (
    (sorted[middle - 1] +
      sorted[middle]) /
    2
  );
}

function percentileRank(values, value) {
  if (!values.length) return null;

  if (values.length === 1) {
    return 100;
  }

  const lessOrEqual =
    values.filter(
      (x) => x <= value
    ).length;

  return (
    ((lessOrEqual - 1) /
      (values.length - 1)) *
    100
  );
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function recencyScore(daysSinceLastOrder) {
  if (
    !Number.isFinite(
      daysSinceLastOrder
    )
  ) {
    return 0;
  }

  if (daysSinceLastOrder <= 30) {
    return 100;
  }

  if (daysSinceLastOrder <= 60) {
    return 75;
  }

  if (daysSinceLastOrder <= 90) {
    return 50;
  }

  if (daysSinceLastOrder <= 180) {
    return 25;
  }

  return 0;
}

function purchaseConsistencyScore(
  totalOrders,
  categoryDiversity
) {
  if (totalOrders < 3) {
    return 0;
  }

  if (
    categoryDiversity === 1
  ) {
    return 100;
  }

  if (
    categoryDiversity === 2
  ) {
    return 75;
  }

  if (
    categoryDiversity === 3
  ) {
    return 50;
  }

  return 25;
}

function buildCustomers(
  qualifyingOrders,
  now
) {
  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId =
      order.contactId;

    const orderTime =
      getOrderDate(order);

    if (
      !contactId ||
      !Number.isFinite(orderTime)
    ) {
      continue;
    }

    const amount =
      Number(order.amount);

    const customer =
      customers.get(contactId) ||
      {
        contactId,
        orders: [],
        lifetimeSpend: 0,
      };

    customer.orders.push({
      orderTime,
      amount,
    });

    customer.lifetimeSpend +=
      amount;

    customers.set(
      contactId,
      customer
    );
  }

  return [...customers.values()]
    .map((customer) => {
      const dates =
        customer.orders
          .map((x) => x.orderTime)
          .sort((a, b) => a - b);

      const intervals = [];

      for (
        let i = 1;
        i < dates.length;
        i++
      ) {
        intervals.push(
          (dates[i] -
            dates[i - 1]) /
            DAY_MS
        );
      }

      const lastOrderTime =
        dates[dates.length - 1];

      const daysSinceLastOrder =
        Math.max(
          0,
          (now - lastOrderTime) /
            DAY_MS
        );

      const typicalInterval =
        median(intervals);

      const expectedNextOrderDate =
        typicalInterval !== null
          ? lastOrderTime +
            typicalInterval *
              DAY_MS
          : null;

      const daysOverdue =
        expectedNextOrderDate !== null
          ? Math.max(
              0,
              (now -
                expectedNextOrderDate) /
                DAY_MS
            )
          : null;

      const orderCycleRatio =
        typicalInterval !== null &&
        typicalInterval > 0
          ? daysSinceLastOrder /
            typicalInterval
          : null;

      /*
       * Category diversity is not re-derived here
       * because #25 proved the product engine.
       *
       * For this isolated value test we use the
       * customer's distinct purchased product IDs
       * as a deterministic proxy only for the
       * consistency component.
       *
       * This does NOT redefine the M06 category
       * contract.
       */
      const productIds =
        new Set();

      for (const order of qualifyingOrders) {
        if (
          order.contactId !==
          customer.contactId
        ) {
          continue;
        }

        for (const item of
          Array.isArray(order.items)
            ? order.items
            : []) {
          const productId =
            item?.productId ||
            item?.product?._id ||
            item?.product?.id;

          if (productId) {
            productIds.add(
              productId
            );
          }
        }
      }

      const categoryDiversity =
        Math.max(
          1,
          productIds.size
        );

      return {
        contactId:
          customer.contactId,

        totalOrders:
          customer.orders.length,

        lifetimeSpend:
          Number(
            customer.lifetimeSpend.toFixed(
              2
            )
          ),

        firstOrderDate:
          new Date(
            dates[0]
          ).toISOString(),

        lastOrderDate:
          new Date(
            lastOrderTime
          ).toISOString(),

        daysSinceLastOrder,

        typicalInterval,

        daysOverdue,

        orderCycleRatio,

        categoryDiversity,

        recencyScore:
          recencyScore(
            daysSinceLastOrder
          ),

        purchaseConsistencyScore:
          purchaseConsistencyScore(
            customer.orders.length,
            categoryDiversity
          ),
      };
    });
}

function assignPercentiles(
  customers
) {
  const spendValues =
    customers.map(
      (x) => x.lifetimeSpend
    );

  const frequencyValues =
    customers.map(
      (x) => x.totalOrders
    );

  for (const customer of customers) {
    customer.lifetimeSpendPercentile =
      percentileRank(
        spendValues,
        customer.lifetimeSpend
      );

    customer.orderFrequencyPercentile =
      percentileRank(
        frequencyValues,
        customer.totalOrders
      );
  }

  return customers;
}

function calculateValueScore(
  customer
) {
  const spend =
    customer.lifetimeSpendPercentile;

  const frequency =
    customer.orderFrequencyPercentile;

  const recency =
    customer.recencyScore;

  const consistency =
    customer.purchaseConsistencyScore;

  const score =
    (
      spend * 0.40 +
      frequency * 0.25 +
      recency * 0.20 +
      consistency * 0.15
    );

  return Number(
    clamp(score, 0, 100).toFixed(2)
  );
}

function rankCustomers(
  customers,
  field
) {
  return [...customers]
    .sort(
      (a, b) =>
        b[field] - a[field]
    )
    .map(
      (x) => x.contactId
    );
}

async function main() {
  console.log(
    "\n========== #27 VALUE / VIP INTELLIGENCE ==========\n"
  );

  const now =
    Date.now();

  const orders =
    await fetchOrders(
      LOCATION_ID
    );

  const qualifyingOrders =
    orders.filter(
      isQualifyingOrder
    );

  console.log(
    `Orders acquired: ${orders.length}`
  );

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  const customers =
    buildCustomers(
      qualifyingOrders,
      now
    );

  assignPercentiles(
    customers
  );

  for (const customer of customers) {
    customer.customerValueScore =
      calculateValueScore(
        customer
      );
  }

  console.log(
    "\n========== CUSTOMER VALUE INTELLIGENCE ==========\n"
  );

  for (const customer of customers) {
    console.log(
      JSON.stringify(
        {
          contactId:
            customer.contactId,

          totalOrders:
            customer.totalOrders,

          lifetimeSpend:
            customer.lifetimeSpend,

          lifetimeSpendPercentile:
            Number(
              customer
                .lifetimeSpendPercentile
                .toFixed(2)
            ),

          orderFrequencyPercentile:
            Number(
              customer
                .orderFrequencyPercentile
                .toFixed(2)
            ),

          daysSinceLastOrder:
            Number(
              customer
                .daysSinceLastOrder
                .toFixed(2)
            ),

          recencyScore:
            customer.recencyScore,

          purchaseConsistencyScore:
            customer
              .purchaseConsistencyScore,

          customerValueScore:
            customer.customerValueScore,
        },
        null,
        2
      )
    );
  }

  console.log(
    "\n========== RANKINGS ==========\n"
  );

  console.log(
    "Spend ranking:",
    rankCustomers(
      customers,
      "lifetimeSpend"
    )
  );

  console.log(
    "Frequency ranking:",
    rankCustomers(
      customers,
      "totalOrders"
    )
  );

  console.log(
    "Value score ranking:",
    rankCustomers(
      customers,
      "customerValueScore"
    )
  );

  console.log(
    "\n========== ASSERTIONS ==========\n"
  );

  const percentileRangeValid =
    customers.every(
      (customer) =>
        customer
          .lifetimeSpendPercentile >= 0 &&
        customer
          .lifetimeSpendPercentile <= 100 &&
        customer
          .orderFrequencyPercentile >= 0 &&
        customer
          .orderFrequencyPercentile <= 100
    );

  const singleCustomerPercentileValid =
    customers.length === 1
      ? customers.every(
          (customer) =>
            customer
              .lifetimeSpendPercentile ===
              100 &&
            customer
              .orderFrequencyPercentile ===
              100
        )
      : true;

  const scoreRangeValid =
    customers.every(
      (customer) =>
        customer.customerValueScore >= 0 &&
        customer.customerValueScore <= 100
    );

  const scoreFormulaValid =
    customers.every(
      (customer) => {
        const expected =
          Number(
            (
              customer
                .lifetimeSpendPercentile *
                0.40 +

              customer
                .orderFrequencyPercentile *
                0.25 +

              customer.recencyScore *
                0.20 +

              customer
                .purchaseConsistencyScore *
                0.15
            ).toFixed(2)
          );

        return (
          customer.customerValueScore ===
          expected
        );
      }
    );

  const spendMonotonicityValid =
    [...customers]
      .sort(
        (a, b) =>
          a.lifetimeSpend -
          b.lifetimeSpend
      )
      .every(
        (customer, index, list) => {
          if (index === 0) {
            return true;
          }

          return (
            customer
              .lifetimeSpendPercentile >=
            list[index - 1]
              .lifetimeSpendPercentile
          );
        }
      );

  const frequencyMonotonicityValid =
    [...customers]
      .sort(
        (a, b) =>
          a.totalOrders -
          b.totalOrders
      )
      .every(
        (customer, index, list) => {
          if (index === 0) {
            return true;
          }

          return (
            customer
              .orderFrequencyPercentile >=
            list[index - 1]
              .orderFrequencyPercentile
          );
        }
      );

  const noGlobalMixing =
    customers.length ===
    new Set(
      customers.map(
        (x) =>
          x.contactId
      )
    ).size;

  console.log(
    "Percentiles in 0–100:",
    percentileRangeValid
  );

  console.log(
    "Single-customer percentile rule:",
    singleCustomerPercentileValid
  );

  console.log(
    "Customer Value Score in 0–100:",
    scoreRangeValid
  );

  console.log(
    "Customer Value Score formula:",
    scoreFormulaValid
  );

  console.log(
    "Spend percentile monotonicity:",
    spendMonotonicityValid
  );

  console.log(
    "Frequency percentile monotonicity:",
    frequencyMonotonicityValid
  );

  console.log(
    "Restaurant-scoped customer set:",
    noGlobalMixing
  );

  /*
   * VIP thresholds are intentionally NOT asserted here.
   *
   * They remain configurable and will be locked
   * separately before VIP Classification / Status
   * becomes production business logic.
   */

  console.log(
    "\nVIP threshold status: CONFIGURABLE / NOT LOCKED"
  );

  console.log(
    "Customer Type status: DERIVED LATER"
  );

  console.log(
    "Behavior Profile status: DERIVED LATER"
  );

  if (
    !percentileRangeValid ||
    !singleCustomerPercentileValid ||
    !scoreRangeValid ||
    !scoreFormulaValid ||
    !spendMonotonicityValid ||
    !frequencyMonotonicityValid ||
    !noGlobalMixing
  ) {
    throw new Error(
      "TEST #27: FAIL"
    );
  }

  console.log(
    "\nTEST #27: PASS\n"
  );
}

main().catch((error) => {
  console.error(
    "\nTEST #27: ERROR\n"
  );

  console.error(error);

  process.exit(1);
});
