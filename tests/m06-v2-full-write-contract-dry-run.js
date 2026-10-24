const {
  getM06FieldKeys,
} = require("../lib/m06-field-contract");

const {
  resolveField,
} = require("../lib/field-resolver");

const STENZ_LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function inferExpectedType(dataType) {
  const type = String(dataType || "").toUpperCase();

  if (
    type.includes("NUMBER") ||
    type.includes("NUMERIC") ||
    type.includes("DECIMAL")
  ) {
    return "number";
  }

  if (
    type.includes("DATE") ||
    type.includes("TIME")
  ) {
    return "date";
  }

  if (
    type.includes("BOOL") ||
    type.includes("CHECKBOX")
  ) {
    return "boolean";
  }

  return "string";
}

function buildDryRunValue(field) {
  const type = inferExpectedType(field.dataType);

  switch (type) {
    case "number":
      return 0;

    case "date":
      return "2026-01-01T00:00:00.000Z";

    case "boolean":
      return false;

    default:
      return "M06_DRY_RUN";
  }
}

async function main() {
  console.log("");
  console.log("========== #36 M06 FULL WRITE CONTRACT DRY RUN ==========");
  console.log("");

  assert(API_KEY, "M06_STENZ_API_KEY is configured.");

  const fieldKeys = getM06FieldKeys();

  console.log(`Logical fieldKeys: ${fieldKeys.length}`);
  console.log("");

  assert(
    fieldKeys.length > 0,
    "M06 field contract contains logical fieldKeys."
  );

  const resolvedFields = [];
  const failures = [];

  for (const fieldKey of fieldKeys) {
    try {
      const field = await resolveField(
        STENZ_LOCATION_ID,
        API_KEY,
        fieldKey
      );

      assert(field?.id, `Resolved field ID for ${fieldKey}`);
      assert(
        field?.fieldKey === fieldKey,
        `Resolved fieldKey matches requested key: ${fieldKey}`
      );

      resolvedFields.push({
        fieldKey,
        fieldId: field.id,
        name: field.name || null,
        dataType: field.dataType || null,
        expectedType: inferExpectedType(field.dataType),
        dryRunValue: buildDryRunValue(field),
      });
    } catch (error) {
      failures.push({
        fieldKey,
        error: error.message,
      });
    }
  }

  console.log("---------- RESOLUTION ----------");

  for (const field of resolvedFields) {
    console.log(
      `${field.fieldKey} -> ${field.fieldId}` +
      ` | ${field.dataType || "UNKNOWN"}`
    );
  }

  console.log("");
  console.log(`Resolved: ${resolvedFields.length}`);
  console.log(`Failed:   ${failures.length}`);
  console.log("");

  assert(
    failures.length === 0,
    `All M06 logical fields resolve. Failures: ${JSON.stringify(failures)}`
  );

  console.log("---------- DRY-RUN PAYLOAD ----------");

  const customFields = resolvedFields.map((field) => ({
    id: field.fieldId,
    key: field.fieldKey,
    fieldValue: field.dryRunValue,
  }));

  console.log(
    JSON.stringify(
      {
        locationId: STENZ_LOCATION_ID,
        writeMode: "DRY_RUN",
        writePerformed: false,
        customFields,
      },
      null,
      2
    )
  );

  console.log("");
  console.log("---------- CONTRACT CHECKS ----------");

  const uniqueKeys =
    new Set(resolvedFields.map((field) => field.fieldKey)).size;

  const uniqueIds =
    new Set(resolvedFields.map((field) => field.fieldId)).size;

  const allHaveIds =
    resolvedFields.every((field) => Boolean(field.fieldId));

  const allHaveKeys =
    resolvedFields.every((field) => Boolean(field.fieldKey));

  const noLocationSpecificLogic =
    resolvedFields.every(
      (field) =>
        typeof field.fieldKey === "string" &&
        field.fieldKey.startsWith("contact.")
    );

  console.log(
    `All logical fieldKeys resolved: ${resolvedFields.length === fieldKeys.length ? "PASS" : "FAIL"}`
  );

  console.log(
    `All resolved fields have IDs: ${allHaveIds ? "PASS" : "FAIL"}`
  );

  console.log(
    `All resolved fields preserve fieldKey: ${allHaveKeys ? "PASS" : "FAIL"}`
  );

  console.log(
    `Logical fieldKeys unique: ${uniqueKeys === resolvedFields.length ? "PASS" : "FAIL"}`
  );

  console.log(
    `Resolved field IDs unique: ${uniqueIds === resolvedFields.length ? "PASS" : "FAIL"}`
  );

  console.log(
    `No restaurant-specific field mapping: ${noLocationSpecificLogic ? "PASS" : "FAIL"}`
  );

  console.log(
    `WRITE operation executed: NO`
  );

  console.log("");
  console.log("========== #36 RESULT ==========");

  assert(
    resolvedFields.length === fieldKeys.length,
    "Full M06 field contract resolved."
  );

  assert(
    uniqueKeys === resolvedFields.length,
    "Logical fieldKeys are unique."
  );

  assert(
    allHaveIds,
    "Every logical field has a location-specific resolved ID."
  );

  assert(
    allHaveKeys,
    "Every resolved field preserves its logical fieldKey."
  );

  assert(
    uniqueIds === resolvedFields.length,
    "Resolved field IDs are unique."
  );

  assert(
    noLocationSpecificLogic,
    "No restaurant-specific field mapping is used."
  );

  console.log(
    `TEST #36: PASS — ${fieldKeys.length}-Field M06 Write Contract Validated`
  );

  console.log("");
  console.log("IMPORTANT: DRY RUN ONLY — NO GHL CONTACT WAS WRITTEN.");
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #36: FAIL");
  console.error(error.message);
  console.error("");
  process.exit(1);
});
