import { createContext, useContext } from 'react';
import type { AppState, Workspace } from '../../shared/schema';
let activeAccount: string | undefined;
export function setActiveAccount(id?: string) {
  activeAccount = id;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(activeAccount ? { 'X-Surplus-User': activeAccount } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response
    .json()
    .catch(() => ({ error: 'The local API is unavailable. Start the app with npm run dev.' }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('surplus-session-expired'));
    throw new Error(result.error || 'This change could not be saved.');
  }
  return result as T;
}
export interface AppContextValue {
  demo?: boolean;
  state: AppState;
  w: Workspace;
  save: (w: Workspace, message?: string) => Promise<void>;
  refresh: (s: AppState) => void;
  notify: (text: string, error?: boolean) => void;
  navigate: (page: string) => void;
  busy: boolean;
  edit: () => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('Missing application context');
  return context;
}
export const uid = () => crypto.randomUUID();
