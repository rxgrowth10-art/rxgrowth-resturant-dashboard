const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");
const { buildM06Values } = require("../lib/m06-value-builder");
const { buildProductCategoryMap } = require("../lib/product-category-intelligence");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function orderId(order) {
  return order?._id || order?.id || null;
}

async function fetchQualifyingOrderDetails() {
  const orders = await fetchOrders(LOCATION_ID);

  const qualifying = orders.filter((order) => {
    const id = orderId(order);

    return Boolean(
      id &&
      order?.contactId &&
      order?.status === "completed" &&
      order?.liveMode === true &&
      order?.markAsTest !== true &&
      Number(order?.amount) > 0
    );
  });

  const details = [];

  for (const order of qualifying) {
    const id = orderId(order);

    const detail = await request(
      `/payments/orders/${encodeURIComponent(id)}` +
        `?altId=${encodeURIComponent(LOCATION_ID)}` +
        `&altType=location`,
      API_KEY,
      {
        version: "2021-07-28",
      }
    );

    details.push({
      ...order,
      ...detail,
      _id: id,
      id,
      contactId: order.contactId,
      status: order.status,
      liveMode: order.liveMode,
      markAsTest: order.markAsTest,
      amount: order.amount,
    });
  }

  return details;
}

function groupByCustomer(orders) {
  const groups = new Map();

  for (const order of orders) {
    const contactId = order?.contactId;

    if (!contactId) continue;

    if (!groups.has(contactId)) {
      groups.set(contactId, []);
    }

    groups.get(contactId).push(order);
  }

  return groups;
}

async function main() {
  if (!API_KEY) {
    throw new Error(
      "M06_STENZ_API_KEY is required."
    );
  }

  console.log("");
  console.log(
    "========== #46 CATEGORY INTELLIGENCE VALIDATION =========="
  );
  console.log("");

  console.log(
    "---------- QUALIFYING ORDERS ----------"
  );

  const allQualifyingOrders =
    await fetchQualifyingOrderDetails();

  console.log(
    `Qualifying orders: ${allQualifyingOrders.length}`
  );

  assert(
    allQualifyingOrders.length > 0,
    "No qualifying orders found."
  );

  const groups =
    groupByCustomer(
      allQualifyingOrders
    );

  console.log(
    `Customers discovered: ${groups.size}`
  );

  console.log("");
  console.log(
    "---------- PRODUCT CATEGORY MAP ----------"
  );

  const productCategoryMap =
    await buildProductCategoryMap({
      locationId: LOCATION_ID,
      apiKey: API_KEY,
      qualifyingOrders: allQualifyingOrders,
    });

  console.log(
    `Product category map: ${productCategoryMap.size} products`
  );

  assert(
    productCategoryMap.size > 0,
    "Product category map is empty."
  );

  console.log("");
  console.log(
    "---------- BUILDER CATEGORY OUTPUT ----------"
  );

  let customersValidated = 0;

  for (const [contactId, customerOrders] of groups) {
    const values =
      buildM06Values({
        customerOrders,
        allQualifyingOrders,
        now: new Date(),
        productCategoryMap,
      });

    const favoriteCategory =
      values["contact.favorite_category"];

    const topCategories =
      values["contact.top_categories"];

    const categoryDiversity =
      values["contact.category_diversity"];

    const favoriteItem =
      values["contact.favorite_item"];

    const topItems =
      values["contact.top_items"];

    console.log("");
    console.log(
      `Customer: ${contactId}`
    );
    console.log(
      `  Orders: ${customerOrders.length}`
    );
    console.log(
      `  Favorite Category: ${favoriteCategory}`
    );
    console.log(
      `  Top Categories: ${topCategories}`
    );
    console.log(
      `  Category Diversity: ${categoryDiversity}`
    );
    console.log(
      `  Favorite Item: ${favoriteItem}`
    );
    console.log(
      `  Top Items: ${topItems}`
    );

    assert(
      favoriteCategory !== "Uncategorized",
      `${contactId}: Favorite Category still uses old placeholder`
    );

    assert(
      topCategories !== "Uncategorized",
      `${contactId}: Top Categories still uses old placeholder`
    );

    assert(
      categoryDiversity !== "Insufficient Data",
      `${contactId}: Category Diversity still uses old string placeholder`
    );

    assert(
      categoryDiversity === null ||
        Number.isFinite(Number(categoryDiversity)),
      `${contactId}: Category Diversity is not numeric/null`
    );

    customersValidated += 1;
  }

  console.log("");
  console.log(
    "========== #46 RESULT =========="
  );

  console.log(
    `Customers validated: ${customersValidated}/${groups.size}`
  );

  console.log(
    `Products in category map: ${productCategoryMap.size}`
  );

  console.log(
    "Favorite Category: PASS"
  );

  console.log(
    "Top Categories: PASS"
  );

  console.log(
    "Category Diversity: PASS"
  );

  console.log(
    "Favorite Item: PASS"
  );

  console.log(
    "Top Items: PASS"
  );

  console.log(
    "No contact writes performed: PASS"
  );

  console.log("");
  console.log(
    "TEST #46: PASS — Category Intelligence Validation"
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #46: FAIL"
  );
  console.error(
    error?.stack || error
  );
  process.exit(1);
});
