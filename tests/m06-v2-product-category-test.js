const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = process.env.GHL_LOCATION_ID || "V2q4leIVzpDKRiljAOOj";

async function fetchProducts(locationId) {
  const all = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await request(
      "/products/" +
      `?locationId=${encodeURIComponent(locationId)}` +
      `&limit=${limit}` +
      `&offset=${offset}`
    );

    const items = Array.isArray(response?.products)
      ? response.products
      : Array.isArray(response?.data)
        ? response.data
        : [];

    all.push(...items);

    console.log(`Products page offset ${offset}: ${items.length} records`);

    if (items.length < limit) break;

    offset += limit;
  }

  const seen = new Set();

  return all.filter((product) => {
    const id = product?._id || product?.id;

    if (!id) return true;
    if (seen.has(id)) return false;

    seen.add(id);
    return true;
  });
}

async function fetchOrderDetails(locationId, orders) {
  const details = [];

  for (const order of orders) {
    const orderId = order?._id || order?.id;
    if (!orderId) continue;

    const detail = await request(
      "/payments/orders/" +
      `${encodeURIComponent(orderId)}` +
      `?altId=${encodeURIComponent(locationId)}` +
      "&altType=location"
    );

    details.push(detail);
  }

  return details;
}

function isQualifyingOrder(order) {
  const contactId = order?.contactId;
  const status = String(order?.status || "").toLowerCase();
  const liveMode = order?.liveMode === true;
  const markAsTest = order?.markAsTest === true;
  const amount = Number(order?.amount);

  return Boolean(
    contactId &&
    status === "completed" &&
    liveMode &&
    !markAsTest &&
    Number.isFinite(amount) &&
    amount > 0
  );
}

function normalizeItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];

  return items.map((item) => {
    const product =
      item?.product ||
      item?.productSnapshot ||
      {};

    const productId =
      item?.productId ||
      item?.product_id ||
      product?._id ||
      product?.id ||
      null;

    const productName =
      item?.productName ||
      item?.name ||
      product?.name ||
      null;

    const qty = Number(
      item?.qty ??
      item?.quantity ??
      0
    );

    const unitPrice =
      Number(item?.unitPrice) ||
      Number(item?.price?.amount) ||
      Number(product?.price?.amount) ||
      0;

    return {
      productId,
      productName,
      qty,
      unitPrice,
      spend: qty * unitPrice,
    };
  });
}

function findCategory(product) {
  if (!product || typeof product !== "object") {
    return null;
  }

  const candidates = [
    product.category,
    product.categoryName,
    product.productCategory,
    product.productCategoryName,
    product.collections,
    product.collection,
    product.categories,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];

      if (typeof first === "string" && first.trim()) {
        return first.trim();
      }

      if (first && typeof first === "object") {
        const name =
          first.name ||
          first.title ||
          first.categoryName ||
          null;

        if (typeof name === "string" && name.trim()) {
          return name.trim();
        }
      }
    }

    if (value && typeof value === "object") {
      const name =
        value.name ||
        value.title ||
        value.categoryName ||
        null;

      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    }
  }

  return null;
}

function compareValues(a, b) {
  const qtyDiff = b.qty - a.qty;
  if (qtyDiff !== 0) return qtyDiff;

  const spendDiff = b.spend - a.spend;
  if (spendDiff !== 0) return spendDiff;

  return b.lastOrderTime - a.lastOrderTime;
}

function calculateCustomerProductIntelligence(
  qualifyingOrders,
  productsById,
  now
) {
  const customers = new Map();

  for (const order of qualifyingOrders) {
    const contactId = order.contactId;
    const orderDate =
      new Date(
        order?.createdAt ||
        order?.dateAdded ||
        order?.createdDate ||
        order?.updatedAt
      ).getTime();

    if (!Number.isFinite(orderDate)) continue;

    const customer =
      customers.get(contactId) ||
      {
        contactId,
        orders: 0,
        categories: new Map(),
        items: new Map(),
        lastOrderTime: 0,
      };

    customer.orders += 1;
    customer.lastOrderTime =
      Math.max(customer.lastOrderTime, orderDate);

    for (const item of normalizeItems(order)) {
      if (
        !item.productId ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0
      ) {
        continue;
      }

      const product = productsById.get(item.productId);

      const category =
        findCategory(product) ||
        "Uncategorized";

      const itemKey =
        item.productId ||
        item.productName ||
        "Unknown";

      const categoryStats =
        customer.categories.get(category) ||
        {
          category,
          qty: 0,
          spend: 0,
          lastOrderTime: 0,
        };

      categoryStats.qty += item.qty;
      categoryStats.spend += item.spend;
      categoryStats.lastOrderTime =
        Math.max(categoryStats.lastOrderTime, orderDate);

      customer.categories.set(
        category,
        categoryStats
      );

      const itemStats =
        customer.items.get(itemKey) ||
        {
          productId: item.productId,
          productName: item.productName || item.productId,
          qty: 0,
          spend: 0,
          lastOrderTime: 0,
        };

      itemStats.qty += item.qty;
      itemStats.spend += item.spend;
      itemStats.lastOrderTime =
        Math.max(itemStats.lastOrderTime, orderDate);

      customer.items.set(
        itemKey,
        itemStats
      );
    }

    customers.set(contactId, customer);
  }

  return [...customers.values()].map((customer) => {
    const categories =
      [...customer.categories.values()]
        .sort(compareValues);

    const items =
      [...customer.items.values()]
        .sort(compareValues);

    const favoriteCategory =
      categories[0]?.category || null;

    const favoriteItem =
      items[0]?.productName || null;

    const topCategories =
      categories.map((x) => ({
        category: x.category,
        qty: x.qty,
        spend: Number(x.spend.toFixed(2)),
      }));

    const topItems =
      items.map((x) => ({
        productId: x.productId,
        productName: x.productName,
        qty: x.qty,
        spend: Number(x.spend.toFixed(2)),
      }));

    const categoryDiversity =
      categories.length;

    const purchaseConsistency =
      customer.orders >= 3
        ? (
            categories.length === 1
              ? "Highly Consistent"
              : categories.length === 2
                ? "Consistent"
                : categories.length === 3
                  ? "Moderately Diverse"
                  : "Highly Diverse"
          )
        : "Insufficient Data";

    return {
      contactId: customer.contactId,
      totalOrders: customer.orders,
      favoriteCategory,
      topCategories,
      favoriteItem,
      topItems,
      categoryDiversity,
      purchaseConsistency,
    };
  });
}

async function main() {
  console.log("\n========== #25 PRODUCT / CATEGORY INTELLIGENCE ==========\n");

  const orders = await fetchOrders(LOCATION_ID);

  const details = await fetchOrderDetails(
    LOCATION_ID,
    orders
  );

  const qualifyingOrders =
    details.filter(isQualifyingOrder);

  console.log(`Orders acquired: ${orders.length}`);
  console.log(`Order details: ${details.length}`);
  console.log(`Qualifying orders: ${qualifyingOrders.length}`);

  const products =
    await fetchProducts(LOCATION_ID);

  console.log(`Products acquired: ${products.length}`);

  const productsById = new Map();

  for (const product of products) {
    const id = product?._id || product?.id;

    if (id) {
      productsById.set(id, product);
    }
  }

  const sampleProduct = products.find(Boolean);

  console.log("\n========== PRODUCT SCHEMA DISCOVERY ==========\n");

  if (sampleProduct) {
    console.log(
      "Sample product keys:",
      Object.keys(sampleProduct).sort()
    );

    console.log(
      "Detected category value:",
      findCategory(sampleProduct)
    );
  }

  const categoryCoverage = {
    withCategory: 0,
    withoutCategory: 0,
  };

  for (const order of qualifyingOrders) {
    for (const item of normalizeItems(order)) {
      if (!item.productId) continue;

      const product =
        productsById.get(item.productId);

      if (findCategory(product)) {
        categoryCoverage.withCategory += 1;
      } else {
        categoryCoverage.withoutCategory += 1;
      }
    }
  }

  console.log("\n========== CATEGORY COVERAGE ==========\n");
  console.log(categoryCoverage);

  const customerIntelligence =
    calculateCustomerProductIntelligence(
      qualifyingOrders,
      productsById,
      Date.now()
    );

  console.log("\n========== CUSTOMER PRODUCT INTELLIGENCE ==========\n");

  for (const customer of customerIntelligence) {
    console.log(
      JSON.stringify(customer, null, 2)
    );
  }

  const uniqueCustomers =
    customerIntelligence.length;

  const customersWithFavoriteCategory =
    customerIntelligence.filter(
      (x) => Boolean(x.favoriteCategory)
    ).length;

  const customersWithFavoriteItem =
    customerIntelligence.filter(
      (x) => Boolean(x.favoriteItem)
    ).length;

  const customersWithValidDiversity =
    customerIntelligence.filter(
      (x) => Number.isInteger(x.categoryDiversity)
    ).length;

  const consistencyEligible =
    customerIntelligence.filter(
      (x) => x.totalOrders >= 3
    );

  const consistencyValues =
    new Set(
      consistencyEligible.map(
        (x) => x.purchaseConsistency
      )
    );

  console.log("\n========== ASSERTIONS ==========\n");

  console.log(
    `Unique customers: ${uniqueCustomers}`
  );

  console.log(
    `Customers with favorite category: ${customersWithFavoriteCategory}`
  );

  console.log(
    `Customers with favorite item: ${customersWithFavoriteItem}`
  );

  console.log(
    `Customers with valid category diversity: ${customersWithValidDiversity}`
  );

  console.log(
    `Purchase consistency eligible customers: ${consistencyEligible.length}`
  );

  console.log(
    `Purchase consistency values:`,
    [...consistencyValues]
  );

  const allHaveFavoriteCategory =
    customerIntelligence.every(
      (x) => typeof x.favoriteCategory === "string"
    );

  const allHaveFavoriteItem =
    customerIntelligence.every(
      (x) => typeof x.favoriteItem === "string"
    );

  const diversityValid =
    customerIntelligence.every(
      (x) =>
        Number.isInteger(x.categoryDiversity) &&
        x.categoryDiversity >= 0
    );

  const insufficientRuleValid =
    customerIntelligence
      .filter((x) => x.totalOrders < 3)
      .every(
        (x) =>
          x.purchaseConsistency ===
          "Insufficient Data"
      );

  const consistencyRuleValid =
    consistencyEligible.every(
      (x) =>
        typeof x.purchaseConsistency === "string" &&
        x.purchaseConsistency !== "Insufficient Data"
    );

  const topCategoryOrderingValid =
    customerIntelligence.every((customer) => {
      const list = customer.topCategories;

      for (let i = 1; i < list.length; i++) {
        if (list[i - 1].qty < list[i].qty) {
          return false;
        }

        if (
          list[i - 1].qty === list[i].qty &&
          list[i - 1].spend < list[i].spend
        ) {
          return false;
        }
      }

      return true;
    });

  const topItemOrderingValid =
    customerIntelligence.every((customer) => {
      const list = customer.topItems;

      for (let i = 1; i < list.length; i++) {
        if (list[i - 1].qty < list[i].qty) {
          return false;
        }

        if (
          list[i - 1].qty === list[i].qty &&
          list[i - 1].spend < list[i].spend
        ) {
          return false;
        }
      }

      return true;
    });

  console.log(
    "Favorite Category populated:",
    allHaveFavoriteCategory
  );

  console.log(
    "Favorite Item populated:",
    allHaveFavoriteItem
  );

  console.log(
    "Category Diversity valid:",
    diversityValid
  );

  console.log(
    "Purchase Consistency insufficient-data rule:",
    insufficientRuleValid
  );

  console.log(
    "Purchase Consistency eligible-data rule:",
    consistencyRuleValid
  );

  console.log(
    "Top Categories ordering:",
    topCategoryOrderingValid
  );

  console.log(
    "Top Items ordering:",
    topItemOrderingValid
  );

  if (
    !allHaveFavoriteCategory ||
    !allHaveFavoriteItem ||
    !diversityValid ||
    !insufficientRuleValid ||
    !consistencyRuleValid ||
    !topCategoryOrderingValid ||
    !topItemOrderingValid
  ) {
    throw new Error(
      "TEST #25: FAIL"
    );
  }

  console.log("\nTEST #25: PASS\n");
}

main().catch((error) => {
  console.error("\nTEST #25: ERROR\n");
  console.error(error);
  process.exit(1);
});
