import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { registerForPushNotifications } from '../services/notification.service';

export type NotificationPermissionStatus =
  | 'unknown'
  | 'rationale'   // show benefit explanation before requesting
  | 'requesting'  // OS dialog is open
  | 'granted'
  | 'denied'      // denied once — can still open settings
  | 'blocked';    // permanently denied — must go to settings

interface UseNotificationPermissionReturn {
  permissionStatus: NotificationPermissionStatus;
  /**
   * Move from 'unknown' → 'rationale' so the UI can display the benefit
   * explanation before the OS permission dialog appears.
   */
  showRationale: () => void;
  /**
   * Request OS permission.  Call this after the user accepts the rationale.
   * No-op when permission is already granted or blocked.
   */
  requestPermission: () => Promise<void>;
  /** Open device notification settings (fallback when permission was denied). */
  openSettings: () => void;
  /** Obtained push token, or null when not yet granted. */
  pushToken: string | null;
}

/**
 * Notification permission with rationale flow (issue #67).
 *
 * State machine:
 *   unknown → rationale → requesting → granted | denied | blocked
 *
 * The UI should:
 *   1. Call `showRationale()` at an appropriate moment (e.g. after first login).
 *   2. When `permissionStatus === 'rationale'`, display a benefit explanation
 *      with an "Enable notifications" button that calls `requestPermission()`.
 *   3. When `permissionStatus === 'denied'` or `'blocked'`, display a settings
 *      fallback button that calls `openSettings()`.
 */
export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('unknown');
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Seed status from the current OS permission on mount.
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setPermissionStatus('granted');
      } else if (status === 'denied') {
        // expo-notifications reports 'denied' for both soft-deny and permanently blocked.
        // On iOS we can't distinguish without a separate flag; treat as 'denied' (reversible).
        setPermissionStatus('denied');
      }
      // Otherwise stay in 'unknown' — the app hasn't asked yet.
    });
  }, []);

  const showRationale = useCallback(() => {
    if (permissionStatus === 'unknown') {
      setPermissionStatus('rationale');
    }
  }, [permissionStatus]);

  const requestPermission = useCallback(async () => {
    if (permissionStatus === 'granted' || permissionStatus === 'blocked') return;

    setPermissionStatus('requesting');
    const token = await registerForPushNotifications();
    if (token) {
      setPushToken(token);
      setPermissionStatus('granted');
    } else {
      // On Android 13+ requestPermissionsAsync can return 'denied' permanently.
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'denied' && Platform.OS === 'android') {
        setPermissionStatus('blocked');
      } else {
        setPermissionStatus('denied');
      }
    }
  }, [permissionStatus]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { permissionStatus, showRationale, requestPermission, openSettings, pushToken };
}
