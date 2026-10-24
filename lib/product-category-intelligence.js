const { request } = require("./ghl");

function assertRequired(value, name) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
}

function getOrderId(order) {
  return order?._id || order?.id || null;
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

async function fetchOrderDetail(
  locationId,
  apiKey,
  orderId
) {
  return request(
    `/payments/orders/${encodeURIComponent(orderId)}` +
      `?altId=${encodeURIComponent(locationId)}` +
      `&altType=location`,
    apiKey,
    {
      version: "2021-07-28",
    }
  );
}

async function fetchProductDetail(
  locationId,
  apiKey,
  productId
) {
  return request(
    `/products/${encodeURIComponent(productId)}` +
      `?locationId=${encodeURIComponent(locationId)}`,
    apiKey,
    {
      version: "2023-02-21",
    }
  );
}

async function fetchCollectionsByIds(
  locationId,
  apiKey,
  collectionIds
) {
  const uniqueIds = [
    ...new Set(
      collectionIds.filter(Boolean)
    ),
  ];

  if (!uniqueIds.length) {
    return [];
  }

  const path =
    "/products/collections" +
    `?altId=${encodeURIComponent(locationId)}` +
    "&altType=location" +
    "&limit=100" +
    `&collectionIds=${encodeURIComponent(
      uniqueIds.join(",")
    )}`;

  const response = await request(
    path,
    apiKey,
    {
      version: "2021-07-28",
    }
  );

  return Array.isArray(response?.data)
    ? response.data
    : [];
}

/**
 * Builds:
 *
 * productId -> {
 *   productName,
 *   collectionIds,
 *   categories
 * }
 *
 * Pipeline:
 *
 * qualifying orders
 *   -> order detail
 *   -> product IDs
 *   -> product detail
 *   -> collection IDs
 *   -> collections
 *   -> category names
 */
async function buildProductCategoryMap({
  locationId,
  apiKey,
  qualifyingOrders,
}) {
  assertRequired(
    locationId,
    "locationId"
  );

  assertRequired(
    apiKey,
    "apiKey"
  );

  if (!Array.isArray(qualifyingOrders)) {
    throw new Error(
      "qualifyingOrders must be an array."
    );
  }

  const purchasedProductIds =
    new Set();

  // --------------------------------------------------
  // 1. Order Detail -> Product IDs
  // --------------------------------------------------

  for (const order of qualifyingOrders) {
    const orderId =
      getOrderId(order);

    if (!orderId) continue;

    const detail =
      await fetchOrderDetail(
        locationId,
        apiKey,
        orderId
      );

    const items =
      Array.isArray(detail?.items)
        ? detail.items
        : [];

    for (const item of items) {
      const productId =
        getProductIdFromItem(item);

      if (productId) {
        purchasedProductIds.add(
          productId
        );
      }
    }
  }

  // --------------------------------------------------
  // 2. Product Detail -> Collection IDs
  // --------------------------------------------------

  const productDetails =
    new Map();

  const collectionIds =
    new Set();

  for (const productId of purchasedProductIds) {
    const product =
      await fetchProductDetail(
        locationId,
        apiKey,
        productId
      );

    const ids =
      Array.isArray(
        product?.collectionIds
      )
        ? product.collectionIds.filter(Boolean)
        : [];

    productDetails.set(
      productId,
      {
        productId,
        productName:
          product?.name ||
          product?.title ||
          null,
        collectionIds: ids,
      }
    );

    for (const collectionId of ids) {
      collectionIds.add(
        collectionId
      );
    }
  }

  // --------------------------------------------------
  // 3. Collections -> Category Names
  // --------------------------------------------------

  const collections =
    await fetchCollectionsByIds(
      locationId,
      apiKey,
      [...collectionIds]
    );

  const collectionById =
    new Map();

  for (const collection of collections) {
    const id =
      collection?._id ||
      collection?.id;

    if (!id) continue;

    const name =
      collection?.name ||
      collection?.title ||
      null;

    collectionById.set(
      id,
      name
    );
  }

  // --------------------------------------------------
  // 4. Final Product -> Category Map
  // --------------------------------------------------

  const productCategoryMap =
    new Map();

  for (
    const [
      productId,
      product
    ] of productDetails
  ) {
    const categories =
      product.collectionIds
        .map(
          (collectionId) =>
            collectionById.get(
              collectionId
            )
        )
        .filter(Boolean);

    productCategoryMap.set(
      productId,
      {
        productId,
        productName:
          product.productName,
        collectionIds:
          product.collectionIds,
        categories: [
          ...new Set(categories),
        ],
      }
    );
  }

  return productCategoryMap;
}

module.exports = {
  buildProductCategoryMap,
};
