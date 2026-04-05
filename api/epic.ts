// Vercel serverless entry point for /api/epic/* routes.
import { createApp } from './_create-app.js';
import { epicRouter } from './_epic-routes.js';

export default createApp('/api/epic', epicRouter);
