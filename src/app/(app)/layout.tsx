import Link from "next/link";
import { Coins, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { getEnv } from "@/server/env";
import { requireUser } from "@/server/session";
import { getBalance } from "@/server/services/credits";
import { signOutAction } from "@/app/actions/auth";
import { formatNumber } from "@/lib/utils";
import { NavLinks } from "./nav";
import { MobileMenu } from "./mobile-menu";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const balance = await getBalance(user.id);
  const name = getEnv().APP_NAME;
  const isAdmin = user.role === "ADMIN";

  const account = (
    <div className="flex flex-col gap-3">
      <Link href="/creditos" className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10" data-testid="balance">
        <span className="flex items-center gap-2 text-sidebar-foreground"><Coins className="size-4 text-accent" />Créditos</span>
        <span className="font-bold tabular">{formatNumber(balance)}</span>
      </Link>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-sidebar-foreground">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="rounded-lg p-2 text-sidebar-foreground hover:bg-white/10 hover:text-white" title="Sair" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-sidebar p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex flex-col gap-8">
          <Logo name={name} href="/painel" inverted className="px-2 pt-1" />
          <NavLinks isAdmin={isAdmin} />
        </div>
        {account}
      </aside>
      <header className="relative flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Logo name={name} href="/painel" inverted />
        <div className="flex items-center gap-2">
          <Link href="/creditos" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white tabular">
            <Coins className="size-4 text-accent" />
            {formatNumber(balance)}
          </Link>
          <MobileMenu isAdmin={isAdmin} footer={account} />
        </div>
      </header>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
