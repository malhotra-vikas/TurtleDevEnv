import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as Constants from '../utils/constants';
import * as leaseAPI from '../api/leaseAPI';
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { open } from 'fs/promises';

// Initialize AWS DynamoDB DocumentClient
const dynamoDB = new DynamoDBClient({ region: Constants.AWS_REGION });

interface RequestBody {
  userEmail?: string;
  userQuery?: string;
}

export async function parseLeaseHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log("Event Starting");

  // Initialize response with a default error state
  let response: APIGatewayProxyResult = {
    statusCode: 500,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    isBase64Encoded: false,
    body: JSON.stringify({ error: "Internal Server Error" })
  };

  try {
    const bodyData: RequestBody = JSON.parse(event.body || '{}');
    console.log("Parsed Event Body", bodyData);

    const { userEmail, userQuery } = bodyData;

    if (!userEmail || !userQuery) {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "Validation Error - Search Criteria Missing" });
      return response;
    }

    // Call the leaseAPI and update the response accordingly
    const apiResponse = await leaseAPI.handleConversation(userEmail, userQuery);
    const apiResponseJSON = JSON.parse(apiResponse)
    if (apiResponseJSON.statusCode === 200) {
      console.log("Lease Parsed and Stored", JSON.stringify(apiResponseJSON.body));
      response.statusCode = 200;
      response.body = JSON.stringify(apiResponseJSON.body, null, 2);
    } else {
      response.statusCode = apiResponseJSON.statusCode;
      response.body = JSON.stringify(apiResponseJSON.body);
    }
  } catch (error) {
    console.error("Error processing request:", error);
    // Maintain error state set during initialization
  }

  console.log("Response from create Lambda", JSON.stringify(response));
  return response;
}
