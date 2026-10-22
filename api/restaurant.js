const KOI_ROLL_LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";
const STENZ_LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

// M10 Win-Back Workflow IDs
const KOI_ROLL_M10_WORKFLOW_ID = "125546e4-1837-4594-860c-8bf6fb9a1d1c";
const STENZ_M10_WORKFLOW_ID = "9da63be7-ddb1-4cc5-ba8c-c467eaadebaa";

function getRestaurantLocationId(req) {
  const headerId = req.headers["x-rx-restaurant"];

  if (typeof headerId === "string" && headerId.trim()) {
    return headerId.trim();
  }

  return null;
}

function getRestaurantConnection(req) {
  const locationId = getRestaurantLocationId(req);

  if (!locationId) {
    const error = new Error("Restaurant location ID is required.");
    error.statusCode = 401;
    throw error;
  }

  // Koi Roll
  if (locationId === KOI_ROLL_LOCATION_ID) {
    const apiKey = process.env.GHL_API_KEY;

    if (!apiKey) {
      const error = new Error(
        "GHL_API_KEY environment variable is not configured."
      );
      error.statusCode = 500;
      throw error;
    }

    return {
      restaurantId: "koi-roll",
      restaurantName: "Koi Roll Sushi",
      locationId: KOI_ROLL_LOCATION_ID,
      apiKey,
      m10WorkflowId: KOI_ROLL_M10_WORKFLOW_ID,
    };
  }

  // STENZ Coffee & Bakery Lounge
  if (locationId === STENZ_LOCATION_ID) {
    const apiKey = process.env.GHL_STENZ_API_KEY;

    if (!apiKey) {
      const error = new Error(
        "GHL_STENZ_API_KEY environment variable is not configured."
      );
      error.statusCode = 500;
      throw error;
    }

    return {
      restaurantId: "stenz",
      restaurantName: "STENZ Coffee & Bakery Lounge",
      locationId: STENZ_LOCATION_ID,
      apiKey,
      m10WorkflowId: STENZ_M10_WORKFLOW_ID,
    };
  }

  const error = new Error("Invalid restaurant location.");
  error.statusCode = 403;
  throw error;
}

module.exports = {
  getRestaurantConnection,
};
