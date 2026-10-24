function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Number(value).toFixed(decimals).replace(/\.00$/, "");
}

function formatDate(value) {
  if (!hasValue(value)) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        return (
          item.name ||
          item.label ||
          item.value ||
          item.productName ||
          item.categoryName ||
          null
        );
      }

      return null;
    })
    .filter(Boolean)
    .join(", ");
}

function addLine(lines, label, value) {
  if (hasValue(value)) {
    lines.push(`${label}: ${value}`);
  }
}

function buildCustomerIntelligenceSummary(customer = {}) {
  const lines = [];

  lines.push("Customer Intelligence");

  lines.push("");
  lines.push("Lifecycle");

  addLine(lines, "Total Orders", customer.totalOrders);
  addLine(lines, "First Order", formatDate(customer.firstOrderDate));
  addLine(lines, "Last Order", formatDate(customer.lastOrderDate));
  addLine(lines, "Customer Status", customer.customerStatus);
  addLine(lines, "Recency", customer.recencyBand);

  const daysSinceLastOrder = formatNumber(customer.daysSinceLastOrder);

  if (daysSinceLastOrder !== null) {
    addLine(lines, "Days Since Last Order", daysSinceLastOrder);
  }

  lines.push("");
  lines.push("Value");

  const lifetimeValue = formatNumber(customer.lifetimeValue);
  const averageOrderValue = formatNumber(customer.averageOrderValue);
  const highestOrderValue = formatNumber(customer.highestOrderValue);
  const lowestOrderValue = formatNumber(customer.lowestOrderValue);
  const customerValueScore = formatNumber(customer.customerValueScore);

  if (lifetimeValue !== null) {
    addLine(lines, "Lifetime Value", lifetimeValue);
  }

  if (averageOrderValue !== null) {
    addLine(lines, "Average Order Value", averageOrderValue);
  }

  if (highestOrderValue !== null) {
    addLine(lines, "Highest Order Value", highestOrderValue);
  }

  if (lowestOrderValue !== null) {
    addLine(lines, "Lowest Order Value", lowestOrderValue);
  }

  if (customerValueScore !== null) {
    addLine(lines, "Customer Value Score", customerValueScore);
  }

  addLine(lines, "VIP Classification", customer.vipClassification);
  addLine(lines, "VIP Status", customer.vipStatus);

  lines.push("");
  lines.push("Frequency");

  addLine(lines, "Orders Last 30 Days", customer.ordersLast30Days);
  addLine(lines, "Orders Previous 30 Days", customer.ordersPrevious30Days);
  addLine(lines, "Frequency Trend", customer.frequencyTrend);

  const averageOrderInterval = formatNumber(customer.averageOrderInterval);
  const typicalOrderInterval = formatNumber(customer.typicalOrderInterval);
  const orderCycleRatio = formatNumber(customer.orderCycleRatio);
  const daysOverdue = formatNumber(customer.daysOverdue);

  if (averageOrderInterval !== null) {
    addLine(lines, "Average Order Interval (days)", averageOrderInterval);
  }

  if (typicalOrderInterval !== null) {
    addLine(lines, "Typical Order Interval (days)", typicalOrderInterval);
  }

  addLine(
    lines,
    "Expected Next Order",
    formatDate(customer.expectedNextOrderDate)
  );

  if (daysOverdue !== null) {
    addLine(lines, "Days Overdue", daysOverdue);
  }

  if (orderCycleRatio !== null) {
    addLine(lines, "Order Cycle Ratio", orderCycleRatio);
  }

  const spendLast30Days = formatNumber(customer.spendLast30Days);
  const spendPrevious30Days = formatNumber(customer.spendPrevious30Days);

  if (
    spendLast30Days !== null ||
    spendPrevious30Days !== null ||
    hasValue(customer.spendingTrend)
  ) {
    lines.push("");
    lines.push("Spending");

    if (spendLast30Days !== null) {
      addLine(lines, "Spend Last 30 Days", spendLast30Days);
    }

    if (spendPrevious30Days !== null) {
      addLine(lines, "Spend Previous 30 Days", spendPrevious30Days);
    }

    addLine(lines, "Spending Trend", customer.spendingTrend);
  }

  lines.push("");
  lines.push("Behavior");

  addLine(lines, "Favorite Category", customer.favoriteCategory);
  addLine(lines, "Favorite Item", customer.favoriteItem);

  const topCategories = formatList(customer.topCategories);

  if (topCategories !== null) {
    addLine(lines, "Top Categories", topCategories);
  }

  const topItems = formatList(customer.topItems);

  if (topItems !== null) {
    addLine(lines, "Top Items", topItems);
  }

  addLine(lines, "Category Diversity", customer.categoryDiversity);
  addLine(lines, "Purchase Consistency", customer.purchaseConsistency);

  addLine(lines, "Order Source Mix", customer.orderSourceMix);
  addLine(lines, "Primary Order Source", customer.primaryOrderSource);
  addLine(lines, "Preferred Order Type", customer.preferredOrderType);
  addLine(lines, "Preferred Location", customer.preferredLocation);
  addLine(lines, "Last Order Type", customer.lastOrderType);
  addLine(lines, "Last Order Location", customer.lastOrderLocation);
  addLine(lines, "Last Coupon Code", customer.lastCouponCode);

  lines.push("");
  lines.push("Action Signals");

  addLine(lines, "Win-back Eligible", customer.winbackEligible);
  addLine(lines, "Win-back Tier", customer.winbackTier);

  return lines.join("\n").trim();
}


const CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY =
  "contact.customer_intelligence_summary";

function attachCustomerIntelligenceSummary(customer = {}) {
  const summary = buildCustomerIntelligenceSummary(customer);

  return {
    ...customer,
    [CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY]: summary,
  };
}

module.exports = {
  buildCustomerIntelligenceSummary,
  attachCustomerIntelligenceSummary,
  CUSTOMER_INTELLIGENCE_SUMMARY_FIELD_KEY,
};
