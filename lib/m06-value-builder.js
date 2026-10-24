const {
  getM06FieldKeys,
} = require("./m06-field-contract");

function daysBetween(a, b) {
  if (!a || !b) return null;

  const ms =
    new Date(b).getTime() -
    new Date(a).getTime();

  return ms / 86400000;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function percentile(value, values) {
  const clean = values
    .map(numeric)
    .filter((v) => v !== null);

  if (clean.length <= 1) return 100;

  const lessOrEqual =
    clean.filter((v) => v <= value).length;

  return (
    ((lessOrEqual - 1) /
      (clean.length - 1)) *
    100
  );
}

function recencyScore(days) {
  if (!Number.isFinite(days)) return 0;

  if (days <= 30) return 100;
  if (days <= 60) return 75;
  if (days <= 90) return 50;
  if (days <= 180) return 25;

  return 0;
}

function orderDate(order) {
  return (
    order?.createdAt ||
    order?.dateAdded ||
    order?.created_at ||
    order?.orderDate ||
    null
  );
}

function amount(order) {
  return (
    numeric(order?.amount) ??
    numeric(order?.amountSummary?.total) ??
    0
  );
}

function extractItems(order) {
  return Array.isArray(order?.items)
    ? order.items
    : [];
}

function productName(item) {
  return (
    item?.product?.name ||
    item?.name ||
    null
  );
}

function productId(item) {
  return (
    item?.product?._id ||
    item?.product?.id ||
    item?.productId ||
    item?._id ||
    null
  );
}

function quantity(item) {
  return (
    numeric(item?.qty) ??
    numeric(item?.quantity) ??
    0
  );
}

function lineSpend(item) {
  const qty = quantity(item);

  const unit =
    numeric(item?.prices?.price) ??
    numeric(item?.price) ??
    numeric(item?.unitPrice) ??
    0;

  return qty * unit;
}

function qualifies(order) {
  return Boolean(
    order?.id ||
    order?._id
  ) &&
    Boolean(order?.contactId) &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    numeric(order?.amount) > 0;
}


function calculatePurchaseConsistency(intervals) {
  if (!Array.isArray(intervals) || intervals.length < 2) {
    return {
      label: "Insufficient Data",
      score: 0,
    };
  }

  const clean = intervals
    .map(Number)
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0
    );

  if (clean.length < 2) {
    return {
      label: "Insufficient Data",
      score: 0,
    };
  }

  const mean =
    clean.reduce(
      (sum, value) => sum + value,
      0
    ) / clean.length;

  if (!Number.isFinite(mean) || mean <= 0) {
    return {
      label: "Insufficient Data",
      score: 0,
    };
  }

  const variance =
    clean.reduce(
      (sum, value) =>
        sum + Math.pow(value - mean, 2),
      0
    ) / clean.length;

  const standardDeviation =
    Math.sqrt(variance);

  /*
   * Coefficient of variation:
   * lower variation = more consistent ordering cycle.
   *
   * Normalize into a 0-100 stability score.
   */
  const coefficientOfVariation =
    standardDeviation / mean;

  const score = Math.max(
    0,
    Math.min(
      100,
      100 * (1 - coefficientOfVariation)
    )
  );

  const label =
    score >= 80
      ? "High"
      : score >= 50
        ? "Medium"
        : "Low";

  return {
    label,
    score: Math.round(score),
  };
}

function toGhlDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid DATE value: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

function buildM06Values({
  customerOrders,
  allQualifyingOrders,
  productCategoryMap = null,
  now = new Date(),
}) {
  if (!Array.isArray(customerOrders)) {
    throw new Error(
      "customerOrders must be an array."
    );
  }

  if (!Array.isArray(allQualifyingOrders)) {
    throw new Error(
      "allQualifyingOrders must be an array."
    );
  }

  const fieldKeys = getM06FieldKeys();

  if (!customerOrders.length) {
    throw new Error(
      "customerOrders must contain at least one qualifying order."
    );
  }

  const sortedOrders =
    [...customerOrders].sort(
      (a, b) =>
        new Date(orderDate(a)) -
        new Date(orderDate(b))
    );

  const orderCount =
    sortedOrders.length;

  const amounts =
    sortedOrders.map(amount);

  const lifetimeValue =
    amounts.reduce(
      (sum, value) => sum + value,
      0
    );

  const averageOrderValue =
    lifetimeValue / orderCount;

  const highestOrderValue =
    Math.max(...amounts);

  const lowestOrderValue =
    Math.min(...amounts);

  const dates =
    sortedOrders
      .map(orderDate)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(a) - new Date(b)
      );

  const firstOrderDate =
    dates[0] || null;

  const lastOrderDate =
    dates[dates.length - 1] || null;

  const daysSinceLastOrder =
    lastOrderDate
      ? Math.max(
          0,
          daysBetween(
            lastOrderDate,
            now
          )
        )
      : null;

  const intervals = [];

  for (
    let i = 1;
    i < dates.length;
    i++
  ) {
    const interval =
      daysBetween(
        dates[i - 1],
        dates[i]
      );

    if (
      Number.isFinite(interval) &&
      interval > 0
    ) {
      intervals.push(interval);
    }
  }

  const averageOrderInterval =
    intervals.length
      ? intervals.reduce(
          (a, b) => a + b,
          0
        ) / intervals.length
      : null;

  const sortedIntervals =
    [...intervals].sort(
      (a, b) => a - b
    );

  const typicalOrderInterval =
    sortedIntervals.length
      ? sortedIntervals[
          Math.floor(
            sortedIntervals.length / 2
          )
        ]
      : null;

  const expectedNextOrderDate =
    typicalOrderInterval !== null &&
    lastOrderDate
      ? new Date(
          new Date(
            lastOrderDate
          ).getTime() +
            typicalOrderInterval *
              86400000
        ).toISOString()
      : null;

  const daysOverdue =
    expectedNextOrderDate
      ? Math.max(
          0,
          daysBetween(
            expectedNextOrderDate,
            now
          )
        )
      : null;

  const orderCycleRatio =
    typicalOrderInterval &&
    typicalOrderInterval > 0 &&
    daysSinceLastOrder !== null
      ? daysSinceLastOrder /
        typicalOrderInterval
      : null;

  let recencyBand;

  if (daysSinceLastOrder <= 30) {
    recencyBand = "Recent";
  } else if (daysSinceLastOrder <= 60) {
    recencyBand = "Cooling";
  } else if (daysSinceLastOrder <= 90) {
    recencyBand = "At Risk";
  } else if (daysSinceLastOrder <= 180) {
    recencyBand = "Lapsed";
  } else {
    recencyBand = "Dormant";
  }

  const customerStatus =
    orderCount === 1
      ? "New"
      : recencyBand === "Recent"
        ? "Active"
        : recencyBand === "Cooling"
          ? "Active"
          : recencyBand === "At Risk"
            ? "At Risk"
            : recencyBand === "Lapsed"
              ? "Lapsed"
              : "Lost";

  const spendLast30 =
    sortedOrders
      .filter((order) => {
        const d = daysBetween(
          orderDate(order),
          now
        );

        return (
          d > 0 &&
          d <= 30
        );
      })
      .reduce(
        (sum, order) =>
          sum + amount(order),
        0
      );

  const spendPrevious30 =
    sortedOrders
      .filter((order) => {
        const d = daysBetween(
          orderDate(order),
          now
        );

        return (
          d > 30 &&
          d <= 60
        );
      })
      .reduce(
        (sum, order) =>
          sum + amount(order),
        0
      );

  const ordersLast30 =
    sortedOrders.filter((order) => {
      const d = daysBetween(
        orderDate(order),
        now
      );

      return d > 0 && d <= 30;
    }).length;

  const ordersPrevious30 =
    sortedOrders.filter((order) => {
      const d = daysBetween(
        orderDate(order),
        now
      );

      return d > 30 && d <= 60;
    }).length;

  let frequencyTrend =
    "Insufficient Data";

  if (
    ordersLast30 > 0 &&
    ordersPrevious30 > 0
  ) {
    frequencyTrend =
      ordersLast30 >
      ordersPrevious30
        ? "Increasing"
        : ordersLast30 <
            ordersPrevious30
          ? "Decreasing"
          : "Stable";
  }

  let spendingTrend =
    "Insufficient Data";

  if (
    spendLast30 > 0 &&
    spendPrevious30 > 0
  ) {
    spendingTrend =
      spendLast30 >
      spendPrevious30
        ? "Increasing"
        : spendLast30 <
            spendPrevious30
          ? "Decreasing"
          : "Stable";
  }

  // -------------------------------------------------------
  // PRODUCT / CATEGORY INTELLIGENCE
  // -------------------------------------------------------

  const itemStats =
    new Map();

  for (const order of sortedOrders) {
    for (const item of extractItems(order)) {
      const id =
        productId(item);

      const name =
        productName(item);

      if (!id && !name) continue;

      const key =
        id || name;

      if (!itemStats.has(key)) {
        itemStats.set(key, {
          id,
          name,
          qty: 0,
          spend: 0,
          lastDate: null,
        });
      }

      const stat =
        itemStats.get(key);

      stat.qty += quantity(item);
      stat.spend += lineSpend(item);

      const date =
        orderDate(order);

      if (
        !stat.lastDate ||
        new Date(date) >
          new Date(stat.lastDate)
      ) {
        stat.lastDate = date;
      }
    }
  }

  const rankedItems =
    [...itemStats.values()]
      .sort(
        (a, b) =>
          b.qty - a.qty ||
          b.spend - a.spend ||
          new Date(b.lastDate || 0) -
            new Date(a.lastDate || 0)
      );

  const favoriteItem =
    rankedItems[0]?.name ||
    null;

  const topItems =
    rankedItems
      .slice(0, 5)
      .map((item) => item.name)
      .filter(Boolean)
      .join(", ");

  // -------------------------------------------------------
  // REAL PRODUCT / CATEGORY INTELLIGENCE
  // -------------------------------------------------------

  const categoryStats =
    new Map();

  for (const order of sortedOrders) {
    for (const item of extractItems(order)) {
      const id =
        productId(item);

      if (!id) continue;

      const productEntry =
        productCategoryMap instanceof Map
          ? productCategoryMap.get(id)
          : productCategoryMap?.[id];

      if (!productEntry) continue;

      const categories =
        Array.isArray(productEntry?.categories)
          ? productEntry.categories
          : [];

      if (!categories.length) continue;

      const qty =
        quantity(item);

      const spend =
        lineSpend(item);

      const date =
        orderDate(order);

      for (const categoryName of categories) {
        if (!categoryName) continue;

        if (!categoryStats.has(categoryName)) {
          categoryStats.set(
            categoryName,
            {
              name: categoryName,
              qty: 0,
              spend: 0,
              lastDate: null,
            }
          );
        }

        const stat =
          categoryStats.get(
            categoryName
          );

        stat.qty += qty;
        stat.spend += spend;

        if (
          date &&
          (
            !stat.lastDate ||
            new Date(date) >
              new Date(stat.lastDate)
          )
        ) {
          stat.lastDate = date;
        }
      }
    }
  }

  const rankedCategories =
    [...categoryStats.values()]
      .sort(
        (a, b) =>
          b.qty - a.qty ||
          b.spend - a.spend ||
          new Date(b.lastDate || 0) -
            new Date(a.lastDate || 0)
      );

  const favoriteCategory =
    rankedCategories[0]?.name ||
    null;

  const topCategories =
    rankedCategories
      .slice(0, 5)
      .map(
        (category) =>
          category.name
      )
      .filter(Boolean)
      .join(", ") ||
    null;

  /*
   * Category Diversity =
   * number of distinct purchased categories.
   *
   * If category intelligence is unavailable,
   * preserve unavailable state as null.
   */
  const categoryDiversity =
    rankedCategories.length > 0
      ? rankedCategories.length
      : null;

  /*
   * Purchase Consistency is based on the actual
   * stability of intervals between qualifying orders.
   * Requires at least 3 qualifying orders, which
   * produces at least 2 usable intervals.
   */
  const purchaseConsistencyResult =
    orderCount >= 3
      ? calculatePurchaseConsistency(
          intervals
        )
      : {
          label: "Insufficient Data",
          score: 0,
        };

  const purchaseConsistency =
    purchaseConsistencyResult.label;

  const purchaseConsistencyScore =
    purchaseConsistencyResult.score;

  // -------------------------------------------------------
  // CHANNEL / LOCATION
  // -------------------------------------------------------

  const sourceStats =
    new Map();

  const orderTypes = [];
  const locations = [];
  const couponCodes = [];

  for (const order of sortedOrders) {
    const source =
      order?.source ||
      order?.sourceName ||
      order?.channel ||
      null;

    if (source) {
      sourceStats.set(
        source,
        (sourceStats.get(source) || 0) +
          1
      );
    }

    const orderType =
      order?.delivery?.method ||
      order?.orderType ||
      null;

    if (orderType) {
      orderTypes.push(orderType);
    }

    const location =
      order?.location?.name ||
      order?.locationName ||
      null;

    if (location) {
      locations.push(location);
    }

    const coupon =
      order?.coupon?.code ||
      order?.couponCode ||
      null;

    if (coupon) {
      couponCodes.push(coupon);
    }
  }

  const sourceEntries =
    [...sourceStats.entries()]
      .sort(
        (a, b) => b[1] - a[1]
      );

  const orderSourceMix =
    sourceEntries
      .map(
        ([source, count]) =>
          `${source}: ${count}`
      )
      .join(", ");

  const primaryOrderSource =
    sourceEntries[0]?.[0] ||
    null;

  const mode = (values) => {
    if (!values.length) return null;

    const counts =
      new Map();

    for (const value of values) {
      counts.set(
        value,
        (counts.get(value) || 0) + 1
      );
    }

    return [...counts.entries()]
      .sort(
        (a, b) => b[1] - a[1]
      )[0][0];
  };

  const preferredOrderType =
    mode(orderTypes);

  const preferredLocation =
    mode(locations);

  const lastOrder =
    sortedOrders[
      sortedOrders.length - 1
    ];

  const lastOrderType =
    lastOrder?.delivery?.method ||
    lastOrder?.orderType ||
    null;

  const lastOrderLocation =
    lastOrder?.location?.name ||
    lastOrder?.locationName ||
    null;

  const lastCouponCode =
    couponCodes.length
      ? couponCodes[
          couponCodes.length - 1
        ]
      : null;

  // -------------------------------------------------------
  // VALUE / VIP
  // -------------------------------------------------------

  const customerStats =
    new Map();

  for (
    const order of allQualifyingOrders
  ) {
    const contactId =
      order?.contactId;

    if (!contactId) continue;

    if (
      !customerStats.has(
        contactId
      )
    ) {
      customerStats.set(
        contactId,
        {
          spend: 0,
          orders: 0,
        }
      );
    }

    const stat =
      customerStats.get(
        contactId
      );

    stat.spend += amount(order);
    stat.orders += 1;
  }

  if (
    !customerStats.has(
      sortedOrders[0]?.contactId
    )
  ) {
    customerStats.set(
      sortedOrders[0]?.contactId,
      {
        spend: lifetimeValue,
        orders: orderCount,
      }
    );
  }

  const spendValues =
    [...customerStats.values()]
      .map((x) => x.spend);

  const frequencyValues =
    [...customerStats.values()]
      .map((x) => x.orders);

  const lifetimeSpendPercentile =
    percentile(
      lifetimeValue,
      spendValues
    );

  const orderFrequencyPercentile =
    percentile(
      orderCount,
      frequencyValues
    );

  const customerValueScore =
    Math.round(
      lifetimeSpendPercentile * 0.40 +
      orderFrequencyPercentile * 0.25 +
      recencyScore(
        daysSinceLastOrder
      ) * 0.20 +
      purchaseConsistencyScore * 0.15
    );

  const vipClassification =
    customerValueScore >= 80
      ? "High Value"
      : customerValueScore >= 50
        ? "Mid Value"
        : "Standard";

  const vipStatus =
    customerValueScore >= 80
      ? "VIP"
      : "Non-VIP";

  // Taxonomy labels intentionally remain
  // conservative until formally locked.
  const customerType =
    "Unclassified";

  const customerBehaviorProfile =
    "Unclassified";

  // -------------------------------------------------------
  // WIN-BACK
  // -------------------------------------------------------

  const winbackEligible =
    orderCount >= 3 &&
    daysSinceLastOrder >= 21 &&
    typicalOrderInterval > 0 &&
    orderCycleRatio >= 1.5;

  const winbackTier =
    orderCycleRatio >= 2
      ? "High"
      : orderCycleRatio >= 1.5
        ? "Medium"
        : "None";

  // -------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------

  const summary = [
    `Lifecycle: ${customerStatus} (${recencyBand})`,
    `Orders: ${orderCount}`,
    `Lifetime Value: ${lifetimeValue.toFixed(2)}`,
    `Average Order Value: ${averageOrderValue.toFixed(2)}`,
    `Days Since Last Order: ${
      daysSinceLastOrder === null
        ? "Unavailable"
        : daysSinceLastOrder.toFixed(2)
    }`,
    `Typical Order Interval: ${
      typicalOrderInterval === null
        ? "Unavailable"
        : typicalOrderInterval.toFixed(2)
    } days`,
    `Frequency Trend: ${frequencyTrend}`,
    `Spending Trend: ${spendingTrend}`,
    `Favorite Item: ${
      favoriteItem || "Unavailable"
    }`,
    `Favorite Category: ${favoriteCategory}`,
    `VIP: ${vipStatus}`,
    `Value Score: ${customerValueScore}`,
    `Win-back Eligible: ${
      winbackEligible ? "Yes" : "No"
    }`,
  ].join("\n");


  /*
   * #39I
   * Category Diversity is a NUMERICAL GHL field.
   *
   * Contract:
   *   = number of distinct purchased categories
   *
   * If category intelligence is unavailable, do NOT write
   * "Insufficient Data" into a numerical field and do NOT
   * invent 0. Preserve unavailable state as null.
   *
   * If the builder already calculated a numeric value,
   * preserve it unchanged.
   */
  const normalizedCategoryDiversity =
    categoryDiversity === null ||
    categoryDiversity === undefined ||
    categoryDiversity === ""
      ? null
      : Number.isFinite(Number(categoryDiversity))
        ? Number(categoryDiversity)
        : null;

  const values = {
  "contact.days_overdue": daysOverdue,
  "contact.overdue_ratio": orderCycleRatio,
  "contact.order_frequency_trend": frequencyTrend,
    "contact.total_orders": orderCount,
    "contact.first_order_date": toGhlDate(firstOrderDate),
    "contact.last_order_date": toGhlDate(lastOrderDate),
    "contact.lifetime_value": lifetimeValue,
    "contact.average_order_value": averageOrderValue,
    "contact.highest_order_value": highestOrderValue,
    "contact.lowest_order_value": lowestOrderValue,
    "contact.average_order_interval_days":
      averageOrderInterval,
    "contact.typical_order_interval_days":
      typicalOrderInterval,
    "contact.days_since_last_order":
      daysSinceLastOrder,
    "contact.expected_next_order_date":

      toGhlDate(expectedNextOrderDate),

    "contact.customer_status":
      customerStatus,

    "contact.orders_last_30_days":
      ordersLast30,
    "contact.orders_previous_30_days":
      ordersPrevious30,

    "contact.spend_last_30_days":
      spendLast30,
    "contact.spend_previous_30_days":
      spendPrevious30,
    "contact.spending_trend":
      spendingTrend,

    "contact.favorite_category":
      favoriteCategory,
    "contact.top_categories":
      topCategories,
    "contact.favorite_item":
      favoriteItem,
    "contact.top_items":
      topItems,
    "contact.category_diversity":
      normalizedCategoryDiversity,
    "contact.purchase_consistency":
      purchaseConsistency,

    "contact.order_source_mix":
      orderSourceMix,
    "contact.primary_order_source":
      primaryOrderSource,
    "contact.preferred_order_type":
      preferredOrderType,
    "contact.preferred_location":
      preferredLocation,
    "contact.last_order_type":
      lastOrderType,
    "contact.last_order_location":
      lastOrderLocation,
    "contact.last_coupon_code":
      lastCouponCode,

    "contact.lifetime_spend_percentile":
      lifetimeSpendPercentile,
    "contact.order_frequency_percentile":
      orderFrequencyPercentile,
    "contact.customer_value_score":
      customerValueScore,
    "contact.vip_classification":
      vipClassification,
    "contact.vip_status":
      vipStatus,
    "contact.customer_type":
      customerType,
    "contact.customer_behavior_profile":
      customerBehaviorProfile,

    "contact.winback_eligibility":
      winbackEligible,
    "contact.winback_tier":
      winbackTier,

    "contact.customer_intelligence_summary":
      summary,
    "contact.m06_intelligence_updated_at":
      toGhlDate(now),
  };

  const missing =
    fieldKeys.filter(
      (key) =>
        !Object.prototype.hasOwnProperty.call(
          values,
          key
        )
    );

  const extra =
    Object.keys(values).filter(
      (key) =>
        !fieldKeys.includes(key)
    );

  if (missing.length) {
    throw new Error(
      `M06 builder missing fields: ${missing.join(", ")}`
    );
  }

  if (extra.length) {
    throw new Error(
      `M06 builder has extra fields: ${extra.join(", ")}`
    );
  }

  return values;
}

module.exports = {
  buildM06Values,
  daysBetween,
  numeric,
  percentile,
  recencyScore,
};
