import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { UserType } from '../utils/user'
import * as Constants from '../utils/constants'

import AWS = require('aws-sdk')

AWS.config.update({ region: Constants.AWS_REGION })


export async function calculate_pmt(loanAmount: any, monthlyInterest: any, term: any) {
    const num_payments = term * 12

    const pmt = loanAmount * monthlyInterest / (1 - (1 + monthlyInterest) ** -num_payments)
    return pmt
}

export async function debtCalculatorHander(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

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
// Parse the JSON string to an object
const bodyData = JSON.parse(event.body || '{}');

  console.log("Event Body", bodyData)

  // Extract details from the path parameters.
  const revenue = bodyData.revenue; // Dollars
  const cashFlow = bodyData.cashFlow; // Dollars
  const ebitda = bodyData.ebitda; // Dollars
  const price = bodyData.price; // Dollars
  const downpayment = bodyData.downpayment; // Dollars
  const interest = bodyData.interest; // Interest Percentage
  const termMonths = bodyData.term; // Term in Months

  if (!revenue || !cashFlow || !ebitda || !price || !downpayment || !interest || !termMonths) {
    response.body = "Validation Error - User missing required field email"
    response.statusCode = 500
    console.log("Response from calculator Lambda: 1 ", JSON.stringify(response))
    return response
  }

  const ebidtaMonthly = ebitda/12
  const ebidtaX = price/ebitda
  const loanAmount = price - downpayment
  const monthlyInterest = interest/12

  var debtService = await calculate_pmt(loanAmount, monthlyInterest, termMonths)
  
  console.log("debtService", debtService)

  console.log("Response from calculator Lambda", debtService)
  return response
}

