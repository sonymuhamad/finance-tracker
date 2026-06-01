import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Returns the signed-in user, or null. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Returns the signed-in user, or redirects to /login.
 * Use in protected server layouts/pages.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
