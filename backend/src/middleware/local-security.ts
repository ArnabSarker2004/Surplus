import type { NextFunction, Request, Response } from 'express';
/** Local Host allowlist + Origin/content-type checks; no cross-origin CORS grant. */
export function localSecurity(req: Request, res: Response, next: NextFunction) {
  const configuredOrigin = process.env.AUTH_PUBLIC_ORIGIN
    ? new URL(process.env.AUTH_PUBLIC_ORIGIN)
    : null;
  const callback =
    req.method === 'GET' && /^\/api\/auth\/oauth\/(google|microsoft)\/callback$/.test(req.path);
  const publicNavigation =
    req.method === 'GET' &&
    !req.path.startsWith('/api/') &&
    req.get('sec-fetch-mode') === 'navigate' &&
    req.get('sec-fetch-dest') === 'document';
  if (req.get('sec-fetch-site') === 'cross-site' && !callback && !publicNavigation)
    return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
  if (
    ![
      'localhost',
      '127.0.0.1',
      '[::1]',
      ...(configuredOrigin ? [configuredOrigin.hostname] : []),
    ].includes(req.hostname)
  )
    return res.status(403).json({ error: 'This app is available on localhost only.' });
  const origin = req.get('origin');
  if (origin && !callback) {
    try {
      const url = new URL(origin);
      if (
        url.origin !== configuredOrigin?.origin &&
        (!['http:', 'https:'].includes(url.protocol) ||
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
          !['5173', process.env.PORT || '3001'].includes(url.port))
      )
        return res.status(403).json({ error: 'Origin is not allowed.' });
    } catch {
      return res.status(403).json({ error: 'Origin is not allowed.' });
    }
  }
  if (!callback && ['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json'))
    return res.status(415).json({ error: 'Use application/json.' });
  res.setHeader('Cache-Control', 'no-store');
  next();
}
