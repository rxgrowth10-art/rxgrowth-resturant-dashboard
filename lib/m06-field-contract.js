const M06_FIELD_KEYS = Object.freeze([
  // Core customer intelligence
  "contact.total_orders",
  "contact.first_order_date",
  "contact.last_order_date",
  "contact.lifetime_value",
  "contact.average_order_value",
  "contact.highest_order_value",
  "contact.lowest_order_value",

  // Order cycle
  "contact.average_order_interval_days",
  "contact.typical_order_interval_days",
  "contact.days_since_last_order",
  "contact.expected_next_order_date",
  "contact.days_overdue",
  "contact.overdue_ratio",

  // Recency / lifecycle
  "contact.customer_status",

  // Frequency
  "contact.orders_last_30_days",
  "contact.orders_previous_30_days",
  "contact.order_frequency_trend",

  // Spending
  "contact.spend_last_30_days",
  "contact.spend_previous_30_days",
  "contact.spending_trend",

  // Product / category intelligence
  "contact.favorite_category",
  "contact.favorite_item",

  // Channel / location
  "contact.preferred_order_type",
  "contact.preferred_location",
  "contact.last_order_type",
  "contact.last_order_location",
  "contact.last_coupon_code",

  // Value / VIP
  "contact.customer_type",

  // Technical / summary outputs
  "contact.customer_intelligence_summary",
  "contact.m06_intelligence_updated_at",

  // Win-back intelligence
  "contact.winback_eligibility",
  "contact.winback_tier",

  "contact.top_categories",
  "contact.top_items",
  "contact.category_diversity",
  "contact.purchase_consistency",
  "contact.order_source_mix",
  "contact.primary_order_source",
  "contact.lifetime_spend_percentile",
  "contact.order_frequency_percentile",
  "contact.customer_value_score",
  "contact.vip_status",
  "contact.vip_classification",
  "contact.customer_behavior_profile",
]);

const M06_FIELD_CONTRACT = Object.freeze(
  M06_FIELD_KEYS.map((fieldKey) => ({
    fieldKey,
    model: "contact",
  }))
);

function getM06FieldKeys() {
  return [...M06_FIELD_KEYS];
}

function getM06FieldContract() {
  return M06_FIELD_CONTRACT.map((field) => ({ ...field }));
}

module.exports = {
  M06_FIELD_KEYS,
  M06_FIELD_CONTRACT,
  getM06FieldKeys,
  getM06FieldContract,
};
