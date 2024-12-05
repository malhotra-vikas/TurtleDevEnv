import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as userApi from '../api/user'
import * as humanConversationApi from '../api/beingHuman'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

export async function favoriteRecommnedationsHandler(event: APIGatewayProxyEvent) {
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

    //const bodyData = JSON.parse(JSON.stringify(event.body || '{}'))
    const bodyData = event.body || '{}'


    console.log("Event Body", bodyData)

    // Extract user details from the path parameters.
    const userEmail = event.queryStringParameters?.userEmail
    const model = event.queryStringParameters?.model
    const brand = event.queryStringParameters?.brand

    if (!userEmail || !brand || !model) {
        response.body = "Validation Error - Search Criteria Missing"
        response.statusCode = Constants.ERROR
        console.log("Response from create Lambda: 1 ", JSON.stringify(response))
        return response
    }

    if (userEmail && brand && model) {
        console.log("User Email in Favorite", userEmail)

        await humanConversationApi.makeFavorite(userEmail, brand + ":" + model)
        response.body = brand+ ":" + model + "favorite success"
        response.statusCode = Constants.SUCCESS
        console.log("Response from create Lambda: 1 ", JSON.stringify(response))
        return response
    }

    return response

}
