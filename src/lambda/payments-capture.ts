import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as userApi from '../api/user'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

interface CustomerDetails {
    email: string;
}

interface SessionObject {
    customer_details: CustomerDetails;
    payment_intent: string;
}
interface StripeEvent {
    type: string;
    data: {
        object: SessionObject;
    };
}

export async function paymentsCaptureHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log("Event Starting")

    var fetchedUser;
    var aiResponse;

    let response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'content-type': 'application/json'
        },
        isBase64Encoded: false,
        body: ''
    }

    console.log("Event body is" + JSON.stringify(event.body))

    const stripeEvent: StripeEvent = JSON.parse(event.body as string);

    console.log("stripe_event  is" + stripeEvent)

    let userEmail
    let subscription_status = "inactive"
    let subscription_date = "NAN"
    let credits = "0"

    const eventType = stripeEvent['type'];

    if (eventType === 'checkout.session.completed') {
        const session = stripeEvent['data']['object'];
        userEmail = session['customer_details']['email'];
        const paymentId = session['payment_intent'];
        subscription_status = 'active';  // or any other status you want to set
        credits = "100";
        subscription_date = new Date().toISOString().split('T')[0];  // YYYY-MM-DD format        
    }

    console.log(" userEmail is  ", userEmail)
    console.log(" subscription_status is being set to ", subscription_status)
    console.log(" subscription_date is being set to ", subscription_date)
    console.log(" credits is being set to ", credits)


    if (!userEmail) {
        response.body = "Validation Error - Search Criteria Missing"
        response.statusCode = Constants.ERROR
        console.log("Response from create Lambda: 1 ", JSON.stringify(response))
        return response
    }

    if (userEmail) {
        console.log("User Email", userEmail)

        fetchedUser = await userApi.retrieveUserByEmail(userEmail)
        console.log("in getPlayerTypeResponsesForUser fetchedUser is" + JSON.stringify(fetchedUser))

        if (!fetchedUser || fetchedUser.length === 0) {
            console.error("No user found or no data available for user:", userEmail);
        } else {
            const userItem = fetchedUser[0];
            await userApi.updateUserSubscription(userEmail, userItem['name'], subscription_status, subscription_date, credits)
        }

    }

    if (response.statusCode = 200) {
        console.log("AI REsponse fetched", JSON.stringify(aiResponse))

        // Beautify the JSON string with indentation (2 spaces)
        const beautifiedBody = JSON.stringify(aiResponse, null, 2)
        response.body = beautifiedBody
    }
    console.log("Response from create Lambda", JSON.stringify(response))
    return response

}




