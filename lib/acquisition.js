const { request } = require("./ghl");
const { fetchAllPages } = require("./pagination");

async function fetchOrders(locationId) {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/payments/orders" +
        `?altId=${encodeURIComponent(locationId)}` +
        "&altType=location" +
        `&limit=${limit}` +
        `&offset=${currentCount}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.data)) {
        return response.data;
      }

      if (Array.isArray(response?.orders)) {
        return response.orders;
      }

      return [];
    },

    hasMore: ({ response, items, total }) => {
      const totalCount =
        Number(response?.totalCount) ||
        Number(response?.total) ||
        Number(response?.meta?.total) ||
        null;

      if (totalCount !== null) {
        return total < totalCount;
      }

      return items.length > 0;
    },
  });
}

async function fetchContacts(locationId) {
  return fetchAllPages({
    fetchPage: async ({ pageNumber }) => {
      const path =
        "/contacts/" +
        `?locationId=${encodeURIComponent(locationId)}` +
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

    hasMore: ({ response, items }) => {
      if (response?.meta?.nextPageUrl) {
        return true;
      }

      return items.length === 100;
    },
  });
}

async function fetchProducts(locationId) {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/products/" +
        `?locationId=${encodeURIComponent(locationId)}` +
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

async function fetchTransactions(locationId) {
  return fetchAllPages({
    fetchPage: async ({ currentCount }) => {
      const limit = 100;

      const path =
        "/payments/transactions" +
        `?altId=${encodeURIComponent(locationId)}` +
        "&altType=location" +
        `&limit=${limit}` +
        `&offset=${currentCount}`;

      return request(path);
    },

    getItems: (response) => {
      if (Array.isArray(response?.data)) {
        return response.data;
      }

      if (Array.isArray(response?.transactions)) {
        return response.transactions;
      }

      return [];
    },

    hasMore: ({ response, items, total }) => {
      const totalCount =
        Number(response?.totalCount) ||
        Number(response?.total) ||
        Number(response?.meta?.total) ||
        null;

      if (totalCount !== null) {
        return total < totalCount;
      }

      return items.length > 0;
    },
  });
}

module.exports = {
  fetchOrders,
  fetchContacts,
  fetchProducts,
  fetchTransactions,
};
