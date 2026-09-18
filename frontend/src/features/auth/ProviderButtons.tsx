import { FcGoogle } from 'react-icons/fc';
import { FaMicrosoft } from 'react-icons/fa6';
import { LoaderCircle } from 'lucide-react';
import type { ProviderId, SignInMethods } from '../../../../shared/auth';
import { useState } from 'react';
import { api } from '../../lib';

export function ProviderIcon({ provider }: { provider: ProviderId }) {
  return provider === 'google' ? (
    <FcGoogle aria-hidden size={20} />
  ) : (
    <FaMicrosoft aria-hidden size={18} color="#586f63" />
  );
}
export function ProviderButtons({
  methods,
  intent = 'login',
  onError,
}: {
  methods: SignInMethods | null;
  intent?: 'login' | 'link';
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<ProviderId | null>(null);
  return (
    <div className="auth-providers">
      {(['google', 'microsoft'] as const).map((id) => {
        const provider = methods?.providers.find((p) => p.id === id);
        const available = !!provider?.available;
        const name = provider?.name || id[0].toUpperCase() + id.slice(1);
        return (
          <button
            key={id}
            className={`provider-button provider-${id}`}
            type="button"
            disabled={!!busy || !available}
            title={
              available
                ? `${intent === 'link' ? 'Connect' : 'Continue with'} ${name}`
                : `${name} sign-in is not configured yet`
            }
            onClick={async () => {
              setBusy(id);
              onError('');
              try {
                const { url } = await api<{ url: string }>(`/auth/oauth/${id}/start`, 'POST', {
                  intent,
                });
                window.location.assign(url);
              } catch (e) {
                onError((e as Error).message);
                setBusy(null);
              }
            }}
          >
            {busy === id ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <ProviderIcon provider={id} />
            )}
            <span>{intent === 'link' ? `Connect ${name}` : `Continue with ${name}`}</span>
            {!available && <small>{methods ? 'Not enabled' : 'Checking'}</small>}
          </button>
        );
      })}
    </div>
  );
}
