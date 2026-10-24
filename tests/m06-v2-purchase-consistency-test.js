const { buildM06Values } = require("../lib/m06-value-builder");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function makeOrder(contactId, date, amount = 100) {
  return {
    _id: `order-${date}`,
    contactId,
    status: "completed",
    liveMode: true,
    markAsTest: false,
    amount,
    createdAt: date,
    items: [
      {
        product: {
          _id: "test-product",
          name: "Test Product",
        },
        qty: 1,
        prices: {
          price: amount,
        },
      },
    ],
  };
}

function runCase(name, dates, expected) {
  const contactId = `contact-${name}`;

  const orders =
    dates.map((date) =>
      makeOrder(contactId, date)
    );

  const values =
    buildM06Values({
      customerOrders: orders,
      allQualifyingOrders: orders,
      now: new Date("2026-10-24T00:00:00Z"),
      productCategoryMap: new Map(),
    });

  const actual =
    values["contact.purchase_consistency"];

  console.log(
    `${name}: ${actual}`
  );

  assert(
    actual === expected,
    `${name}: expected ${expected}, got ${actual}`
  );
}

console.log("");
console.log(
  "========== #47 PURCHASE CONSISTENCY =========="
);
console.log("");

runCase(
  "Stable intervals",
  [
    "2026-09-14T00:00:00Z",
    "2026-09-24T00:00:00Z",
    "2026-10-04T00:00:00Z",
  ],
  "High"
);

runCase(
  "Moderate variation",
  [
    "2026-08-25T00:00:00Z",
    "2026-09-04T00:00:00Z",
    "2026-09-24T00:00:00Z",
  ],
  "Medium"
);

runCase(
  "Highly variable intervals",
  [
    "2026-07-01T00:00:00Z",
    "2026-07-06T00:00:00Z",
    "2026-08-25T00:00:00Z",
  ],
  "Low"
);

runCase(
  "Insufficient orders",
  [
    "2026-10-01T00:00:00Z",
    "2026-10-11T00:00:00Z",
  ],
  "Insufficient Data"
);

console.log("");
console.log(
  "High stability classification: PASS"
);
console.log(
  "Medium stability classification: PASS"
);
console.log(
  "Low stability classification: PASS"
);
console.log(
  "Insufficient Data rule: PASS"
);
console.log(
  "TEST #47: PASS — Purchase Consistency Production Logic"
);
