const { request } = require("../lib/ghl");
const { resolveField } = require("../lib/field-resolver");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

const TARGETS = [
  "contact.first_order_date",
  "contact.last_order_date",
  "contact.expected_next_order_date",
  "contact.m06_intelligence_updated_at",
  "contact.category_diversity",
];

const CONTACT_ID = "VFK3JVJaIXFt4J98d3c5";

async function main() {
  console.log("");
  console.log("========== #37B FIELD DIAGNOSTIC ==========");
  console.log("");

  if (!API_KEY) {
    throw new Error("M06_STENZ_API_KEY is not configured.");
  }

  console.log("---------- RESOLVED FIELD METADATA ----------");

  for (const fieldKey of TARGETS) {
    const field = await resolveField(
      LOCATION_ID,
      API_KEY,
      fieldKey
    );

    console.log("");
    console.log(`FIELD: ${fieldKey}`);
    console.log(JSON.stringify(field, null, 2));
  }

  console.log("");
  console.log("---------- RAW GHL FIELD REGISTRY ----------");

  const registryResponse = await request(
    `/locations/${encodeURIComponent(LOCATION_ID)}` +
    `/customFields?model=contact`,
    API_KEY
  );

  const registry =
    Array.isArray(registryResponse?.customFields)
      ? registryResponse.customFields
      : Array.isArray(registryResponse?.fields)
        ? registryResponse.fields
        : Array.isArray(registryResponse?.data)
          ? registryResponse.data
          : [];

  for (const fieldKey of TARGETS) {
    const match = registry.find(
      (field) => field?.fieldKey === fieldKey
    );

    console.log("");
    console.log(`REGISTRY FIELD: ${fieldKey}`);
    console.log(
      JSON.stringify(
        match || null,
        null,
        2
      )
    );
  }

  console.log("");
  console.log("---------- CURRENT CONTACT VALUES ----------");

  const contactResponse = await request(
    `/contacts/${encodeURIComponent(CONTACT_ID)}` +
    `?locationId=${encodeURIComponent(LOCATION_ID)}`,
    API_KEY
  );

  const customFields =
    Array.isArray(contactResponse?.contact?.customFields)
      ? contactResponse.contact.customFields
      : [];

  for (const fieldKey of TARGETS) {
    const registryField = registry.find(
      (field) => field?.fieldKey === fieldKey
    );

    const fieldId = registryField?.id;

    const current = customFields.find(
      (field) => field?.id === fieldId
    );

    console.log("");
    console.log(`CONTACT VALUE: ${fieldKey}`);
    console.log(
      JSON.stringify(
        current || null,
        null,
        2
      )
    );
  }

  console.log("");
  console.log("========== #37B COMPLETE ==========");
  console.log("READ ONLY — NO WRITE PERFORMED.");
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #37B: FAIL");
  console.error(error.stack || error.message);
  console.error("");
  process.exit(1);
});
