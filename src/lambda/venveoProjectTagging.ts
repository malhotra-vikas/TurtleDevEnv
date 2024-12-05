import AWS = require('aws-sdk');
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Context, Callback } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';

import * as Constants from '../utils/constants';
import { stat } from 'fs';

AWS.config.update({ region: Constants.AWS_REGION });

const gptModel = "gpt-4o-mini"
const embeddingModel = "text-embedding-ada-002";

// Initialize OpenAI client
const configuration = new Configuration({
    apiKey: process.env.VENVEO_OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

const createTagsEmbeddingInSupabase = async (id: string, project_tags: string[]): Promise<boolean> => {
    // Validate environment variables
    if (!process.env.VENVEO_SUPABASE_URL || !process.env.VENVEO_SUPABASE_KEY) {
        throw new Error('Supabase environment variables are not set.');
    }

    // Initialize Supabase client
    const supabase = createClient(
        process.env.VENVEO_SUPABASE_URL as string,
        process.env.VENVEO_SUPABASE_KEY as string
    );

    console.log("project_tags that i will store in supa_Base are ", project_tags)
    try {

        const embeddingResponse = await openai.createEmbedding({
            model: embeddingModel,
            input: `${id}: ${project_tags}`,
        });
        const embedding = embeddingResponse.data.data[0].embedding;

        // Update the tags for the given project ID
        const { error } = await supabase
            .from('project_embeddings')
            .insert({ 
                project_id: id,
                project_tags: project_tags,
                embedding: embedding,
                updated_at: new Date().toISOString(), // Set the updated_at to the current timestamp
            }) 
            .eq('id', id);

        if (error) {
            console.error(`Error inserting embedding tags for project ID: ${id}`, error);
            return false;
        }

        console.log(`Successfully inserting embedding tags for project ID: ${id}`);
        return true;
    } catch (err) {
        console.error(`Unexpected error inserting embedding tags for project ID: ${id}`, err);
        return false;
    }
};

const updateTagsInSupabase = async (id: string, project_tags: string[]): Promise<boolean> => {
    // Validate environment variables
    if (!process.env.VENVEO_SUPABASE_URL || !process.env.VENVEO_SUPABASE_KEY) {
        throw new Error('Supabase environment variables are not set.');
    }

    // Initialize Supabase client
    const supabase = createClient(
        process.env.VENVEO_SUPABASE_URL as string,
        process.env.VENVEO_SUPABASE_KEY as string
    );

    console.log("project_tags that i will store in supa_Base are ", project_tags)
    try {
        // Update the tags for the given project ID
        const { error } = await supabase
            .from('project')
            .update({ 
                project_tags: project_tags,
                updated_at: new Date().toISOString(), // Set the updated_at to the current timestamp
            }) 
            .eq('id', id);

        if (error) {
            console.error(`Error updating tags for project ID: ${id}`, error);
            return false;
        }

        console.log(`Successfully updated tags for project ID: ${id}`);
        return true;
    } catch (err) {
        console.error(`Unexpected error updating tags for project ID: ${id}`, err);
        return false;
    }
};


const generateTagsWithOpenAI = async (description: string | null, type: string | null, permit_category: string | null, fileDate: string | null, city: string | null, county: string | null, state: string | null, zip: string | null, contact_id: string | null): Promise<string[]> => {

    if (permit_category === 'Other') {
        permit_category = ""
    }
    if (!permit_category) {
        permit_category = ""
    }
    if (!fileDate) {
        fileDate = ""
    }
    if (!city) {
        city = ""
    } 
    if (!state) {
        state = ""
    } 
    if (!county) {
        county = ""
    } 
    if (!zip) {
        zip = ""
    } 
    if (!contact_id) {
        contact_id = ""
    }
    console.log("Lets gen Tags - 2")

    const prompt = `
  Generate 15-20 comma saperated, descriptive tags for the following project: 
  Project Description: ${description || "No description provided"}
  Project Type: ${type || "No type provided"}
  Project Permit Category: ${permit_category || "No type provided"}
  Project Address: ${county} ${city} ${state} ${zip}
  Contact ID: ${contact_id}
  Project Start Date: ${fileDate}
  
  Tags should be relevant, concise, and describe what the project is all about. Tags should include the project location, Month and Year of Start Date in month-year format and Contact ID. Tags:
  `;


    try {
        console.log("Prompt Raw:", prompt);

        console.log("Prompt length (characters):", prompt.length);
        console.log("Before OpenAI API Call:", new Date().toISOString());

        let chatMessages: { role: 'system' | 'user', content: string }[] = [{
            role: "system",
            content: "You are a helpful assistant."
        }];
        chatMessages.push({ role: 'user', content: prompt });

        const response = await openai.createChatCompletion({
            model: gptModel,
            messages: chatMessages,
            max_tokens: 1000,
        });
        console.log("After OpenAI API Call:", new Date().toISOString());

        console.log("OPen AI Resposne", response)

        let messageContent

        // Check if the choices array and the text are not undefined
        if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
            messageContent = response.data.choices[0].message.content.trim();
        } else {
            throw new Error("No completion found or completion was empty.");
        }

        if (!messageContent) {
            console.warn('No content in OpenAI response.');
            return []; // Return an empty array if content is missing
        }

        // Process the tags from the content
        const tags = messageContent
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

        return tags;

    } catch (error) {
        console.error('Error generating tags with OpenAI:', error);
        return [];
    }
};

export async function venveoProjectTaggingHandler(
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback
): Promise<APIGatewayProxyResult> {

    let response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'content-type': 'application/json'
        },
        isBase64Encoded: false,
        body: ''
    }

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
            .select('id, permit_category, contact_id, email, description, type, fileDate, address_state, address_city, address_county, address_zip')
            .is('project_tags', null)  // Ensure project_tags is null
            .not('type', 'is', null)
            .not('description', 'is', null)
            .range(0, 39);

        console.log('Raw Supabase response:', { projects, error });

        if (error) {
            console.error('Error fetching projects from Supabase:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Error fetching data from Supabase' }),
            };
        }

        if (!projects || projects.length === 0) {
            console.warn('No projects found.');
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No projects found.' }),
            };
        }

        console.log('SUPABASE Project data:', projects);

        // Generate tags for each project sequentially
        const results = [];
        for (const project of projects) {
            try {
                // Generate tags for the current project
                const tags = await generateTagsWithOpenAI(
                    project.description,
                    project.type,
                    project.permit_category,
                    project.fileDate,
                    project.address_city,
                    project.address_county,
                    project.address_state,
                    project.address_zip,
                    project.contact_id

                );

                // Create the project tags object
                const projectTags = {
                    id: project.id,
                    tags,
                };

                // Update tags in Supabase
                const success = await updateTagsInSupabase(project.id, tags);

                if (success) {
                    console.log(`Updated tags for project ID: ${project.id}`);
                    results.push({ id: project.id, tags });
                } else {
                    console.error(`Failed to update tags for project ID: ${project.id}`);
                }

                console.log('Generated tags for project:', projectTags);
                const runningWithEmbedding = process.env.VENVEO_EMBEDDING_ON

                if (runningWithEmbedding) {
                    // Create Embedding for tags in Supabase
                    const embeddingSuccess = await createTagsEmbeddingInSupabase(project.id, tags);

                    if (embeddingSuccess) {
                        console.log(`Embedding tags for project ID: ${project.id}`);
                        results.push({ id: project.id, tags });
                    } else {
                        console.error(`Failed to Embedd tags for project ID: ${project.id}`);
                    }
                }
                
                // Add the generated tags to the results
                results.push(projectTags);

            } catch (error) {
                console.error(`Error generating tags for project ID: ${project.id}`, error);
                // Optionally, handle the error (e.g., continue to the next project)
            }
        }

        // Beautify the JSON string with indentation (2 spaces)
        const beautifiedBody = JSON.stringify({ results }, null, 2)
        response.body = beautifiedBody
        console.log("Response from create Lambda", JSON.stringify(response))

        return response



    } catch (err) {
        console.error('Error processing Lambda function:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
