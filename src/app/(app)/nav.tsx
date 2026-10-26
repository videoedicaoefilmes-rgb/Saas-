"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, FolderKanban, LayoutDashboard, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/creditos", label: "Créditos", icon: Coins },
  { href: "/conta", label: "Conta", icon: Settings },
];

export function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = isAdmin ? [...items, { href: "/admin", label: "Administração", icon: Shield }] : items;
  return (
    <nav className="flex flex-col gap-1">
      {all.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`) || (href === "/projetos" && pathname.startsWith("/processamentos"));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
