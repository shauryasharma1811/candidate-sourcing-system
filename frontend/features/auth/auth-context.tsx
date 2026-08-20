"use client";

/**
 * Global auth state. Wraps the app in RootLayout. On mount it checks for a
 * persisted access token (session persistence across page refresh) and
 * silently loads the profile; apiFetch handles refreshing an expired
 * access token transparently.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { authService, UserProfile } from "@/services/auth-service";
import { clearSession, isLoggedIn, saveTokens } from "@/lib/session";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginCandidate: (email: string, password: string, intendedJobId?: string | null) => Promise<string | null>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!isLoggedIn()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await authService.getProfile();
      setUser(profile);
    } catch {
      clearSession();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Session persistence: rehydrate on every full page load
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loginCandidate = useCallback(
    async (email: string, password: string, intendedJobId?: string | null) => {
      const tokens = await authService.loginCandidate(email, password, intendedJobId);
      saveTokens(tokens.access_token, tokens.refresh_token);
      await loadProfile();
      return tokens.redirect_to;
    },
    [loadProfile]
  );

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const tokens = await authService.loginAdmin(email, password);
      saveTokens(tokens.access_token, tokens.refresh_token);
      await loadProfile();
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: user !== null, loginCandidate, loginAdmin, logout, refreshProfile: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
