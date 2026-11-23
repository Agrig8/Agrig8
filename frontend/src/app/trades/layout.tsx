import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.trades;

export default function TradesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
