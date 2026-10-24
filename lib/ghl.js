const https = require("https");

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 10000;

function getApiKey() {
  const apiKey = process.env.GHL_API_KEY;

  if (!apiKey) {
    throw new Error("GHL_API_KEY is missing from environment variables.");
  }

  return apiKey;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(headers, retryCount, options = {}) {
  const retryAfter =
    headers?.["retry-after"] ??
    headers?.["Retry-After"];

  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(
        seconds * 1000,
        options.maxRetryDelayMs ??
          DEFAULT_MAX_RETRY_DELAY_MS
      );
    }

    const retryDate =
      Date.parse(String(retryAfter));

    if (!Number.isNaN(retryDate)) {
      return Math.max(
        0,
        Math.min(
          retryDate - Date.now(),
          options.maxRetryDelayMs ??
            DEFAULT_MAX_RETRY_DELAY_MS
        )
      );
    }
  }

  const baseDelay =
    options.retryDelayMs ??
    DEFAULT_RETRY_DELAY_MS;

  const maxDelay =
    options.maxRetryDelayMs ??
    DEFAULT_MAX_RETRY_DELAY_MS;

  return Math.min(
    baseDelay * Math.pow(2, retryCount - 1),
    maxDelay
  );
}

function request(
  path,
  apiKey = getApiKey(),
  options = {}
) {
  const maxRetries =
    options.maxRetries ??
    DEFAULT_MAX_RETRIES;

  return requestWithRetry(
    path,
    apiKey,
    options,
    0,
    maxRetries
  );
}

async function requestWithRetry(
  path,
  apiKey,
  options,
  retryCount,
  maxRetries
) {
  const result = await performRequest(
    path,
    apiKey,
    options
  );

  if (
    result.statusCode !== 429 ||
    retryCount >= maxRetries
  ) {
    if (
      result.statusCode < 200 ||
      result.statusCode >= 300
    ) {
      throw new Error(
        `GHL API error ${result.statusCode}: ${JSON.stringify(
          result.data
        )}`
      );
    }

    return result.data;
  }

  const nextRetry =
    retryCount + 1;

  const delay =
    getRetryDelayMs(
      result.headers,
      nextRetry,
      options
    );

  console.log(
    `GHL 429 retry guard: attempt=${nextRetry}/${maxRetries}, waiting ${delay}ms before retry.`
  );

  await sleep(delay);

  return requestWithRetry(
    path,
    apiKey,
    options,
    nextRetry,
    maxRetries
  );
}

function performRequest(
  path,
  apiKey,
  options
) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      path,
      BASE_URL
    );

    const method =
      options.method || "GET";

    const body =
      options.body === undefined ||
      options.body === null
        ? null
        : JSON.stringify(options.body);

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Version:
        options.version ||
        API_VERSION,
      Accept: "application/json",
    };

    if (body !== null) {
      headers["Content-Type"] =
        "application/json";

      headers["Content-Length"] =
        Buffer.byteLength(body);
    }

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path:
          `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          let data;

          try {
            data = responseBody
              ? JSON.parse(responseBody)
              : {};
          } catch (error) {
            return reject(
              new Error(
                `GHL returned invalid JSON. HTTP ${res.statusCode}: ${responseBody.slice(
                  0,
                  500
                )}`
              )
            );
          }

          resolve({
            statusCode:
              res.statusCode,

            headers:
              res.headers || {},

            data,
          });
        });
      }
    );

    req.on("error", reject);

    if (body !== null) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  request,
};
