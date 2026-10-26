"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLinks } from "./nav";

export function MobileMenu({ isAdmin, footer }: { isAdmin: boolean; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-white hover:bg-white/10"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-white/10 bg-sidebar p-4 shadow-xl">
          <NavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-white/10 pt-4">{footer}</div>
        </div>
      )}
    </>
  );
}
