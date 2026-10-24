const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID =
  process.env.GHL_LOCATION_ID ||
  "V2q4leIVzpDKRiljAOOj";

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

function getOrderDate(order) {
  const candidates = [
    order?.createdAt,
    order?.dateAdded,
    order?.createdDate,
    order?.updatedAt,
  ];

  for (const value of candidates) {
    const time = new Date(value).getTime();

    if (Number.isFinite(time)) {
      return time;
    }
  }

  return null;
}

function getSource(order) {
  const source = order?.source;

  if (typeof source === "string" && source.trim()) {
    return source.trim();
  }

  if (source && typeof source === "object") {
    return (
      source.name ||
      source.type ||
      source.subType ||
      source.id ||
      null
    );
  }

  return (
    order?.orderSource ||
    order?.sourceName ||
    order?.sourceType ||
    null
  );
}

function getOrderType(order) {
  const candidates = [
    order?.delivery?.method,
    order?.deliveryMethod,
    order?.orderType,
    order?.type,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getLocation(order) {
  const delivery = order?.delivery;

  if (delivery && typeof delivery === "object") {
    const candidates = [
      delivery.location,
      delivery.locationName,
      delivery.store,
      delivery.storeName,
      delivery.branch,
      delivery.branchName,
    ];

    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === "object") {
        const name =
          value.name ||
          value.title ||
          value.locationName ||
          value.storeName ||
          value.branchName ||
          null;

        if (
          typeof name === "string" &&
          name.trim()
        ) {
          return name.trim();
        }
      }
    }
  }

  const candidates = [
    order?.location,
    order?.locationName,
    order?.store,
    order?.storeName,
    order?.branch,
    order?.branchName,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === "object") {
      const name =
        value.name ||
        value.title ||
        value.locationName ||
        value.storeName ||
        value.branchName ||
        null;

      if (
        typeof name === "string" &&
        name.trim()
      ) {
        return name.trim();
      }
    }
  }

  return null;
}

function getCoupon(order) {
  const candidates = [
    order?.couponCode,
    order?.coupon,
    order?.discount?.couponCode,
    order?.discount?.code,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === "object") {
      const code =
        value.code ||
        value.couponCode ||
        value.name ||
        null;

      if (
        typeof code === "string" &&
        code.trim()
      ) {
        return code.trim();
      }
    }
  }

  return null;
}

function incrementStat(map, key, order) {
  if (!key) return;

  const current =
    map.get(key) ||
    {
      key,
      qty: 0,
      spend: 0,
      lastOrderTime: 0,
    };

  current.qty += 1;
  current.spend += Number(order.amount) || 0;

  const orderTime = getOrderDate(order);

  if (Number.isFinite(orderTime)) {
    current.lastOrderTime =
      Math.max(
        current.lastOrderTime,
        orderTime
      );
  }

  map.set(key, current);
}

function selectPrimary(map) {
  const values =
    [...map.values()].sort((a, b) => {
      if (b.qty !== a.qty) {
        return b.qty - a.qty;
      }

      if (b.spend !== a.spend) {
        return b.spend - a.spend;
      }

      return (
        b.lastOrderTime -
        a.lastOrderTime
      );
    });

  return values[0]?.key || null;
}

function buildMix(map) {
  return [...map.values()]
    .sort((a, b) => {
      if (b.qty !== a.qty) {
        return b.qty - a.qty;
      }

      if (b.spend !== a.spend) {
        return b.spend - a.spend;
      }

      return (
        b.lastOrderTime -
        a.lastOrderTime
      );
    })
    .map((item) => ({
      value: item.key,
      orders: item.qty,
      spend: Number(
        item.spend.toFixed(2)
      ),
    }));
}

function buildCustomerIntelligence(
  orders
) {
  const customers = new Map();

  for (const order of orders) {
    const contactId = order.contactId;

    if (!contactId) continue;

    const orderTime =
      getOrderDate(order);

    const customer =
      customers.get(contactId) ||
      {
        contactId,
        orders: 0,
        sources: new Map(),
        orderTypes: new Map(),
        locations: new Map(),
        lastOrder: null,
        lastOrderTime: -Infinity,
      };

    customer.orders += 1;

    const source = getSource(order);
    const orderType = getOrderType(order);
    const location = getLocation(order);

    incrementStat(
      customer.sources,
      source,
      order
    );

    incrementStat(
      customer.orderTypes,
      orderType,
      order
    );

    incrementStat(
      customer.locations,
      location,
      order
    );

    if (
      Number.isFinite(orderTime) &&
      orderTime > customer.lastOrderTime
    ) {
      customer.lastOrderTime = orderTime;
      customer.lastOrder = order;
    }

    customers.set(
      contactId,
      customer
    );
  }

  return [...customers.values()]
    .map((customer) => {
      const lastOrder =
        customer.lastOrder;

      return {
        contactId:
          customer.contactId,

        totalOrders:
          customer.orders,

        orderSourceMix:
          buildMix(customer.sources),

        primaryOrderSource:
          selectPrimary(customer.sources),

        preferredOrderType:
          selectPrimary(
            customer.orderTypes
          ),

        preferredLocation:
          selectPrimary(
            customer.locations
          ),

        lastOrderType:
          lastOrder
            ? getOrderType(lastOrder)
            : null,

        lastOrderLocation:
          lastOrder
            ? getLocation(lastOrder)
            : null,

        lastCouponCode:
          lastOrder
            ? getCoupon(lastOrder)
            : null,
      };
    });
}

async function main() {
  console.log(
    "\n========== #26 CHANNEL / LOCATION INTELLIGENCE ==========\n"
  );

  const orders =
    await fetchOrders(LOCATION_ID);

  const qualifyingOrders =
    orders.filter(isQualifyingOrder);

  console.log(
    `Orders acquired: ${orders.length}`
  );

  console.log(
    `Qualifying orders: ${qualifyingOrders.length}`
  );

  console.log(
    "\n========== RAW FIELD DISCOVERY ==========\n"
  );

  const sample =
    qualifyingOrders[0];

  if (sample) {
    console.log(
      "Sample source:",
      JSON.stringify(
        sample?.source,
        null,
        2
      )
    );

    console.log(
      "Sample delivery:",
      JSON.stringify(
        sample?.delivery,
        null,
        2
      )
    );

    console.log(
      "Sample coupon fields:",
      {
        couponCode:
          sample?.couponCode,
        coupon:
          sample?.coupon,
        discount:
          sample?.discount,
      }
    );
  }

  const sourceValues =
    new Set();

  const orderTypeValues =
    new Set();

  const locationValues =
    new Set();

  const couponValues =
    new Set();

  for (const order of qualifyingOrders) {
    const source =
      getSource(order);

    const orderType =
      getOrderType(order);

    const location =
      getLocation(order);

    const coupon =
      getCoupon(order);

    if (source) {
      sourceValues.add(source);
    }

    if (orderType) {
      orderTypeValues.add(orderType);
    }

    if (location) {
      locationValues.add(location);
    }

    if (coupon) {
      couponValues.add(coupon);
    }
  }

  console.log(
    "\nSource values:",
    [...sourceValues]
  );

  console.log(
    "Order type values:",
    [...orderTypeValues]
  );

  console.log(
    "Location values:",
    [...locationValues]
  );

  console.log(
    "Coupon values:",
    [...couponValues]
  );

  const intelligence =
    buildCustomerIntelligence(
      qualifyingOrders
    );

  console.log(
    "\n========== CUSTOMER CHANNEL / LOCATION INTELLIGENCE ==========\n"
  );

  for (const customer of intelligence) {
    console.log(
      JSON.stringify(
        customer,
        null,
        2
      )
    );
  }

  console.log(
    "\n========== ASSERTIONS ==========\n"
  );

  const uniqueCustomers =
    intelligence.length;

  const customersWithSource =
    intelligence.filter(
      (x) =>
        typeof x.primaryOrderSource ===
        "string"
    ).length;

  const customersWithOrderType =
    intelligence.filter(
      (x) =>
        typeof x.preferredOrderType ===
        "string"
    ).length;

  const customersWithLocation =
    intelligence.filter(
      (x) =>
        typeof x.preferredLocation ===
        "string"
    ).length;

  const customersWithLastType =
    intelligence.filter(
      (x) =>
        typeof x.lastOrderType ===
        "string"
    ).length;

  const customersWithLastLocation =
    intelligence.filter(
      (x) =>
        typeof x.lastOrderLocation ===
        "string"
    ).length;

  const mixOrderingValid =
    intelligence.every(
      (customer) => {
        const list =
          customer.orderSourceMix;

        for (
          let i = 1;
          i < list.length;
          i++
        ) {
          if (
            list[i - 1].orders <
            list[i].orders
          ) {
            return false;
          }

          if (
            list[i - 1].orders ===
              list[i].orders &&
            list[i - 1].spend <
              list[i].spend
          ) {
            return false;
          }
        }

        return true;
      }
    );

  const lastOrderRuleValid =
    intelligence.every(
      (customer) => {
        if (!customer.totalOrders) {
          return false;
        }

        return (
          customer.lastOrderType ===
            getOrderType(
              qualifyingOrders.find(
                (order) =>
                  order.contactId ===
                  customer.contactId &&
                  getOrderDate(order) ===
                    customer.lastOrderTime
              )
            )
        );
      }
    );

  console.log(
    `Unique customers: ${uniqueCustomers}`
  );

  console.log(
    `Customers with primary source: ${customersWithSource}`
  );

  console.log(
    `Customers with preferred order type: ${customersWithOrderType}`
  );

  console.log(
    `Customers with preferred location: ${customersWithLocation}`
  );

  console.log(
    `Customers with last order type: ${customersWithLastType}`
  );

  console.log(
    `Customers with last order location: ${customersWithLastLocation}`
  );

  console.log(
    "Order Source Mix ordering:",
    mixOrderingValid
  );

  console.log(
    "Last-order consistency:",
    lastOrderRuleValid
  );

  if (
    uniqueCustomers === 0 ||
    !mixOrderingValid ||
    !lastOrderRuleValid
  ) {
    throw new Error(
      "TEST #26: FAIL"
    );
  }

  console.log(
    "\nTEST #26: PASS\n"
  );
}

main().catch((error) => {
  console.error(
    "\nTEST #26: ERROR\n"
  );

  console.error(error);

  process.exit(1);
});
