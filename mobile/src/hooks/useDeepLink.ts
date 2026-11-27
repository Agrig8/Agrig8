import { useCallback, useEffect, useState } from 'react';
import { CommonActions, type NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../stores/authStore';
import {
  parseDeepLink,
  requiresAuth,
  type DeepLinkTarget,
} from '../constants/links';

export type { DeepLinkTarget };

/**
 * Deep-link routing with auth-aware guards (issue #261).
 *
 * - A link that lands while authenticated navigates immediately.
 * - A link that needs auth while signed out is parked; `resumePendingDeepLink`
 *   replays it once a token appears (login-then-continue).
 * - Unrecognised / malformed links are dropped (parseDeepLink returns null).
 *
 * The pending target lives in a module-level slot so it survives the
 * WalletConnect -> TradeList remount that happens on login.
 */

let pendingTarget: DeepLinkTarget | null = null;
const listeners = new Set<() => void>();

function setPending(target: DeepLinkTarget | null): void {
  pendingTarget = target;
  listeners.forEach((l) => l());
}

/** Set when handleUrl receives a non-empty URL that cannot be parsed (issue #62). */
export interface InvalidDeepLinkError {
  url: string;
}

interface UseDeepLinkReturn {
  pendingDeepLink: DeepLinkTarget | null;
  /** Non-null when the most recent handleUrl call received an unrecognised URL (issue #62). */
  invalidLinkError: InvalidDeepLinkError | null;
  /** Dismiss the invalid-link error so the UI can return to its normal state (issue #62). */
  dismissInvalidLink: () => void;
  /** Parse a raw URL (cold-start or runtime) and route or park it. */
  handleUrl: (url: string | null | undefined, navigation?: NavigationContainerRef<RootStackParamList> | null) => void;
  /** Route or park an already-parsed target (e.g. from a push notification tap). */
  handleDeepLink: (target: DeepLinkTarget, navigation?: NavigationContainerRef<RootStackParamList> | null) => void;
  /** Replay a parked link once the user is authenticated. */
  resumePendingDeepLink: (navigation: NavigationContainerRef<RootStackParamList> | null) => void;
}

function navigate(
  navigation: NavigationContainerRef<RootStackParamList> | null | undefined,
  target: DeepLinkTarget,
): void {
  if (!navigation) return;
  navigation.dispatch(
    CommonActions.navigate({ name: target.screen, params: target.params }),
  );
}

export function useDeepLink(): UseDeepLinkReturn {
  const { token } = useAuthStore();
  const [pendingDeepLink, setPendingState] = useState<DeepLinkTarget | null>(pendingTarget);
  const [invalidLinkError, setInvalidLinkError] = useState<InvalidDeepLinkError | null>(null);

  useEffect(() => {
    const sync = () => setPendingState(pendingTarget);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const dismissInvalidLink = useCallback(() => {
    setInvalidLinkError(null);
  }, []);

  const routeOrPark = useCallback(
    (target: DeepLinkTarget, navigation?: NavigationContainerRef<RootStackParamList> | null) => {
      if (requiresAuth(target) && !token) {
        setPending(target);
        return;
      }
      setPending(null);
      navigate(navigation, target);
    },
    [token],
  );

  const handleUrl = useCallback(
    (url: string | null | undefined, navigation?: NavigationContainerRef<RootStackParamList> | null) => {
      const target = parseDeepLink(url);
      if (!target) {
        // Surface a recoverable error only when the caller passed a non-empty string that
        // looks like a link attempt but could not be matched to a known route (issue #62).
        if (url && typeof url === 'string' && url.trim().length > 0) {
          setInvalidLinkError({ url });
        }
        return;
      }
      setInvalidLinkError(null);
      routeOrPark(target, navigation);
    },
    [routeOrPark],
  );

  const handleDeepLink = useCallback(
    (target: DeepLinkTarget, navigation?: NavigationContainerRef<RootStackParamList> | null) => {
      routeOrPark(target, navigation);
    },
    [routeOrPark],
  );

  const resumePendingDeepLink = useCallback(
    (navigation: NavigationContainerRef<RootStackParamList> | null) => {
      if (pendingTarget && token) {
        const target = pendingTarget;
        setPending(null);
        navigate(navigation, target);
      }
    },
    [token],
  );

  return { pendingDeepLink, invalidLinkError, dismissInvalidLink, handleUrl, handleDeepLink, resumePendingDeepLink };
}

/** Test helper. */
export function __clearPendingDeepLink(): void {
  setPending(null);
}
