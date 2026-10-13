'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { refreshSession, request, setAccessToken } from './api';
import type { AuthResponse, User } from './types';

interface SessionValue {
  /** `undefined` while the initial refresh is in flight. */
  user: User | null | undefined;
  signIn: (res: AuthResponse) => void;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);
  const qc = useQueryClient();

  useEffect(() => {
    // A reload loses the in-memory access token; the refresh cookie restores it.
    let cancelled = false;
    void refreshSession().then((res) => {
      if (!cancelled) setUserState(res?.user ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setUserState(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await request<void>('POST', '/auth/logout', { noRetry: true });
    } catch {
      // Already signed out server-side; clear locally regardless.
    }
    setAccessToken(null);
    setUserState(null);
    qc.clear();
  }, [qc]);

  const value = useMemo<SessionValue>(() => ({ user, signIn, signOut, setUser: setUserState }), [user, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
