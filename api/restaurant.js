const KOI_ROLL_LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";
const STENZ_LOCATION_ID = "V2q4leIVzpDKRiljAOOj";

function getRestaurantAccessId(req) {
  const headerId = req.headers["x-rx-restaurant"];

  if (typeof headerId === "string" && headerId.trim()) {
    return headerId.trim();
  }

  return null;
}

function getRestaurantConnection(req) {
  const accessId = getRestaurantAccessId(req);

  if (!accessId) {
    const error = new Error("Restaurant access ID is required.");
    error.statusCode = 401;
    throw error;
  }

  const koiRollAccessId =
    process.env.RXGROWTH_KOI_ROLL_ACCESS_ID;

  const stenzAccessId =
    process.env.RXGROWTH_STENZ_ACCESS_ID;

  // Koi Roll
  if (
    koiRollAccessId &&
    accessId === koiRollAccessId
  ) {
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
    };
  }

  // STENZ Coffee & Bakery Lounge
  if (
    stenzAccessId &&
    accessId === stenzAccessId
  ) {
    const apiKey =
      process.env.GHL_STENZ_API_KEY;

    if (!apiKey) {
      const error = new Error(
        "GHL_STENZ_API_KEY environment variable is not configured."
      );
      error.statusCode = 500;
      throw error;
    }

    return {
      restaurantId: "stenz",
      restaurantName:
        "STENZ Coffee & Bakery Lounge",
      locationId: STENZ_LOCATION_ID,
      apiKey,
    };
  }

  const error = new Error("Invalid restaurant access.");
  error.statusCode = 403;
  throw error;
}

module.exports = {
  getRestaurantConnection,
};
