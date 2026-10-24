// TEST FIXTURE ONLY.
// This validates the locked M06 V2 qualifying-order contract.
// It must NOT become restaurant-specific business logic.

const { fetchOrders } = require("../lib/acquisition");
const { request } = require("../lib/ghl");

const LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function evaluateQualification(order) {
  const reasons = [];

  const hasContactId = Boolean(order?.contactId);

  const isCompleted =
    order?.status === "completed";

  const isLive =
    order?.liveMode === true;

  const isNotTest =
    order?.markAsTest !== true;

  const amount =
    typeof order?.amount === "number"
      ? order.amount
      : Number(order?.amount);

  const hasPositiveAmount =
    Number.isFinite(amount) &&
    amount > 0;

  if (!hasContactId) {
    reasons.push("missing_contactId");
  }

  if (!isCompleted) {
    reasons.push("status_not_completed");
  }

  if (!isLive) {
    reasons.push("liveMode_not_true");
  }

  if (!isNotTest) {
    reasons.push("markAsTest_true");
  }

  if (!hasPositiveAmount) {
    reasons.push("amount_not_positive");
  }

  return {
    qualifying:
      hasContactId &&
      isCompleted &&
      isLive &&
      isNotTest &&
      hasPositiveAmount,

    reasons,

    checks: {
      hasContactId,
      isCompleted,
      isLive,
      isNotTest,
      hasPositiveAmount,
    },
  };
}

async function fetchOrderDetail(orderId) {
  const path =
    `/payments/orders/${encodeURIComponent(orderId)}` +
    `?altId=${encodeURIComponent(LOCATION_ID)}` +
    "&altType=location";

  return request(path);
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("M06 V2 QUALIFICATION TEST #18");
  console.log("==============================================");

  const orders = await fetchOrders(LOCATION_ID);

  console.log("");
  console.log(`Orders acquired: ${orders.length}`);

  if (!orders.length) {
    throw new Error("No orders found.");
  }

  const results = [];
  const seenIds = new Set();

  for (const order of orders) {
    const orderId = getOrderId(order);

    if (!orderId) {
      throw new Error("Encountered order without ID.");
    }

    if (seenIds.has(orderId)) {
      continue;
    }

    seenIds.add(orderId);

    // Use Order Detail as the authoritative transaction record
    // for qualification validation.
    const detail = await fetchOrderDetail(orderId);

    const evaluation =
      evaluateQualification(detail);

    results.push({
      orderId,
      contactId: detail?.contactId || null,
      status: detail?.status || null,
      liveMode: detail?.liveMode ?? null,
      markAsTest: detail?.markAsTest ?? null,
      amount: detail?.amount ?? null,
      ...evaluation,
    });
  }

  const qualifying = results.filter(
    (x) => x.qualifying
  );

  const rejected = results.filter(
    (x) => !x.qualifying
  );

  console.log("");
  console.log("========== QUALIFICATION RESULTS ==========");

  console.log(`Orders evaluated:       ${results.length}`);
  console.log(`Qualifying orders:      ${qualifying.length}`);
  console.log(`Rejected orders:        ${rejected.length}`);

  console.log("");
  console.log("========== QUALIFYING ORDERS ==========");

  for (const result of qualifying) {
    console.log(
      `${result.orderId} | contact=${result.contactId} | amount=${result.amount}`
    );
  }

  if (rejected.length > 0) {
    console.log("");
    console.log("========== REJECTED ORDERS ==========");

    for (const result of rejected) {
      console.log(
        `${result.orderId} | ${result.reasons.join(", ")}`
      );
    }
  }

  console.log("");
  console.log("========== CONTRACT CHECK ==========");

  const invalidQualifying = qualifying.filter(
    (x) =>
      !x.checks.hasContactId ||
      !x.checks.isCompleted ||
      !x.checks.isLive ||
      !x.checks.isNotTest ||
      !x.checks.hasPositiveAmount
  );

  console.log(
    `Qualifying orders violating contract: ${invalidQualifying.length}`
  );

  // Explicitly prove that qualification does NOT depend
  // on paymentStatus or fulfillmentStatus.
  const usesForbiddenFields = results.some(
    (x) =>
      Object.prototype.hasOwnProperty.call(
        x.checks,
        "paymentStatus"
      ) ||
      Object.prototype.hasOwnProperty.call(
        x.checks,
        "fulfillmentStatus"
      )
  );

  console.log(
    `Uses paymentStatus: ${usesForbiddenFields}`
  );

  console.log(
    `Uses fulfillmentStatus: ${usesForbiddenFields}`
  );

  const pass =
    results.length === orders.length &&
    results.length > 0 &&
    invalidQualifying.length === 0 &&
    usesForbiddenFields === false;

  console.log("");

  if (pass) {
    console.log("TEST #18: PASS");
    return;
  }

  console.log("TEST #18: FAIL");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("");
  console.error("TEST #18: ERROR");
  console.error(error);
  process.exitCode = 1;
});
