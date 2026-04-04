// Vercel serverless entry point.
// Vercel detects this file and serves it at /api/steam (and sub-paths via vercel.json rewrites).
import app from '../backend/src/app';

export default app;
