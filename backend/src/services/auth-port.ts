import type { AuthService } from './auth-service';

/** HTTP adapters support both local and asynchronous database authentication. */
export type AuthPort = {
  [K in keyof AuthService]: AuthService[K] extends (...args: infer A) => infer R
    ? (...args: A) => R | Promise<Awaited<R>>
    : AuthService[K];
};
