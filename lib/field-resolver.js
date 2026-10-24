const { request } = require("./ghl");

const fieldCache = new Map();

async function fetchContactFieldRegistry(locationId, apiKey) {
  if (!locationId) {
    throw new Error("locationId is required.");
  }

  if (!apiKey) {
    throw new Error("apiKey is required.");
  }

  const cacheKey = `${locationId}:contact`;

  if (fieldCache.has(cacheKey)) {
    return fieldCache.get(cacheKey);
  }

  const response = await request(
    `/locations/${locationId}/customFields?model=contact`,
    apiKey
  );

  const fields = Array.isArray(response?.customFields)
    ? response.customFields
    : Array.isArray(response?.fields)
      ? response.fields
      : Array.isArray(response?.data)
        ? response.data
        : [];

  const registry = new Map();

  for (const field of fields) {
    const fieldKey = field?.fieldKey;
    const fieldId = field?.id;

    if (!fieldKey || !fieldId) {
      continue;
    }

    registry.set(fieldKey, {
      id: fieldId,
      fieldKey,
      name: field?.name || null,
      dataType: field?.dataType || null,
      locationId: field?.locationId || locationId,
    });
  }

  fieldCache.set(cacheKey, registry);

  return registry;
}

async function resolveField(locationId, apiKey, fieldKey) {
  if (!fieldKey) {
    throw new Error("fieldKey is required.");
  }

  const registry = await fetchContactFieldRegistry(locationId, apiKey);
  const field = registry.get(fieldKey);

  if (!field) {
    throw new Error(
      `Field key "${fieldKey}" was not found for location "${locationId}".`
    );
  }

  return field;
}

async function resolveFieldId(locationId, apiKey, fieldKey) {
  const field = await resolveField(locationId, apiKey, fieldKey);
  return field.id;
}

function clearFieldCache() {
  fieldCache.clear();
}

module.exports = {
  fetchContactFieldRegistry,
  resolveField,
  resolveFieldId,
  clearFieldCache,
};
