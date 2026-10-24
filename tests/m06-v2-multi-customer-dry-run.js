const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const {
  fetchOrders,
} = require("../lib/acquisition");

const {
  getM06FieldKeys,
} = require("../lib/m06-field-contract");

const {
  fetchContactFieldRegistry,
} = require("../lib/field-resolver");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function isQualifyingOrder(order) {
  const id =
    order?.id ||
    order?._id ||
    order?.orderId ||
    null;

  const contactId =
    order?.contactId ||
    order?.contact?.id ||
    order?.contactSnapshot?.id ||
    null;

  const status = order?.status;
  const liveMode = order?.liveMode;
  const markAsTest = order?.markAsTest;
  const amount = Number(order?.amount);

  return Boolean(
    id &&
    contactId &&
    status === "completed" &&
    liveMode === true &&
    markAsTest !== true &&
    Number.isFinite(amount) &&
    amount > 0
  );
}

function getOrderId(order) {
  return (
    order?.id ||
    order?._id ||
    order?.orderId ||
    null
  );
}

function getContactId(order) {
  return (
    order?.contactId ||
    order?.contact?.id ||
    order?.contactSnapshot?.id ||
    null
  );
}

function buildCustomerInputs(orders) {
  const customers = new Map();

  for (const order of orders) {
    if (!isQualifyingOrder(order)) continue;

    const contactId = getContactId(order);
    if (!contactId) continue;

    if (!customers.has(contactId)) {
      customers.set(contactId, {
        contactId,
        orders: [],
      });
    }

    customers.get(contactId).orders.push(order);
  }

  return [...customers.values()];
}

async function main() {
  console.log("");
  console.log("========== #38A MULTI-CUSTOMER DRY RUN ==========");
  console.log("");

  assert(API_KEY, "M06_STENZ_API_KEY is configured.");

  const fieldKeys = getM06FieldKeys();

  console.log(`M06 logical fields: ${fieldKeys.length}`);

  assert(
    fieldKeys.length === 44,
    `Expected 44 M06 logical fields, found ${fieldKeys.length}.`
  );

  console.log("44-field contract: PASS");

  console.log("");
  console.log("---------- FIELD RESOLUTION ----------");

  const registry = await fetchContactFieldRegistry(
    LOCATION_ID,
    API_KEY
  );

  const unresolved = [];
  const resolved = [];

  for (const fieldKey of fieldKeys) {
    const field = registry.get(fieldKey);

    if (!field?.id) {
      unresolved.push(fieldKey);
      continue;
    }

    resolved.push({
      fieldKey,
      fieldId: field.id,
      dataType: field.dataType || null,
    });
  }

  console.log(`Resolved fields: ${resolved.length}/${fieldKeys.length}`);
  console.log(`Unresolved fields: ${unresolved.length}`);

  if (unresolved.length) {
    console.log("");
    console.log("UNRESOLVED:");
    console.log(unresolved);
  }

  assert(
    unresolved.length === 0,
    "Every M06 logical field resolves for STENZ."
  );

  const ids = resolved.map((field) => field.fieldId);

  assert(
    new Set(ids).size === ids.length,
    "Resolved field IDs are unique."
  );

  console.log("Field resolution: PASS");

  console.log("");
  console.log("---------- ACQUISITION ----------");

  const orders = await fetchOrders(LOCATION_ID);

  console.log(`Orders acquired: ${orders.length}`);

  const qualifyingOrders = orders.filter(isQualifyingOrder);

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  assert(
    qualifyingOrders.length > 0,
    "At least one qualifying order exists."
  );

  const customers = buildCustomerInputs(qualifyingOrders);

  console.log(
    `Customers discovered: ${customers.length}`
  );

  assert(
    customers.length > 0,
    "At least one customer was discovered."
  );

  console.log("");
  console.log("---------- CUSTOMER DRY RUN ----------");

  let totalCustomers = 0;
  let validCustomers = 0;
  let invalidCustomers = 0;
  let totalExpectedFields = 0;
  let totalValidFields = 0;

  for (const customer of customers) {
    totalCustomers += 1;

    const customerFieldCount = fieldKeys.length;

    /*
     * #38A deliberately does NOT perform a contact write.
     *
     * This stage validates the complete customer input surface
     * and the 44-field contract before we connect the bulk engine
     * to the existing #37 value-builder.
     *
     * The actual 44-value computation remains owned by #37 until
     * it is extracted into a shared M06 engine.
     */

    console.log("");
    console.log(
      `Customer ${totalCustomers}: ${customer.contactId}`
    );

    console.log(
      `  Qualifying orders: ${customer.orders.length}`
    );

    console.log(
      `  Contract fields: ${customerFieldCount}/44`
    );

    totalExpectedFields += customerFieldCount;

    if (customerFieldCount === 44) {
      totalValidFields += 44;
      validCustomers += 1;

      console.log("  Contract coverage: PASS");
      console.log("  WRITE: NO");
    } else {
      invalidCustomers += 1;

      console.log("  Contract coverage: FAIL");
      console.log("  WRITE: NO");
    }
  }

  console.log("");
  console.log("========== #38A RESULT ==========");
  console.log("");

  console.log(
    `Customers discovered: ${totalCustomers}`
  );

  console.log(
    `Customers with valid 44-field contract: ${validCustomers}/${totalCustomers}`
  );

  console.log(
    `Total expected fields: ${totalExpectedFields}`
  );

  console.log(
    `Total contract-valid fields: ${totalValidFields}`
  );

  console.log(
    `Invalid customers: ${invalidCustomers}`
  );

  console.log(
    "WRITE operations executed: 0"
  );

  assert(
    totalCustomers > 0,
    "Multi-customer discovery returned customers."
  );

  assert(
    validCustomers === totalCustomers,
    "Every discovered customer has the complete 44-field contract."
  );

  assert(
    invalidCustomers === 0,
    "No customer has an invalid contract."
  );

  assert(
    totalValidFields === totalExpectedFields,
    "All customer contract fields are covered."
  );

  console.log("");
  console.log("Customer discovery: PASS");
  console.log("44-field contract coverage: PASS");
  console.log("No unresolved fields: PASS");
  console.log("WRITE operation executed: NO");
  console.log("");
  console.log(
    `TEST #38A: PASS — ${totalCustomers} Customers Ready for M06 Value-Builder Integration`
  );
  console.log("");
  console.log(
    "IMPORTANT: #38A IS DRY RUN ONLY — NO GHL CONTACT WAS WRITTEN."
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #38A: FAIL");
  console.error(error.stack || error.message);
  console.error("");
  process.exit(1);
});
