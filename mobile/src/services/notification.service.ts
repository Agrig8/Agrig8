import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const PUSH_TOKEN_KEY = "amana_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type?: "trade" | "dispute" | "general";
  tradeId?: string;
  disputeId?: string;
  screen?: string;
}

/**
 * Result of the pre-permission explanation flow (issue #67).
 * - 'granted'  — permission was already granted or the user accepted after the explanation.
 * - 'denied'   — user dismissed the explanation or the OS denied permission.
 * - 'skipped'  — permission was already denied at the OS level; settings fallback was shown.
 */
export type NotificationPermissionResult = 'granted' | 'denied' | 'skipped';

/**
 * Ask the caller to show a rationale screen before the OS permission dialog (issue #67).
 * Returns true if the user confirmed they want to proceed; false if they dismissed.
 */
export type ShowRationaleCallback = () => Promise<boolean>;

/**
 * Ask the caller to open the OS settings page as a fallback when permission is permanently
 * denied (issue #67).
 */
export type OpenSettingsCallback = () => void;

/**
 * Request push-notification permission, preceded by an in-app explanation screen (issue #67).
 *
 * Flow:
 * 1. If already granted, skip the rationale and return 'granted'.
 * 2. If permanently denied (canAskAgain === false), invoke openSettings and return 'skipped'.
 * 3. Otherwise show the rationale via showRationale(); if the user declines, return 'denied'.
 * 4. Present the OS permission dialog; return 'granted' or 'denied' based on outcome.
 */
export async function requestNotificationPermissionWithRationale(
  showRationale: ShowRationaleCallback,
  openSettings: OpenSettingsCallback,
): Promise<NotificationPermissionResult> {
  try {
    const { status: existingStatus, canAskAgain } =
      await Notifications.getPermissionsAsync();

    if (existingStatus === "granted") {
      const token = await Notifications.getExpoPushTokenAsync();
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token.data);
      return "granted";
    }

    if (!canAskAgain) {
      openSettings();
      return "skipped";
    }

    const userAccepted = await showRationale();
    if (!userAccepted) return "denied";

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return "denied";

    const token = await Notifications.getExpoPushTokenAsync();
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token.data);
    return "granted";
  } catch {
    return "denied";
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    const pushToken = token.data;

    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
    return pushToken;
  } catch {
    return null;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storePushTokenOnBackend(
  pushToken: string,
  authToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      "https://api.amana.io/user/push-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pushToken }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export function setupNotificationListeners(
  onNotificationTap: (data: NotificationData) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as NotificationData;
      onNotificationTap(data);
    },
  );

  return () => subscription.remove();
}

/**
 * Payload of the notification the app was cold-started from, if any
 * (issue #259). Runtime taps go through `setupNotificationListeners`.
 */
export async function getInitialNotificationData(): Promise<NotificationData | null> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return (response?.notification.request.content.data as NotificationData) ?? null;
  } catch {
    return null;
  }
}

/** IANA timezone of the device, shown next to quiet-hours controls (issue #260). */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function setupForegroundNotificationHandler(
  onNotification: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      onNotification(notification);
    },
  );

  return () => subscription.remove();
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: null,
  });

  return identifier;
}

export async function checkNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}
