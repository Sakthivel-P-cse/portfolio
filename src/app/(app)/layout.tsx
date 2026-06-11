import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

// All routes in this group require auth. requireUser() redirects to /login otherwise
// and ensures a Prisma User + Settings row exists.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      title="Portfolio"
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
    >
      {children}
    </AppShell>
  );
}
