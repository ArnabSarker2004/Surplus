import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthStatus } from '../../../shared/auth';
import { hashPassword, verifyPassword } from '../infrastructure/passwords';
import type { AuthRepository, Identity, Session } from '../repositories/auth-repository';

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class AuthService {
  private readonly key: Buffer;
  private attempts: number[] = [];
  private working = false;
  constructor(
    private readonly repository: AuthRepository,
    private readonly now = () => Date.now(),
  ) {
    this.key = repository.signingKey();
  }
  private valid(session: Session) {
    const now = this.now();
    return now - session.lastSeen < SESSION_IDLE_MS && now - session.createdAt < SESSION_MAX_MS;
  }
  private newSession() {
    const token = jwt.sign({ iat: Math.floor(this.now() / 1000) }, this.key, {
      algorithm: 'HS256',
      issuer: 'surplus',
      audience: 'surplus-api',
      subject: 'workspace-owner',
      jwtid: randomBytes(32).toString('hex'),
      expiresIn: SESSION_MAX_MS / 1000,
    });
    return {
      token,
      session: { hash: tokenHash(token), createdAt: this.now(), lastSeen: this.now() },
    };
  }
  status(token: string | null, touch = false): AuthStatus {
    const account = this.repository.account();
    if (!account) return { setupRequired: true, user: null };
    const sessions = this.repository.sessions();
    if (token) {
      try {
        jwt.verify(token, this.key, {
          algorithms: ['HS256'],
          issuer: 'surplus',
          audience: 'surplus-api',
          subject: 'workspace-owner',
          clockTimestamp: Math.floor(this.now() / 1000),
        });
      } catch {
        token = null;
      }
    }
    const session = token
      ? sessions.find((s) => s.hash === tokenHash(token) && this.valid(s))
      : undefined;
    // Polling /session never extends idle life. Real authenticated API activity does.
    if (session && touch && this.now() - session.lastSeen >= 60_000) {
      session.lastSeen = this.now();
      this.repository.saveSessions(sessions.filter((s) => this.valid(s)));
    }
    return { setupRequired: false, user: session ? { username: account.username } : null };
  }
  async authenticate(username: string, password: string, setup: boolean, oldToken: string | null) {
    if (this.working)
      throw new AuthError('Another sign-in is in progress. Try again shortly.', 429);
    this.attempts = this.attempts.filter((at) => this.now() - at < 15 * 60_000);
    if (this.attempts.length >= 5)
      throw new AuthError('Too many attempts. Try again in 15 minutes.', 429);
    this.working = true;
    try {
      const account = this.repository.account();
      if (setup && account)
        throw new AuthError('This device already has an account. Sign in instead.', 409);
      if (!setup && !account) throw new AuthError('Create your local account first.', 409);
      this.attempts.push(this.now());
      const { token, session } = this.newSession();
      if (setup) {
        const hashed = await hashPassword(password);
        this.repository.create({ username, password: hashed, createdAt: this.now() }, session);
      } else {
        // Always derive the password before comparing usernames, keeping failures generic.
        const correct = account!.password
          ? await verifyPassword(password, account!.password)
          : false;
        if (!correct || username !== account!.username)
          throw new AuthError('Username or password is incorrect.', 401);
        this.repository.saveSessions([
          ...this.repository
            .sessions()
            .filter((s) => this.valid(s) && (!oldToken || s.hash !== tokenHash(oldToken)))
            .slice(-9),
          session,
        ]);
      }
      this.attempts = [];
      return token;
    } finally {
      this.working = false;
    }
  }
  logout(token: string | null) {
    if (!token) return;
    this.repository.saveSessions(
      this.repository.sessions().filter((s) => s.hash !== tokenHash(token) && this.valid(s)),
    );
  }
  requireRecent(token: string | null) {
    const session = this.repository.sessions().find((s) => token && s.hash === tokenHash(token));
    if (!this.status(token).user || !session || this.now() - session.createdAt > 5 * 60_000)
      throw new AuthError('Sign out and sign in again before changing sign-in methods.', 403);
  }
  methods(_token?: string | null) {
    const account = this.repository.account();
    return {
      identities: (account?.identities || []).map(({ provider, label }) => ({ provider, label })),
      email: account?.email || null,
      password: !!account?.password,
    };
  }
  completeIdentity(
    identity: Identity | { email: string },
    intent: 'login' | 'link',
    token: string | null,
  ) {
    const account = this.repository.account();
    const isEmail = 'email' in identity;
    const matches =
      account &&
      (isEmail
        ? account.email === identity.email
        : account.identities?.some(
            (i) => i.provider === identity.provider && i.subject === identity.subject,
          ));
    if (intent === 'link') {
      this.requireRecent(token);
      if (!account) throw new AuthError('Sign in first.', 401);
      if (isEmail) account.email = identity.email;
      else
        account.identities = [
          ...(account.identities || []).filter((i) => i.provider !== identity.provider),
          identity,
        ];
      this.repository.saveAccount(account);
      return token!;
    }
    if (account && !matches)
      throw new AuthError(
        'This sign-in method is not linked. Sign in with your existing method, then connect it in Settings.',
        403,
      );
    const next = this.newSession();
    if (!account)
      this.repository.create(
        {
          username: isEmail ? identity.email : identity.label,
          createdAt: this.now(),
          ...(isEmail ? { email: identity.email } : { identities: [identity] }),
        },
        next.session,
      );
    else
      this.repository.saveSessions([
        ...this.repository
          .sessions()
          .filter((s) => this.valid(s) && (!token || s.hash !== tokenHash(token)))
          .slice(-9),
        next.session,
      ]);
    return next.token;
  }
  unlink(method: string, token: string | null) {
    this.requireRecent(token);
    const account = this.repository.account()!;
    const remaining =
      (account.password ? 1 : 0) +
      (account.email && method !== 'email' ? 1 : 0) +
      (account.identities || []).filter((i) => i.provider !== method).length;
    if (!remaining) throw new AuthError('Keep at least one sign-in method connected.', 409);
    if (method === 'email') delete account.email;
    else account.identities = (account.identities || []).filter((i) => i.provider !== method);
    this.repository.saveAccount(account);
  }
}
