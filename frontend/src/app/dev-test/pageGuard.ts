import { notFound } from "next/navigation";

export function assertDevelopmentOnly(environment: string): void {
  if (environment === "production") {
    notFound();
  }
}
