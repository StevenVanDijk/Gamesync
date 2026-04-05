// Vercel serverless entry point for /api/epic/* routes.
import { createApp } from './_create-app';
import { epicRouter } from './_epic-routes';

export default createApp('/api/epic', epicRouter);
