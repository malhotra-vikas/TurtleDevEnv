import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'

AWS.config.update({ region: Constants.AWS_REGION })

export async function restaurantListHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Define known restaurants
  const restaurants = [
    { name: 'The Cheesecake Factory', type: 'Dine in' },
    { name: 'Chipotle', type: 'Fast food' },
    { name: 'Macddonald', type: 'Fast food' },
  ];

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
      data: restaurants,
    }),
  };

  return response;
};
