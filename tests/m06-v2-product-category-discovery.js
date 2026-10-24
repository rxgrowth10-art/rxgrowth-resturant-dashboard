const { fetchOrders, fetchProducts } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";
const API_KEY = process.env.M06_STENZ_API_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fetchCollectionsByIds(collectionIds) {
  const uniqueIds = [
    ...new Set(
      collectionIds.filter(Boolean)
    ),
  ];

  if (uniqueIds.length === 0) {
    return [];
  }

  const path =
    "/products/collections" +
    `?altId=${encodeURIComponent(LOCATION_ID)}` +
    "&altType=location" +
    "&limit=100" +
    `&collectionIds=${encodeURIComponent(uniqueIds.join(","))}`;

  const response = await request(
    path,
    API_KEY,
    {
      version: "2021-07-28",
    }
  );

  return Array.isArray(response?.data)
    ? response.data
    : [];
}

function getProductIdFromItem(item) {
  return (
    item?.product?._id ||
    item?.product?.id ||
    item?.productId ||
    item?.product_id ||
    null
  );
}

async function main() {
  assert(
    API_KEY,
    "M06_STENZ_API_KEY is required."
  );

  console.log("");
  console.log(
    "========== #45 PRODUCT → CATEGORY DISCOVERY =========="
  );
  console.log("");

  // --------------------------------------------------
  // 1. Orders
  // --------------------------------------------------

  console.log(
    "---------- ORDERS ----------"
  );

  const orders = await fetchOrders(
    LOCATION_ID
  );

  const qualifyingOrders =
    orders.filter((order) => {
      const id =
        order?._id ||
        order?.id;

      return Boolean(
        id &&
        order?.contactId &&
        order?.status === "completed" &&
        order?.liveMode === true &&
        order?.markAsTest !== true &&
        Number(order?.amount) > 0
      );
    });

  console.log(
    `Orders acquired: ${orders.length}`
  );

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  assert(
    qualifyingOrders.length > 0,
    "No qualifying orders found."
  );

  // --------------------------------------------------
  // 2. Extract purchased Product IDs
  // --------------------------------------------------

  console.log("");
  console.log(
    "---------- PURCHASED PRODUCT IDs ----------"
  );

  const purchasedProductIds =
    new Set();

  let totalLineItems = 0;
  let ordersWithItems = 0;

  console.log(
    "Fetching full order details..."
  );

  for (let i = 0; i < qualifyingOrders.length; i++) {
    const order = qualifyingOrders[i];

    const orderId =
      order?._id ||
      order?.id;

    assert(
      orderId,
      "Qualifying order has no ID."
    );

    const detail =
      await request(
        "/payments/orders/" +
          encodeURIComponent(orderId) +
          `?altId=${encodeURIComponent(LOCATION_ID)}` +
          "&altType=location",
        API_KEY,
        {
          version: "2021-07-28",
        }
      );

    const items =
      Array.isArray(detail?.items)
        ? detail.items
        : [];

    if (items.length > 0) {
      ordersWithItems += 1;
    }

    totalLineItems += items.length;

    for (const item of items) {
      const productId =
        getProductIdFromItem(item);

      if (productId) {
        purchasedProductIds.add(
          productId
        );
      }
    }

    console.log(
      `[${i + 1}/${qualifyingOrders.length}] ` +
      `${orderId} → ${items.length} line items`
    );
  }

  console.log(
    `Orders with items[]: ${ordersWithItems}/${qualifyingOrders.length}`
  );

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

  // --------------------------------------------------
  // 3. Products
  // --------------------------------------------------

  console.log("");
  console.log(
    "---------- PRODUCTS ----------"
  );

  const products =
    await fetchProducts(
      LOCATION_ID
    );

  const productById =
    new Map();

  for (const product of products) {
    const id =
      product?._id ||
      product?.id;

    if (id) {
      productById.set(
        id,
        product
      );
    }
  }

  const purchasedProducts =
    [];

  const missingProducts =
    [];

  for (const productId of purchasedProductIds) {
    const product =
      productById.get(
        productId
      );

    if (product) {
      purchasedProducts.push(
        product
      );
    } else {
      missingProducts.push(
        productId
      );
    }
  }

  console.log(
    `Products acquired: ${products.length}`
  );

  console.log(
    `Purchased products resolved: ${purchasedProducts.length}/${purchasedProductIds.size}`
  );

  console.log(
    `Purchased products missing: ${missingProducts.length}`
  );

  // --------------------------------------------------
  // 4. Product → Collection IDs
  // --------------------------------------------------

  console.log("");
  console.log(
    "---------- PRODUCT → COLLECTION IDs ----------"
  );

  const productCategoryMap =
    new Map();

  const allCollectionIds =
    new Set();

  let productsWithCollections = 0;
  let productsWithoutCollections = 0;

  for (const product of purchasedProducts) {
    const productId =
      product?._id ||
      product?.id;

    const collectionIds =
      Array.isArray(
        product?.collectionIds
      )
        ? product.collectionIds.filter(
            Boolean
          )
        : [];

    productCategoryMap.set(
      productId,
      collectionIds
    );

    if (collectionIds.length > 0) {
      productsWithCollections += 1;

      for (const collectionId of collectionIds) {
        allCollectionIds.add(
          collectionId
        );
      }
    } else {
      productsWithoutCollections += 1;
    }
  }

  console.log(
    `Products with collectionIds: ${productsWithCollections}`
  );

  console.log(
    `Products without collectionIds: ${productsWithoutCollections}`
  );

  console.log(
    `Unique Collection IDs discovered: ${allCollectionIds.size}`
  );

  // --------------------------------------------------
  // 5. Collections
  // --------------------------------------------------

  console.log("");
  console.log(
    "---------- COLLECTIONS ----------"
  );

  const collections =
    await fetchCollectionsByIds(
      [...allCollectionIds]
    );

  const collectionById =
    new Map();

  for (const collection of collections) {
    const id =
      collection?._id ||
      collection?.id;

    if (id) {
      collectionById.set(
        id,
        collection
      );
    }
  }

  console.log(
    `Collections resolved: ${collections.length}/${allCollectionIds.size}`
  );

  // --------------------------------------------------
  // 6. Build Product → Category Names
  // --------------------------------------------------

  console.log("");
  console.log(
    "---------- RESOLVED PRODUCT → CATEGORY ----------"
  );

  let productsWithResolvedCategories = 0;
  let productsWithUnresolvedCategories = 0;

  const resolvedProductCategories =
    new Map();

  for (const product of purchasedProducts) {
    const productId =
      product?._id ||
      product?.id;

    const productName =
      product?.name ||
      "(Unnamed Product)";

    const collectionIds =
      productCategoryMap.get(
        productId
      ) || [];

    const categories =
      collectionIds
        .map(
          (collectionId) =>
            collectionById.get(
              collectionId
            )
        )
        .filter(Boolean)
        .map(
          (collection) =>
            collection?.name ||
            collection?.title ||
            collection?.slug ||
            null
        )
        .filter(Boolean);

    resolvedProductCategories.set(
      productId,
      categories
    );

    if (categories.length > 0) {
      productsWithResolvedCategories += 1;
    } else {
      productsWithUnresolvedCategories += 1;
    }

    console.log("");
    console.log(
      `Product: ${productName}`
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
        categories.length
          ? categories.join(", ")
          : "(unresolved)"
      }`
    );
  }

  // --------------------------------------------------
  // 7. Final Result
  // --------------------------------------------------

  console.log("");
  console.log(
    "========== #45 RESULT =========="
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
    `Purchased products resolved: ${purchasedProducts.length}`
  );

  console.log(
    `Products with collectionIds: ${productsWithCollections}`
  );

  console.log(
    `Products without collectionIds: ${productsWithoutCollections}`
  );

  console.log(
    `Collection IDs discovered: ${allCollectionIds.size}`
  );

  console.log(
    `Collections resolved: ${collections.length}`
  );

  console.log(
    `Products with resolved categories: ${productsWithResolvedCategories}`
  );

  console.log(
    `Products without resolved categories: ${productsWithUnresolvedCategories}`
  );

  const coverage =
    purchasedProducts.length > 0
      ? (
          productsWithResolvedCategories /
          purchasedProducts.length
        ) * 100
      : 0;

  console.log(
    `Category coverage: ${coverage.toFixed(2)}%`
  );

  console.log("");
  console.log(
    "No contact writes performed: PASS"
  );

  console.log(
    "No product writes performed: PASS"
  );

  console.log(
    "Product → Collection relationship discovery: PASS"
  );

  console.log("");
  console.log(
    "TEST #45: PASS — Product Category Discovery"
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #45: FAIL"
  );
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );
  process.exit(1);
});
