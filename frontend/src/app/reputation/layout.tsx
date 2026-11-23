import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.reputation;

export default function ReputationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
