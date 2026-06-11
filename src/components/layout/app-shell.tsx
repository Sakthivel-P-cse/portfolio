import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { ModalManager } from "@/components/modals/modal-manager";

interface AppShellProps {
  title: string;
  user: { name: string | null; email: string; avatarUrl: string | null };
  children: ReactNode;
}

// The responsive frame: sidebar (desktop/tablet) + header + content + mobile bottom nav.
export function AppShell({ title, user, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} user={user} />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
      <ModalManager />
    </div>
  );
}
