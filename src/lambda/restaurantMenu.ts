import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as fs from 'fs';
import * as path from 'path';

AWS.config.update({ region: Constants.AWS_REGION })

// Initialize the S3 client
const s3 = new AWS.S3();

const bucketName = '1010public';
const fileKey = 'the_cheesecake_factory_allergens_full.json';

export async function restaurantMenuHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log("Lambda Event is ", JSON.stringify(event));

    
    try {
        // Fetch the JSON file from S3
        const response = await s3
            .getObject({ Bucket: bucketName, Key: fileKey })
            .promise();

        const data = JSON.parse(response.Body?.toString('utf-8') || '{}');
        console.log("Data in JSON is ", JSON.stringify(data));

        // Create a response object
        const lambdaResponse = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },

            body: JSON.stringify(data)
        };

        return lambdaResponse;


    } catch (error) {
        console.error("Error occurred:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: (error as Error).message }),
        };
    }
};
