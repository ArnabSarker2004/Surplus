import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { PlaidError } from '../integrations/plaid';
import { AuthError } from '../services/auth-service';
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  if (err instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (err instanceof PlaidError) {
    const messages: Record<string, string> = {
      NOT_CONFIGURED:
        'Bank connection is not configured for this environment yet. You can continue manually.',
      ALREADY_CONNECTED: 'Disconnect the current bank account before connecting another.',
      ITEM_LOGIN_REQUIRED: 'Reconnect your bank account to continue.',
      CONNECTION_ERROR: 'Could not reach Plaid. Please try again.',
      INVALID_ACCESS_TOKEN: 'The bank access token is invalid. Connect a new bank account.',
      NOT_CONNECTED: 'Connect a bank account first.',
      BUSY: 'A connection operation is already running.',
      TRIAL_NOT_CONFIRMED:
        'This call is disabled until the server has a current Plaid Trial plan confirmation. Normal transaction sync remains available.',
      REFRESH_COOLDOWN:
        'A bank refresh was requested recently. Wait ten minutes before requesting another.',
      MISSING_ACCESS_TOKEN: 'Set PLAID_SANDBOX_ACCESS_TOKEN in the server .env file.',
    };
    return res.status(err.code === 'BUSY' ? 409 : err.code === 'NOT_CONNECTED' ? 400 : 502).json({
      error:
        messages[err.code] ??
        'Plaid could not complete this request. Your saved plan is safe; try again or use Demo Mode.',
    });
  }
  if (err instanceof SyntaxError)
    return res.status(400).json({ error: 'Request must contain valid JSON.' });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
