// cli.js
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import { createInterface } from 'readline';
import ora from 'ora';

dotenv.config();

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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

// Configure Gemini Pro
const modelConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
    ],
};

async function generateEmbedding(text) {
    // For Gemini, we'll use the embedTextModel
    const model = genAI.getGenerativeModel({ model: "models/text-embedding-004" });
    const result = await model.embedContent(text);
    const embedding = result.embedding;
    return embedding.values;
}

async function findSimilarContent(embedding) {
    // We'll match articles using dot product similarity
    const { data: articles, error } = await supabase
        .rpc('match_articles', {
            query_embedding: embedding,
            match_threshold: 0.5, // Adjust this threshold as needed
            match_count: 5 // Limit to top 5 matches
        });

    if (error) {
        console.error('Error finding similar content:', error);
        return [];
    }

    return articles;
}

async function chat() {
    console.log('Welcome to the Animal Knowledge Base CLI! Type "exit" to quit.\n');

    // Initialize Gemini Pro model
    const model = genAI.getGenerativeModel({ model: "gemini-pro", ...modelConfig });

    // Start a chat session
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: "You are a helpful assistant that answers questions about animals. Please keep your responses concise and factual." }],
            },
            {
                role: "model",
                parts: [{ text: "I understand. I'll act as a knowledgeable assistant focused on providing concise, factual information about animals based on the context provided." }],
            },
        ],
    });

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

            // Find relevant articles
            const relevantArticles = await findSimilarContent(questionEmbedding);

            // If no relevant content found
            if (relevantArticles.length === 0) {
                spinner.stop();
                console.log('\nAI: I don\'t have enough relevant information to answer that question.\n');
                continue;
            }

            // Prepare context from relevant articles
            const context = relevantArticles
                .map(article => article.content)
                .join('\n\n');

            // Send the question with context to Gemini
            const prompt = `Use ONLY the following information to answer the question. If you cannot answer based on this information, say so.

Context: ${context}

Question: ${question}`;

            const result = await chat.sendMessage([{ text: prompt }]);

            const response = await result.response;

            spinner.stop();
            console.log('\nAI:', response.text(), '\n');

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