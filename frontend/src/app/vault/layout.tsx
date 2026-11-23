import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.vault;

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
