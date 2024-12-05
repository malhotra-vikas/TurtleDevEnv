import { Construct } from 'constructs'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cdk from 'aws-cdk-lib'
import * as Constants from '../src/utils/constants'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'

import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';


import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as s3 from 'aws-cdk-lib/aws-s3';

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

const VENVEO_OPENAI_API_KEY = process.env.VENVEO_OPENAI_API_KEY || 'default-api-key';
const VENVEO_SUPABASE_URL = process.env.VENVEO_SUPABASE_URL || 'default-api-key';
const VENVEO_SUPABASE_KEY = process.env.VENVEO_SUPABASE_KEY || 'default-api-key';

export class TurtleAIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const snsLoggingRole = new iam.Role(this, 'SnsLoggingRole', {
      assumedBy: new iam.ServicePrincipal('sns.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
    })

    // Define the SNS Publish Policy
    const snsPublishPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'], // It's better to specify the exact ARN of the SNS topic if possible
    })

    const TurtleAILayer = new lambda.LayerVersion(this, 'TurtleAILayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../TurtleAI-layer')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'A layer that includes the UUID module',
    });

    // Create SNS Topic for AdminAlerts
    const snsTopicAdminAlerts = new sns.Topic(this, 'TurtleAI-ContactSNSTopic-AdminAlerts', {
      displayName: 'TurtleAI-ContactSNSTopic-AdminAlerts',
      topicName: 'TurtleAI-ContactSNSTopic-AdminAlerts' // Explicit physical name
    })

    // Create SNS Topic for ContactVerification
    const snsTopicContactVerification = new sns.Topic(this, 'TurtleAI-ContactSNSTopic-ContactVerification', {
      displayName: 'TurtleAI-ContactSNSTopic-ContactVerification',
      topicName: 'TurtleAI-ContactSNSTopic-ContactVerification'
    })

    // Define DynamoDB table for contacts
    const turtleAIUserTable = new dynamodb.Table(this, 'TurtleAIUsersTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      tableName: Constants.GOLF_PRO_USERS_TABLE,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Use On-Demand billing mode
    })
    // Adding a Global Secondary Index (GSI) for 'managerId'
    turtleAIUserTable.addGlobalSecondaryIndex({
      indexName: Constants.GOLF_PRO_USERS_TABLE_NAME_IDX, // If you have a custom index for name
      partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      // You can include 'name' and 'email' as non-key attributes if you need to return these attributes in your query results
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['name', 'email']
    });

    // Create IAM Role
    const lambdaRole = new iam.Role(this, Constants.LAMBDA_ROLE, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: Constants.LAMBDA_ROLE,
      description: 'Role for Lambda with logging, DynamoDB and SNS permissions',
    })

    // Attach policies to the role

    // CloudWatch logs policy
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['arn:aws:logs:*:*:*'],
    }))

    // Grant Textract permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['textract:AnalyzeDocument'],
      resources: ['*'],
    }))

    // DynamoDB read/write policy
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Scan', 'dynamodb:Query'],
      resources: [Constants.GOLF_PRO_USERS_TABLE_ARN], // Replace with your DynamoDB table ARN
    }))

    // SNS publish policy
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'], // Replace with your SNS topic ARN
    }))

    // S3 read/write policy
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject', 's3:PutObjectAcl'],
      resources: ['arn:aws:s3:::bulk-upload-contacts/*', 'arn:aws:s3:::bulk-upload-contacts', 'arn:aws:s3:::leasewiselynewleases/*']
    }))

    // Create Lambda function for Paymets Capturing
    const stripePaymentsCaptureLambda = new lambdaNodejs.NodejsFunction(this, Constants.GOLF_PRO_PAYMENTS_CAPTURE_LAMBDA, {
      entry: 'src/lambda/payments-capture.ts', // Path to your Lambda code
      handler: 'paymentsCaptureHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: turtleAIUserTable.tableName,
      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.GOLF_PRO_PAYMENTS_CAPTURE_LAMBDA
    })


    // Create Lambda function for Project Tagging
    const venveoConversationsLambda = new lambdaNodejs.NodejsFunction(this, Constants.VENVEO_CONVERSATIONS_LAMBDA, {
      entry: 'src/lambda/venveoConversations.ts', // Path to your Lambda code
      handler: 'venVeoConversationsHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        VENVEO_OPENAI_API_KEY: VENVEO_OPENAI_API_KEY,
        VENVEO_SUPABASE_URL: VENVEO_SUPABASE_URL,
        VENVEO_SUPABASE_KEY: VENVEO_SUPABASE_KEY
      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.VENVEO_CONVERSATIONS_LAMBDA,
      bundling: {
        nodeModules: ['openai', 'dotenv'] // Explicitly include  if not being bundled
      }
    })

    // Create Lambda function for Project Tagging
    const venveoProjectTaggingLambda = new lambdaNodejs.NodejsFunction(this, Constants.VENVEO_PROJECT_TAGGING_LAMBDA, {
      entry: 'src/lambda/venveoProjectTagging.ts', // Path to your Lambda code
      handler: 'venveoProjectTaggingHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        VENVEO_OPENAI_API_KEY: VENVEO_OPENAI_API_KEY,
        VENVEO_SUPABASE_URL: VENVEO_SUPABASE_URL,
        VENVEO_SUPABASE_KEY: VENVEO_SUPABASE_KEY
      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.VENVEO_PROJECT_TAGGING_LAMBDA,
      bundling: {
        nodeModules: ['openai', 'dotenv'] // Explicitly include  if not being bundled
      }
    })


    // Schedule the Lambda function to run every 5 minutes
    const lambdaSchedule = new events.Rule(this, 'LambdaEveryFiveMinutes', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    // Set the target of the Rule as your Lambda function
    lambdaSchedule.addTarget(new targets.LambdaFunction(venveoProjectTaggingLambda));


    const allergyListLambda = new lambdaNodejs.NodejsFunction(this, Constants.ALLERGY_LIST_LAMBDA, {
      entry: 'src/lambda/allergyList.ts', // Path to your Lambda code
      handler: 'allergyListHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {

      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.ALLERGY_LIST_LAMBDA
    })

    const restaurantListLambda = new lambdaNodejs.NodejsFunction(this, Constants.RESTAURANTS_LIST_LAMBDA, {
      entry: 'src/lambda/restaurantList.ts', // Path to your Lambda code
      handler: 'restaurantListHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {

      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.RESTAURANTS_LIST_LAMBDA
    })

    const restaurantMenuLambda = new lambdaNodejs.NodejsFunction(this, Constants.RESTAURANTS_MENU_LAMBDA, {
      entry: 'src/lambda/restaurantMenu.ts', // Path to your Lambda code
      handler: 'restaurantMenuHandler', // The exported function name for creating contacts
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {

      },
      role: lambdaRole,
      layers: [TurtleAILayer],
      timeout: cdk.Duration.minutes(5),
      functionName: Constants.RESTAURANTS_MENU_LAMBDA
    })


    // Grant permissions to access DynamoDB
    turtleAIUserTable.grantReadWriteData(stripePaymentsCaptureLambda)


    // Create API Gateway
    const api = new apigateway.RestApi(this, 'TurtleAI-Users-api', {
      deployOptions: {
        stageName: 'v1',
      },
    })

    const usersResource = api.root.addResource('users')
    const employeesResource = api.root.addResource('employees')
    const projectsResource = api.root.addResource('projects')
    const tasksResource = api.root.addResource('tasks')
    const journalResource = api.root.addResource('journals')
    const journalAnalysisResource = api.root.addResource('journalsAnalysis')
    const debtCalcResource = api.root.addResource("debtCalculator")
    const conversationsResource = api.root.addResource('conversations')
    const recommendationsResource = api.root.addResource('recommendations')
    const favoriteRecommendationsResource = api.root.addResource('favoriteRecommendations')
    const fetchFavoriteRecommendationsResource = api.root.addResource('getFavoriteRecommendations')
    const paymentsResource = api.root.addResource('payments')
    const allergyResource = api.root.addResource('allergyai')
    const restaurantResource = api.root.addResource('allergyai-restaurants')
    const restaurantMenuResource = api.root.addResource('allergyai-restaurant-menu')
    const venVeoResource = api.root.addResource('venVeoAI')

    // Add GET method to Allergy List capturing
    const venVeoConversationsLambdaIntegration = new apigateway.LambdaIntegration(venveoConversationsLambda)
    venVeoResource.addMethod('GET', venVeoConversationsLambdaIntegration)


    // Add GET method to Allergy List capturing
    const allergyListLambdaIntegration = new apigateway.LambdaIntegration(allergyListLambda)
    allergyResource.addMethod('GET', allergyListLambdaIntegration)

    // Add GET method to Allergy List capturing
    const restaurantListLambdaIntegration = new apigateway.LambdaIntegration(restaurantListLambda)
    restaurantResource.addMethod('GET', restaurantListLambdaIntegration)

    // Add GET method to Allergy List capturing
    const restaurantMenuLambdaIntegration = new apigateway.LambdaIntegration(restaurantMenuLambda)
    restaurantMenuResource.addMethod('GET', restaurantMenuLambdaIntegration)


    // Add POST method to payments capturing
    const paymentsCaptureIntegration = new apigateway.LambdaIntegration(stripePaymentsCaptureLambda)
    paymentsResource.addMethod('POST', paymentsCaptureIntegration)

    // IAM Policy to send emails using SES
    const sesSendEmailPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    })

    // Output the API endpoint URL
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
    })
  }
}
