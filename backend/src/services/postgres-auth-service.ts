import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type pg from 'pg';
import type { AuthStatus, LinkedMethods } from '../../../shared/auth';
import type { Identity } from '../repositories/auth-repository';
import { hashPassword, verifyPassword, type PasswordHash } from '../infrastructure/passwords';
import { transaction } from '../infrastructure/postgres';
import { AuthError, SESSION_IDLE_MS, SESSION_MAX_MS } from './auth-service';
import type { AuthPort } from './auth-port';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
interface User {
  id: string;
  username: string;
  password: PasswordHash | null;
  email: string | null;
}

/** Custom authentication backed by PostgreSQL; Supabase Auth is not required. */
export class PostgresAuthService implements AuthPort {
  private attempts = new Map<string, number[]>();
  private hashing = false;
  constructor(
    private pool: pg.Pool,
    private key: Buffer,
  ) {}

  private subject(token: string | null) {
    if (!token) return null;
    try {
      const claims = jwt.verify(token, this.key, {
        algorithms: ['HS256'],
        issuer: 'surplus',
        audience: 'surplus-api',
      });
      return typeof claims !== 'string' &&
        typeof claims.sub === 'string' &&
        /^[0-9a-f-]{36}$/.test(claims.sub)
        ? claims.sub
        : null;
    } catch {
      return null;
    }
  }
  private async session(client: pg.Pool | pg.PoolClient, token: string | null) {
    const id = this.subject(token);
    if (!id || !token) return null;
    const result = await client.query<User & { created_at: Date; last_seen: Date }>(
      `SELECT u.*, s.created_at, s.last_seen FROM surplus_auth.sessions s
       JOIN surplus_auth.users u ON u.id=s.user_id WHERE s.hash=$1 AND u.id=$2
       AND s.created_at > now() - ($3 * interval '1 millisecond')
       AND s.last_seen > now() - ($4 * interval '1 millisecond')`,
      [digest(token), id, SESSION_MAX_MS, SESSION_IDLE_MS],
    );
    return result.rows[0] || null;
  }
  async status(token: string | null, touch = false): Promise<AuthStatus> {
    const user = await this.session(this.pool, token);
    if (user && touch && Date.now() - user.last_seen.getTime() >= 60_000)
      await this.pool.query('UPDATE surplus_auth.sessions SET last_seen=now() WHERE hash=$1', [
        digest(token!),
      ]);
    return {
      setupRequired: false,
      registrationOpen: true,
      user: user ? { id: user.id, username: user.username } : null,
    };
  }
  private async issue(client: pg.PoolClient, id: string, oldToken: string | null) {
    const token = jwt.sign({}, this.key, {
      algorithm: 'HS256',
      issuer: 'surplus',
      audience: 'surplus-api',
      subject: id,
      jwtid: randomBytes(32).toString('hex'),
      expiresIn: SESSION_MAX_MS / 1000,
    });
    // Serialize per-account session pruning across server instances.
    await client.query('SELECT id FROM surplus_auth.users WHERE id=$1 FOR UPDATE', [id]);
    if (oldToken)
      await client.query('DELETE FROM surplus_auth.sessions WHERE hash=$1', [digest(oldToken)]);
    await client.query(
      `DELETE FROM surplus_auth.sessions WHERE user_id=$1 AND (created_at <= now() - interval '7 days' OR last_seen <= now() - interval '30 minutes')`,
      [id],
    );
    await client.query(
      `DELETE FROM surplus_auth.sessions WHERE hash IN (SELECT hash FROM surplus_auth.sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 9)`,
      [id],
    );
    await client.query('INSERT INTO surplus_auth.sessions(hash,user_id) VALUES($1,$2)', [
      digest(token),
      id,
    ]);
    return token;
  }
  async authenticate(username: string, password: string, setup: boolean, oldToken: string | null) {
    const cutoff = Date.now() - 15 * 60_000;
    for (const [name, values] of this.attempts) {
      const recent = values.filter((at) => at > cutoff);
      if (recent.length) this.attempts.set(name, recent);
      else this.attempts.delete(name);
    }
    const attempts = this.attempts.get(username) || [];
    if (this.hashing || attempts.length >= 5 || this.attempts.size >= 1000)
      throw new AuthError('Too many sign-in attempts. Try again later.', 429);
    this.attempts.set(username, [...attempts, Date.now()]);
    this.hashing = true;
    try {
      let id: string;
      let hashed: PasswordHash | undefined;
      if (setup) {
        id = randomUUID();
        hashed = await hashPassword(password);
      } else {
        const result = await this.pool.query<User>(
          'SELECT * FROM surplus_auth.users WHERE username=$1',
          [username],
        );
        const user = result.rows[0];
        // Unknown accounts still perform the same expensive derivation.
        const correct = user?.password
          ? await verifyPassword(password, user.password)
          : (await hashPassword(password), false);
        if (!user || !correct) throw new AuthError('Username or password is incorrect.', 401);
        id = user.id;
      }
      const token = await transaction(this.pool, async (client) => {
        if (setup) {
          await client.query(
            'INSERT INTO surplus_auth.users(id,username,password) VALUES($1,$2,$3)',
            [id, username, hashed],
          );
          await client.query('INSERT INTO surplus.workspaces(user_id) VALUES($1)', [id]);
        }
        return this.issue(client, id, oldToken);
      });
      this.attempts.delete(username);
      return token;
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new AuthError('That username is unavailable. Choose another or sign in.', 409);
      throw error;
    } finally {
      this.hashing = false;
    }
  }
  async logout(token: string | null) {
    if (token)
      await this.pool.query('DELETE FROM surplus_auth.sessions WHERE hash=$1', [digest(token)]);
  }
  async requireRecent(token: string | null) {
    const user = await this.session(this.pool, token);
    if (!user || Date.now() - user.created_at.getTime() > 5 * 60_000)
      throw new AuthError('Sign out and sign in again before changing sign-in methods.', 403);
  }
  async methods(token?: string | null): Promise<LinkedMethods> {
    const user = await this.session(this.pool, token || null);
    if (!user) return { identities: [], email: null, password: false };
    const identities = await this.pool.query<Identity>(
      'SELECT provider,label FROM surplus_auth.identities WHERE user_id=$1 ORDER BY provider',
      [user.id],
    );
    return { identities: identities.rows, email: user.email, password: !!user.password };
  }
  async completeIdentity(
    identity: Identity | { email: string },
    intent: 'login' | 'link',
    token: string | null,
  ) {
    try {
      return await transaction(this.pool, async (client) => {
        const email = 'email' in identity;
        if (intent === 'link') {
          const user = await this.session(client, token);
          if (!user || Date.now() - user.created_at.getTime() > 5 * 60_000)
            throw new AuthError('Sign out and sign in again before changing sign-in methods.', 403);
          await client.query('SELECT id FROM surplus_auth.users WHERE id=$1 FOR UPDATE', [user.id]);
          if (email)
            await client.query('UPDATE surplus_auth.users SET email=$2 WHERE id=$1', [
              user.id,
              identity.email,
            ]);
          else
            await client.query(
              `INSERT INTO surplus_auth.identities(provider,subject,user_id,label) VALUES($1,$2,$3,$4)
            ON CONFLICT(user_id,provider) DO UPDATE SET subject=excluded.subject,label=excluded.label`,
              [identity.provider, identity.subject, user.id, identity.label],
            );
          return token!;
        }
        // Two tabs can complete a first provider sign-in together. Serialize that
        // identity's lookup/create so both receive the same account.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          JSON.stringify(email ? ['email', identity.email] : [identity.provider, identity.subject]),
        ]);
        const result = email
          ? await client.query<{ id: string }>('SELECT id FROM surplus_auth.users WHERE email=$1', [
              identity.email,
            ])
          : await client.query<{ id: string }>(
              'SELECT user_id AS id FROM surplus_auth.identities WHERE provider=$1 AND subject=$2',
              [identity.provider, identity.subject],
            );
        let id = result.rows[0]?.id;
        if (!id) {
          id = randomUUID();
          // Never attach a social identity merely because its email matches a password account.
          const username = `student-${id}`;
          await client.query('INSERT INTO surplus_auth.users(id,username,email) VALUES($1,$2,$3)', [
            id,
            username,
            email ? identity.email : null,
          ]);
          await client.query('INSERT INTO surplus.workspaces(user_id) VALUES($1)', [id]);
          if (!email)
            await client.query(
              'INSERT INTO surplus_auth.identities(provider,subject,user_id,label) VALUES($1,$2,$3,$4)',
              [identity.provider, identity.subject, id, identity.label],
            );
        }
        return this.issue(client, id, token);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new AuthError(
          'This sign-in method is already connected. Sign in with it or choose another.',
          409,
        );
      throw error;
    }
  }
  async unlink(method: string, token: string | null) {
    await transaction(this.pool, async (client) => {
      const user = await this.session(client, token);
      if (!user || Date.now() - user.created_at.getTime() > 5 * 60_000)
        throw new AuthError('Sign out and sign in again before changing sign-in methods.', 403);
      const locked = await client.query<User>(
        'SELECT * FROM surplus_auth.users WHERE id=$1 FOR UPDATE',
        [user.id],
      );
      const account = locked.rows[0];
      const identities = await client.query(
        'SELECT provider FROM surplus_auth.identities WHERE user_id=$1',
        [user.id],
      );
      const remaining =
        Number(!!account.password) +
        Number(!!account.email && method !== 'email') +
        identities.rows.filter((i) => i.provider !== method).length;
      if (!remaining) throw new AuthError('Keep at least one sign-in method connected.', 409);
      if (method === 'email')
        await client.query('UPDATE surplus_auth.users SET email=NULL WHERE id=$1', [user.id]);
      else
        await client.query('DELETE FROM surplus_auth.identities WHERE user_id=$1 AND provider=$2', [
          user.id,
          method,
        ]);
    });
  }
}
