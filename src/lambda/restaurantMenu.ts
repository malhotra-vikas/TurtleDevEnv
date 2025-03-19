import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import fetch from "node-fetch";

const fileUrl = "https://1010publicfolder.s3.us-east-2.amazonaws.com/restaurants_full.json";

export async function restaurantMenuHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log("Lambda Event is ", JSON.stringify(event));

    try {
        // Fetch the JSON file directly from the public S3 URL
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Data in JSON is ", JSON.stringify(data));

        // Create a response object
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("❌ Error occurred:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: (error as Error).message }),
        };
    }
};
