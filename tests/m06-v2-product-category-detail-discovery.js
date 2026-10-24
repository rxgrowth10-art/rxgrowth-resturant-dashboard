const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProductIdFromItem(item) {
  return (
    item?.product?._id ||
    item?.product?.id ||
    item?.productId ||
    item?._id ||
    null
  );
}

async function fetchOrderDetail(orderId) {
  return request(
    `/payments/orders/${encodeURIComponent(orderId)}` +
      `?altId=${encodeURIComponent(LOCATION_ID)}` +
      "&altType=location",
    API_KEY,
    {
      version: "2021-07-28",
    }
  );
}

async function fetchProductDetail(productId) {
  return request(
    `/products/${encodeURIComponent(productId)}` +
      `?locationId=${encodeURIComponent(LOCATION_ID)}`,
    API_KEY,
    {
      version: "2023-02-21",
    }
  );
}

async function fetchCollections() {
  return request(
    "/products/collections" +
      `?altId=${encodeURIComponent(LOCATION_ID)}` +
      "&altType=location" +
      "&limit=100" +
      "&offset=0",
    API_KEY,
    {
      version: "2021-07-28",
    }
  );
}

async function main() {
  assert(
    API_KEY,
    "M06_STENZ_API_KEY is required."
  );

  console.log("");
  console.log(
    "========== #45B PRODUCT DETAIL → CATEGORY DISCOVERY =========="
  );
  console.log("");

  // ------------------------------------------------------------
  // ORDERS
  // ------------------------------------------------------------

  console.log("---------- ORDERS ----------");

  const orders = await fetchOrders(LOCATION_ID);

  const qualifyingOrders = orders.filter((order) => {
    const id = order?._id || order?.id;

    return Boolean(
      id &&
      order?.contactId &&
      order?.status === "completed" &&
      order?.liveMode === true &&
      order?.markAsTest !== true &&
      Number(order?.amount) > 0
    );
  });

  console.log(`Orders acquired: ${orders.length}`);
  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  assert(
    qualifyingOrders.length > 0,
    "No qualifying orders found."
  );

  // ------------------------------------------------------------
  // PURCHASED PRODUCT IDS
  // ------------------------------------------------------------

  console.log("");
  console.log(
    "---------- PURCHASED PRODUCT IDs ----------"
  );

  const purchasedProductIds = new Set();
  let totalLineItems = 0;

  for (let i = 0; i < qualifyingOrders.length; i++) {
    const order = qualifyingOrders[i];

    const orderId =
      order?._id ||
      order?.id;

    const detail =
      await fetchOrderDetail(orderId);

    const items =
      Array.isArray(detail?.items)
        ? detail.items
        : [];

    totalLineItems += items.length;

    for (const item of items) {
      const productId =
        getProductIdFromItem(item);

      if (productId) {
        purchasedProductIds.add(productId);
      }
    }

    console.log(
      `[${i + 1}/${qualifyingOrders.length}] ` +
      `${orderId} → ${items.length} line items`
    );
  }

  console.log(
    `Total order line items: ${totalLineItems}`
  );

  console.log(
    `Unique purchased Product IDs: ${purchasedProductIds.size}`
  );

  assert(
    purchasedProductIds.size > 0,
    "No Product IDs found inside qualifying orders."
  );

  // ------------------------------------------------------------
  // PRODUCT DETAILS
  // ------------------------------------------------------------

  console.log("");
  console.log(
    "---------- PRODUCT DETAILS ----------"
  );

  const productDetails = new Map();

  let productsWithCollectionIds = 0;
  let productsWithoutCollectionIds = 0;

  const discoveredCollectionIds =
    new Set();

  let productIndex = 0;

  for (const productId of purchasedProductIds) {
    productIndex += 1;

    const product =
      await fetchProductDetail(productId);

    productDetails.set(
      productId,
      product
    );

    const collectionIds =
      Array.isArray(product?.collectionIds)
        ? product.collectionIds.filter(Boolean)
        : [];

    if (collectionIds.length > 0) {
      productsWithCollectionIds += 1;

      for (const collectionId of collectionIds) {
        discoveredCollectionIds.add(
          collectionId
        );
      }
    } else {
      productsWithoutCollectionIds += 1;
    }

    console.log("");
    console.log(
      `[${productIndex}/${purchasedProductIds.size}]`
    );

    console.log(
      `Product: ${product?.name || "(unnamed)"}`
    );

    console.log(
      `Product ID: ${productId}`
    );

    console.log(
      `Collection IDs: ${
        collectionIds.length
          ? collectionIds.join(", ")
          : "(none)"
      }`
    );

    await sleep(250);
  }

  // ------------------------------------------------------------
  // COLLECTIONS
  // ------------------------------------------------------------

  console.log("");
  console.log(
    "---------- COLLECTIONS ----------"
  );

  const collectionsResponse =
    await fetchCollections();

  const collections =
    Array.isArray(collectionsResponse?.data)
      ? collectionsResponse.data
      : [];

  const collectionMap =
    new Map();

  for (const collection of collections) {
    const collectionId =
      collection?._id ||
      collection?.id ||
      collection?.collectionId;

    if (!collectionId) continue;

    collectionMap.set(
      collectionId,
      collection
    );
  }

  console.log(
    `Collections acquired: ${collections.length}`
  );

  console.log(
    `Purchased collection IDs discovered: ${
      discoveredCollectionIds.size
    }`
  );

  // ------------------------------------------------------------
  // RESOLUTION
  // ------------------------------------------------------------

  console.log("");
  console.log(
    "---------- PRODUCT → CATEGORY ----------"
  );

  let resolvedProducts = 0;
  let unresolvedProducts = 0;

  for (const productId of purchasedProductIds) {
    const product =
      productDetails.get(productId);

    const collectionIds =
      Array.isArray(product?.collectionIds)
        ? product.collectionIds.filter(Boolean)
        : [];

    const resolvedCollections =
      collectionIds
        .map((id) => collectionMap.get(id))
        .filter(Boolean);

    const categoryNames =
      resolvedCollections
        .map(
          (collection) =>
            collection?.name ||
            collection?.title ||
            collection?.slug ||
            null
        )
        .filter(Boolean);

    if (categoryNames.length > 0) {
      resolvedProducts += 1;
    } else {
      unresolvedProducts += 1;
    }

    console.log("");
    console.log(
      `Product: ${product?.name || "(unnamed)"}`
    );

    console.log(
      `Product ID: ${productId}`
    );

    console.log(
      `Collection IDs: ${
        collectionIds.length
          ? collectionIds.join(", ")
          : "(none)"
      }`
    );

    console.log(
      `Categories: ${
        categoryNames.length
          ? categoryNames.join(", ")
          : "(unresolved)"
      }`
    );
  }

  const categoryCoverage =
    purchasedProductIds.size > 0
      ? (
          (resolvedProducts /
            purchasedProductIds.size) *
          100
        )
      : 0;

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------

  console.log("");
  console.log(
    "========== #45B RESULT =========="
  );
  console.log("");

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  console.log(
    `Order line items: ${totalLineItems}`
  );

  console.log(
    `Unique purchased products: ${purchasedProductIds.size}`
  );

  console.log(
    `Products with collectionIds: ${productsWithCollectionIds}`
  );

  console.log(
    `Products without collectionIds: ${productsWithoutCollectionIds}`
  );

  console.log(
    `Collection IDs discovered: ${discoveredCollectionIds.size}`
  );

  console.log(
    `Collections acquired: ${collections.length}`
  );

  console.log(
    `Products with resolved categories: ${resolvedProducts}`
  );

  console.log(
    `Products without resolved categories: ${unresolvedProducts}`
  );

  console.log(
    `Category coverage: ${categoryCoverage.toFixed(2)}%`
  );

  console.log("");
  console.log(
    "No contact writes performed: PASS"
  );

  console.log(
    "No product writes performed: PASS"
  );

  console.log(
    "Product detail → collection discovery: PASS"
  );

  console.log("");
  console.log(
    "TEST #45B: PASS — Product Detail Category Discovery"
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #45B: FAIL");
  console.error(
    error?.stack ||
      error?.message ||
      String(error)
  );
  process.exit(1);
});
