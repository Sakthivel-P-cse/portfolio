"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, PanelLeftClose, PanelLeft } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Desktop/tablet sidebar. Collapsible to an icon rail. Hidden on mobile (bottom nav instead).
export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border/60 bg-sidebar md:flex"
    >
      <div className="flex h-16 items-center gap-2 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
          <TrendingUp className="size-5 text-primary" />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold">Portfolio</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn("w-full gap-2", collapsed && "justify-center px-0")}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
