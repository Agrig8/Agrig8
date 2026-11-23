import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.dashboard;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
