// Vercel serverless entry point for /api/gog/* routes.
import { createApp } from './_create-app.js';
import { gogRouter } from './_gog-routes.js';

export default createApp('/api/gog', gogRouter);
