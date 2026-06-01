"use server";

import { signIn, signOut } from "@/lib/auth";
import { devLoginSchema } from "./schema";

export type DevLoginState = { error?: string };

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signInWithDevLogin(
  _prev: DevLoginState,
  formData: FormData,
): Promise<DevLoginState> {
  const parsed = devLoginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email tidak valid" };
  }
  // signIn redirects on success (throws NEXT_REDIRECT), so this never returns
  // on the happy path.
  await signIn("dev-login", { email: parsed.data.email, redirectTo: "/" });
  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
