import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as Constants from '../utils/constants';
import * as leaseAPI from '../api/leaseAPI';
import pdf from 'pdf-parse';

// Initialize AWS DynamoDB DocumentClient
const dynamoDB = new DynamoDBClient({ region: Constants.AWS_REGION });

// Initialize AWS S3 Client
const s3Client = new S3Client({ region: Constants.AWS_REGION });

interface RequestBody {
    fileContent: string; // Base64 encoded file content
    fileName: string
}

async function uploadToS3(s3FileName: string, fileContentBuffer: Buffer) {
    // Upload the lease file to S3
    const bucketName = process.env.LEASEWISELY_NEWLEASE_S3_BUCKET_NAME;
    const params = {
        Bucket: bucketName, // Replace with your bucket name
        Key: s3FileName, // File name you want to save as in S3
        Body: fileContentBuffer,
        ContentType: "application/pdf",
      };
  
    const data = await s3Client.send(new PutObjectCommand(params))
    console.log(`File uploaded successfully. ${data}`);

    const s3FilePath = `s3://${bucketName}/${s3FileName}`;
    return s3FilePath
}

export async function uploadLeaseHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log("Event Starting");

    // Initialize response with a default error state
    let response: APIGatewayProxyResult = {
        statusCode: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        },
        isBase64Encoded: false,
        body: JSON.stringify({ error: "Internal Server Error" })
    };

    try {
        
        const bodyData: RequestBody = JSON.parse(event.body || '{}');
        console.log("Parsed Event Body", bodyData);

        const { fileContent, fileName } = bodyData;

        if (!fileContent || !fileName) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "Validation Error - fileContent is missing" });
            return response;
        }

        // Split filename by dots and ensure it ends with 'pdf'
        const fileParts = fileName.split('.');
        if (fileParts.length < 2 || fileParts[fileParts.length - 1].toLowerCase() !== 'pdf') {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "Validation Error - Only PDF files are allowed and file names cannot contain multiple dots" });
            return response;
        }

        const fileBuffer = Buffer.from(fileContent, 'base64');
        
        // Extract name without extension
        const fileNameWithoutExtension = fileParts.slice(0, -1).join('.');

        // Generate a UUID for the file
        const uuid = uuidv4();
        const s3FileName = `${fileNameWithoutExtension}-${uuid}.pdf`;

        // Upload PDF to S3
        const uploadedS3FilePath = await uploadToS3(s3FileName, fileBuffer)
        console.log("uploadedS3FilePath is ", uploadedS3FilePath)

        // Store the file path and UUID in DynamoDB table for New Leases
        const tableName = process.env.LEASEWISELY_NEWLEASE_DYNAMODB_TABLE_NAME;
        await dynamoDB.send(new PutItemCommand({
            TableName: tableName,
            Item: {
                uuid: { S: uuid },
                s3FilePath: { S: uploadedS3FilePath }
            },
        }));

        response.statusCode = 200;
        response.body = JSON.stringify({ uuid });

    } catch (error) {
        console.error("Error processing request:", error);
        response.statusCode = 500;
        response.body = JSON.stringify({ error: "Error processing request", details: error });

    }

    console.log("Response from create Lambda", JSON.stringify(response));
    return response;
}
