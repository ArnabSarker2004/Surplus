import { Router } from 'express';
import { credentialsSchema } from '../../../shared/auth';
import { clearSessionCookie, sessionToken, setSessionCookie } from '../middleware/auth-session';
import type { AuthPort } from '../services/auth-port';

export function authRoutes(auth: AuthPort) {
  const router = Router();
  router.get('/session', async (req, res) => res.json(await auth.status(sessionToken(req))));
  for (const route of ['setup', 'register', 'login'] as const) {
    router.post(`/${route}`, async (req, res) => {
      const { username, password } = credentialsSchema.parse(req.body);
      const token = await auth.authenticate(
        username,
        password,
        route !== 'login',
        sessionToken(req),
      );
      setSessionCookie(req, res, token);
      res.status(route !== 'login' ? 201 : 200).json(await auth.status(token));
    });
  }
  router.post('/logout', async (req, res) => {
    await auth.logout(sessionToken(req));
    clearSessionCookie(req, res);
    res.json(await auth.status(null));
  });
  return router;
}
