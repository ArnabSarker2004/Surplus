import type { Request, RequestHandler, Response } from 'express';
import { SESSION_MAX_MS } from '../services/auth-service';

import type { AuthPort } from '../services/auth-port';

export const SESSION_COOKIE = 'surplus_session';
export function sessionToken(req: Request): string | null {
  const value = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return value &&
    value.length < 2048 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    ? value
    : null;
}
export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || process.env.AUTH_PUBLIC_ORIGIN?.startsWith('https:') === true,
    path: '/',
    maxAge: SESSION_MAX_MS,
  });
}
export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || process.env.AUTH_PUBLIC_ORIGIN?.startsWith('https:') === true,
    path: '/',
  });
}
export function requireSession(auth: AuthPort): RequestHandler {
  return async (req, res, next) => {
    const status = await auth.status(sessionToken(req), true);
    if (!status.user) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Sign in to access your saved plan.' });
    }
    if (req.headers['x-surplus-user'] && req.headers['x-surplus-user'] !== status.user.id)
      return res
        .status(401)
        .json({ error: 'The account changed in another tab. Reload to continue.' });
    res.locals.user = status.user;
    next();
  };
}
