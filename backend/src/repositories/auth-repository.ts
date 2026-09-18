import type { Store } from '../infrastructure/sqlite-store';
import type { PasswordHash } from '../infrastructure/passwords';
import { randomBytes } from 'node:crypto';
import type { ProviderId } from '../../../shared/auth';

export interface Identity {
  provider: ProviderId;
  subject: string;
  label: string;
}

export interface LocalAccount {
  username: string;
  password?: PasswordHash;
  identities?: Identity[];
  email?: string;
  createdAt: number;
}
export interface Session {
  hash: string;
  createdAt: number;
  lastSeen: number;
}
export class AuthRepository {
  constructor(private readonly store: Store) {}
  account() {
    return this.store.get<LocalAccount | null>('auth.account', null);
  }
  sessions() {
    return this.store.get<Session[]>('auth.sessions', []);
  }
  create(account: LocalAccount, session: Session) {
    this.store.transaction(() => {
      if (this.account()) throw new Error('An account already exists.');
      this.store.set('auth.account', account);
      this.store.set('auth.sessions', [session]);
    });
  }
  saveSessions(sessions: Session[]) {
    this.store.transaction(() => this.store.set('auth.sessions', sessions));
  }
  saveAccount(account: LocalAccount) {
    this.store.transaction(() => this.store.set('auth.account', account));
  }
  signingKey() {
    const configured = process.env.JWT_SIGNING_KEY;
    if (configured && !/^[a-f0-9]{64}$/i.test(configured))
      throw new Error('JWT_SIGNING_KEY must be 64 hex characters.');
    let key = configured || this.store.get<string>('auth.signingKey', '');
    if (!key) {
      key = randomBytes(32).toString('hex');
      this.store.transaction(() => this.store.set('auth.signingKey', key));
    }
    return Buffer.from(key, 'hex');
  }
}
