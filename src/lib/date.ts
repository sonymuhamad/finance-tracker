import { DEFAULT_LOCALE } from "./money";

/** A short, localized day+month label (e.g. "3 Jul") for an ISO date string. */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(DEFAULT_LOCALE, {
    day: "numeric",
    month: "short",
  });
}
