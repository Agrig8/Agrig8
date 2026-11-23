import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.settings;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
