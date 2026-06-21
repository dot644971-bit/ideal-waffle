// ============================================================
// hooks/useAuth.ts — Cross-Domain Authentication Hook
// ============================================================
// Manages the full auth lifecycle:
//  1. Checks URL for ?token= (from PHP redirect after login)
//  2. Falls back to localStorage for returning visitors
//  3. Periodically verifies tokens server-side
//  4. Provides login/logout actions
//
// Usage in any 'use client' component:
//   const { isAuthenticated, user, isLoading, login, logout } = useAuth();
//
//   if (isLoading) return <LoadingSpinner />;
//   if (!isAuthenticated) return null; // redirecting to login
// ============================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  handleTokenFromUrl,
  loadAuth,
  clearAuth,
  isAuthValid,
  verifyTokenServerSide,
  decodeTokenPayload,
  payloadToUser,
  saveAuth,
  redirectToLogin,
  redirectToLogout,
  type AuthUser,
} from '@/lib/auth';

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

const SERVER_VERIFY_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useAuth(): AuthState & { login: () => void; logout: () => void; refreshUser: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
  });
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUser = useCallback(async () => {
    const { token } = loadAuth();
    if (!token) return;
    const result = await verifyTokenServerSide(token);
    if (result.valid && result.user && result.token) {
      setState({
        isAuthenticated: true,
        user: result.user,
        token: result.token,
        isLoading: false,
      });
    }
  }, []);

  // Main auth check — runs once on mount
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      // Step 1: Check URL for ?token= or ?action=logout
      const urlResult = handleTokenFromUrl();

      if (urlResult.handled && urlResult.user) {
        // Token was in URL — verify it server-side in background
        if (!cancelled) {
          setState({
            isAuthenticated: true,
            user: urlResult.user,
            token: urlResult.token,
            isLoading: false,
          });
        }
        // Background server verification
        if (urlResult.token) {
          verifyTokenServerSide(urlResult.token).then((result) => {
            if (!cancelled && result.valid && result.user) {
              setState({
                isAuthenticated: true,
                user: result.user,
                token: result.token || urlResult.token,
                isLoading: false,
              });
            }
          });
        }
        return;
      }

      if (urlResult.handled && !urlResult.user) {
        // Logout action was handled
        if (!cancelled) {
          setState({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
          });
        }
        return;
      }

      // Step 2: Check localStorage
      const valid = isAuthValid();
      const { token, user } = loadAuth();

      if (valid && user) {
        if (!cancelled) {
          setState({
            isAuthenticated: true,
            user,
            token,
            isLoading: false,
          });
        }
      } else {
        // Token expired or invalid — clear
        clearAuth();
        if (!cancelled) {
          setState({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
          });
        }
      }
    };

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Periodic server-side verification
  useEffect(() => {
    if (!state.isAuthenticated || !state.token) {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
      return;
    }

    verifyTimerRef.current = setInterval(() => {
      refreshUser();
    }, SERVER_VERIFY_INTERVAL);

    return () => {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
    };
  }, [state.isAuthenticated, state.token, refreshUser]);

  const login = useCallback(() => {
    redirectToLogin(typeof window !== 'undefined' ? window.location.href : undefined);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setState({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
    });
    redirectToLogout();
  }, []);

  return { ...state, login, logout, refreshUser };
}
