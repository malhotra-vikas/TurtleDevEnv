// Import the Supabase library
import { createClient } from '@supabase/supabase-js';

// Supabase URL and API Key
const SUPABASE_URL = 'https://oraegslkyasvnzxdlhyo.supabase.co'; // Replace with your Supabase project URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYWVnc2xreWFzdm56eGRsaHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTg2NjczMzksImV4cCI6MjAzNDI0MzMzOX0.DrPwJgstsL403DYTEd6w3jsC2TGvn8b804shlY1xEjM'; // Replace with your Supabase public API key

// Initialize the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchDataFromTable() {
    try {
        // Replace 'table_name' with your actual table name
        const { data, error } = await supabase
            .from('project')
            .select('*') // Select all columns; adjust as needed
            .order('id', { ascending: true }); // Example: order by 'id'

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        console.log('Data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error in fetchDataFromTable:', error);
    }
}

// Call the function to fetch data
fetchDataFromTable();
