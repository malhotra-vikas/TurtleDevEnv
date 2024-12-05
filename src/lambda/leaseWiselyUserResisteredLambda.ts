import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as Constants from '../utils/constants';

const snsClient = new SNSClient({ region: Constants.AWS_REGION });

interface RequestBody {
    email: string;
    uuid: string;
}

export async function userRegisteredHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log("Event Starting");

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

        const { email, uuid } = bodyData;

        if (!email || !uuid) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "Validation Error - email is missing" });
            return response;
        }

        const message = JSON.stringify({
            uuid,
            email
        });

        const topicArn = process.env.LEASE_WISELY_SNS_TOPIC_ARN;
        if (!topicArn) {
            throw new Error("SNS topic ARN is not configured.");
        }

        const params = {
            Message: message,
            TopicArn: topicArn,
        };

        const data = await snsClient.send(new PublishCommand(params));
        console.log(`Message sent to SNS topic ${topicArn}. MessageID: ${data.MessageId}. Message Params are ${params}`);

        response.statusCode = 200;
        response.body = JSON.stringify({ uuid });

    } catch (error) {
        console.error("Error processing request:", error);
        response.statusCode = 500;
        response.body = JSON.stringify({ error: "Error processing request", details: error || error });
    }

    console.log("Response from Lambda", JSON.stringify(response));
    return response;
}
