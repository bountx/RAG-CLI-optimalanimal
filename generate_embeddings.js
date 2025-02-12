// generate_embeddings.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate an embedding using OpenAI
async function generateEmbedding(text) {
    const truncatedText = text.slice(0, 8000); // Ensure text isn't too long
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: truncatedText,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

// Fetch all articles from the 'animals' table and update them with OpenAI embeddings
async function updateArticleEmbeddings() {
    const { data: articles, error } = await supabase.from('animals').select('id, article');

    if (error) {
        console.error('Error fetching articles:', error);
        return;
    }

    for (const article of articles) {
        console.log(`Generating embedding for article ID: ${article.id}`);
        const embedding = await generateEmbedding(article.article);

        // Update the database with the generated embedding in the new column
        const { error: updateError } = await supabase
            .from('animals')
            .update({ article_openai_embedding: embedding })
            .eq('id', article.id);

        if (updateError) {
            console.error(`Error updating embedding for article ID: ${article.id}`, updateError);
        } else {
            console.log(`Successfully updated embedding for article ID: ${article.id}`);
        }
    }

    console.log('All articles updated with OpenAI embeddings!');
}

// Run the update function
updateArticleEmbeddings();
