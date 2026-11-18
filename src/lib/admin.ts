import { auth } from "./auth";

/** True when the signed-in user's email is listed in ADMIN_EMAILS. */
export async function isAdmin(): Promise<boolean> {
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && allowed.includes(email);
}
