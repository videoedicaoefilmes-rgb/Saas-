"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  ["/admin", "Visão geral"],
  ["/admin/usuarios", "Usuários"],
  ["/admin/projetos", "Projetos"],
  ["/admin/processamentos", "Processamentos"],
  ["/admin/creditos", "Créditos"],
  ["/admin/configuracoes", "Configurações"],
  ["/admin/auditoria", "Auditoria"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px" aria-label="Administração">
      {links.map(([href, label]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
