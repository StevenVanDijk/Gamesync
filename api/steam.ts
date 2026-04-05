// Vercel serverless entry point for /api/steam/* routes.
import { createApp } from './_create-app';
import { steamRouter } from './_steam-routes';

export default createApp('/api/steam', steamRouter);
