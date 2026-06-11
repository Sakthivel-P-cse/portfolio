import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Resolve the authenticated Supabase user and ensure a matching Prisma `User`
 * (and default `Settings`) row exists. Redirects to /login if unauthenticated.
 *
 * Returns the Prisma user id, which every query scopes by.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Upsert keeps our relational User row in sync with Supabase auth.users.
  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
    },
    create: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      settings: { create: {} }, // defaults from schema (DARK theme, INR, etc.)
    },
  });

  return dbUser;
}

/** Like requireUser but returns null instead of redirecting (for API routes). */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? "" },
    create: {
      id: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      settings: { create: {} },
    },
  });
}
