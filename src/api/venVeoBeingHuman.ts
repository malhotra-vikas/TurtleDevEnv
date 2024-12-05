import AWS = require('aws-sdk')
import { OpenAIApi, Configuration } from 'openai'
import * as Constants from "../utils/constants"
import { timeStamp } from 'console';
import * as userApi from './user'
import { getBallBrands } from '../utils/awsUtils'
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const configuration = new Configuration({
    apiKey: process.env.VENVEO_OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

const gptModel = "gpt-4o-mini"
const embeddingModel = "text-embedding-ada-002";


interface ConversationContext {
    email: string;
    Context?: string;
}

export async function saveKnowledgeBaseLocally(knowledgeBase: ProjectKnowledgeBase[]) {
    const filePath = path.join('/tmp', 'knowledgeBase.json');
    fs.writeFileSync(filePath, JSON.stringify(knowledgeBase, null, 2), 'utf-8');
    console.log('Knowledge base saved locally:', filePath);
}

export function loadKnowledgeBaseLocally(): ProjectKnowledgeBase[] | null {
    const filePath = path.join('/tmp', 'knowledgeBase.json');
    if (fs.existsSync(filePath)) {
        console.log('Loading knowledge base from local storage:', filePath);
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    return null;
}

// Helper function to chunk knowledge base
export async function chunkArray<T>(array: T[], chunkSize: number): Promise<T[][]> {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
    }
    return result;
}

export async function getVenVeoKnowledgeBase(lastId: string, pageSize: number = 2500): Promise<ProjectKnowledgeBase[]> {
    // Validate environment variables
    if (!process.env.VENVEO_SUPABASE_URL || !process.env.VENVEO_SUPABASE_KEY) {
        throw new Error('Supabase environment variables are not set.');
    }
    const supabase = createClient(
        process.env.VENVEO_SUPABASE_URL as string,
        process.env.VENVEO_SUPABASE_KEY as string
    );

    try {
        let query = supabase
            .from('project')
            .select('id, project_tags')
            .not('project_tags', 'is', null)
            .order('id', { ascending: true })
            .limit(pageSize);

        if (lastId && lastId !== 'null') {
            query = query.gt('id', lastId); // Only add condition if lastId is not null
        }
        const { data: projects, error } = await query;

        if (error) throw new Error(`Supabase Error: ${error.message}`);

        return projects?.map(project => ({
            id: project.id,
            project_tags: JSON.parse(project.project_tags || '[]')
        })) || [];

    } catch (error) {
        console.error("Error fetching knowledge base:", error);
        throw error;
    }
}

export async function askVenVeoOpenAI(question: string, venVeoKnowledgeBase: ProjectKnowledgeBase[]): Promise<string> {
    console.log("in askOpenAI - Question is ", question)

    const maxEntries = 50; // Adjust based on OpenAI token limits
    const trimmedKnowledgeBase = venVeoKnowledgeBase.slice(0, maxEntries);

    const knowledgeBaseEntries = trimmedKnowledgeBase.map(entry =>
        `project-id: ${entry.id}\nproject_tags: ${entry.project_tags}`
    );

    const effectivePrompt = `
    Answer this question:\n\nQuery: "${question}"\n\n. This is the Knowledge Base for projects done on any property. The project_tags defines the date of project, type of project and the location of property :\n${knowledgeBaseEntries.join("\n\n")}
    Provide the output in format listed below. Only provide the details listed below in JSON and nothing else:
    {
        "project-id": "project id from the knowledge base",
        "location": "location from the knowledge base",
        "contact-id": "contact id from the knowledge base",
        "otherDetails": "any additional relevant details"
    }
    `;

    console.log("in askOpenAI - Effective Prompt is ", effectivePrompt)
    // Correct type annotation for chatMessages
    let chatMessages: { role: 'system' | 'user', content: string }[] = [{
        role: "system",
        content: "Your name is Alexa. You are the Chief Data Scientiest at VenVeo. You answer user's questions about the various properies and projects. The project_tags in the knowledge base has details on various projects done on any property. You always query the knowledege base to answer queries, never make stuff up. If no relevant data is returned then you return empty JSON."
    }];
    chatMessages.push({ role: 'user', content: effectivePrompt });

    try {
        const response = await openai.createChatCompletion({
            model: gptModel,
            messages: chatMessages,
            max_tokens: 1000
        });

        // Check if the choices array and the text are not undefined
        if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
            let message = response.data.choices[0].message.content.trim(); // Corrected path to messages

            if (message.includes('json')) {
                // Remove all occurrences of 'json' from the message
                message = message.replace(/json/g, '');
            }
            if (message.includes('```')) {
                // Remove all occurrences of 'json' from the message
                message = message.replace(/```/g, '');
            }       
            console.log("in askOpenAI - Building Message ", message)

            return message;
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

export async function handleVenVeoConversation(userQuery: string): Promise<string> {
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
    const pageSize = 1000; // Number of records per chunk
    const chunkSize = 1000; // Number of records to process in each OpenAI call

    let lastId: string | null = 'null'; // Initialize with null for the first query
    let knowledgeBase: ProjectKnowledgeBase[];

    try {
        console.log("User Query:", userQuery);

        // Attempt to load knowledge base from local storage
        knowledgeBase = loadKnowledgeBaseLocally() || [];
        
        if (knowledgeBase.length === 0) {
            console.log('Knowledge base not found locally. Fetching from Supabase...');

            let lastId: string | null = 'null';
            knowledgeBase = [];
            while (true) {
                const chunk = await getVenVeoKnowledgeBase(lastId, pageSize);
                if (!chunk || chunk.length === 0) break; // Stop if no more records
                knowledgeBase = knowledgeBase.concat(chunk);
                lastId = chunk[chunk.length - 1].id; // Update lastId for the next chunk
            }

            // Save fetched knowledge base locally
            saveKnowledgeBaseLocally(knowledgeBase);
        }

        console.log(`Loaded knowledge base with ${knowledgeBase.length} records.`);

        // Chunk the knowledge base for parallel processing
        const knowledgeBaseChunks = await chunkArray(knowledgeBase, chunkSize);

        console.log(`Divided knowledge base into ${knowledgeBaseChunks.length} chunks for parallel processing.`);

        // Process each chunk in parallel
        const responses = await Promise.all(
            (await knowledgeBaseChunks).map((chunk, index) => {
                console.log(`Processing chunk ${index + 1} with ${chunk.length} records.`);
                return askVenVeoOpenAI(userQuery, chunk);
            })
        );

        // Filter and modify responses
        const filteredResponses = responses.map(response => {
            // Trim whitespace and check if it starts with 'json'
            let trimmedResponse = response.trim();
            if (trimmedResponse.startsWith('json')) {
                // Strip 'json' from the beginning of the response
                trimmedResponse = trimmedResponse.substring(4);
            }
            return trimmedResponse;
        }).filter(response => response.length > 20); // Filter out effectively empty responses

        // Aggregate and return the cumulative response
        const cumulativeResponse = filteredResponses.join(",\n"); // Combine responses with commas for valid JSON array
        console.log("Cumulative Response:", cumulativeResponse);
        return cumulativeResponse;
    } catch (error) {
        console.error("Error in handling VenVeo conversation:", error);
        return "An error occurred while processing your request.";
    }
}