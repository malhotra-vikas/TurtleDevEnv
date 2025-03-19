import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const fileUrl = "https://1010publicfolder.s3.us-east-2.amazonaws.com/restaurants_full.json";

// Define a function to categorize restaurant types based on their names
const categorizeRestaurantType = (name: string): string => {
  const fastFoodChains = [
    "McDonald's", 'Macdonald', 'Burger King', 'Taco Bell', 
    "Wendy's", 'Starbucks', 'Popeyes', 'KFC', 'Panera Bread'
  ];
  return fastFoodChains.includes(name) ? 'Fast food' : 'Dine in';
};

export async function restaurantListHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Fetch the JSON file directly from the public S3 URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract and deduplicate restaurant names
    const uniqueRestaurants = new Map(); // Using Map to remove duplicates while preserving order

    data.restaurants?.forEach((restaurant: { restaurant: string }) => {
      if (!uniqueRestaurants.has(restaurant.restaurant)) {
        uniqueRestaurants.set(restaurant.restaurant, {
          name: restaurant.restaurant,
          type: categorizeRestaurantType(restaurant.restaurant),
        });
      }
    });

    const restaurantNamesFromJSON = Array.from(uniqueRestaurants.values());

    console.log("✅ Extracted Restaurants:", restaurantNamesFromJSON);

    // Create a response object
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({ data: restaurantNamesFromJSON }),
    };
  } catch (error) {
    console.error("❌ Error occurred:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
