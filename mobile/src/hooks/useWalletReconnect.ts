import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';

export type WalletReconnectStatus =
  | 'connected'
  | 'disconnected'
  | 'network-mismatch'
  | 'expired'
  | 'reconnecting'
  | 'error';

interface UseWalletReconnectReturn {
  status: WalletReconnectStatus;
  /** Manually trigger a reconnect attempt. */
  reconnect: () => Promise<void>;
}

/**
 * Wallet reconnect state management (issue #63).
 *
 * Monitors:
 * - auth token expiry (token cleared → expired)
 * - network disconnects (no connectivity → disconnected)
 * - network mismatch (online but previously offline and token may be stale)
 *
 * Provides a `reconnect()` callback to re-issue the challenge and refresh the
 * session so the UI can show a consistent reconnect banner instead of stale state.
 */
export function useWalletReconnect(): UseWalletReconnectReturn {
  const { token, walletAddress, setToken, clearAuth } = useAuthStore();
  const [status, setStatus] = useState<WalletReconnectStatus>(
    token ? 'connected' : 'disconnected',
  );
  const wasOfflineRef = useRef(false);

  // Track token presence: cleared token = expired/disconnected.
  useEffect(() => {
    if (!token) {
      setStatus((prev) =>
        prev === 'reconnecting' ? prev : 'expired',
      );
    } else if (status === 'expired' || status === 'disconnected') {
      setStatus('connected');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Monitor network state.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      if (!isOnline) {
        wasOfflineRef.current = true;
        setStatus((prev) =>
          prev === 'reconnecting' ? prev : 'disconnected',
        );
      } else if (wasOfflineRef.current && token) {
        wasOfflineRef.current = false;
        setStatus('network-mismatch');
      } else if (isOnline && token && status === 'disconnected') {
        wasOfflineRef.current = false;
        setStatus('connected');
      }
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reconnect = useCallback(async () => {
    if (!walletAddress) {
      await clearAuth();
      setStatus('disconnected');
      return;
    }

    setStatus('reconnecting');
    try {
      const { challenge } = await authApi.generateChallenge(walletAddress);
      const { token: newToken } = await authApi.verifyChallenge(walletAddress, challenge);
      await setToken(newToken);
      setStatus('connected');
    } catch {
      setStatus('error');
    }
  }, [walletAddress, setToken, clearAuth]);

  return { status, reconnect };
}
