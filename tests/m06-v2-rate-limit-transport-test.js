const https = require("https");

const originalRequest =
  https.request;

const {
  request,
} = require("../lib/ghl");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function makeResponse(
  statusCode,
  headers,
  body
) {
  const listeners = {};

  return {
    statusCode,
    headers,

    on(event, callback) {
      listeners[event] = callback;

      if (event === "data") {
        setImmediate(() => {
          callback(
            JSON.stringify(body)
          );
        });
      }

      if (event === "end") {
        setImmediate(() => {
          callback();
        });
      }

      return this;
    },
  };
}

async function main() {
  console.log("");
  console.log(
    "========== #43 RATE-LIMIT TRANSPORT TEST =========="
  );
  console.log("");

  let attempts = 0;

  https.request = (
    options,
    callback
  ) => {
    attempts += 1;

    const reqListeners = {};

    const req = {
      on(event, handler) {
        reqListeners[event] = handler;
        return this;
      },

      write() {},

      end() {
        if (attempts === 1) {
          callback(
            makeResponse(
              429,
              {
                "retry-after": "0",
              },
              {
                statusCode: 429,
                message:
                  "Too Many Requests",
              }
            )
          );

          return;
        }

        callback(
          makeResponse(
            200,
            {},
            {
              success: true,
              attempts,
            }
          )
        );
      },
    };

    return req;
  };

  try {
    console.log(
      "---------- SIMULATED GHL RESPONSE ----------"
    );

    console.log(
      "Attempt #1 → HTTP 429"
    );

    const result =
      await request(
        "/rate-limit-test",
        "TEST_API_KEY",
        {
          maxRetries: 3,
          retryDelayMs: 1,
          maxRetryDelayMs: 10,
        }
      );

    console.log(
      "Retry succeeded."
    );

    console.log(
      `Total HTTP attempts: ${attempts}`
    );

    console.log(
      `Final response: ${JSON.stringify(result)}`
    );

    assert(
      attempts === 2,
      `Expected 2 HTTP attempts, got ${attempts}`
    );

    assert(
      result?.success === true,
      "Final response did not succeed."
    );

    console.log("");
    console.log(
      "429 detection: PASS"
    );

    console.log(
      "Retry execution: PASS"
    );

    console.log(
      "Successful recovery after 429: PASS"
    );

    console.log(
      "No unhandled 429 propagated: PASS"
    );

    console.log("");
    console.log(
      "TEST #43: PASS — Rate-Limit Transport Resilience"
    );
    console.log("");
  } finally {
    https.request =
      originalRequest;
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "TEST #43: FAIL"
  );
  console.error(
    error?.stack ||
    error?.message ||
    String(error)
  );

  https.request =
    originalRequest;

  process.exit(1);
});
