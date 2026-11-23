/**
 * Centralized page metadata for all app routes.
 *
 * Import `routeMeta` and spread the relevant entry into each route's
 * `export const metadata: Metadata = { ...routeMeta.trades }`.
 * This keeps titles and descriptions consistent and in one place.
 */

const APP_NAME = "innov8";
const APP_TAGLINE = "Secure Agricultural Escrow";

function title(page: string): string {
  return `${page} — ${APP_NAME}`;
}

export const routeMeta = {
  dashboard: {
    title: title("Dashboard"),
    description: "Overview of your active trades, balances, and recent activity.",
  },
  trades: {
    title: title("Trades"),
    description: "Browse, create, and manage your agricultural escrow trades.",
  },
  tradesCreate: {
    title: title("New Trade"),
    description: "Open a new escrow trade with a buyer or seller.",
  },
  tradesDetail: {
    title: title("Trade Details"),
    description: "View the status, timeline, and actions for a single escrow trade.",
  },
  mediator: {
    title: title("Mediator Portal"),
    description: "Review and resolve disputes assigned to you as a mediator.",
  },
  mediatorDisputes: {
    title: title("Disputes"),
    description: "Active and historical dispute cases requiring mediator review.",
  },
  profile: {
    title: title("Profile"),
    description: "View your wallet identity and account information.",
  },
  reputation: {
    title: title("Reputation"),
    description: "Your trust score, completed trades, and dispute history.",
  },
  settings: {
    title: title("Settings"),
    description: `Configure your ${APP_NAME} account preferences, notifications, and security.`,
  },
  vault: {
    title: title("Vault"),
    description: "Manage your Stellar asset balances and escrow funds.",
  },
  streams: {
    title: title("Payment Streams"),
    description: "Monitor active payment streams linked to your escrow trades.",
  },
  help: {
    title: title("Help"),
    description: `Documentation and support resources for ${APP_NAME} users.`,
  },
  accessDenied: {
    title: title("Access Denied"),
    description: "You do not have permission to view this page.",
  },
} as const satisfies Record<string, { title: string; description: string }>;

export type RouteKey = keyof typeof routeMeta;

/** Site-level defaults — used by root layout when no page-level metadata applies. */
export const siteMetadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s — ${APP_NAME}`,
  },
  description: `Blockchain-powered agricultural trade settlement on Stellar.`,
};
