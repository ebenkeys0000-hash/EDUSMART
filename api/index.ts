import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/server/app.ts';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

/**
 * Normalizes Vercel rewrite URLs (`/api/index?__path=auth/register&foo=bar`)
 * back into Express API paths (`/api/auth/register?foo=bar`) without losing query params.
 */
export function normalizeVercelApiUrl(rawUrl?: string): string {
  const input = rawUrl || '/api';
  try {
    const parsed = new URL(input, 'http://localhost');
    if (parsed.searchParams.has('__path')) {
      const subPath = (parsed.searchParams.get('__path') || '').replace(/^\/+/, '');
      parsed.searchParams.delete('__path');
      const qs = parsed.searchParams.toString();
      return `/api${subPath ? `/${subPath}` : ''}${qs ? `?${qs}` : ''}`;
    }
    if (parsed.pathname === '/api/index') {
      const qs = parsed.searchParams.toString();
      return `/api${qs ? `?${qs}` : ''}`;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return input;
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    req.url = normalizeVercelApiUrl(req.url);
    const app = getApp();
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('Vercel API handler initialization error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: `Server initialization failed: ${err?.message || 'Internal error'}`,
        })
      );
    }
  }
}
