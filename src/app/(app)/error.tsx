"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-10">
      <Alert tone="error" title="Não foi possível carregar esta página">
        Pode ser uma instabilidade momentânea. Tente novamente; se continuar, fale com o suporte.
      </Alert>
      <Button onClick={reset} variant="secondary" className="self-start">Tentar novamente</Button>
    </div>
  );
}
