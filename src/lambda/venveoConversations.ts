import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Constants from '../utils/constants'
import * as userApi from '../api/user'
import * as humanConversationApi from '../api/venVeoBeingHuman'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

const gptModel = "gpt-4o-mini"
const embeddingModel = "text-embedding-ada-002";

// Function to replace markdown link syntax with HTML <a href> tag
function replaceMarkdownLinkWithHref(text: String) {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
    return `<a href="${url}">${linkText}</a>`;
  });
}


export async function venVeoConversationsHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log("Event Starting")

  var fetchedUser;
  var aiResponse;
  var appointmentIntent;

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
  const userquery = event.queryStringParameters?.userquery

  if (!userquery) {
    response.body = "Validation Error - Search Criteria Missing"
    response.statusCode = Constants.ERROR
    console.log("Response from create Lambda: 1 ", JSON.stringify(response))
    return response
  }

  if (userquery) {
    console.log("User Query", userquery)

    aiResponse = await humanConversationApi.handleVenVeoConversation(userquery)
//    appointmentIntent = await humanConversationApi.handleRoseCreekIntentCheck(userquery)

    // Using the function to process the aiResponse
    //aiResponse = replaceMarkdownLinkWithHref(aiResponse);

  }

  if (response.statusCode = 200) {
    console.log("AI REsponse fetched", JSON.stringify(aiResponse))
    console.log("Appointment Intent fetched", JSON.stringify(appointmentIntent))

    // Beautify the JSON string with indentation (2 spaces)
    const beautifiedBody = JSON.stringify({ aiResponse, appointmentIntent }, null, 2)
    response.body = beautifiedBody
  }
  console.log("Response from create Lambda", JSON.stringify(response))
  return response

}

