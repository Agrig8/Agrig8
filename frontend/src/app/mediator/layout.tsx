import type { Metadata } from "next";
import { routeMeta } from "@/lib/routeMetadata";

export const metadata: Metadata = routeMeta.mediator;

export default function MediatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
