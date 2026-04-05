// Vercel serverless entry point for /api/steam/* routes.
import { createApp } from './_create-app.js';
import { steamRouter } from './_steam-routes.js';

export default createApp('/api/steam', steamRouter);
