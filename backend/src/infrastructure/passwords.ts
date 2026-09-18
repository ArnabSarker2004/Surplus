import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface PasswordHash {
  salt: string;
  hash: string;
}
// OWASP scrypt configuration; async work runs off the event loop.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: (await derive(password, salt)).toString('hex') };
}
export async function verifyPassword(password: string, saved: PasswordHash) {
  const actual = await derive(password, saved.salt);
  const expected = Buffer.from(saved.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
