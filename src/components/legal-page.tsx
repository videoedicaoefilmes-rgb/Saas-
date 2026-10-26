import Link from "next/link";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui/alert";

export function LegalPage({ appName, title, version, children }: { appName: string; title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo name={appName} />
          <Link href="/" className="text-sm text-primary hover:underline">Início</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Versão {version}</p>
        <Alert tone="warning" className="my-6" title="Rascunho — pendente de revisão jurídica">
          Este texto é um rascunho técnico para o MVP e ainda não foi revisado por advogado. Não deve ser usado em operação comercial antes dessa revisão.
        </Alert>
        <div className="flex flex-col gap-4 text-[15px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </main>
    </div>
  );
}
