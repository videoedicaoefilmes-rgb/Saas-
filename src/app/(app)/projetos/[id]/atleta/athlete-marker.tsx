"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FastForward, MousePointerClick, Pause, Play, Rewind, Trash2, Eye } from "lucide-react";
import { addAthleteMarkAction, deleteAthleteMarkAction } from "@/app/actions/athlete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatTimecode } from "@/lib/timecode";
import { cn } from "@/lib/utils";

type Mark = { id: string; timeMs: number; x: number; y: number };

/** Área da imagem dentro do elemento <video> (descontando as faixas pretas). */
type Box = { left: number; top: number; width: number; height: number };

/** Uma marcação aparece sobre o vídeo quando ele está parado perto do instante marcado. */
const SHOW_WINDOW_MS = 400;

export function AthleteMarker({
  projectId,
  playbackUrl,
  durationMs,
  maxMarks,
  marks,
}: {
  projectId: string;
  playbackUrl: string;
  durationMs: number;
  maxMarks: number;
  marks: Mark[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [paused, setPaused] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Calcula onde a imagem fica dentro do player (o vídeo é "encaixado" mantendo a proporção).
  const measure = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const rw = v.clientWidth;
    const rh = v.clientHeight;
    const scale = Math.min(rw / v.videoWidth, rh / v.videoHeight);
    const width = v.videoWidth * scale;
    const height = v.videoHeight * scale;
    setBox({ left: (rw - width) / 2, top: (rh - height) / 2, width, height });
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    return () => ro.disconnect();
  }, [measure]);

  function sync() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentMs(Math.round(v.currentTime * 1000));
    setPaused(v.paused);
  }

  function seekTo(ms: number) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(durationMs, ms)) / 1000;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function onPick(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !box) return;
    if (!v.paused) {
      v.pause();
      setFeedback({ tone: "info", text: "Vídeo pausado. Agora clique em cima do atleta." });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (marks.length >= maxMarks) {
      setFeedback({ tone: "error", text: `Limite de ${maxMarks} marcações. Remova uma para adicionar outra.` });
      return;
    }
    const timeMs = Math.round(v.currentTime * 1000);
    startTransition(async () => {
      const res = await addAthleteMarkAction(projectId, { timeMs, x, y });
      setFeedback(
        res.ok
          ? { tone: "success", text: `Atleta marcado em ${formatTimecode(timeMs)}. Se quiser, marque também em outro momento do jogo.` }
          : { tone: "error", text: res.error },
      );
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAthleteMarkAction(projectId, id);
      if (!res.ok) setFeedback({ tone: "error", text: res.error });
    });
  }

  const visible = paused ? marks.filter((m) => Math.abs(m.timeMs - currentMs) <= SHOW_WINDOW_MS) : [];

  if (videoError) {
    return (
      <Alert tone="warning" title="Seu navegador não conseguiu reproduzir este vídeo">
        Isso acontece com alguns formatos (ex.: H.265/HEVC, comum em iPhone). Tente abrir esta página no Microsoft Edge ou no Safari.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Como marcar</CardTitle>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
            <li>Vá até um momento em que o atleta aparece bem (arraste a barra ou dê play).</li>
            <li><strong className="text-foreground">Pause</strong> o vídeo.</li>
            <li><strong className="text-foreground">Clique em cima do atleta</strong> na imagem.</li>
          </ol>
        </CardHeader>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={playbackUrl}
            preload="metadata"
            playsInline
            className="aspect-video w-full"
            onLoadedMetadata={() => {
              measure();
              sync();
            }}
            onTimeUpdate={sync}
            onSeeked={sync}
            onPlay={sync}
            onPause={sync}
            onError={() => setVideoError(true)}
          />
          {box && (
            <div
              role="button"
              tabIndex={0}
              aria-label={paused ? "Clique em cima do atleta" : "Clique para pausar o vídeo"}
              data-testid="athlete-pick-area"
              onClick={onPick}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  togglePlay();
                }
              }}
              className={cn("absolute", paused ? "cursor-crosshair" : "cursor-pointer")}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            >
              {visible.map((m) => (
                <span
                  key={m.id}
                  className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-amber-400 shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
                  style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                  aria-hidden
                />
              ))}
              {paused && visible.length === 0 && (
                <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                  <MousePointerClick className="mr-1 inline size-3.5" />
                  Clique em cima do atleta
                </span>
              )}
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-3">
          <input
            type="range"
            min={0}
            max={durationMs}
            step={100}
            value={currentMs}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
            aria-label="Posição no vídeo"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={togglePlay} aria-label={paused ? "Reproduzir" : "Pausar"}>
                {paused ? <Play /> : <Pause />}
                {paused ? "Play" : "Pausar"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => seekTo(currentMs - 5000)} aria-label="Voltar 5 segundos"><Rewind />5s</Button>
              <Button variant="secondary" size="sm" onClick={() => seekTo(currentMs - 1000)} aria-label="Voltar 1 segundo">−1s</Button>
              <Button variant="secondary" size="sm" onClick={() => seekTo(currentMs + 1000)} aria-label="Avançar 1 segundo">+1s</Button>
              <Button variant="secondary" size="sm" onClick={() => seekTo(currentMs + 5000)} aria-label="Avançar 5 segundos">5s<FastForward /></Button>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tabular">
              {formatTimecode(currentMs)} / {formatTimecode(durationMs)}
            </span>
          </div>
          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marcações ({marks.length})</CardTitle>
          <CardDescription>
            Uma já basta. Marcar em 2 ou 3 momentos diferentes (por exemplo, 1º e 2º tempo) ajuda o sistema a não se perder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma marcação ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="athlete-marks">
              {marks.map((m, i) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">Marcação {i + 1}</span>{" "}
                    <span className="tabular text-muted-foreground">em {formatTimecode(m.timeMs)}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => seekTo(m.timeMs)}><Eye />Ver</Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger hover:bg-danger-soft"
                      disabled={pending}
                      onClick={() => remove(m.id)}
                      aria-label={`Remover marcação ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
