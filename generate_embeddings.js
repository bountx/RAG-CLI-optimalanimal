import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateEmbedding(text) {
    const MAX_TOKENS = 2000; // Limit text size to prevent API errors
    const truncatedText = text.slice(0, 8000); // Safe character limit

    const model = genAI.getGenerativeModel({ model: "models/text-embedding-004" }); // Use correct model
    const result = await model.embedContent(truncatedText);
    return result.embedding.values;
}


// Fetch all articles and update them with embeddings
async function updateArticleEmbeddings() {
    const { data: articles, error } = await supabase.from('animals').select('id, article');

    if (error) {
        console.error('Error fetching articles:', error);
        return;
    }

    for (const article of articles) {
        console.log(`Generating embedding for article ID: ${article.id}`);

        const embedding = await generateEmbedding(article.article);

        // Update the database with the generated embedding
        const { error: updateError } = await supabase
            .from('animals')
            .update({ article_embedding: embedding })
            .eq('id', article.id);

        if (updateError) {
            console.error(`Error updating embedding for article ID: ${article.id}`, updateError);
        } else {
            console.log(`Successfully updated embedding for article ID: ${article.id}`);
        }
    }

    console.log('All articles updated with embeddings!');
}

// Run the function
updateArticleEmbeddings();
