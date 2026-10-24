const { request } = require("./ghl");
const { resolveField } = require("./field-resolver");

function assertRequired(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required.`);
  }
}

function normalizeValueForGhlField(value, field) {
  const dataType = field?.dataType;

  // GHL DATE fields persist as YYYY-MM-DD.
  // M06 may calculate/store an ISO timestamp internally,
  // but the GHL transport representation must be date-only.
  if (
    dataType === "DATE" &&
    value !== null &&
    value !== undefined &&
    value !== ""
  ) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === "string") {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/);

      if (match) {
        return match[1];
      }
    }

    throw new Error(
      `Invalid DATE value for field "${field?.fieldKey}": ${value}`
    );
  }

  // Numerical fields cannot store human-readable strings such as
  // "Insufficient Data". When M06 has no numerical value, persist
  // null rather than an invalid string.
  if (dataType === "NUMERICAL") {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (
      typeof value === "string" &&
      value === "Insufficient Data"
    ) {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      throw new Error(
        `Invalid NUMERICAL value for field "${field?.fieldKey}": ${value}`
      );
    }

    return numeric;
  }

  return value;
}

/**
 * Write M06 logical fieldKey/value pairs to a GHL contact.
 *
 * Input:
 * {
 *   locationId,
 *   apiKey,
 *   contactId,
 *   values: {
 *     "contact.total_orders": 5,
 *     "contact.lifetime_value": 595
 *   }
 * }
 *
 * M06 business logic never supplies GHL field IDs.
 * The resolver translates fieldKey -> location-specific field ID.
 */
async function writeContactFields({
  locationId,
  apiKey,
  contactId,
  values,
}) {
  assertRequired(locationId, "locationId");
  assertRequired(apiKey, "apiKey");
  assertRequired(contactId, "contactId");

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("values must be a fieldKey/value object.");
  }

  const entries = Object.entries(values);

  if (entries.length === 0) {
    return {
      succeeded: true,
      contactId,
      updatedFields: [],
      response: null,
    };
  }

  const customFields = [];

  for (const [fieldKey, value] of entries) {
    if (!fieldKey || !fieldKey.startsWith("contact.")) {
      throw new Error(
        `Invalid M06 fieldKey: ${fieldKey}`
      );
    }

    if (value === undefined) {
      throw new Error(
        `Undefined value is not allowed for fieldKey: ${fieldKey}`
      );
    }

    const resolved = await resolveField(
      locationId,
      apiKey,
      fieldKey
    );

    const normalizedValue =
      normalizeValueForGhlField(
        value,
        resolved
      );

    customFields.push({
      id: resolved.id,
      key: fieldKey,
      fieldValue: normalizedValue,
    });
  }

  const response = await request(
    `/contacts/${encodeURIComponent(contactId)}`,
    apiKey,
    {
      method: "PUT",
      version: "2021-07-28",
      body: {
        customFields,
      },
    }
  );

  return {
    succeeded:
      response?.succeeded !== false,
    contactId,
    updatedFields: customFields.map((field) => ({
      fieldKey: field.key,
      fieldId: field.id,
      value: field.fieldValue,
    })),
    response,
  };
}

module.exports = {
  writeContactFields,
};
