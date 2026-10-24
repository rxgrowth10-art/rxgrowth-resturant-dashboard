const { fetchOrders } = require("./acquisition");
const { resolveField } = require("./field-resolver");
const { getM06FieldKeys } = require("./m06-field-contract");
const { buildM06Values } = require("./m06-value-builder");
const { buildProductCategoryMap } = require("./product-category-intelligence");
const { writeContactFields } = require("./contact-writer");

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

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

function validateValue(fieldKey, value, field) {
  const dataType = field?.dataType;

  if (value === undefined) {
    return {
      ok: false,
      reason: "undefined",
    };
  }

  if (dataType === "DATE") {
    if (value === null) {
      return { ok: true };
    }

    const valid =
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value);

    return {
      ok: valid,
      reason: valid
        ? null
        : `DATE value is not YYYY-MM-DD: ${JSON.stringify(value)}`,
    };
  }

  if (dataType === "NUMERICAL") {
    if (value === null) {
      return { ok: true };
    }

    const valid = numeric(value);

    return {
      ok: valid,
      reason: valid
        ? null
        : `NUMERICAL value is not numeric/null: ${JSON.stringify(value)}`,
    };
  }

  return { ok: true };
}

async function resolveFieldContract(locationId, apiKey) {
  const fieldKeys = getM06FieldKeys();

  if (!Array.isArray(fieldKeys) || fieldKeys.length === 0) {
    throw new Error("M06 field contract is empty.");
  }

  const resolved = {};

  for (const fieldKey of fieldKeys) {
    const field = await resolveField(
      locationId,
      apiKey,
      fieldKey
    );

    if (!field?.id) {
      throw new Error(
        `Could not resolve field ID for ${fieldKey}`
      );
    }

    resolved[fieldKey] = field;
  }

  return {
    fieldKeys,
    resolved,
  };
}

function validateBuiltValues(values, fieldKeys, resolved) {
  if (!values || typeof values !== "object") {
    throw new Error("Builder returned no values object.");
  }

  const actualKeys = Object.keys(values);

  const missing = fieldKeys.filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        values,
        key
      )
  );

  const extra = actualKeys.filter(
    (key) => !fieldKeys.includes(key)
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing M06 fields: ${missing.join(", ")}`
    );
  }

  if (extra.length > 0) {
    throw new Error(
      `Extra M06 fields: ${extra.join(", ")}`
    );
  }

  const typeErrors = [];

  for (const fieldKey of fieldKeys) {
    const check = validateValue(
      fieldKey,
      values[fieldKey],
      resolved[fieldKey]
    );

    if (!check.ok) {
      typeErrors.push({
        fieldKey,
        reason: check.reason,
      });
    }
  }

  if (typeErrors.length > 0) {
    const details = typeErrors
      .map(
        (item) =>
          `${item.fieldKey}: ${item.reason}`
      )
      .join(" | ");

    throw new Error(
      `M06 type validation failed: ${details}`
    );
  }

  return values;
}

async function runM06Engine({
  locationId,
  apiKey,
  now = new Date(),
  write = false,
}) {
  if (!locationId) {
    throw new Error("locationId is required.");
  }

  if (!apiKey) {
    throw new Error("apiKey is required.");
  }

  const {
    fieldKeys,
    resolved,
  } = await resolveFieldContract(
    locationId,
    apiKey
  );

  const orders = await fetchOrders(locationId);

  const qualifyingOrders =
    orders.filter(qualifyOrder);

  if (qualifyingOrders.length === 0) {
    return {
      locationId,
      mode: write ? "write" : "dry-run",
      ordersAcquired: orders.length,
      qualifyingOrders: 0,
      customersDiscovered: 0,
      customersProcessed: 0,
      customersWritten: 0,
      fieldCount: fieldKeys.length,
      results: [],
    };
  }

  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;

    if (!customers.has(contactId)) {
      customers.set(contactId, []);
    }

    customers
      .get(contactId)
      .push(order);
  }

  const productCategoryMap =
    await buildProductCategoryMap({
      locationId,
      apiKey,
      qualifyingOrders,
    });

  const results = [];
  const failures = [];

  const buildNow = new Date(now);

  for (
    const [contactId, customerOrders]
    of customers.entries()
  ) {
    try {
      const built =
        await buildM06Values({
          customer: {
            contactId,
            orders: customerOrders,
          },

          customerOrders,

          allQualifyingOrders:
            qualifyingOrders,

          productCategoryMap,

          qualifyingOrders,

          orders: customerOrders,

          now: buildNow,

          locationId,
        });

      const values =
        built?.values ||
        built?.fields ||
        built;

      validateBuiltValues(
        values,
        fieldKeys,
        resolved
      );

      let writeResult = null;

      if (write) {
        writeResult =
          await writeContactFields({
            locationId,
            apiKey,
            contactId,
            values,
          });
      }

      results.push({
        contactId,
        qualifyingOrders:
          customerOrders.length,
        fields: Object.keys(values).length,
        values,
        writeResult,
      });
    } catch (error) {
      failures.push({
        contactId,
        error:
          error?.message ||
          String(error),
      });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `M06 failed for ${failures.length} customer(s): ${JSON.stringify(
        failures
      )}`
    );
  }

  return {
    locationId,
    mode: write ? "write" : "dry-run",
    ordersAcquired: orders.length,
    qualifyingOrders:
      qualifyingOrders.length,
    customersDiscovered:
      customers.size,
    customersProcessed:
      results.length,
    customersWritten:
      write ? results.length : 0,
    fieldCount: fieldKeys.length,
    results,
  };
}

module.exports = {
  runM06Engine,
  qualifyOrder,
  validateValue,
};
