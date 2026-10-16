const KOI_ROLL_LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

function getRestaurantAccessKey(req) {
  const headerKey = req.headers["x-rx-restaurant"];

  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }

  return null;
}

function getRestaurantConnection(req) {
  const accessKey = getRestaurantAccessKey(req);

  if (!accessKey) {
    const error = new Error("Restaurant access is required.");
    error.statusCode = 401;
    throw error;
  }

  const koiRollAccessKey = process.env.RXGROWTH_KOI_ROLL_ACCESS_KEY;

  if (!koiRollAccessKey || accessKey !== koiRollAccessKey) {
    const error = new Error("Invalid restaurant access.");
    error.statusCode = 403;
    throw error;
  }

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

module.exports = {
  getRestaurantConnection,
};
