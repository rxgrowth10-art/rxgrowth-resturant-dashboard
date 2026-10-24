const { runM06Engine } = require("../lib/m06-engine");
const { getRestaurantConnection } = require("./restaurant");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const restaurant = getRestaurantConnection(req);

    const result = await runM06Engine({
      locationId: restaurant.locationId,
      apiKey: restaurant.apiKey,
      write: false,
    });

    return res.status(200).json({
      success: true,
      restaurant: {
        id: restaurant.restaurantId,
        name: restaurant.restaurantName,
        locationId: restaurant.locationId,
      },
      mode: "dry-run",
      result,
    });
  } catch (error) {
    const status =
      Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 500;

    return res.status(status).json({
      success: false,
      error: error?.message || "M06 execution failed",
    });
  }
};
