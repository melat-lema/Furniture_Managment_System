import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, setSessionEndedHandler } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { notifyError } from '../../lib/notify';
import { clearSessionHint, hasSessionHint, setSessionHint } from '../../lib/session-hint';
import type { AuthUser } from '../../types/auth';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

interface AuthResponse {
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (hasSessionHint() ? 'loading' : 'unauthenticated'));
  const userRef = useRef<AuthUser | null>(null);

  const applyUser = useCallback((next: AuthUser | null) => {
    userRef.current = next;
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  /** Clears everything about the current person (also the cached data, for shared tablets). */
  const endSession = useCallback(() => {
    applyUser(null);
    clearSessionHint();
    queryClient.clear();
  }, [applyUser, queryClient]);

  // Restore the session when the app opens.
  useEffect(() => {
    if (!hasSessionHint()) return;
    let cancelled = false;

    api
      .get<AuthResponse>('/auth/me')
      .then(({ data }) => {
        if (!cancelled) applyUser(data.user);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const apiError = toApiError(error);
        if (apiError.isNetwork || apiError.isServer) {
          // Could not reach the server: do not forget the session, just show the login screen.
          setStatus('unauthenticated');
          notifyError(apiError, 'Could not restore your session');
        } else {
          endSession();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyUser, endSession]);

  // Called by the API layer when the session ends on the server side.
  useEffect(() => {
    setSessionEndedHandler((message) => {
      const hadUser = userRef.current !== null;
      endSession();
      if (hadUser) {
        toast.warning('You have been signed out', { id: 'session-ended', description: message });
      }
    });
    return () => setSessionEndedHandler(null);
  }, [endSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
      queryClient.clear();
      applyUser(data.user);
      setSessionHint();
      return data.user;
    },
    [applyUser, queryClient],
  );

  const logout = useCallback(async (): Promise<void> => {
    let reachedServer = true;
    try {
      await api.post('/auth/logout');
    } catch {
      reachedServer = false;
    }
    endSession();
    if (reachedServer) {
      toast.success('Signed out', { description: 'See you soon.' });
    } else {
      toast.warning('Signed out on this device', {
        description: "We couldn't reach the server to end the session. It will expire on its own.",
      });
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
