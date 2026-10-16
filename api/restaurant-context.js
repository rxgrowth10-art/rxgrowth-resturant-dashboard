const { getRestaurantConnection } = require("./_restaurant");

module.exports = async function handler(req, res) {
  try {
    const restaurant = getRestaurantConnection(req);

    return res.status(200).json({
      success: true,
      restaurant: {
        id: restaurant.restaurantId,
        name: restaurant.restaurantName,
        locationId: restaurant.locationId,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      error: error.message || "Restaurant context error.",
    });
  }
};
