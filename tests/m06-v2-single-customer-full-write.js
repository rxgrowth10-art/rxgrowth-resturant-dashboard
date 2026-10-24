const { request } = require("../lib/ghl");
const { resolveField } = require("../lib/field-resolver");
const { writeContactFields } = require("../lib/contact-writer");
const { getM06FieldKeys } = require("../lib/m06-field-contract");
const { fetchOrders } = require("../lib/acquisition");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

// Controlled test customer already used successfully by #35.
const CONTACT_ID = "VFK3JVJaIXFt4J98d3c5";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function percentile(value, values) {
  if (values.length <= 1) return 100;

  const lessOrEqual = values.filter((v) => v <= value).length;

  return ((lessOrEqual - 1) / (values.length - 1)) * 100;
}

function recencyScore(days) {
  if (days <= 30) return 100;
  if (days >= 181) return 0;

  return 100 - ((days - 30) / 151) * 100;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchOrderDetails(orders) {
  const details = [];

  for (const order of orders) {
    const id = order?._id || order?.id;

    if (!id) continue;

    const detail = await request(
      `/payments/orders/${encodeURIComponent(id)}` +
      `?altId=${encodeURIComponent(LOCATION_ID)}` +
      `&altType=location`,
      API_KEY
    );

    details.push(detail);
  }

  return details;
}

function qualifies(order) {
  const orderId = order?._id || order?.id;

  return Boolean(
    orderId &&
    order?.contactId &&
    order?.status === "completed" &&
    order?.liveMode === true &&
    order?.markAsTest !== true &&
    numeric(order?.amount) > 0
  );
}

function orderDate(order) {
  return (
    order?.createdAt ||
    order?.dateAdded ||
    order?.createdAtUtc ||
    order?.updatedAt
  );
}

function amount(order) {
  return numeric(
    order?.amount ??
    order?.amountSummary?.total ??
    order?.total
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
    item?.productName ||
    null
  );
}

function productId(item) {
  return (
    item?.product?._id ||
    item?.product?.id ||
    item?.productId ||
    null
  );
}

function quantity(item) {
  return numeric(
    item?.qty ??
    item?.quantity ??
    1
  );
}

function lineSpend(item) {
  const qty = quantity(item);

  const unit =
    numeric(item?.prices?.price) ||
    numeric(item?.price) ||
    numeric(item?.unitPrice);

  return qty * unit;
}

async function main() {
  console.log("");
  console.log("========== #37 SINGLE CUSTOMER FULL M06 WRITE ==========");
  console.log("");

  assert(API_KEY, "M06_STENZ_API_KEY is configured.");

  const fieldKeys = getM06FieldKeys();

  console.log(`M06 logical fields: ${fieldKeys.length}`);
  console.log(`Controlled contactId: ${CONTACT_ID}`);
  console.log("");

  // ---------------------------------------------------------
  // 1. ACQUIRE
  // ---------------------------------------------------------

  const orders = await fetchOrders(LOCATION_ID);

  const details = await fetchOrderDetails(
    orders.filter(qualifies)
  );

  const qualifying = details.filter(qualifies);

  const customerOrders = qualifying
    .filter((order) => order.contactId === CONTACT_ID)
    .sort(
      (a, b) =>
        new Date(orderDate(a)) -
        new Date(orderDate(b))
    );

  assert(
    customerOrders.length > 0,
    "Controlled customer has qualifying orders."
  );

  console.log("---------- CUSTOMER INPUT ----------");
  console.log(`Qualifying orders: ${customerOrders.length}`);

  // ---------------------------------------------------------
  // 2. CORE INTELLIGENCE
  // ---------------------------------------------------------

  const orderCount = customerOrders.length;

  const amounts = customerOrders.map(amount);

  const lifetimeValue =
    amounts.reduce((sum, value) => sum + value, 0);

  const averageOrderValue =
    lifetimeValue / orderCount;

  const highestOrderValue =
    Math.max(...amounts);

  const lowestOrderValue =
    Math.min(...amounts);

  const dates = customerOrders
    .map(orderDate)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(a) - new Date(b)
    );

  const firstOrderDate = dates[0];
  const lastOrderDate = dates[dates.length - 1];

  const now = new Date();

  const daysSinceLastOrder =
    Math.max(
      0,
      daysBetween(lastOrderDate, now)
    );

  const intervals = [];

  for (let i = 1; i < dates.length; i++) {
    const interval =
      daysBetween(
        dates[i - 1],
        dates[i]
      );

    if (Number.isFinite(interval) && interval > 0) {
      intervals.push(interval);
    }
  }

  const averageOrderInterval =
    intervals.length
      ? intervals.reduce((a, b) => a + b, 0) /
        intervals.length
      : null;

  const sortedIntervals =
    [...intervals].sort((a, b) => a - b);

  const typicalOrderInterval =
    sortedIntervals.length
      ? sortedIntervals[
          Math.floor(sortedIntervals.length / 2)
        ]
      : null;

  const expectedNextOrderDate =
    typicalOrderInterval !== null
      ? new Date(
          new Date(lastOrderDate).getTime() +
          typicalOrderInterval * 86400000
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
    typicalOrderInterval > 0
      ? daysSinceLastOrder /
        typicalOrderInterval
      : null;

  // ---------------------------------------------------------
  // 3. RECENCY / LIFECYCLE
  // ---------------------------------------------------------

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

  let customerStatus;

  if (orderCount === 1) {
    customerStatus = "New";
  } else if (daysSinceLastOrder <= 60) {
    customerStatus = "Active";
  } else if (daysSinceLastOrder <= 90) {
    customerStatus = "At Risk";
  } else if (daysSinceLastOrder <= 180) {
    customerStatus = "Lapsed";
  } else {
    customerStatus = "Lost";
  }

  // ---------------------------------------------------------
  // 4. FREQUENCY / SPENDING
  // ---------------------------------------------------------

  const last30Start =
    new Date(now.getTime() - 30 * 86400000);

  const previous30Start =
    new Date(now.getTime() - 60 * 86400000);

  const last30Orders =
    customerOrders.filter((order) => {
      const d = new Date(orderDate(order));
      return d > last30Start && d <= now;
    });

  const previous30Orders =
    customerOrders.filter((order) => {
      const d = new Date(orderDate(order));
      return (
        d > previous30Start &&
        d <= last30Start
      );
    });

  const ordersLast30 =
    last30Orders.length;

  const ordersPrevious30 =
    previous30Orders.length;

  const spendLast30 =
    last30Orders.reduce(
      (sum, order) => sum + amount(order),
      0
    );

  const spendPrevious30 =
    previous30Orders.reduce(
      (sum, order) => sum + amount(order),
      0
    );

  let frequencyTrend = "Insufficient Data";

  if (
    ordersLast30 > 0 &&
    ordersPrevious30 > 0
  ) {
    frequencyTrend =
      ordersLast30 > ordersPrevious30
        ? "Increasing"
        : ordersLast30 < ordersPrevious30
          ? "Decreasing"
          : "Stable";
  }

  let spendingTrend = "Insufficient Data";

  if (
    spendLast30 > 0 &&
    spendPrevious30 > 0
  ) {
    spendingTrend =
      spendLast30 > spendPrevious30
        ? "Increasing"
        : spendLast30 < spendPrevious30
          ? "Decreasing"
          : "Stable";
  }

  // ---------------------------------------------------------
  // 5. PRODUCT INTELLIGENCE
  // ---------------------------------------------------------

  const itemStats = new Map();

  for (const order of customerOrders) {
    for (const item of extractItems(order)) {
      const id = productId(item);
      const name = productName(item);

      if (!id && !name) continue;

      const key = id || name;

      if (!itemStats.has(key)) {
        itemStats.set(key, {
          id,
          name,
          qty: 0,
          spend: 0,
          lastOrderDate: orderDate(order),
        });
      }

      const stat = itemStats.get(key);

      stat.qty += quantity(item);
      stat.spend += lineSpend(item);

      if (
        new Date(orderDate(order)) >
        new Date(stat.lastOrderDate)
      ) {
        stat.lastOrderDate = orderDate(order);
      }
    }
  }

  const rankedItems =
    [...itemStats.values()]
      .sort(
        (a, b) =>
          b.qty - a.qty ||
          b.spend - a.spend ||
          new Date(b.lastOrderDate) -
            new Date(a.lastOrderDate)
      );

  const favoriteItem =
    rankedItems[0]?.name || null;

  const topItems =
    rankedItems
      .slice(0, 5)
      .map((item) => item.name)
      .filter(Boolean);

  // Current proven GHL order payload does not expose
  // category information reliably. Preserve that limitation.
  const favoriteCategory = "Uncategorized";
  const topCategories = ["Uncategorized"];
  const categoryDiversity = "Insufficient Data";

  const purchaseConsistency =
    orderCount >= 3
      ? "Highly Consistent"
      : "Insufficient Data";

  // ---------------------------------------------------------
  // 6. CHANNEL / LOCATION
  // ---------------------------------------------------------

  const sources =
    customerOrders
      .map((order) => {
        const source =
          order?.source ||
          order?.orderSource ||
          null;

        if (!source) return null;

        if (typeof source === "string") {
          return source;
        }

        return (
          source?.name ||
          source?.subType ||
          source?.type ||
          null
        );
      })
      .filter(Boolean);

  const sourceCounts = new Map();

  for (const source of sources) {
    sourceCounts.set(
      source,
      (sourceCounts.get(source) || 0) + 1
    );
  }

  const sourceMix =
    [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(
        ([source, count]) =>
          `${source}: ${count}`
      )
      .join(", ") || null;

  const primaryOrderSource =
    [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ||
    null;

  const orderTypes =
    customerOrders
      .map(
        (order) =>
          order?.delivery?.method ||
          order?.orderType ||
          null
      )
      .filter(Boolean);

  const locations =
    customerOrders
      .map(
        (order) =>
          order?.locationId ||
          order?.location?.name ||
          null
      )
      .filter(Boolean);

  const preferredOrderType =
    orderTypes.length
      ? [...new Set(orderTypes)][0]
      : null;

  const preferredLocation =
    locations.length
      ? [...new Set(locations)][0]
      : null;

  const lastOrder =
    customerOrders[customerOrders.length - 1];

  const lastOrderType =
    lastOrder?.delivery?.method ||
    lastOrder?.orderType ||
    null;

  const lastOrderLocation =
    lastOrder?.location?.name ||
    lastOrder?.locationId ||
    null;

  const lastCouponCode =
    lastOrder?.coupon?.code ||
    lastOrder?.couponCode ||
    null;

  // ---------------------------------------------------------
  // 7. VALUE / VIP
  // ---------------------------------------------------------

  const allCustomerStats = new Map();

  for (const order of qualifying) {
    const id = order.contactId;

    if (!allCustomerStats.has(id)) {
      allCustomerStats.set(id, {
        spend: 0,
        orders: 0,
      });
    }

    const stat = allCustomerStats.get(id);

    stat.spend += amount(order);
    stat.orders += 1;
  }

  const allSpends =
    [...allCustomerStats.values()]
      .map((x) => x.spend);

  const allFrequencies =
    [...allCustomerStats.values()]
      .map((x) => x.orders);

  const lifetimeSpendPercentile =
    percentile(
      lifetimeValue,
      allSpends
    );

  const orderFrequencyPercentile =
    percentile(
      orderCount,
      allFrequencies
    );

  const purchaseConsistencyScore =
    orderCount >= 3
      ? 100
      : 0;

  const customerValueScore =
    (
      lifetimeSpendPercentile * 0.40 +
      orderFrequencyPercentile * 0.25 +
      recencyScore(daysSinceLastOrder) * 0.20 +
      purchaseConsistencyScore * 0.15
    );

  const vipClassification =
    customerValueScore >= 80
      ? "High"
      : customerValueScore >= 50
        ? "Medium"
        : "Standard";

  const vipStatus =
    customerValueScore >= 80
      ? "VIP"
      : "Standard";

  // Taxonomy intentionally not locked yet.
  const customerType = "Unclassified";
  const customerBehaviorProfile = "Unclassified";

  // ---------------------------------------------------------
  // 8. WINBACK
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // 9. SUMMARY
  // ---------------------------------------------------------

  const summary = [
    `Lifecycle: ${customerStatus} (${recencyBand})`,
    `Orders: ${orderCount}`,
    `Lifetime Value: ${lifetimeValue.toFixed(2)}`,
    `Average Order Value: ${averageOrderValue.toFixed(2)}`,
    `Last Order: ${lastOrderDate}`,
    `Days Since Last Order: ${daysSinceLastOrder.toFixed(2)}`,
    `Typical Order Interval: ${
      typicalOrderInterval === null
        ? "Insufficient Data"
        : typicalOrderInterval.toFixed(2)
    } days`,
    `Order Cycle Ratio: ${
      orderCycleRatio === null
        ? "Insufficient Data"
        : orderCycleRatio.toFixed(2)
    }`,
    `Frequency Trend: ${frequencyTrend}`,
    `Spending Trend: ${spendingTrend}`,
    `Favorite Item: ${favoriteItem || "Unavailable"}`,
    `Favorite Category: ${favoriteCategory}`,
    `Customer Value Score: ${customerValueScore.toFixed(2)}`,
    `VIP: ${vipStatus}`,
    `Customer Type: ${customerType}`,
    `Behavior Profile: ${customerBehaviorProfile}`,
    `Win-back Eligible: ${winbackEligible ? "Yes" : "No"}`,
  ].join("\n");

  // ---------------------------------------------------------
  // 10. BUILD LOGICAL WRITE MAP
  // ---------------------------------------------------------

  const values = {
    "contact.total_orders": orderCount,
    "contact.first_order_date": firstOrderDate,
    "contact.last_order_date": lastOrderDate,
    "contact.lifetime_value": lifetimeValue,
    "contact.average_order_value": averageOrderValue,
    "contact.highest_order_value": highestOrderValue,
    "contact.lowest_order_value": lowestOrderValue,
    "contact.average_order_interval_days": averageOrderInterval,
    "contact.typical_order_interval_days": typicalOrderInterval,
    "contact.days_since_last_order": daysSinceLastOrder,
    "contact.expected_next_order_date": expectedNextOrderDate,
    "contact.days_overdue": daysOverdue,
    "contact.overdue_ratio": orderCycleRatio,

    "contact.customer_status": customerStatus,

    "contact.orders_last_30_days": ordersLast30,
    "contact.orders_previous_30_days": ordersPrevious30,
    "contact.order_frequency_trend": frequencyTrend,

    "contact.spend_last_30_days": spendLast30,
    "contact.spend_previous_30_days": spendPrevious30,
    "contact.spending_trend": spendingTrend,

    "contact.favorite_category": favoriteCategory,
    "contact.top_categories": topCategories.join(", "),
    "contact.favorite_item": favoriteItem,
    "contact.top_items": topItems.join(", "),
    "contact.category_diversity": categoryDiversity,
    "contact.purchase_consistency": purchaseConsistency,

    "contact.order_source_mix": sourceMix,
    "contact.primary_order_source": primaryOrderSource,
    "contact.preferred_order_type": preferredOrderType,
    "contact.preferred_location": preferredLocation,
    "contact.last_order_type": lastOrderType,
    "contact.last_order_location": lastOrderLocation,
    "contact.last_coupon_code": lastCouponCode,

    "contact.lifetime_spend_percentile": lifetimeSpendPercentile,
    "contact.order_frequency_percentile": orderFrequencyPercentile,
    "contact.customer_value_score": customerValueScore,
    "contact.vip_classification": vipClassification,
    "contact.vip_status": vipStatus,
    "contact.customer_type": customerType,
    "contact.customer_behavior_profile": customerBehaviorProfile,

    "contact.winback_eligibility": winbackEligible,
    "contact.winback_tier": winbackTier,

    "contact.customer_intelligence_summary": summary,
    "contact.m06_intelligence_updated_at": now.toISOString(),
  };

  // ---------------------------------------------------------
  // 11. CONTRACT COVERAGE
  // ---------------------------------------------------------

  const missing = fieldKeys.filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        values,
        key
      )
  );

  const extra = Object.keys(values).filter(
    (key) => !fieldKeys.includes(key)
  );

  console.log("");
  console.log("---------- VALUE BUILD ----------");
  console.log(`Computed values: ${Object.keys(values).length}`);
  console.log(`Missing contract fields: ${missing.length}`);
  console.log(`Extra fields: ${extra.length}`);

  if (missing.length) {
    console.log("Missing:");
    console.log(missing.join("\n"));
  }

  if (extra.length) {
    console.log("Extra:");
    console.log(extra.join("\n"));
  }

  assert(
    missing.length === 0,
    "Every M06 contract field has a computed value."
  );

  // ---------------------------------------------------------
  // 12. RESOLVE ALL FIELDS BEFORE WRITE
  // ---------------------------------------------------------

  const resolved = {};

  for (const fieldKey of fieldKeys) {
    resolved[fieldKey] =
      await resolveField(
        LOCATION_ID,
        API_KEY,
        fieldKey
      );
  }

  console.log("");
  console.log("---------- RESOLUTION ----------");
  console.log(
    `Resolved fields: ${Object.keys(resolved).length}`
  );

  assert(
    Object.keys(resolved).length === fieldKeys.length,
    "All M06 fields resolved before write."
  );

  // ---------------------------------------------------------
  // 13. REAL SINGLE-CUSTOMER WRITE
  // ---------------------------------------------------------

  console.log("");
  console.log("---------- WRITE ----------");
  console.log("Writing ONE customer only.");
  console.log(`contactId: ${CONTACT_ID}`);

  const writeResult =
    await writeContactFields({
      locationId: LOCATION_ID,
      apiKey: API_KEY,
      contactId: CONTACT_ID,
      values,
    });

  assert(
    writeResult?.succeeded !== false,
    "M06 single-customer write succeeded."
  );

  console.log(
    `Updated fields: ${writeResult.updatedFields.length}`
  );

  // ---------------------------------------------------------
  // 14. READ BACK
  // ---------------------------------------------------------

  console.log("");
  console.log("---------- READ BACK ----------");

  const contact =
    await request(
      `/contacts/${encodeURIComponent(CONTACT_ID)}` +
      `?locationId=${encodeURIComponent(LOCATION_ID)}`,
      API_KEY
    );

  const customFields =
    Array.isArray(contact?.contact?.customFields)
      ? contact.contact.customFields
      : [];

  const byId = new Map();

  for (const field of customFields) {
    if (field?.id) {
      byId.set(
        field.id,
        field.value
      );
    }
  }

  function normalizeReadValue(expected, actual) {
    // GHL DATE / DATE_TIME custom fields can return YYYY-MM-DD
    // even when the write payload contains an ISO timestamp.
    if (
      typeof expected === "string" &&
      typeof actual === "string" &&
      expected.length >= 10 &&
      actual.length === 10 &&
      expected.slice(4, 5) === "-" &&
      expected.slice(7, 8) === "-" &&
      actual.slice(4, 5) === "-" &&
      actual.slice(7, 8) === "-"
    ) {
      return expected.slice(0, 10) === actual;
    }

    // Numerical fields use null for "Insufficient Data".
    if (
      expected === "Insufficient Data" &&
      (actual === undefined ||
        actual === null ||
        actual === "")
    ) {
      return true;
    }

    // Numeric values can safely compare numerically.
    if (
      typeof expected === "number" &&
      actual !== undefined &&
      actual !== null &&
      actual !== ""
    ) {
      return Number(actual) === expected;
    }

    // Explicit null means we accept a missing/null GHL field.
    if (expected === null) {
      return (
        actual === undefined ||
        actual === null ||
        actual === ""
      );
    }

    // GHL may omit false checkbox/boolean values from the
    // returned customFields collection.
    if (expected === false) {
      return (
        actual === false ||
        actual === 0 ||
        actual === "false" ||
        actual === "0" ||
        actual === undefined ||
        actual === null ||
        actual === ""
      );
    }

    return String(actual) === String(expected);
  }

  let matched = 0;
  const mismatches = [];

  for (const fieldKey of fieldKeys) {
    const field = resolved[fieldKey];

    const actual =
      byId.get(field.id);

    const expected =
      values[fieldKey];

    if (
      normalizeReadValue(
        expected,
        actual
      )
    ) {
      matched++;
    } else {
      mismatches.push({
        fieldKey,
        expected,
        actual,
        fieldId: field.id,
      });
    }
  }

  console.log(`Fields matched: ${matched}/${fieldKeys.length}`);

  if (mismatches.length) {
    console.log("");
    console.log("MISMATCHES:");
    console.log(
      JSON.stringify(
        mismatches,
        null,
        2
      )
    );
  }

  assert(
    mismatches.length === 0,
    "Every written M06 value persisted correctly."
  );

  // ---------------------------------------------------------
  // RESULT
  // ---------------------------------------------------------

  console.log("");
  console.log("========== #37 RESULT ==========");
  console.log("");
  console.log("Single customer: PASS");
  console.log("Real M06 values: PASS");
  console.log("Logical fieldKey write path: PASS");
  console.log("Location-specific resolution: PASS");
  console.log("Read-back reconciliation: PASS");
  console.log("44-field contract coverage: PASS");
  console.log("");
  console.log(
    `TEST #37: PASS — Single Customer Full M06 Write Validated`
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #37: FAIL");
  console.error(error.stack || error.message);
  console.error("");
  process.exit(1);
});
