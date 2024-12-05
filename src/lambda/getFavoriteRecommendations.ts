import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as userApi from '../api/user'
import * as humanConversationApi from '../api/beingHuman'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

export async function getFavoriteRecommnedationsHandler(event: APIGatewayProxyEvent) {
    console.log("Event Starting")

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

    if (!userEmail) {
        response.body = "Validation Error - Search Criteria Missing"
        response.statusCode = Constants.ERROR
        console.log("Response from create Lambda: 1 ", JSON.stringify(response))
        return response
    }

    if (userEmail) {
        console.log("User Email in Favorite", userEmail)

        let existingCurrentRecommendation = await humanConversationApi.getCurrentRecommendationForUser(userEmail)
        if (existingCurrentRecommendation && existingCurrentRecommendation.length > 0) {
            // Accessing the first recommendation in the array (assuming there's only one)
            const firstRecommendation = existingCurrentRecommendation[0];
    
            console.log("Found existing", firstRecommendation)
            response.body = firstRecommendation.favorite
            response.statusCode = Constants.SUCCESS
            console.log("Response from create Lambda: 1 ", JSON.stringify(response))
    
            console.log("Found existing - Response Returned", response)
    
            return response
        }
    }

    return response

}
