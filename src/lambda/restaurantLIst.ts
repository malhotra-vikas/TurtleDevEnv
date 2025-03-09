import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'

AWS.config.update({ region: Constants.AWS_REGION })

// Initialize the S3 client
const s3 = new AWS.S3();

const bucketName = '1010public';
//const fileKey = 'the_cheesecake_factory_allergens_full.json';
const fileKey = 'restaurants_full.json';

// Define a function to categorize restaurant types based on their names
const categorizeRestaurantType = (name: string): string => {
  const fastFoodChains = ["McDonald's", 'Macdonald', 'Burger King', 'Taco Bell', 'Wendy\'s', 'Starbucks', 'Popeyes', 'KFC', 'Panera Bread'];
  return fastFoodChains.includes(name) ? 'Fast food' : 'Dine in';
};

export async function restaurantListHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

  try {
    // Fetch the JSON file from S3
    const restaurantNameResponse = await s3
      .getObject({ Bucket: bucketName, Key: fileKey })
      .promise();

    const data = JSON.parse(restaurantNameResponse.Body?.toString('utf-8') || '{}');

    // Extract and deduplicate restaurant names
    const uniqueRestaurants = new Map(); // Using Map to remove duplicates while preserving order

    data.restaurants?.forEach((restaurant: { restaurant: string }) => {
      if (!uniqueRestaurants.has(restaurant.restaurant)) {
        uniqueRestaurants.set(restaurant.restaurant, {
          name: restaurant.restaurant,
          type: categorizeRestaurantType(restaurant.restaurant)
        });
      }
    });

    const restaurantNamesFromJSON = Array.from(uniqueRestaurants.values());

    console.log("Extracted Restaurants:", restaurantNamesFromJSON);

    // Define known restaurants
    const restaurants = [
      { name: 'The Cheesecake Factory', type: 'Dine in' },
      { name: 'Panera Bread', type: 'Fast food' },
      { name: 'Olive Garden', type: 'Fast food' },
      { name: 'Macdonald', type: 'Fast food' },
      { name: 'Taco Bell', type: 'Fast food' },
      { name: 'Starbucks', type: 'Fast food' },
    ];
    console.log("Extracted OLDER CODE Restaurant Names:", restaurants);

    // Create a response object
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },

      body: JSON.stringify({
        data: restaurantNamesFromJSON,
      }),
    };

    return response;
  } catch (error) {
    console.error("Error occurred:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }

};
