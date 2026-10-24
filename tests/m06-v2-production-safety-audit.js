const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.join(ROOT, "lib");

const FORBIDDEN_STENZ_FIELD_IDS = [
  "u6yiamYAzDXxDSNcrYAW",
  "7aX6S5hOeCEaWehEIsFP",
  "ZU6HupbrHasrix9EXZ13",
  "LNcuic7xsHUGtMDEc7JF",
  "2fHquwcknKPJpFgyswTP",
  "mNsFkJwUdVW1jO5KaMKV",
  "QCbCjFMhvfIoKS0yxr0c",
  "ZtlaFCPZM710a0SamPmB",
  "Rog0sAeIfsgwuCKxlfH5",
  "gYeh9GiZfBtptfydtd3t",
  "WFWFrQMCf8b9y3in7Bv1",
  "KHKWkzbd0PYJwQAtGSwX",
  "utMAZhK2y8laZAfqAJXb",
  "vukLL26fKfmUZH66BDYr",
  "6PdM0a5B2KnzHif8oAqd",
  "lNeDmrVjEwgkefdL7vs4",
  "OC9s4ILqM7QRTvWn2ueI",
  "8MWPSU0fY6QfKHQicHxl",
  "WmmmN33cKc1djTw9vRIP",
  "t3x0itWCXiT9Pxyo8HKF",
  "zeX8ZKQB14ArXe5OBkwi",
  "cLWq3pxuupD458NjexIQ",
  "UueK8zWu6qLUe5RS7HXc",
  "TV9fyI5UkYVOct8hGpA1",
  "ew2e0K4YXIcDtxthBR6t",
  "4ihEc3qCP17IuKohfNTz",
  "JlE7ebO8NLjlbghJc6vU",
  "sG8zs8T6YcIp3s0wNitI",
  "WK2IjcZvu5cnFuIVqCJ6",
  "HqxQ0tg7SJUMKi0sXe1p",
  "pcc5M6VghcDAswnqwQc9",
  "oNwVeCI5QG3rS5HTUucw",
  "CtDU0OAeJYb2TZV44Qyy",
  "dXlXGqR93w1rlwC1Oo3M",
  "S063vIjCk01ISQPsj1Qd",
  "DyJAfnZq4eAtEtszcmhv",
  "3TrzlB8U6rACCcPm5XTg",
  "t1ZCRVkMBG29lmg9dfph",
  "GXuk4LUf0GCKLKZdu0Om",
];

const FORBIDDEN_CUSTOMER_IDS = [
  "ohNVjaJXwSItvVHeMtdG",
  "VFK3JVJaIXFt4J98d3c5",
  "00xumJANOLjqB2usBpGC",
  "7I7VwsEPAMo8c0aQdeDs",
  "bCGnQoz9X370Gw5pkMeK",
  "KDnp9xAQQgF8Tp2TjGY1",
  "famO3Y8FoyArA25Fi4Gq",
  "5aj4on8zt8j5EdFYmMGB",
  "D1bWgrYdVfbSS40oaynz",
];

const FORBIDDEN_FIXTURE_COUNTS = [
  "14 orders",
  "9 customers",
  "15 contacts",
  "122 products",
  "3 transactions",
];

const LIB_FILES = fs
  .readdirSync(LIB_DIR)
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(LIB_DIR, file));

function readAllLib() {
  return LIB_FILES.map((file) => ({
    file,
    relative: path.relative(ROOT, file),
    content: fs.readFileSync(file, "utf8"),
  }));
}

function findMatches(files, needles) {
  const matches = [];

  for (const item of files) {
    for (const needle of needles) {
      if (item.content.includes(needle)) {
        matches.push({
          file: item.relative,
          needle,
        });
      }
    }
  }

  return matches;
}

function assertNoMatches(
  title,
  matches
) {
  if (matches.length === 0) {
    console.log(
      `${title}: PASS`
    );
    return;
  }

  console.error(
    `${title}: FAIL`
  );

  for (const match of matches) {
    console.error(
      `  ${match.file} → ${match.needle}`
    );
  }

  fail(
    `${title} detected ${matches.length} violation(s).`
  );
}

async function main() {
  console.log("");
  console.log(
    "========== #44 M06 PRODUCTION SAFETY AUDIT =========="
  );
  console.log("");

  assert(
    fs.existsSync(LIB_DIR),
    "lib directory not found."
  );

  console.log(
    `Production lib files scanned: ${LIB_FILES.length}`
  );

  console.log("");
  console.log(
    "---------- HARDCODED LOCATION-SPECIFIC FIELD IDs ----------"
  );

  const fieldIdMatches =
    findMatches(
      readAllLib(),
      FORBIDDEN_STENZ_FIELD_IDS
    );

  assertNoMatches(
    "No STENZ field IDs in production lib",
    fieldIdMatches
  );

  console.log("");
  console.log(
    "---------- HARDCODED CUSTOMER IDs ----------"
  );

  const customerIdMatches =
    findMatches(
      readAllLib(),
      FORBIDDEN_CUSTOMER_IDS
    );

  assertNoMatches(
    "No STENZ customer IDs in production lib",
    customerIdMatches
  );

  console.log("");
  console.log(
    "---------- FIXTURE COUNTS ----------"
  );

  const countMatches =
    findMatches(
      readAllLib(),
      FORBIDDEN_FIXTURE_COUNTS
    );

  assertNoMatches(
    "No fixture counts in production lib",
    countMatches
  );

  console.log("");
  console.log(
    "---------- UNSUPPORTED ORDER STATUS DEPENDENCIES ----------"
  );

  const productionFiles =
    readAllLib();

  const paymentStatusMatches =
    findMatches(
      productionFiles,
      ["paymentStatus"]
    );

  const fulfillmentStatusMatches =
    findMatches(
      productionFiles,
      ["fulfillmentStatus"]
    );

  assertNoMatches(
    "No paymentStatus dependency in production lib",
    paymentStatusMatches
  );

  assertNoMatches(
    "No fulfillmentStatus dependency in production lib",
    fulfillmentStatusMatches
  );

  console.log("");
  console.log(
    "---------- FIELD RESOLUTION ARCHITECTURE ----------"
  );

  const resolverPath =
    path.join(
      LIB_DIR,
      "field-resolver.js"
    );

  const writerPath =
    path.join(
      LIB_DIR,
      "contact-writer.js"
    );

  const builderPath =
    path.join(
      LIB_DIR,
      "m06-value-builder.js"
    );

  assert(
    fs.existsSync(resolverPath),
    "field-resolver.js missing."
  );

  assert(
    fs.existsSync(writerPath),
    "contact-writer.js missing."
  );

  assert(
    fs.existsSync(builderPath),
    "m06-value-builder.js missing."
  );

  const resolver =
    fs.readFileSync(
      resolverPath,
      "utf8"
    );

  const writer =
    fs.readFileSync(
      writerPath,
      "utf8"
    );

  const builder =
    fs.readFileSync(
      builderPath,
      "utf8"
    );

  assert(
    resolver.includes(
      "resolveField"
    ),
    "resolveField missing from field resolver."
  );

  assert(
    resolver.includes(
      "fieldKey"
    ),
    "fieldKey missing from field resolver."
  );

  assert(
    writer.includes(
      "resolveField"
    ),
    "Contact writer does not use field resolver."
  );

  assert(
    writer.includes(
      "fieldKey"
    ),
    "Contact writer does not operate by fieldKey."
  );

  assert(
    builder.includes(
      "contact."
    ),
    "M06 value builder does not produce logical contact field keys."
  );

  console.log(
    "fieldKey → resolver → location-specific field ID: PASS"
  );

  console.log(
    "Contact writer uses resolved IDs: PASS"
  );

  console.log(
    "M06 builder remains logical-field based: PASS"
  );

  console.log("");
  console.log(
    "---------- SECRET / API KEY SAFETY ----------"
  );

  const secretPatterns = [
    /ghl_[A-Za-z0-9_-]{20,}/i,
    /sk-[A-Za-z0-9_-]{20,}/,
    /Bearer\s+[A-Za-z0-9._-]{30,}/,
  ];

  const secretMatches = [];

  for (const item of productionFiles) {
    for (const pattern of secretPatterns) {
      if (pattern.test(item.content)) {
        secretMatches.push({
          file: item.relative,
          pattern: String(pattern),
        });
      }
    }
  }

  assertNoMatches(
    "No embedded API secrets detected",
    secretMatches
  );

  console.log("");
  console.log(
    "---------- ENVIRONMENT CONFIGURATION ----------"
  );

  const ghlPath =
    path.join(
      LIB_DIR,
      "ghl.js"
    );

  const ghl =
    fs.readFileSync(
      ghlPath,
      "utf8"
    );

  assert(
    ghl.includes(
      "process.env.GHL_API_KEY"
    ),
    "GHL API key is not environment-based."
  );

  console.log(
    "GHL API key from environment: PASS"
  );

  console.log("");
  console.log(
    "---------- TEST / PRODUCTION SEPARATION ----------"
  );

  const testFiles =
    fs.readdirSync(
      path.join(ROOT, "tests")
    )
    .filter((file) =>
      file.endsWith(".js")
    );

  assert(
    testFiles.length > 0,
    "No test files found."
  );

  console.log(
    `Test files remain isolated under tests/: ${testFiles.length}`
  );

  console.log(
    "Test / production separation: PASS"
  );

  console.log("");
  console.log(
    "========== #44 RESULT =========="
  );
  console.log("");

  console.log(
    "Hardcoded restaurant field IDs: 0"
  );

  console.log(
    "Hardcoded customer IDs: 0"
  );

  console.log(
    "Hardcoded fixture counts: 0"
  );

  console.log(
    "paymentStatus dependency: 0"
  );

  console.log(
    "fulfillmentStatus dependency: 0"
  );

  console.log(
    "Embedded API secrets: 0"
  );

  console.log("");
  console.log(
    "FieldKey-based portability: PASS"
  );

  console.log(
    "Environment-based secrets: PASS"
  );

  console.log(
    "Production/test separation: PASS"
  );

  console.log("");
  console.log(
    "TEST #44: PASS — M06 Production Safety Audit"
  );

  console.log("");
  console.log(
    "=================================================="
  );
  console.log(
    "M06 V2 PRODUCTION SAFETY GATE: PASS"
  );
  console.log(
    "M06 V2 READY FOR FREEZE"
  );
  console.log(
    "=================================================="
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #44: FAIL"
  );
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );
  process.exit(1);
});
