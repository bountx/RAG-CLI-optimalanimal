// cli.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createInterface } from 'readline';
import ora from 'ora';

dotenv.config();

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Create readline interface
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to generate an embedding using OpenAI
async function generateEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
}

// Function to find similar content using Supabase RPC call
async function findSimilarContent(embedding) {
    const { data: articles, error } = await supabase
        .rpc('match_articles_openai', {
            query_embedding: embedding,
            match_threshold: 0.5, // Adjust as needed
            match_count: 5 // Top 5 matches
        });

    if (error) {
        console.error('Error finding similar content:', error);
        return [];
    }
    return articles;
}

async function chat() {
    console.log('Welcome to the Animal Knowledge Base CLI! Type "exit" to quit.\n');

    // System prompt for the chat session
    const systemPrompt = "You are a helpful assistant that answers questions about animals. Please keep your responses concise and factual. Use ONLY the context provided to answer the question.";

    while (true) {
        const question = await new Promise((resolve) => {
            rl.question('You: ', resolve);
        });

        if (question.toLowerCase() === 'exit') {
            break;
        }

        const spinner = ora('Thinking...').start();

        try {
            // Generate embedding for the question
            const questionEmbedding = await generateEmbedding(question);

            // Find relevant articles from your database
            const relevantArticles = await findSimilarContent(questionEmbedding);

            if (relevantArticles.length === 0) {
                spinner.stop();
                console.log('\nAI: I don\'t have enough relevant information to answer that question.\n');
                continue;
            }

            // Combine the content of the matched articles into one context string
            const context = relevantArticles
                .map(article => article.content)
                .join('\n\n');

            // Construct the prompt using the retrieved context and user question
            const prompt = `Use ONLY the following information to answer the question. If you cannot answer based on this information, say so.

Context: ${context}

Question: ${question}`;

            // Call OpenAI ChatCompletion API
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
            });

            spinner.stop();
            console.log('\nAI:', completion.choices[0].message.content, '\n');
        } catch (error) {
            spinner.stop();
            console.error('Error:', error.message);
        }
    }

    rl.close();
    console.log('Goodbye!');
}

// Start the chat
chat();
