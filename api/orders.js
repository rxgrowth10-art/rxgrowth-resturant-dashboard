const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

const MAX_PAGES = 100;
const UPSTREAM_PAGE_SIZE = 100;

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getOrderId(order) {
  return String(order._id || order.id || "");
}

function getCustomerName(order) {
  const contact = order.contactSnapshot || {};
  const firstName =
    order.contact?.firstName ||
    contact.firstName ||
    "";

  const lastName =
    order.contact?.lastName ||
    contact.lastName ||
    "";

  const combined = `${firstName} ${lastName}`.trim();

  return (
    order.contactName ||
    order.customerName ||
    combined ||
    order.contact?.name ||
    contact.name ||
    "Unknown Customer"
  );
}

function getPaymentMethod(order) {
  const method = order.paymentMethod;

  if (typeof method === "string") {
    return method;
  }

  return (
    method?.name ||
    method?.type ||
    order.paymentMethodName ||
    "Unknown"
  );
}

function getOrderAmount(order) {
  const amount = Number(order.amount);

  return Number.isFinite(amount) ? amount : 0;
}

function getPaymentStatus(order) {
  return normalizeText(order.paymentStatus || "unknown");
}

function getFulfillmentStatus(order) {
  return normalizeText(order.fulfillmentStatus || "unknown");
}

function getOrderDate(order) {
  return order.createdAt || order.created_at || null;
}

function getOrderItems(order) {
  if (!Array.isArray(order.items)) {
    return [];
  }

  return order.items.map((item) => ({
    name:
      item.name ||
      item.productName ||
      item.product?.name ||
      "Unnamed Item",

    quantity: Number(item.qty ?? item.quantity ?? 1),

    price: Number(
      item.price ??
      item.amount ??
      item.product?.price ??
      0
    ),

    productId:
      item.productId ||
      item.product?.id ||
      null,
  }));
}

function normalizeOrder(order) {
  return {
    id: getOrderId(order),

    contactId:
      order.contactId ||
      order.contact?.id ||
      null,

    customerName: getCustomerName(order),

    email:
      order.contactSnapshot?.email ||
      order.contact?.email ||
      order.email ||
      "",

    phone:
      order.contactSnapshot?.phone ||
      order.contact?.phone ||
      order.phone ||
      "",

    amount: getOrderAmount(order),

    currency: order.currency || "EGP",

    paymentStatus: order.paymentStatus || "unknown",

    paymentMethod: getPaymentMethod(order),

    fulfillmentStatus:
      order.fulfillmentStatus || "unknown",

    orderStatus: order.status || "unknown",

    createdAt: getOrderDate(order),

    items: getOrderItems(order),

    source:
      order.sourceName ||
      order.source?.name ||
      "Unknown",

    liveMode: order.liveMode ?? null,

    markAsTest: order.markAsTest ?? null,

    raw: order,
  };
}

async function ghlRequest(path, params = {}) {
  const apiKey = process.env.GHL_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GHL_API_KEY environment variable."
    );
  }

  const url = new URL(`${GHL_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: "HighLevel returned a non-JSON response.",
    };
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
      data.error ||
      `HighLevel API returned ${response.status}.`
    );

    error.statusCode = response.status;

    // Do not expose the API key in errors or logs.
    throw error;
  }

  return data;
}

function extractOrders(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.orders)) {
    return response.orders;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data?.orders)) {
    return response.data.orders;
  }

  return [];
}

async function fetchAllOrders(filters) {
  const allOrders = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = {
      locationId: LOCATION_ID,

      altId: LOCATION_ID,

      altType: "location",

      limit: UPSTREAM_PAGE_SIZE,

      offset: page * UPSTREAM_PAGE_SIZE,
    };

    // Native API filters already tested in this project.
    if (filters.startDate) {
      params.startAt = filters.startDate;
    }

    if (filters.endDate) {
      params.endAt = filters.endDate;
    }

    if (filters.paymentStatus) {
      params.paymentStatus = filters.paymentStatus;
    }

    if (filters.search) {
      params.search = filters.search;
    }

    const response = await ghlRequest(
      "/payments/orders",
      params
    );

    const orders = extractOrders(response);

    allOrders.push(...orders);

    const totalCount = Number(
      response.totalCount ??
      response.meta?.total ??
      response.data?.totalCount
    );

    if (Number.isFinite(totalCount)) {
      if (allOrders.length >= totalCount) {
        break;
      }
    } else if (orders.length < UPSTREAM_PAGE_SIZE) {
      break;
    }

    if (orders.length === 0) {
      break;
    }
  }

  return allOrders;
}

function matchesSearch(order, search) {
  if (!search) {
    return true;
  }

  const query = normalizeText(search);

  const searchableValues = [
    order.id,
    order.customerName,
    order.email,
    order.phone,
    order.contactId,
  ];

  return searchableValues.some((value) =>
    normalizeText(value).includes(query)
  );
}

function matchesDateRange(order, startDate, endDate) {
  if (!startDate && !endDate) {
    return true;
  }

  const rawDate = order.createdAt;

  if (!rawDate) {
    return false;
  }

  const timestamp = new Date(rawDate).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (startDate) {
    const start = new Date(startDate).getTime();

    if (
      Number.isFinite(start) &&
      timestamp < start
    ) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(endDate).getTime();

    if (
      Number.isFinite(end) &&
      timestamp > end
    ) {
      return false;
    }
  }

  return true;
}

function filterOrders(orders, filters) {
  return orders.filter((order) => {
    if (!matchesSearch(order, filters.search)) {
      return false;
    }

    if (
      !matchesDateRange(
        order,
        filters.startDate,
        filters.endDate
      )
    ) {
      return false;
    }

    if (
      filters.paymentStatus &&
      getPaymentStatus(order) !==
        normalizeText(filters.paymentStatus)
    ) {
      return false;
    }

    if (
      filters.fulfillmentStatus &&
      getFulfillmentStatus(order) !==
        normalizeText(filters.fulfillmentStatus)
    ) {
      return false;
    }

    if (
      filters.paymentMethod &&
      !normalizeText(getPaymentMethod(order)).includes(
        normalizeText(filters.paymentMethod)
      )
    ) {
      return false;
    }

    return true;
  });
}

function calculateSummary(orders) {
  const totalOrders = orders.length;

  const totalOrderValue = orders.reduce(
    (sum, order) => sum + order.amount,
    0
  );

  const paidOrders = orders.filter(
    (order) => getPaymentStatus(order) === "paid"
  );

  const unpaidOrders = orders.filter(
    (order) => getPaymentStatus(order) === "unpaid"
  );

  const paidAmount = paidOrders.reduce(
    (sum, order) => sum + order.amount,
    0
  );

  const unpaidAmount = unpaidOrders.reduce(
    (sum, order) => sum + order.amount,
    0
  );

  return {
    totalOrders,

    totalOrderValue,

    paidOrders: paidOrders.length,

    paidAmount,

    unpaidOrders: unpaidOrders.length,

    unpaidAmount,

    currency: "EGP",
  };
}

function sortOrders(orders, sortBy, sortDir) {
  const direction = sortDir === "asc" ? 1 : -1;

  const allowedFields = [
    "createdAt",
    "amount",
    "customerName",
    "paymentStatus",
    "fulfillmentStatus",
  ];

  const field = allowedFields.includes(sortBy)
    ? sortBy
    : "createdAt";

  return [...orders].sort((a, b) => {
    let first = a[field];
    let second = b[field];

    if (field === "createdAt") {
      first = first ? new Date(first).getTime() : 0;
      second = second ? new Date(second).getTime() : 0;
    }

    if (field === "amount") {
      first = Number(first) || 0;
      second = Number(second) || 0;
    }

    if (typeof first === "string") {
      first = first.toLowerCase();
      second = String(second ?? "").toLowerCase();
    }

    if (first < second) return -1 * direction;
    if (first > second) return 1 * direction;

    return 0;
  });
}

async function getOrderDetails(orderId) {
  if (!orderId) {
    const error = new Error("Order ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const response = await ghlRequest(
    `/payments/orders/${encodeURIComponent(orderId)}`,
    {
      locationId: LOCATION_ID,
      altId: LOCATION_ID,
      altType: "location",
    }
  );

  const order =
    response.order ||
    response.data?.order ||
    response.data ||
    response;

  return normalizeOrder(order);
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return sendJson(res, 405, {
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const query = req.query || {};

    // Request one order's details.
    if (query.id) {
      const order = await getOrderDetails(query.id);

      return sendJson(res, 200, {
        success: true,
        order,
      });
    }

    const page = Math.max(
      1,
      parseInt(query.page, 10) || 1
    );

    const allowedPageSizes = [10, 25, 50];

    const requestedPageSize = parseInt(
      query.pageSize,
      10
    ) || 10;

    const pageSize = allowedPageSizes.includes(
      requestedPageSize
    )
      ? requestedPageSize
      : 10;

    const filters = {
      search: String(query.search || "").trim(),

      startDate: query.startDate
        ? String(query.startDate)
        : "",

      endDate: query.endDate
        ? String(query.endDate)
        : "",

      paymentStatus: String(
        query.paymentStatus || ""
      ).trim(),

      fulfillmentStatus: String(
        query.fulfillmentStatus || ""
      ).trim(),

      paymentMethod: String(
        query.paymentMethod || ""
      ).trim(),
    };

    const rawOrders = await fetchAllOrders(filters);

    const normalizedOrders = rawOrders.map(
      normalizeOrder
    );

    const filteredOrders = filterOrders(
      normalizedOrders,
      filters
    );

    const sortBy = String(
      query.sortBy || "createdAt"
    );

    const sortDir = String(
      query.sortDir || "desc"
    );

    const sortedOrders = sortOrders(
      filteredOrders,
      sortBy,
      sortDir
    );

    const totalCount = sortedOrders.length;

    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / pageSize)
    );

    const startIndex = (page - 1) * pageSize;

    const paginatedOrders = sortedOrders.slice(
      startIndex,
      startIndex + pageSize
    );

    const summary = calculateSummary(
      filteredOrders
    );

    return sendJson(res, 200, {
      success: true,

      data: {
        orders: paginatedOrders,

        totalCount,

        page,

        pageSize,

        totalPages,

        summary,

        filters,
      },
    });
  } catch (error) {
    console.error("Orders API error:", {
      message: error.message,
      statusCode: error.statusCode || 500,
    });

    return sendJson(
      res,
      error.statusCode || 500,
      {
        success: false,

        message:
          error.statusCode === 400
            ? error.message
            : "Unable to load orders from HighLevel.",

        ...(process.env.NODE_ENV !== "production"
          ? { details: error.message }
          : {}),
      }
    );
  }
};
