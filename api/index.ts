// Vercel serverless function handler
// This file is used by Vercel to handle all requests
// Import the Express app from the server
// The app initialization starts when the module is imported
import app from "../server/index";

// Export the app as the default handler for Vercel
// Vercel will invoke this handler for all requests matching the rewrite rules
export default app;

