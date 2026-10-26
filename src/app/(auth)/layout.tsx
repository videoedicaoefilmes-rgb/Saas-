import { Logo } from "@/components/logo";
import { getEnv } from "@/server/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-sidebar px-4 py-10">
      <Logo name={getEnv().APP_NAME} inverted className="mb-8 text-lg" />
      <main className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl sm:p-8">{children}</main>
      <p className="mt-6 text-center text-xs text-slate-400">
        <a href="/termos" className="hover:text-white">Termos de Uso</a> · <a href="/privacidade" className="hover:text-white">Privacidade</a>
      </p>
    </div>
  );
}
