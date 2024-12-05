import * as AWS from 'aws-sdk'
import * as Constants from '../utils/constants'

AWS.config.update({ region: Constants.AWS_REGION })
const dynamodb = new AWS.DynamoDB.DocumentClient()


async function getSecret(client: AWS.SecretsManager, secretArn: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSecretValue({ SecretId: secretArn }, (err, data) => {
      if (err) {
        reject(err)
        return
      }

      if ('SecretString' in data) {
        resolve(data.SecretString as string)
      } else {
        resolve(Buffer.from(data.SecretBinary as any, 'base64').toString('ascii'))
      }
    })
  })
}

export const awsUtils = { getSecret }

export async function getBallBrands(): Promise<BallBrand[]>{
  let brands: BallBrand[] = [];

  try {
      // Define the DynamoDB scan parameters
      const params: AWS.DynamoDB.DocumentClient.ScanInput = {
          TableName: Constants.GOLF_PRO_BRANDS_TABLE,
      };

      let items = ''
      let context = null
      console.log("Searching for params " + JSON.stringify(params))

      // Perform the scan operation on the DynamoDB table
      const result = await dynamodb.scan(params).promise();

      if (result && result.Items) {

          // Map the DynamoDB items to the desired format
          brands = result.Items.map((item: any) => ({
              name: item.name,
              logo: item.logo
          }));
          return brands
      }

  } catch (error) {
      console.log("Error  " + error)
      throw error
  }
  return brands

}
