import { LogOut } from 'lucide-react';
import { useAuth } from './AuthGate';

export function LogoutButton() {
  const { logout, loggingOut } = useAuth();
  return (
    <button className="logout-button" disabled={loggingOut} onClick={() => void logout()}>
      <LogOut size={16} />
      {loggingOut ? 'Logging out…' : 'Log out'}
    </button>
  );
}
