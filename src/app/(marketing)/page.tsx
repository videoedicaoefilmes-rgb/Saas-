import { CheckCircle2, Clock, Download, FolderKanban, Scissors, ShieldCheck, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getEnv } from "@/server/env";
import { getCurrentUser } from "@/server/session";

const steps = [
  { icon: Upload, title: "Envie o vídeo da partida", text: "Arquivos MP4 ou MOV direto do celular ou da câmera." },
  { icon: Clock, title: "Marque os horários dos lances", text: "Digite 12:35 → 12:52 ou marque assistindo ao vídeo." },
  { icon: Scissors, title: "Nós cortamos para você", text: "Cada lance vira um MP4 separado, com corte preciso." },
  { icon: Download, title: "Baixe tudo organizado", text: "Um por um ou todos de uma vez em ZIP, com nomes padronizados." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const name = getEnv().APP_NAME;
  const user = await getCurrentUser();
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/10 bg-sidebar">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo name={name} inverted />
          <nav className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/painel" size="sm">Ir para o painel</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/entrar" variant="ghost" size="sm" className="text-white hover:bg-white/10">Entrar</ButtonLink>
                <ButtonLink href="/cadastro" size="sm">Criar conta</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {sp.conta === "excluida" && (
          <div className="bg-primary-soft px-4 py-3 text-center text-sm text-green-900">Sua conta e seus arquivos foram excluídos.</div>
        )}
        <section className="bg-sidebar text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-14 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-green-300">Para famílias, atletas e videomakers esportivos</p>
              <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-5xl">Os melhores lances da partida, cortados em minutos.</h1>
              <p className="mt-4 max-w-xl text-lg text-slate-300">
                Envie o vídeo do jogo, informe os horários dos lances e receba cada corte pronto para baixar. Sem editor complicado, sem horas na timeline.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={user ? "/projetos/novo" : "/cadastro"} size="lg">Começar agora</ButtonLink>
                <ButtonLink href="#como-funciona" size="lg" variant="ghost" className="text-white hover:bg-white/10">Como funciona</ButtonLink>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl" aria-hidden>
              <div className="mb-4 aspect-video rounded-lg bg-gradient-to-br from-green-700 to-green-900 p-3">
                <div className="flex h-full items-end">
                  <div className="h-1.5 w-full rounded-full bg-white/20">
                    <div className="relative h-1.5 w-1/3 rounded-full bg-amber-400" />
                  </div>
                </div>
              </div>
              {[["Lance 1", "12:35 → 12:52", "Assistência"], ["Lance 2", "34:10 → 34:28", "Finalização"], ["Lance 3", "71:02 → 71:15", "Desarme"]].map(([l, t, c]) => (
                <div key={l} className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="font-semibold">{l}</span>
                  <span className="tabular text-slate-300">{t}</span>
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Como funciona</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">Quatro passos, do vídeo bruto aos lances prontos para compartilhar ou montar o vídeo do atleta.</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><s.icon className="size-5" /></span>
                  <span className="text-xs font-bold text-muted-foreground">PASSO {i + 1}</span>
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
            <div>
              <FolderKanban className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">Para quem faz isso todo fim de semana</h3>
              <p className="mt-1 text-sm text-muted-foreground">Videomakers e empresas de filmagem processam vários jogos e atletas por projeto, com nomes de arquivo padronizados.</p>
            </div>
            <div>
              <CheckCircle2 className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">Simples para pais e atletas</h3>
              <p className="mt-1 text-sm text-muted-foreground">Sem instalar programas. Funciona no computador e no celular.</p>
            </div>
            <div>
              <ShieldCheck className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">Privacidade em primeiro lugar</h3>
              <p className="mt-1 text-sm text-muted-foreground">Vídeos privados, acessíveis só pela sua conta, com links temporários e exclusão automática após o prazo de retenção.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold">Pague só pelo que processar</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            O consumo é medido em créditos por minuto de lance cortado — não pela duração do jogo inteiro. Você vê o custo antes de confirmar.
          </p>
          <ButtonLink href={user ? "/painel" : "/cadastro"} className="mt-6" size="lg">Criar minha conta</ButtonLink>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {name} · Um produto do ecossistema GM Sports</p>
          <nav className="flex gap-4">
            <a href="/termos" className="hover:text-foreground">Termos de Uso</a>
            <a href="/privacidade" className="hover:text-foreground">Privacidade</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
