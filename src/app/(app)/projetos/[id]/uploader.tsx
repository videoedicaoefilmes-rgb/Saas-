"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Progress, Spinner } from "@/components/ui/misc";
import { allowedVideoExtension } from "@/lib/naming";
import { formatBytes } from "@/lib/utils";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; loaded: number; total: number }
  | { kind: "validating"; assetId: string }
  | { kind: "error"; message: string };

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "Não foi possível enviar o vídeo.";
  } catch {
    return "Não foi possível enviar o vídeo.";
  }
}

/**
 * Envio direto ao armazenamento (URL assinada), com progresso real.
 * Depois do envio, acompanha a validação feita pelo worker (formato real, codecs, duração).
 */
export function Uploader({ projectId, maxBytes, pendingAssetId }: { projectId: string; maxBytes: number; pendingAssetId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [phase, setPhase] = useState<Phase>(pendingAssetId ? { kind: "validating", assetId: pendingAssetId } : { kind: "idle" });

  // Acompanha a validação no servidor.
  useEffect(() => {
    if (phase.kind !== "validating") return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const res = await fetch(`/api/assets/${phase.assetId}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) {
        const body = (await res.json()) as { status: string };
        if (body.status === "READY" || body.status === "REJECTED") {
          router.refresh();
          return;
        }
      }
      setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [phase, router]);

  // Aviso ao fechar a aba durante o envio.
  useEffect(() => {
    if (phase.kind !== "uploading") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase.kind]);

  const fileError = file
    ? !allowedVideoExtension(file.name)
      ? "Formato não aceito. Envie um vídeo MP4 ou MOV."
      : file.size > maxBytes
        ? `O arquivo tem ${formatBytes(file.size)} e passa do limite de ${formatBytes(maxBytes)}.`
        : file.size === 0
          ? "O arquivo está vazio."
          : null
    : null;

  async function start() {
    if (!file || fileError || !rights) return;
    setPhase({ kind: "uploading", loaded: 0, total: file.size });
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filename: file.name, sizeBytes: file.size, rightsConfirmed: true }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const { assetId, upload } = (await res.json()) as {
        assetId: string;
        upload: { url: string; method: "PUT"; headers: Record<string, string> };
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open(upload.method, upload.url);
        for (const [k, v] of Object.entries(upload.headers)) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => setPhase({ kind: "uploading", loaded: e.loaded, total: e.total || file.size });
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (código ${xhr.status}). Tente novamente.`)));
        xhr.onerror = () => reject(new Error("A conexão caiu durante o envio. Verifique a internet e tente novamente."));
        xhr.onabort = () => reject(new Error("Envio cancelado."));
        xhr.send(file);
      });

      const done = await fetch(`/api/uploads/${assetId}/complete`, { method: "POST" });
      if (!done.ok) throw new Error(await readError(done));
      const body = (await done.json()) as { status: string; rejectionReason?: string };
      if (body.status === "REJECTED") throw new Error(body.rejectionReason ?? "Vídeo recusado.");
      setPhase({ kind: "validating", assetId });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Falha no envio." });
    } finally {
      xhrRef.current = null;
    }
  }

  if (phase.kind === "validating") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-info-soft px-4 py-3 text-sm text-blue-900" role="status">
        <Spinner />
        Vídeo recebido. Validando formato e lendo a duração... isso leva alguns segundos.
      </div>
    );
  }

  if (phase.kind === "uploading") {
    const pct = phase.total ? (phase.loaded / phase.total) * 100 : 0;
    return (
      <div className="flex flex-col gap-3" role="status">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Enviando {file?.name}</span>
          <span className="tabular text-muted-foreground">
            {formatBytes(phase.loaded)} de {formatBytes(phase.total)} ({Math.floor(pct)}%)
          </span>
        </div>
        <Progress value={pct} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Mantenha esta página aberta até o fim do envio.</p>
          <Button variant="ghost" size="sm" onClick={() => xhrRef.current?.abort()}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-6 py-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
      >
        <UploadCloud className="size-8 text-primary" />
        <span className="font-semibold">{file ? file.name : "Escolher vídeo da partida"}</span>
        <span className="text-xs text-muted-foreground">
          {file ? formatBytes(file.size) : `MP4 ou MOV, até ${formatBytes(maxBytes)} · arraste o arquivo ou toque para escolher`}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        className="sr-only"
        data-testid="video-input"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {fileError && <Alert tone="error">{fileError}</Alert>}
      {phase.kind === "error" && <Alert tone="error">{phase.message}</Alert>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          Declaro que tenho autorização para usar este vídeo e as imagens das pessoas que aparecem nele (incluindo menores de idade, com consentimento dos responsáveis).
        </span>
      </label>
      <Button onClick={start} disabled={!file || !!fileError || !rights} className="self-start">
        <UploadCloud />
        Enviar vídeo
      </Button>
    </div>
  );
}
