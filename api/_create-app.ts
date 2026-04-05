import express, { NextFunction, Request, Response, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function createApp(prefix: string, router: Router) {
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
    }),
  );

  app.use(prefix, router);

  // Global error handler — must have exactly 4 params for Express to recognise it.
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

  return app;
}
