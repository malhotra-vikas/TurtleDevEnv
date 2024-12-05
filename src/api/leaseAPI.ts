import AWS from 'aws-sdk';
import { OpenAIApi, Configuration } from 'openai';
import * as Constants from "../utils/constants"
import { timeStamp } from 'console';
import * as userApi from '../api/user'

// Initialize the DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = Constants.LEASE_WISELY_USER_LEASES_TABLE // replace 'GolfConversations' with your table name
const openaiKey = process.env.OPENAI_KEY

// Initialize OpenAI client
const configuration = new Configuration({
    apiKey: openaiKey
});


const openai = new OpenAIApi(configuration);

interface ConversationContext {
    email: string;
    Context?: string;
}

export async function getPlayerTypeResponsesForUser(userEmail: string) {
    let playerTypeResponses = null
    const fetchedUser = await userApi.retrieveUserByEmail(userEmail)
    console.log("in getPlayerTypeResponsesForUser fetchedUser is" + JSON.stringify(fetchedUser))

    if (!fetchedUser || fetchedUser.length === 0) {
        console.error("No user found or no data available for user:", userEmail);
        return "No data available.";
    }

    const userItem = fetchedUser[0];
    let playerTypeString = ''


    for (const key in userItem) {
        if (userItem.hasOwnProperty(key)) {
            playerTypeString += `${key} is ${userItem[key]}\n`; // Append each key-value pair with a newline for better readability
        }
    }
    console.log(playerTypeString);
    return playerTypeString.trim(); // Trim the last newline character to clean up the final string
}


export async function getUserLeaseContext(email: string) {
    console.log("Searching for email in user Context Conversations" + email)
    try {
        // Define the DynamoDB query parameters
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: Constants.LEASE_WISELY_USER_LEASES_TABLE,
            KeyConditionExpression: '',
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
        }

        // Check if partition key is provided and add it to the query
        if (email) {
            if (params.ExpressionAttributeNames) {
                // Use params.ExpressionAttributeNames safely here
                params.ExpressionAttributeNames['#partitionKey'] = "email"

            }
            if (params.ExpressionAttributeValues) {
                // Use params.ExpressionAttributeValues safely here
                params.ExpressionAttributeValues[':partitionValue'] = email
            }
            params.KeyConditionExpression += '#partitionKey = :partitionValue'
        }

        let items = ''
        let leaseContext = null
        console.log("Searching for params " + JSON.stringify(params))

        // Perform the query on the DynamoDB table
        const result = await dynamodb.query(params).promise()
        if (result && result.Items) {
            let resultJson = JSON.stringify(result)
            leaseContext = extractContexts(resultJson)
        }

        return leaseContext

    } catch (error) {
        console.log("Error  " + error)

        throw error
    }


}

// Function to parse JSON and extract Context field
function extractContexts(jsonData: string): string[] {
    console.log(" in extractContexts jsonData is ", jsonData)

    // Parse the JSON data
    const data = JSON.parse(jsonData).Items as LeaseItem[];
    console.log(" in extractContexts data is ", data);

    // Map over the parsed data to extract the Context field
    const contexts = data.map((item: LeaseItem) => item.leaseText);
    console.log(" in extractContexts contexts is ", contexts);

    return contexts;
}

export async function saveUserContext(email: string, question: string, response: string): Promise<void> {
    // Create a JSON object from the question and response
    const context = JSON.stringify({
        question: question,
        response: response
    });

    const params = {
        TableName: tableName,
        Item: {
            email: email,
            Context: context,
            timestamp: new Date().toISOString()
        }
    };
    try {
        await dynamodb.put(params).promise();
    } catch (error) {
        console.error("Error saving user context:", error);
    }
}
export async function askOpenAIRecommendations(playerTypeResponses: string): Promise<string> {
    console.log("in askOpenAIRecommendations - playerTypeResponses is ", playerTypeResponses)

    let ballRecommendationCategories = "Brand Name, Model Name, Percentage match to Player Preferences, Driver Distance, Driver Height, Driver Wind Score, 7-Iron Carry, 7-Iron Roll, Greenside Spin and Putter Feel"

    // Build the effective prompt by integrating historical context and player type responses
    let effectivePrompt = `Player Game Preferences:${playerTypeResponses}\n\nBall Recommendation Categories:${ballRecommendationCategories}\n\nResponse Format:${"rrsponseJSON"}`;

    console.log("in askOpenAI - Effective Prompt is ", effectivePrompt)
    // Correct type annotation for chatMessages
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "You are an expert Golf Ball Fitting assistant designed to make recommendations for Golf Ball Fittings. You make 5 Golf Ball Brand and Model recommendations. The recommendations has a row for each of the categories defined in Ball Recommendation Categories. The response format will follow Response Format schema. You give high weightage to Player Game Preferences while making recommendations"
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });
    let golfBallRecommendations = ''

    try {
        
        const model = process.env.LEASEWISELY_GPT_MODEL_NAME;
        if (model) {
            const response = await openai.createChatCompletion({
                model: model, // Ensure this model is available or update as necessary
                messages: chatMessages,
                max_tokens: 1000
            });
    
            console.log("in askOpenAI -Building Rresponse ", response)
            if (response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message && response.data.choices[0].message.content) {
                // Extracting the golf ball recommendations from the response
                golfBallRecommendations = response.data.choices[0].message.content.trim();
                console.log("Response from golfBallRecommendations Lambda", golfBallRecommendations);    
        }    
        return golfBallRecommendations;    

        } else {
            console.error("No golf ball recommendations found in the response.");
            return "No recommendations found.";
        }

        /*
                // Check if the choices array and the text are not undefined
                if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
                    return  JSON.stringify(response.data.choices[0].message.content.trim());
                } else {
                    throw new Error("No completion found or completion was empty.");
                }
        */
    } catch (error: any) {
        console.error("Error in askOpenAI:", error);
        if (error.response) {
            console.error("HTTP status code:", error.response.status);
            console.error("Response body:", error.response.data);
            // Handle specific cases based on status code
            switch (error.response.status) {
                case 429:
                    console.error("Rate limit exceeded");
                    break;
                case 503:
                    console.error("Service unavailable");
                    break;
                // Add more cases as needed
            }
        }
        throw new Error("Failed to get response from OpenAI");
    }
}

export async function askOpenAI(question: string, context: string) {
    console.log("in askOpenAI - Question is ", question)
    console.log("in askOpenAI - Context is ", context)

    let openAIResponse = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'content-type': 'application/json'
        },
        isBase64Encoded: false,
        body: ''
    }

    // Build the effective prompt by integrating historical context and player type responses
    let effectivePrompt = "LeaseText:"

    try {
        const contextArray = JSON.parse(context);
        if (Array.isArray(contextArray) && contextArray.length > 0) {
            // Join the context array into a string if it's not empty, and prepend to the question
            effectivePrompt = effectivePrompt + `${contextArray.join("\n")}\n\n`;
        }
        effectivePrompt = effectivePrompt + `\n\nQuestion: `;
        effectivePrompt = effectivePrompt + `${question}`
    } catch (error) {
        console.error("Error parsing context, using question only:", error);
        // If parsing fails, use only the question
        effectivePrompt = question;
    }

    console.log("in askOpenAI - Effective Prompt is ", effectivePrompt)
    // Correct type annotation for chatMessages
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "You are a Residential Lease Expert. You are designed to give great answers to people's questions about their Leases. \
        You apply context for the lease using LeaseText and you also use past responses while gicing answers. \
        If the user's question is about a date, you are very specific and factual response."
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });

    try {
        const model = process.env.LEASEWISELY_GPT_MODEL_NAME;
        if (model) {
            const response = await openai.createChatCompletion({
                model: model, // Ensure this model is available or update as necessary
                messages: chatMessages,
                max_tokens: 1000
            });

            console.log("in askOpenAI -Building Rresponse ", response)

            // Check if the choices array and the text are not undefined
            if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
                openAIResponse.body = response.data.choices[0].message.content.trim();
                openAIResponse.statusCode = response.status
            } else {
                throw new Error("No completion found or completion was empty.");
            }
    
        }
        return openAIResponse


    } catch (error: any) {
        console.error("Error in askOpenAI:", error);
        if (error.response) {
            console.error("HTTP status code:", error.response.status);
            console.error("Response body:", error.response.data);
            // Handle specific cases based on status code
            switch (error.response.status) {
                case 429:
                    console.error("Rate limit exceeded");
                    break;
                case 503:
                    console.error("Service unavailable");
                    break;
                // Add more cases as needed
            }
        }
        openAIResponse.body = error.response.data
        openAIResponse.statusCode = error.response.status
        return openAIResponse
    }
}


export async function makeRecomemndations(email: string): Promise<string> {
    let playerTypeResponses = await getPlayerTypeResponsesForUser(email)
    if (!playerTypeResponses) {
        playerTypeResponses = ''
    }
    console.log("In Handle Conversations - playerTypeResponses " + playerTypeResponses)
    try {
        let response = await askOpenAIRecommendations(playerTypeResponses);
        console.log("In Handle Conversations - AI REsponse " + response)

        //        await saveRecommendation(email, response);
        return response;

    } catch (error) {
        console.error("Failed to process the AI response:", error);
    }
    return ''
}

export async function handleConversation(email: string, userInput: string) {
    let conversationResponse = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'content-type': 'application/json'
        },
        isBase64Encoded: false,
        body: ''
    }

    // string[] with context
    let context = await getUserLeaseContext(email);
    if (!context) {
        context = []
    }
    const jsonContext = JSON.stringify(context)

    try {
        console.log("In Handle Conversations - Context " + jsonContext)

        conversationResponse = await askOpenAI(userInput, jsonContext);
        console.log("In Handle Conversations - AI REsponse " + JSON.stringify(conversationResponse))

        //        await saveUserContext(email, userInput, response);
        return JSON.stringify(conversationResponse);

    } catch (error) {
        console.error("Failed to process the AI response:", error);
    }
    return ''
}
export function storeLease(userEmail: string, pdfTextData: string) {
    let response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'content-type': 'application/json'
        },
        isBase64Encoded: false,
        body: ''
    }

    console.log("storeLease not yet implemented")
    return response

}

