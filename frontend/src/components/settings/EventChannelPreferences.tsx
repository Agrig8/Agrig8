"use client";

import React, { useEffect, useId, useState } from "react";
import { request } from "@/lib/api/client";

export type NotificationChannel = "email" | "push" | "in-app";

export const NOTIFICATION_EVENTS = [
  { key: "deposit", label: "Deposit", description: "Funds deposited into a trade." },
  { key: "delivery", label: "Delivery", description: "Goods or service marked as delivered." },
  { key: "dispute", label: "Dispute", description: "A dispute is opened or resolved." },
  { key: "settlement", label: "Settlement", description: "Funds released or a trade is settled." },
] as const;

export const NOTIFICATION_CHANNELS: ReadonlyArray<{
  key: NotificationChannel;
  label: string;
}> = [
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
  { key: "in-app", label: "In-app" },
];

export type EventChannelMap = Record<string, NotificationChannel[]>;

const KNOWN_EVENT_KEYS: ReadonlySet<string> = new Set(
  NOTIFICATION_EVENTS.map((e) => e.key),
);
const KNOWN_CHANNEL_KEYS: ReadonlySet<string> = new Set(
  NOTIFICATION_CHANNELS.map((c) => c.key),
);

/** Default: every event delivered in-app only. */
export function defaultEventChannels(): EventChannelMap {
  return Object.fromEntries(
    NOTIFICATION_EVENTS.map((e) => [e.key, ["in-app"] as NotificationChannel[]]),
  );
}

/**
 * Accepts the GET /notifications/preferences payload (either the legacy
 * channel map or the `{ channels, quietHours }` blob) and returns a complete
 * map for the four supported events. Unknown values are dropped.
 */
export function normalizeEventChannels(payload: unknown): EventChannelMap {
  const result = defaultEventChannels();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return result;
  }
  const source = (
    "channels" in payload ? (payload as { channels: unknown }).channels : payload
  ) as Record<string, unknown> | undefined;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return result;
  }
  for (const eventKey of Object.keys(source)) {
    if (!KNOWN_EVENT_KEYS.has(eventKey)) continue;
    const value = source[eventKey];
    if (!Array.isArray(value)) continue;
    const channels = value.filter(
      (c): c is NotificationChannel =>
        typeof c === "string" && KNOWN_CHANNEL_KEYS.has(c),
    );
    result[eventKey] = Array.from(new Set(channels));
  }
  return result;
}

/** Returns a new map with `channel` toggled for `eventKey`. */
export function toggleChannel(
  map: EventChannelMap,
  eventKey: string,
  channel: NotificationChannel,
  enabled: boolean,
): EventChannelMap {
  const current = map[eventKey] ?? [];
  const next = enabled
    ? Array.from(new Set([...current, channel]))
    : current.filter((c) => c !== channel);
  return { ...map, [eventKey]: next };
}

interface EventChannelPreferencesProps {
  token: string | null;
}

/**
 * Per-event notification channel selection (deposit, delivery, dispute,
 * settlement) backed by GET/PUT /notifications/preferences.
 */
export function EventChannelPreferences({ token }: EventChannelPreferencesProps) {
  const headingId = useId();
  const [prefs, setPrefs] = useState<EventChannelMap>(defaultEventChannels);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    request<unknown>("/notifications/preferences", { token })
      .then((data) => {
        if (!cancelled) setPrefs(normalizeEventChannels(data));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load preferences");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleToggle(eventKey: string, channel: NotificationChannel, enabled: boolean) {
    setSuccess(false);
    setPrefs((prev) => toggleChannel(prev, eventKey, channel, enabled));
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await request("/notifications/preferences", {
        method: "PUT",
        token,
        body: JSON.stringify(prefs),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const disabled = !token || loading || saving;

  return (
    <div className="space-y-3" data-testid="event-channel-preferences">
      <h3 id={headingId} className="text-sm font-medium text-text-primary">
        Channels per event
      </h3>
      {!token && (
        <p className="text-sm text-text-secondary">Sign in to choose notification channels.</p>
      )}
      {loading && <p className="text-sm text-text-secondary">Loading preferences…</p>}
      <table className="w-full text-sm" aria-labelledby={headingId}>
        <thead>
          <tr className="text-left text-text-secondary">
            <th scope="col" className="py-2 pr-4 font-medium">Event</th>
            {NOTIFICATION_CHANNELS.map((c) => (
              <th key={c.key} scope="col" className="py-2 px-2 font-medium text-center">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_EVENTS.map((event) => (
            <tr key={event.key} className="border-t border-border-primary">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-text-primary">
                <span className="block">{event.label}</span>
                <span className="block text-xs text-text-secondary">{event.description}</span>
              </th>
              {NOTIFICATION_CHANNELS.map((channel) => {
                const inputId = `${event.key}-${channel.key}`;
                return (
                  <td key={channel.key} className="py-2 px-2 text-center">
                    <input
                      id={inputId}
                      type="checkbox"
                      aria-label={`${event.label} via ${channel.label}`}
                      checked={(prefs[event.key] ?? []).includes(channel.key)}
                      disabled={disabled}
                      onChange={(e) => handleToggle(event.key, channel.key, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {error && (
        <p role="alert" className="text-sm text-status-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-status-success">
          Notification channels saved.
        </p>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled}
        className="rounded-md border border-border-primary px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save channels"}
      </button>
    </div>
  );
}
