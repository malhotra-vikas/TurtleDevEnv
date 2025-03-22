import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'

AWS.config.update({ region: Constants.AWS_REGION })

export async function allergyListHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

  // Define known allergies
  const allergies = [
    { name: 'Peanuts', type: 'Food', description: 'Common nut allergy causing severe reactions' },
    { name: 'Shellfish', type: 'Food', description: 'Includes shrimp, crab, and lobster allergies' },
    { name: 'Dairy', type: 'Food', description: 'Lactose intolerance or milk protein allergy' },
    { name: 'Eggs', type: 'Food', description: 'Allergy to proteins found in egg whites or yolks' },
    { name: 'Wheat', type: 'Food', description: 'Allergy to proteins found in wheat products' },
    { name: 'Soy', type: 'Food', description: 'Allergy to soybeans or soy-based products' },
    { name: 'Tree Nuts', type: 'Food', description: 'Includes almonds, cashews, walnuts, pecans, etc.' },
    //{ name: 'Fish', type: 'Food', description: 'Allergy to fish like salmon, tuna, cod, etc.' },
    { name: 'Sesame', type: 'Food', description: 'Allergy to sesame seeds or sesame oil' },
    { name: 'Corn', type: 'Food', description: 'Allergy to corn or corn-based products' },
    { name: 'Mustard', type: 'Food', description: 'Allergy to mustard seeds, often found in sauces or dressings' },
    { name: 'Gelatin', type: 'Food', description: 'Allergy to animal-based gelatin used in desserts and supplements' }
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
      data: allergies,
    }),
  };

  return response;
};
