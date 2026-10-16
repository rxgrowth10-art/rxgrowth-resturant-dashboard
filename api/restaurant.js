const KOI_ROLL_LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

function getRestaurantId(req) {
  const headerId = req.headers["x-rx-restaurant"];

  if (typeof headerId === "string" && headerId.trim()) {
    return headerId.trim();
  }

  return null;
}

function getRestaurantConnection(req) {
  const restaurantId = getRestaurantId(req);

  if (!restaurantId) {
    const error = new Error("Restaurant ID is required.");
    error.statusCode = 401;
    throw error;
  }

  if (restaurantId !== "koi-roll") {
    const error = new Error("Unknown restaurant.");
    error.statusCode = 404;
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
