"use client";

import { useCallback, useEffect, useState } from "react";

export type StellarNetwork = "testnet" | "mainnet";

const STORAGE_KEY = "stellar_network_preference";
const SUPPORTED_NETWORKS: StellarNetwork[] = ["testnet", "mainnet"];
const DEFAULT_NETWORK: StellarNetwork = "testnet";

function readStoredNetwork(): StellarNetwork {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_NETWORKS as string[]).includes(stored)) {
      return stored as StellarNetwork;
    }
  } catch {
    // localStorage unavailable (SSR, private browsing)
  }
  return DEFAULT_NETWORK;
}

function writeStoredNetwork(network: StellarNetwork): void {
  try {
    localStorage.setItem(STORAGE_KEY, network);
  } catch {
    // ignore write failures
  }
}

export interface UseNetworkPreferenceResult {
  network: StellarNetwork;
  setNetwork: (n: StellarNetwork) => void;
  isUnsupported: boolean;
}

/**
 * Persists the user's selected Stellar network in localStorage (issue #36).
 *
 * Returns the stored preference on first render, falls back to "testnet" when
 * the stored value is missing or unrecognised, and shows an `isUnsupported`
 * flag so callers can render an unsupported-network banner.
 */
export function useNetworkPreference(): UseNetworkPreferenceResult {
  const [network, setNetworkState] = useState<StellarNetwork>(DEFAULT_NETWORK);

  // Read from storage after first mount (avoids SSR mismatch)
  useEffect(() => {
    setNetworkState(readStoredNetwork());
  }, []);

  const setNetwork = useCallback((n: StellarNetwork) => {
    if (!(SUPPORTED_NETWORKS as string[]).includes(n)) {
      return;
    }
    setNetworkState(n);
    writeStoredNetwork(n);
  }, []);

  const isUnsupported =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK !== undefined &&
    network !== DEFAULT_NETWORK &&
    process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "Public Global Stellar Network ; September 2015" &&
    network === "mainnet";

  return { network, setNetwork, isUnsupported };
}
