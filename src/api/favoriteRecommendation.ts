import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as userApi from './user'
import * as humanConversationApi from './beingHuman'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

export async function favoriteRecommnedationsHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

  if (!userEmail) {
    response.body = "Validation Error - Search Criteria Missing"
        response.statusCode = Constants.ERROR
        console.log("Response from create Lambda: 1 ", JSON.stringify(response))
        return response
    }

  if (userEmail) {
        console.log("User Email", userEmail)

        aiResponse = await humanConversationApi.makeRecomemndations(userEmail)
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
