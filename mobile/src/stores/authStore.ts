import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'innov8_token';
const LEGACY_TOKEN_KEY = 'amana_token';

/** Reads the token, migrating it from the legacy key so sessions survive the rename. */
export async function readTokenWithMigration(): Promise<string | null> {
  const current = await SecureStore.getItemAsync(TOKEN_KEY);
  if (current) return current;
  const legacy = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
  if (!legacy) return null;
  await SecureStore.setItemAsync(TOKEN_KEY, legacy);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  return legacy;
}

/** Why the current wallet session ended, surfaced so the UI can explain it (issue #63). */
export type WalletDisconnectReason = 'expired' | 'disconnected' | 'network_mismatch';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  walletAddress: string | null;
  /** True when the authenticated user has the admin role. */
  isAdmin: boolean;
  isLoading: boolean;
  /** Set when a session ends due to a recoverable wallet issue; null during normal use (issue #63). */
  disconnectReason: WalletDisconnectReason | null;
  setToken: (token: string) => Promise<void>;
  setRefreshToken: (refreshToken: string) => Promise<void>;
  setWalletAddress: (address: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  getToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  clearAuth: () => Promise<void>;
  /** Clear credentials and record the disconnect reason so WalletConnectScreen can explain it (issue #63). */
  expireSession: (reason: WalletDisconnectReason) => Promise<void>;
  /** Dismiss the reconnect banner without signing in (issue #63). */
  clearDisconnectReason: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  walletAddress: null,
  isAdmin: false,
  isLoading: true,
  disconnectReason: null,

  setToken: async (token: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token });
  },

  setRefreshToken: async (refreshToken: string) => {
    await SecureStore.setItemAsync('amana_refresh_token', refreshToken);
    set({ refreshToken });
  },

  setWalletAddress: (address: string) => {
    set({ walletAddress: address });
  },

  setIsAdmin: (isAdmin: boolean) => {
    set({ isAdmin });
  },

  getToken: async () => {
    try {
      const token = await readTokenWithMigration();
      set({ token });
      return token;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  },

  getRefreshToken: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('amana_refresh_token');
      set({ refreshToken });
      return refreshToken;
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    await SecureStore.deleteItemAsync('amana_refresh_token');
    set({ token: null, refreshToken: null, walletAddress: null, isAdmin: false, disconnectReason: null });
  },

  expireSession: async (reason: WalletDisconnectReason) => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    await SecureStore.deleteItemAsync('amana_refresh_token');
    set({ token: null, refreshToken: null, walletAddress: null, isAdmin: false, disconnectReason: reason });
  },

  clearDisconnectReason: () => {
    set({ disconnectReason: null });
  },
}));
