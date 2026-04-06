import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { steamRouter } from '../../api/_steam-routes.js';
import { epicRouter } from '../../api/_epic-routes.js';
import { gogRouter } from '../../api/_gog-routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api/steam', steamRouter);
app.use('/api/epic', epicRouter);
app.use('/api/gog', gogRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Global error handler — catches anything that escapes a route's try/catch.
// Must have exactly 4 parameters for Express to recognise it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Backend] Unhandled error:', err?.name, err?.message, err?.stack);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      detail: err?.message ?? String(err),
    });
  }
});

export default app;
