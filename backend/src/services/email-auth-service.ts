import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AuthMailer } from '../integrations/auth-mail';
import { AuthError } from './auth-service';

import type { AuthPort } from './auth-port';

const hash = (text: string) => createHash('sha256').update(text).digest();
interface Challenge {
  email: string;
  hash: Buffer;
  expires: number;
  attempts: number;
  intent: 'login' | 'link';
  ownerToken: string | null;
}
export class EmailAuthService {
  private challenges = new Map<string, Challenge>();
  private sends: { at: number; email: string }[] = [];
  constructor(
    private auth: AuthPort,
    private mailer: AuthMailer,
    private now = () => Date.now(),
  ) {}
  async request(email: string, intent: 'login' | 'link', token: string | null) {
    if (intent === 'link') await this.auth.requireRecent(token);
    this.sends = this.sends.filter((s) => this.now() - s.at < 15 * 60_000);
    if (this.sends.length >= 15 || this.sends.filter((s) => s.email === email).length >= 3)
      throw new AuthError('Too many codes requested. Try again in 15 minutes.', 429);
    this.sends.push({ at: this.now(), email });
    for (const [id, c] of this.challenges)
      if (c.expires <= this.now() || c.email === email) this.challenges.delete(id);
    const id = randomBytes(32).toString('hex');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    // Generic response for unlinked addresses. No email-based implicit account linking.
    const status = await this.auth.status(null);
    const eligible =
      intent === 'link' ||
      status.registrationOpen ||
      status.setupRequired ||
      (await this.auth.methods(token)).email === email;
    this.challenges.set(id, {
      email,
      hash: hash(`${id}:${eligible ? code : randomBytes(32).toString('hex')}`),
      expires: this.now() + 10 * 60_000,
      attempts: 0,
      intent,
      ownerToken: token,
    });
    if (eligible) {
      try {
        await this.mailer.sendCode(email, code);
      } catch {
        this.challenges.delete(id);
        throw new AuthError(
          'Email could not be delivered. Please try again later or use another sign-in method.',
          503,
        );
      }
    }
    return id;
  }
  async verify(id: string | null, code: string) {
    const c = id ? this.challenges.get(id) : null;
    if (!id || !c || c.expires <= this.now() || c.attempts >= 5)
      throw new AuthError('This code has expired. Request a new one.', 400);
    c.attempts++;
    if (!timingSafeEqual(c.hash, hash(`${id}:${code}`)))
      throw new AuthError('That code is incorrect. Please try again.', 400);
    this.challenges.delete(id);
    return this.auth.completeIdentity({ email: c.email }, c.intent, c.ownerToken);
  }
}
