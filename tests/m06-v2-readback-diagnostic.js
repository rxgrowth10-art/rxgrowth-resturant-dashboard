const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;
const CONTACT_ID = "ohNVjaJXwSItvVHeMtdG";

async function main() {
  if (!API_KEY) {
    throw new Error("M06_STENZ_API_KEY is missing.");
  }

  console.log("");
  console.log("========== #39A READ-BACK DIAGNOSTIC ==========");
  console.log("Contact:", CONTACT_ID);
  console.log("");

  const response = await request(
    `/contacts/${encodeURIComponent(CONTACT_ID)}?locationId=${encodeURIComponent(LOCATION_ID)}`,
    API_KEY
  );

  console.log("========== TOP-LEVEL KEYS ==========");
  console.log(Object.keys(response || {}));

  console.log("");
  console.log("========== CUSTOM FIELD SHAPE ==========");

  const candidates = [
    response?.customFields,
    response?.contact?.customFields,
    response?.data?.customFields,
  ];

  candidates.forEach((value, index) => {
    console.log(`Candidate ${index + 1}:`);
    console.log(
      Array.isArray(value)
        ? `ARRAY length=${value.length}`
        : value === undefined
          ? "undefined"
          : typeof value
    );

    if (Array.isArray(value)) {
      console.log(
        JSON.stringify(value.slice(0, 10), null, 2)
      );
    }
  });

  console.log("");
  console.log("========== TARGET FIELD LOOKUP ==========");

  const allCustomFields =
    Array.isArray(response?.customFields)
      ? response.customFields
      : Array.isArray(response?.contact?.customFields)
        ? response.contact.customFields
        : Array.isArray(response?.data?.customFields)
          ? response.data.customFields
          : [];

  const targetKeys = [
    "contact.total_orders",
    "contact.first_order_date",
    "contact.lifetime_value",
    "contact.last_coupon_code",
    "contact.customer_value_score",
    "contact.customer_intelligence_summary",
    "contact.m06_intelligence_updated_at",
  ];

  for (const key of targetKeys) {
    const matches = allCustomFields.filter((field) =>
      [
        field?.key,
        field?.fieldKey,
        field?.id,
        field?.name,
      ].includes(key)
    );

    console.log("");
    console.log(`FIELD: ${key}`);
    console.log(JSON.stringify(matches, null, 2));
  }

  console.log("");
  console.log("========== ALL NON-EMPTY CUSTOM FIELDS ==========");

  for (const field of allCustomFields) {
    const value =
      field?.value ??
      field?.fieldValue ??
      field?.field_value ??
      null;

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      console.log(
        JSON.stringify(
          {
            id: field?.id,
            key: field?.key,
            fieldKey: field?.fieldKey,
            value: field?.value,
            fieldValue: field?.fieldValue,
            name: field?.name,
          },
          null,
          2
        )
      );
    }
  }

  console.log("");
  console.log("========== #39A COMPLETE ==========");
  console.log("NO WRITE PERFORMED.");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #39A: FAIL");
  console.error(error.stack || error.message);
  process.exit(1);
});
