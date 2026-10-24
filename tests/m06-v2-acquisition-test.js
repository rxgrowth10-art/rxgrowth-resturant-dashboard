const { request } = require("../lib/ghl");
const { fetchAllPages } = require("../lib/pagination");

// TEST FIXTURE ONLY.
// This is the current STENZ test restaurant.
// It must NOT become business logic inside M06.
const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function uniqueCount(items) {
  return new Set(
    items
      .map((item) => item?._id || item?.id || item?.transactionId)
      .filter(Boolean)
  ).size;
}

async function fetchOrders() {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/payments/orders" +
        `?altId=${encodeURIComponent(LOCATION_ID)}` +
        "&altType=location" +
        `&limit=${limit}` +
        `&offset=${currentCount}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.orders)) {
        return response.orders;
      }

      if (Array.isArray(response?.data)) {
        return response.data;
      }

      return [];
    },

    hasMore: ({ response, items, total }) => {
      const totalCount =
        Number(response?.totalCount) ||
        Number(response?.meta?.total) ||
        null;

      if (totalCount !== null) {
        return total < totalCount;
      }

      return items.length > 0;
    },
  });
}

async function fetchContacts() {
  return fetchAllPages({
    fetchPage: async ({ pageNumber }) => {
      const path =
        "/contacts/" +
        `?locationId=${encodeURIComponent(LOCATION_ID)}` +
        "&limit=100" +
        `&page=${pageNumber}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.contacts)) {
        return response.contacts;
      }

      if (Array.isArray(response?.data)) {
        return response.data;
      }

      return [];
    },

    hasMore: ({ items }) => {
      return items.length === 100;
    },
  });
}

async function fetchProducts() {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/products/" +
        `?locationId=${encodeURIComponent(LOCATION_ID)}` +
        `&limit=${limit}` +
        `&offset=${currentCount}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.products)) {
        return response.products;
      }

      if (Array.isArray(response?.data)) {
        return response.data;
      }

      return [];
    },

    hasMore: ({ response, items, total }) => {
      const totalCount =
        Number(response?.total) ||
        Number(response?.totalCount) ||
        Number(response?.meta?.total) ||
        null;

      if (totalCount !== null) {
        return total < totalCount;
      }

      return items.length > 0;
    },
  });
}

async function fetchTransactions() {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/payments/transactions" +
        `?altId=${encodeURIComponent(LOCATION_ID)}` +
        "&altType=location" +
        `&limit=${limit}` +
        `&offset=${currentCount}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.transactions)) {
        return response.transactions;
      }

      if (Array.isArray(response?.data)) {
        return response.data;
      }

      return [];
    },

    hasMore: ({ response, items, total }) => {
      const totalCount =
        Number(response?.totalCount) ||
        Number(response?.meta?.total) ||
        null;

      if (totalCount !== null) {
        return total < totalCount;
      }

      return items.length > 0;
    },
  });
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("M06 V2 DATA ACQUISITION TEST #15");
  console.log("========================================");
  console.log("");

  const [orders, contacts, products, transactions] =
    await Promise.all([
      fetchOrders(),
      fetchContacts(),
      fetchProducts(),
      fetchTransactions(),
    ]);

  console.log("");
  console.log("========== ACQUISITION RESULTS ==========");
  console.log("");

  console.log(`Orders:       ${orders.length}`);
  console.log(`Contacts:     ${contacts.length}`);
  console.log(`Products:     ${products.length}`);
  console.log(`Transactions: ${transactions.length}`);

  console.log("");
  console.log("========== UNIQUENESS CHECK ==========");
  console.log("");

  console.log(
    `Orders unique:       ${uniqueCount(orders) === orders.length}`
  );

  console.log(
    `Contacts unique:     ${uniqueCount(contacts) === contacts.length}`
  );

  console.log(
    `Products unique:     ${uniqueCount(products) === products.length}`
  );

  console.log(
    `Transactions unique: ${uniqueCount(transactions) === transactions.length}`
  );

  const allPassed =
    orders.length >= 0 &&
    contacts.length >= 0 &&
    products.length >= 0 &&
    transactions.length >= 0 &&
    uniqueCount(orders) === orders.length &&
    uniqueCount(contacts) === contacts.length &&
    uniqueCount(products) === products.length &&
    uniqueCount(transactions) === transactions.length;

  console.log("");
  console.log("========================================");

  if (allPassed) {
    console.log("TEST #15: PASS");
  } else {
    console.log("TEST #15: FAIL");
    process.exitCode = 1;
  }

  console.log("========================================");
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("TEST #15: ERROR");
  console.error(error);
  process.exitCode = 1;
});
