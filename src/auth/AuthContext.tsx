import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { appApi, authApi, ApiError, errorMessage, type AccountIdentifier, type AppConfig, type Me } from '@/api';
import {
  getRefreshToken,
  loadTokens,
  saveTokens,
  setPasswordChangeRequiredHandler,
  setSessionExpiredHandler,
} from '@/api/client';

type Status = 'loading' | 'signedOut' | 'signedIn' | 'offline';

type AuthValue = {
  status: Status;
  user: Me | null;
  config: AppConfig | null;
  /** Why the session couldn't be restored (shown on the offline screen). */
  bootError: string | null;
  signIn: (account: AccountIdentifier, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** An admin set this user's password; they must choose their own before continuing. */
  mustChangePassword: boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  retry: () => void;
  /** True if the logged-in user's role grants this permission code. */
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Platform admins manage car washes from the web admin portal, not this staff app. */
const PLATFORM_ADMIN_ROLE = 'SUPER_ADMIN';
const PLATFORM_ADMIN_MESSAGE = 'Platform admin accounts sign in on the Vahanly Admin portal, not the app.';

class PlatformAdminError extends Error {
  constructor() {
    super(PLATFORM_ADMIN_MESSAGE);
  }
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const [me, cfg] = await Promise.all([authApi.me(), appApi.config().catch(() => null)]);
    if (me.role.name === PLATFORM_ADMIN_ROLE) throw new PlatformAdminError();
    setUser(me);
    setConfig(cfg);
    setStatus('signedIn');
  }, []);

  // Restore a stored session (runs as a promise callback so no setState happens synchronously).
  const restore = useCallback(async (tokens: Awaited<ReturnType<typeof loadTokens>>) => {
    if (!tokens) {
      setStatus('signedOut');
      return;
    }
    try {
      await loadSession();
    } catch (e) {
      if (e instanceof PlatformAdminError || (e instanceof ApiError && (e.status === 401 || e.status === 403))) {
        await saveTokens(null);
        setStatus('signedOut');
      } else {
        // Keep the stored session; let the user retry once back online / not rate-limited.
        setBootError(errorMessage(e));
        setStatus('offline');
      }
    }
  }, [loadSession]);

  const boot = useCallback(() => loadTokens().then(restore), [restore]);

  useEffect(() => {
    loadTokens().then(restore);
  }, [restore]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('signedOut');
    });
    setPasswordChangeRequiredHandler(() => {
      setUser((u) => (u && !u.mustChangePassword ? { ...u, mustChangePassword: true } : u));
    });
    return () => {
      setSessionExpiredHandler(null);
      setPasswordChangeRequiredHandler(null);
    };
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const tokens = await authApi.changePassword(currentPassword, newPassword);
      // Other sessions (including the old refresh token) are revoked; use the new pair.
      await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      await loadSession();
    },
    [loadSession],
  );

  const signIn = useCallback(
    async (account: AccountIdentifier, password: string) => {
      const result = await authApi.login(account, password);
      if (result.user.role === PLATFORM_ADMIN_ROLE) {
        authApi.logout(result.refreshToken).catch(() => {});
        throw new PlatformAdminError();
      }
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      try {
        await loadSession();
      } catch (e) {
        await saveTokens(null);
        throw e;
      }
    },
    [loadSession],
  );

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Best effort: revoke the refresh token server-side.
      authApi.logout(refreshToken).catch(() => {});
    }
    await saveTokens(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthValue>(() => {
    const perms = new Set(user?.permissions ?? []);
    return {
      status,
      user,
      config,
      bootError,
      signIn,
      signOut,
      mustChangePassword: !!user?.mustChangePassword,
      changePassword,
      retry: () => {
        setStatus('loading');
        boot();
      },
      can: (p) => perms.has(p),
    };
  }, [status, user, config, bootError, signIn, signOut, changePassword, boot]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
