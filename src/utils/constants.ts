// constants.ts
export const LAMBDA_ROLE = "TurtleAILambdaRole"

export const AWS_ACCOUNT = process.env.AWS_ACCOUNT
export const AWS_REGION = process.env.AWS_REGION

// AutoBuilds from the AWS Variables
export const ALERT_ADMIN_SNS_QUEUE = "arn:aws:sns:"+AWS_REGION+":"+AWS_ACCOUNT+":TurtleAI-ContactSNSTopic-AdminAlerts"
export const USER_VERIFICATION_SNS_QUEUE = "arn:aws:sns:"+AWS_REGION+":"+AWS_ACCOUNT+":TurtleAI-ContactSNSTopic-ContactVerification"
export const CONTACTS_TABLE_ARN = "arn:aws:dynamodb:"+AWS_REGION+":"+AWS_ACCOUNT+":table/TurtleAIContacts"
export const CONTACTS_VERIFICATION_TABLE_ARN = "arn:aws:dynamodb:"+AWS_REGION+":"+AWS_ACCOUNT+":table/TurtleAIContactsVerification"

// Contacts Table
//export const CONTACTS_TABLE = "TurtleAIContacts"

// Contacts Table
export const GOLF_PRO_USERS_TABLE = "TurtleAIUsers"

export const GOLF_PRO_USERS_TABLE_ARN = "arn:aws:dynamodb:" + exports.AWS_REGION + ":" + exports.AWS_ACCOUNT + ":table/" + GOLF_PRO_USERS_TABLE;

export const GOLF_PRO_USERS_TABLE_PARTITION_KEY = 'email'
export const GOLF_PRO_USERS_TABLE_SORT_KEY = 'name'

export const GOLF_PRO_PAYMENTS_CAPTURE_LAMBDA = "TurtleAIPaymentsCaptureLambda"

export const GOLF_PRO_USERS_TABLE_NAME_IDX = 'NameIndex'
export const GOLF_PRO_CONVERSATIONS_TABLE_TIMESTAMP_IDX = 'TimeStampIndex'
export const GOLF_PRO_RECOMMENDATIONS_TABLE_TIMESTAMP_IDX = 'TimeStampIndex'

export const GOLF_PRO_JOURNAL_TABLE_TIMESTAMP_IDX = "TimestampIndex"

// Ten Ten Resources

export const ALLERGY_LIST_LAMBDA = "AllergyListLambda"
export const RESTAURANTS_LIST_LAMBDA = "RestaurantListLambda"
export const RESTAURANTS_MENU_LAMBDA = "RestaurantMenuLambda"


export const VENVEO_PROJECT_TAGGING_LAMBDA = "VenveoProjectTaggingLambda"
export const VENVEO_CONVERSATIONS_LAMBDA = "VenveoConversationsLambda"


export const CONTACTS_TABLE_SORT_KEY = 'email'
export const CONTACTS_TABLE_PARTITION_KEY = 'contactId'
export const CONTACTS_TABLE_CONTACTID_IDX = 'ContactIdIndex'
export const CONTACTS_TABLE_EMAIL_IDX = 'EmailIndex'

// S3 Bucket
export const BULK_UPLOAD_BUCKET = 'bulk-upload-contacts'
export const BULK_UPLOAD_CSV = 'uploadContacts.csv'

export const SUCCESS = 200
export const ERROR = 400
export const DOES_NOT_EXIST = 404
export const INTERNAL_ERROR = 500

export const POST = 'POST'
export const DELETE = 'DELETE'
export const GET = 'GET'
export const PUT = 'PUT'

// Source of Contacts being created
export const WEB_LEAD = "web-lead"
export const BULK_UPLOAD = "bulk-upload"