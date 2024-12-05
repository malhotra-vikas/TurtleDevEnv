import AWS = require('aws-sdk')
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { UserType } from '../utils/user'
import { readUserFromEvent, readUserFromUpdateEvent } from '../index'
import * as Constants from '../utils/constants'
import * as contactApi from '../api/user'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

export async function updateContactHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

  console.log("Event starting")
  const region = Constants.AWS_REGION
  var updatedContact

  let response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'content-type': 'application/json'
    },
    isBase64Encoded: false,
    body: ''
  }
  // console.log("Event Body is " + JSON.stringify(event.body))

  // Extract data from the path parameters.
  const userEmail = event.queryStringParameters?.userEmail
  const name = event.queryStringParameters?.name
  const handicap = event.queryStringParameters?.handicap || ''
  const currentBallBrand = event.queryStringParameters?.currentBallBrand  || ''
  const currentBallModel = event.queryStringParameters?.currentBallModel  || ''
  const golfState = event.queryStringParameters?.golfState  || ''
  const driverDistance = event.queryStringParameters?.driverDistance  || ''
  const driverTrajectory = event.queryStringParameters?.driverTrajectory  || ''
  const driverShotShape = event.queryStringParameters?.driverShotShape  || ''
  const driverSpinRate = event.queryStringParameters?.driverSpinRate  || ''
  const iron7Distance = event.queryStringParameters?.iron7Distance || ''
  const iron7Trajectory = event.queryStringParameters?.iron7Trajectory || ''
  const abilityToShapeShots = event.queryStringParameters?.abilityToShapeShots || ''
  const greenSideSpin = event.queryStringParameters?.greenSideSpin || ''
  const wedgesSpinControl = event.queryStringParameters?.wedgesSpinControl || ''
  const puttingFeel = event.queryStringParameters?.puttingFeel || ''
  const criticalCharacteristics = event.queryStringParameters?.criticalCharacteristics || ''
  const idealBallDescription = event.queryStringParameters?.idealBallDescription || ''
  let discoveryQuestionCount = null

  if (event.queryStringParameters && event.queryStringParameters.discoveryQuestionCount) {
    discoveryQuestionCount = event.queryStringParameters.discoveryQuestionCount
  }

  // Check if the listId is valid (you can implement your validation logic).
  if (!userEmail || !name) {
    response.body = "Missing search criteria"
    response.statusCode = Constants.INTERNAL_ERROR
    console.log("Response 3:", response)

    return response
  }

  if (typeof userEmail !== 'string' || typeof name !== 'string') {
    response.body = "Invalid search criteria"
    response.statusCode = Constants.INTERNAL_ERROR
    console.log("Response 4:", response)

    return response
  }

  const eventBodyData = event.body || '{}'

  console.log("To be updated body data", eventBodyData)


  var updateResponse = await contactApi.updateContact(userEmail, name, handicap, currentBallBrand, currentBallModel, 
    golfState, driverDistance, driverTrajectory, driverShotShape, driverSpinRate, iron7Distance, iron7Trajectory, 
    abilityToShapeShots, greenSideSpin, wedgesSpinControl, puttingFeel, criticalCharacteristics, 
    idealBallDescription, discoveryQuestionCount)

  console.log("Contact updated", updateResponse)

  /*
  if ((updateResponse) {
    // Query for the contact that was successfully updated and return that in response
    updatedContact = await contactApi.retrieveUserByEmail
    console.log("Updated contact", updatedContact)

    // Beautify the JSON string with indentation (2 spaces)
    const beautifiedBody = JSON.stringify(updatedContact, null, 2)
    response.body = beautifiedBody

  } else {
    response.body = updateResponse.body
    response.statusCode = updateResponse.statusCode
  }
  */

  console.log("Response from update Lambda", JSON.stringify(response))
  return response
}


