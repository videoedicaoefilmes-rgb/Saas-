import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-sm font-bold text-primary">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço não existe ou você não tem acesso a este conteúdo.</p>
      <ButtonLink href="/painel">Voltar ao painel</ButtonLink>
    </main>
  );
}
