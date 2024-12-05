import { SNSHandler, SNSEvent, Context, Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import * as Constants from '../utils/constants';

const snsClient = new SNSClient({ region: Constants.AWS_REGION });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

interface SNSMessage {
    uuid: string;
    email: string;
}

export const buildTextHandler: SNSHandler = async (event: SNSEvent, context: Context, callback: Callback): Promise<void> => {
    console.log("SNS Event Received: ", JSON.stringify(event));

    const newLeasesTable = process.env.LEASEWISELY_NEWLEASE_DYNAMODB_TABLE_NAME;
    const userLeasesTable = process.env.LEASEWISELY_USERLEASE_DYNAMODB_TABLE_NAME;

    if (!newLeasesTable || !userLeasesTable) {
        console.error("Environment variables for DynamoDB table names are not set.");
        return;
    }

    try {
        for (const record of event.Records) {
            const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
            const { uuid, email } = snsMessage;

            console.log(`Processed SNS Message - UUID: ${uuid}, Email: ${email}`);
/*
            // Retrieve S3 file path from DynamoDB
            const ddbResponse = await dynamoDb.get({
                TableName: newLeasesTable,
                Key: { uuid }
            }).promise();

            const s3FilePath = ddbResponse.Item?.s3FilePath;
            if (!s3FilePath) {
                throw new Error(`No S3 file path found for UUID: ${uuid}`);
            }
            console.log("s3FilePath is", s3FilePath);

            const s3Bucket = s3FilePath.split('/')[2];
            const s3Key = s3FilePath.split('/').slice(3).join('/');

            console.log("s3Bucket:", s3Bucket);
            console.log("s3Key:", s3Key);

            // Read the PDF file from S3
            const s3Params = {
                Bucket: s3Bucket,
                Key: s3Key
            };
            const s3Object = await s3.getObject(s3Params).promise();
            console.log("s3Object is", s3Object);
            console.log("S3 Object ContentType:", s3Object.ContentType);

            const documentBytes = s3Object.Body as Buffer;
            console.log("Document bytes length:", documentBytes.length);

            // Validate the PDF format
            if (!isValidPDFFormat(documentBytes)) {
                throw new Error('Unsupported document format or corrupted file.');
            }
*/
            try {

                // Insert extracted text into another DynamoDB table
                await dynamoDb.put({
                    TableName: userLeasesTable,
                    Item: {
                        email,
                        UUID: uuid
                    }
                }).promise();

                console.log(`Inserted data into destination table for UUID: ${uuid}, Email: ${email}`);

                const message = JSON.stringify({
                    uuid,
                    email
                });
        
                const topicArn = process.env.LEASE_WISELY_PARSE_PDF_SNS_TOPIC_ARN;
                if (!topicArn) {
                    throw new Error("SNS topic ARN is not configured.");
                }
        
                const params = {
                    Message: message,
                    TopicArn: topicArn,
                };
        
                const data = await snsClient.send(new PublishCommand(params));
                console.log(`Message sent to SNS topic ${topicArn}. MessageID: ${data.MessageId}. Message Params are ${params}`);
        
            } catch (textractError) {
                console.error("Textract error:", textractError);
                if (isTextractError(textractError)) {
                    if (textractError.code === 'UnsupportedDocumentException') {
                        console.error("Document format is not supported by Textract.");
                    }
                } else {
                    console.error("An unexpected error occurred:", textractError);
                }
            }
        }
    } catch (error) {
        console.error("Error processing SNS event: ", error);

    }

    // Type guard to check if error is a TextractError
    function isTextractError(error: unknown): error is AWS.AWSError {
        return typeof error === 'object' && error !== null && 'code' in error;
    }

    // Function to validate PDF format
    function isValidPDFFormat(documentBytes: Buffer): boolean {
        return documentBytes.slice(0, 4).toString() === '%PDF';
    }

};
