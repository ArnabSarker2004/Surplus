import { test as base, expect } from '@playwright/test';

export const testCredentials = {
  username: 'browser-test',
  password: 'test-only-browser-passphrase',
};
export const test = base.extend<{ authenticated: void }>({
  request: async ({ context }, use) => {
    await use(context.request);
  },
  authenticated: [
    async ({ request }, use) => {
      const status = await (await request.get('/api/auth/session')).json();
      const response = await request.post(`/api/auth/${status.setupRequired ? 'setup' : 'login'}`, {
        data: testCredentials,
      });
      expect(response.ok()).toBeTruthy();
      await use();
    },
    { auto: true },
  ],
});
export { expect };
