import AWS = require('aws-sdk')
import { OpenAIApi, Configuration } from 'openai'
import * as Constants from "../utils/constants"
import { timeStamp } from 'console';
import * as userApi from '../api/user'
import { getBallBrands } from '../utils/awsUtils'
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize the DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'GolfProUsersConversations'; // replace 'GolfConversations' with your table name
const recommendationTable = 'GolfProUsersRecommendations'

// Initialize OpenAI client
const configuration = new Configuration({
    apiKey: process.env.VENVEO_OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

const gptModel = "gpt-4o-mini"
const embeddingModel = "text-embedding-ada-002";

const responseJSON = [
    {
        "brand": "",
        "model": "",
        "percentageMatch": "",
        "driverDistance": "",
        "driverHeight": "",
        "driverWindScore": "",
        "ironCarry": "",
        "ironRoll": "",
        "greensideSpin": "",
        "putterFeel": ""
    },
    {
        "brand": "",
        "model": "",
        "percentageMatch": "",
        "driverDistance": "",
        "driverHeight": "",
        "driverWindScore": "",
        "ironCarry": "",
        "ironRoll": "",
        "greensideSpin": "",
        "putterFeel": ""
    },
    {
        "brand": "",
        "model": "",
        "percentageMatch": "",
        "driverDistance": "",
        "driverHeight": "",
        "driverWindScore": "",
        "ironCarry": "",
        "ironRoll": "",
        "greensideSpin": "",
        "putterFeel": ""
    },
    {
        "brand": "",
        "model": "",
        "percentageMatch": "",
        "driverDistance": "",
        "driverHeight": "",
        "driverWindScore": "",
        "ironCarry": "",
        "ironRoll": "",
        "greensideSpin": "",
        "putterFeel": ""
    },
    {
        "brand": "",
        "model": "",
        "percentageMatch": "",
        "driverDistance": "",
        "driverHeight": "",
        "driverWindScore": "",
        "ironCarry": "",
        "ironRoll": "",
        "greensideSpin": "",
        "putterFeel": ""
    }
]

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
        return null;
    }

    const userItem = fetchedUser[0];
    const questionCount = userItem['discoveryQuestionCount'];

    let playerTypeString = ''

    if (!questionCount || questionCount < 16) {
        return playerTypeString;
    }


    for (const key in userItem) {
        if (userItem.hasOwnProperty(key)) {
            playerTypeString += `${key} is ${userItem[key]}\n`; // Append each key-value pair with a newline for better readability
        }
    }
    console.log(playerTypeString);
    return playerTypeString.trim(); // Trim the last newline character to clean up the final string
}

export async function getUserContext(email: string) {
    console.log("Searching for email in user Context Conversations" + email)
    try {
        // Define the DynamoDB query parameters
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: Constants.GOLF_PRO_USERS_CONVERSATIONS_TABLE,
            KeyConditionExpression: '',
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
        }

        // Check if partition key is provided and add it to the query
        if (email) {
            if (params.ExpressionAttributeNames) {
                // Use params.ExpressionAttributeNames safely here
                params.ExpressionAttributeNames['#partitionKey'] = Constants.GOLF_PRO_USERS_TABLE_PARTITION_KEY

            }
            if (params.ExpressionAttributeValues) {
                // Use params.ExpressionAttributeValues safely here
                params.ExpressionAttributeValues[':partitionValue'] = email
            }
            params.KeyConditionExpression += '#partitionKey = :partitionValue'
        }

        let items = ''
        let context = null
        console.log("Searching for params " + JSON.stringify(params))

        // Perform the query on the DynamoDB table
        const result = await dynamodb.query(params).promise()
        if (result && result.Items) {
            let resultJson = JSON.stringify(result)
            context = extractContexts(resultJson)
        }

        return context

    } catch (error) {
        console.log("Error  " + error)

        throw error
    }
}
    
export async function getVenVeoKnowledgeBase(lastId: number, pageSize: number = 1000): Promise<ProjectKnowledgeBase[]> {
    let projectKnowledgeBase: ProjectKnowledgeBase[] = [];

    try {
        // Validate environment variables
        if (!process.env.VENVEO_SUPABASE_URL || !process.env.VENVEO_SUPABASE_KEY) {
            throw new Error('Supabase environment variables are not set.');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.VENVEO_SUPABASE_URL as string,
            process.env.VENVEO_SUPABASE_KEY as string
        );

        // Fetch data from the Supabase project table
        const { data: projects, error } = await supabase
            .from('project')
            .select('id, project_tags')
            .not('project_tags', 'is', null)
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(pageSize);
    
        if (!projects || projects.length === 0) {
            console.warn('No projects found.');
            return []
        }

        console.log('Raw Supabase response:', { projects, error });
        console.log('Raw Supabase response count:', projects.length);

        // Generate tags for each project sequentially
        const results = [];

        // Process each project and populate the projectKnowledgeBase
        for (const project of projects) {
            let parsedTags = [];
            try {
                // Parse project_tags JSON string into an array
                parsedTags = JSON.parse(project.project_tags);
            } catch (err) {
                console.error(`Error parsing tags for project ${project.id}:`, err);
            }
            // Add the project data to the knowledge base
            projectKnowledgeBase.push({
                id: project.id,
                project_tags: parsedTags
            });
        }


    } catch (error) {
        console.log("Error  " + error)
        throw error
    }
    return projectKnowledgeBase
}


export async function askVenVeoOpenAI(question: string, venVeoKnowledgeBase: ProjectKnowledgeBase[]): Promise<string> {
    console.log("in askOpenAI - Question is ", question)

    // Build the effective prompt by integrating historical context and player type responses
    let effectivePrompt = `
    Answer this question : 

    Query: "${question}"
    `;

    try {
        if (Array.isArray(venVeoKnowledgeBase) && venVeoKnowledgeBase.length > 0) {
            // Format each entry in the knowledge base to include both question and answer
            const knowledgeBaseEntries = venVeoKnowledgeBase.map(entry =>
                `project-id: ${entry.id}\nproject_tags: ${entry.project_tags}`
            );

            // Join the formatted entries into a string and prepend to the effective prompt
            effectivePrompt = effectivePrompt + `. Use the Knowledge Base:\n${knowledgeBaseEntries.join("\n\n")}\n\n`;
        }

        effectivePrompt = effectivePrompt + `Provide the output in the following structured format:
          "project-id": "project id from the knowledge base",
          "location": "location from the knowledge base",
          "contact-id": "contact id from the knowledge base",
          "otherDetails": "any additional relevant details"
        `;

    } catch (error) {
        console.error("Error parsing context, using question only:", error);
        // If parsing fails, use only the question
        effectivePrompt = question;
    }

    console.log("in askOpenAI - Effective Prompt is ", effectivePrompt)
    // Correct type annotation for chatMessages
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "Your name is Alexa. You are the Chief Data Scientiest at VenVeo. You answer user's questions about the various properies and projects. The project_tags in the knowledge base has details on various projects done on any property. You always query the knowledege base to answer queries, never make stuff up."
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });

    try {
        const response = await openai.createChatCompletion({
            model: gptModel,
            messages: chatMessages,
            max_tokens: 1000
        });

        console.log("in askOpenAI -Building Rresponse ", response)

        // Check if the choices array and the text are not undefined
        if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
            return response.data.choices[0].message.content.trim();
        } else {
            throw new Error("No completion found or completion was empty.");
        }
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

// Generate Query Embedding
async function generateQueryEmbedding(query: string) {
    const response = await openai.createEmbedding({
        model: embeddingModel,
        input: query,
    });

    return response.data.data[0].embedding;
}

async function parseQueryWithAI(query: string) {
    const prompt = `
    Break down the following query into key attributes and conditions:
    
    Query: "${query}"
    
    Provide the output in the following structured JSON format:
    {
      "action": "action being requested",
      "propertyType": "type of property (e.g., residential, commercial)",
      "location": "location mentioned in the query",
      "permitType": "type of permit mentioned in the query",
      "otherDetails": "any additional relevant details"
    }
    `;
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "You are an AI Assistent"
    }];
    chatMessages.push({ role: 'user', content: prompt });


    try {
        const response = await openai.createChatCompletion({
            model: gptModel,
            messages: chatMessages,
            max_tokens: 200,
            temperature: 0.0, // Ensure a deterministic response
        });

        // Parse the AI response
        const parsedResponse = JSON.parse(response.data.choices[0].message.content.trim());
        return parsedResponse;
    } catch (error) {
        console.error("Error parsing query with OpenAI:", error);
        throw error;
    }
}


export async function handleVenVeoConversation(userInput: string): Promise<string> {
    // Fetch Past User Quesntions and Responses.
    /*    
        let context = await getUserContext(email);
        if (!context) {
            context = []
        }
        const jsonContext = JSON.stringify(context)
    */
/*
    const runningWithEmbedding = process.env.VENVEO_EMBEDDING_ON

    if (runningWithEmbedding) {
        const queryEmbedding = await generateQueryEmbedding(userInput);
    }
*/
    //const parsedQuery = await parseQueryWithAI(userInput)
    //console.log("parsedQuery is " + parsedQuery)

    let response;
    // string[] with context
    let venVeoKnowledgeBase = await getVenVeoKnowledgeBase();
    if (!venVeoKnowledgeBase) {
        venVeoKnowledgeBase = []
    }
    const jsonVenVeoKnowledgeBase = JSON.stringify(venVeoKnowledgeBase)
    console.log("jsonVenVeoKnowledgeBase " + jsonVenVeoKnowledgeBase)

    try {

        //        response = await askROpenAI(userInput, jsonContext, playerTypeResponses, ballBrands);
        response = await askVenVeoOpenAI(userInput, venVeoKnowledgeBase);


        console.log("In Handle Conversations - AI REsponse " + response)

        //        await saveUserContext(email, userInput, response);
        return response;

    } catch (error) {
        console.error("Failed to process the AI response:", error);
    }
    return ''
}

// Function to parse JSON and extract Context field
function extractContexts(jsonData: string): string[] {
    console.log(" in extractContexts jsonData is ", jsonData)

    // Parse the JSON data
    const data = JSON.parse(jsonData).Items as Item[];
    console.log(" in extractContexts data is ", data);

    // Map over the parsed data to extract the Context field
    const contexts = data.map((item: Item) => item.Context);
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

interface UpdateRecommendationParams {
    TableName: string;
    Key: {
        email: string;
        recommendationStatus: string
    };
    UpdateExpression: string;
    ExpressionAttributeValues: {
        [key: string]: string;
    };
    ExpressionAttributeNames: {}
    ReturnValues: string;
}



export async function saveRecommendations(email: string, recommendation: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString(); // Current timestamp in seconds as a string
    let recommendationStatus = "current"

    const params: UpdateRecommendationParams = {
        TableName: recommendationTable,
        Key: {
            email: email,
            recommendationStatus: recommendationStatus
        },
        UpdateExpression: 'SET recommendation = :newRec, #timestampAttr = :timestampVal',

        ExpressionAttributeValues: {
            ':newRec': recommendation,
            ':timestampVal': timestamp
        },
        ExpressionAttributeNames: {
            '#timestampAttr': 'timestamp',
        },

        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const result = await dynamodb.update(params).promise();
        return result;

    } catch (error) {
        console.error('DynamoDB Error', error);
        throw error;
    }

}

export async function makeFavorite(email: string, favorite: string) {
    const recommendationStatus = "current"
    console.debug("Saving for", favorite)
    const params: UpdateRecommendationParams = {
        TableName: recommendationTable,
        Key: {
            email: email,
            recommendationStatus: recommendationStatus
        },
        UpdateExpression: 'SET #favorite = :favorite',
        ExpressionAttributeValues: {
            ':favorite': favorite
        },
        ExpressionAttributeNames: {
            '#favorite': 'favorite',
        },
        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const result = await dynamodb.update(params).promise();
        console.debug("result", result)
        return result

    } catch (error) {
        console.error('DynamoDB Error', error);
        throw error;
    }

}

export async function askOpenAIRecommendations(playerTypeResponses: string): Promise<string> {
    console.log("in askOpenAIRecommendations - playerTypeResponses is ", playerTypeResponses)

    let ballRecommendationCategories = "Brand Name, Model Name, Percentage match to Player Preferences, Driver Distance (Yards), Driver Height, Driver Wind Score (out of 10), 7-Iron Carry (Yards), 7-Iron Roll (Yards), Greenside Spin (out of 10), Putter Feel, Recommendation-Reason"

    // Build the effective prompt by integrating historical context and player type responses
    let effectivePrompt = `Player Game Preferences:${playerTypeResponses}\n\nBall Recommendation Categories:${ballRecommendationCategories}\n\nResponse Format:${JSON.stringify(responseJSON)}`;

    console.log("in askOpenAI - Effective Prompt is ", effectivePrompt)
    // Correct type annotation for chatMessages
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "You are an expert Golf Ball Fitting assistant designed to make recommendations for Golf Ball Fittings. " +
            "You make 5 Golf Ball Brand and Model recommendations. " +
            "The recommendations has a row for each of the categories defined in Ball Recommendation Categories. " +
            "The response format will follow Response Format schema. Driver Distance, 7-Iron Carry, 7-Iron Roll should be in Yards. " +
            "Greenside Spin and Driver Wind Score should be on a range of 1-10. Putter Feel shoould map to Soft, Medium or Firm" +
            "Recommendation-Reason in 20 words" +
            "You give high weightage to Player Game Preferences while making recommendations. " +
            "You always include Player's Current Ball as 3rd, 4th or 5th recommendation. " +
            "You always ensure that Player's Current Ball Percentage Match is less than the other recommendations "
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4o-mini", // Ensure this model is available or update as necessary
            messages: chatMessages,
            max_tokens: 1000
        });

        console.log("in askOpenAI -Building Rresponse ", response)

        if (response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message && response.data.choices[0].message.content) {
            // Extracting the golf ball recommendations from the response
            let golfBallRecommendations = ''
            golfBallRecommendations = response.data.choices[0].message.content.trim();
            console.log("Response from golfBallRecommendations Lambda", golfBallRecommendations);

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

export async function askOpenAI(question: string, context: string, playerTypeResponses: string, ballBrands: BallBrand[]): Promise<string> {
    console.log("in askOpenAI - Question is ", question)
    console.log("in askOpenAI - Context is ", context)
    console.log("in askOpenAI - playerTypeResponses is ", playerTypeResponses)

    // Build the effective prompt by integrating historical context and player type responses
    let effectivePrompt = "Context:"

    try {
        const contextArray = JSON.parse(context);
        if (Array.isArray(contextArray) && contextArray.length > 0) {
            // Join the context array into a string if it's not empty, and prepend to the question
            effectivePrompt = effectivePrompt + `${contextArray.join("\n")}\n\n`;
        }
        if (Array.isArray(ballBrands) && ballBrands.length > 0) {
            // Join the context array into a string if it's not empty, and prepend to the question
            effectivePrompt = effectivePrompt + `Ball Brands:${ballBrands.join("\n")}\n\n`;
        }

        effectivePrompt = effectivePrompt + `Player Game Preferences:${playerTypeResponses}\n\nQuestion: `;
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
        content: "You are a helpful Golf Ball Fitting assistant designed to give great recommendations to people's questions about Golf and Ball Fittings. You apply context on people's past questions using Context and you also give high weightage to Player Game Preferences while making recommendations. You focus your recomnmendation around the Ball Brands included in the query"
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4o-mini", // Ensure this model is available or update as necessary
            messages: chatMessages,
            max_tokens: 1000
        });

        console.log("in askOpenAI -Building Rresponse ", response)

        // Check if the choices array and the text are not undefined
        if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
            return response.data.choices[0].message.content.trim();
        } else {
            throw new Error("No completion found or completion was empty.");
        }
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

export async function makeRecomemndations(email: string): Promise<string> {
    let response = ''

    // Check if this user has an existing recomemndation that is current. Return that.
    let existingCurrentRecommendation = await getCurrentRecommendationForUser(email)
    if (existingCurrentRecommendation && existingCurrentRecommendation.length > 0) {
        // Accessing the first recommendation in the array (assuming there's only one)
        const firstRecommendation = existingCurrentRecommendation[0];

        console.log("Found existing", firstRecommendation)
        response = firstRecommendation.recommendation
        console.log("Found existing - Response Returned", response)

        return response
    }


    let playerTypeResponses = await getPlayerTypeResponsesForUser(email)
    if (!playerTypeResponses) {
        return ''
    }
    console.log("In Handle Conversations - playerTypeResponses " + playerTypeResponses)

    try {
        response = await askOpenAIRecommendations(playerTypeResponses);
        console.log("In Handle Conversations - AI REsponse " + response)

        await saveRecommendations(email, response);

    } catch (error) {
        console.error("Failed to process the AI response:", error);
    }
    return response;
}

export async function handleConversation(email: string, userInput: string): Promise<string> {
    // string[] with context
    let context = await getUserContext(email);
    if (!context) {
        context = []
    }
    let response;
    const jsonContext = JSON.stringify(context)

    // string[] with context
    let ballBrands = await getBallBrands();
    if (!ballBrands) {
        ballBrands = []
    }
    const jsonballBrands = JSON.stringify(ballBrands)


    let playerTypeResponses = await getPlayerTypeResponsesForUser(email)
    if (!playerTypeResponses) {
        playerTypeResponses = ''
    }
    console.log("In Handle Conversations - playerTypeResponses " + playerTypeResponses)

    try {
        console.log("In Handle Conversations - Context " + jsonContext)

        response = await askOpenAI(userInput, jsonContext, playerTypeResponses, ballBrands);
        console.log("In Handle Conversations - AI REsponse " + response)

        await saveUserContext(email, userInput, response);
        return response;

    } catch (error) {
        console.error("Failed to process the AI response:", error);
    }
    return ''
}

export async function getCurrentRecommendationForUser(email: string) {

    let recommendationStatus = "current"

    console.log("Searching for email" + email)
    try {
        // Define the DynamoDB query parameters
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: Constants.GOLF_PRO_USERS_RECOMMENDATIONS_TABLE,
            KeyConditionExpression: '#partitionKey = :partitionValue AND #sortKey = :sortValue',
            ExpressionAttributeNames: {
                '#partitionKey': "email",
                '#sortKey': "recommendationStatus"
            },
            ExpressionAttributeValues: {
                ':partitionValue': email,
                ':sortValue': recommendationStatus
            }
        };


        let items
        console.log("Searching for params " + JSON.stringify(params))

        // Perform the query on the DynamoDB table
        const result = await dynamodb.query(params).promise()

        console.log("Items found " + JSON.stringify(result))
        items = result.Items || null

        return items

    } catch (error) {
        console.log("Error  " + error)

        throw error
    }

}

