import { z } from 'zod';

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_.-]+$/, 'Use letters, numbers, dots, underscores or hyphens.'),
  password: z
    .string()
    .min(12, 'Use at least 12 characters.')
    .max(128, 'Use at most 128 characters.'),
});
export interface AuthStatus {
  setupRequired: boolean;
  registrationOpen?: boolean;
  user: { username: string; id?: string } | null;
}
export const providerSchema = z.enum(['google', 'microsoft']);
export type ProviderId = z.infer<typeof providerSchema>;
export interface SignInMethods {
  providers: { id: ProviderId; name: string; available: boolean }[];
  email: boolean;
}
export interface LinkedMethods {
  identities: { provider: ProviderId; label: string }[];
  email: string | null;
  password: boolean;
}
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
