import express from 'express';
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize PocketBase client with the URL from environment variables
const pb = new PocketBase(process.env.POCKETBASE_URL); // Use the PocketBase URL from .env

const app = express();
const port = 3000;

// Middleware to handle JSON data
app.use(express.json());
app.use(express.static(join(__dirname, 'webpages'))); // Serve static HTML files

// Admin authentication route
app.post('/api/auth', (req, res) => {
    const { username, password } = req.body;

    // Check if the provided credentials match those in the environment variables
    if (username === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        // If authentication is successful, respond with a success message
        return res.status(200).json({ message: 'Authentication successful' });
    }

    // If authentication fails
    return res.status(403).json({ error: 'Unauthorized' });
});

// Fetch posts function (should be async)
async function fetchPosts() {
    try {
        const posts = await pb.collection('posts').getFullList({
            sort: '-created', // Sort by creation date (optional)
        });

        const filteredPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            md: post.md,
            created: new Date(post.created).toISOString().split('T')[0], // Convert to YYYY-MM-DD
        }));

        return filteredPosts; // Return as JSON object
    } catch (error) {
        console.error('Error fetching posts:', error);
        return { error: 'Error fetching posts' };
    }
}

// Route for fetching posts
app.get('/api/thread', async (req, res) => {
    const posts = await fetchPosts();
    res.json(posts); // Use res.json to send JSON response
});
// Add this new route to your existing code
app.get('/api/post/:id', async (req, res) => {
    const postId = req.params.id; // Extract the post ID from the request parameters

    try {
        // Fetch the post data from PocketBase
        const post = await pb.collection('posts').getOne(postId);

        // Prepare the post data to be sent in the response
        const postData = {
            id: post.id,
            title: post.title,
            md: post.md,
            date: new Date(post.created).toISOString().split('T')[0], // Format the date as YYYY-MM-DD
        };

        // Send the post data as JSON response
        res.status(200).json(postData);
    } catch (error) {
        console.error('Error fetching post:', error);

        // Handle cases where the post is not found or other errors occur
        if (error.status === 404) {
            res.status(404).json({ error: 'Post not found' });
        } else {
            res.status(500).json({ error: 'Error fetching post' });
        }
    }
});
// Route for adding a new post (protected by authentication)
app.post('/api/add_post', async (req, res) => {
    const data = req.body;

    try {
        // Authenticate with PocketBase using the admin credentials from environment variables
        await pb.admins.authWithPassword(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

        const datam = {
            title: data.title,
            md: data.md,
        };

        // Create the new post in the 'posts' collection
        const record = await pb.collection('posts').create(datam);

        // Send a success response back to the client
        res.status(200).json({ message: 'Post successfully added!', data: record });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Error creating post' });
    }
});

// Routes for your admin and other pages
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'webpages', 'index.html'));
});

app.get('/blog', (req, res) => {
    res.sendFile(join(__dirname, 'webpages', 'blog.html'));
});

app.get('/post/:id', (req, res) => {
    res.sendFile(join(__dirname, 'webpages', 'post.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'webpages', 'admin.html'));
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});