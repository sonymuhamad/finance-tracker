import { DomainError } from "./errors";

/** Standard return shape for Server Actions invoked from the client. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Runs a server-action body, converting a DomainError into a friendly
 * `{ ok: false }` result. Unexpected errors still throw (surfaced by Next).
 */
export async function runAction(
  fn: () => Promise<void>,
): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
}
