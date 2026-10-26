"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowDownUp, Pencil, Play, Rewind, FastForward, Trash2, Flag, FlagOff } from "lucide-react";
import { addClipAction, deleteClipAction, moveClipAction, sortClipsAction, updateClipAction } from "@/app/actions/clips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/misc";
import { FormResult, SubmitButton, fieldValue } from "@/components/form";
import { CLIP_CATEGORIES, CLIP_CATEGORY_LABELS, CLIP_RANGE_MESSAGES, validateClipRange, type ClipCategoryValue } from "@/lib/clips";
import { formatDuration, formatTimecode, parseTimecode } from "@/lib/timecode";
import type { ActionResult } from "@/server/action-result";

type ClipRow = {
  id: string;
  position: number;
  startMs: number;
  endMs: number;
  title: string | null;
  category: ClipCategoryValue | null;
  notes: string | null;
};

type Props = {
  projectId: string;
  playbackUrl: string | null;
  durationMs: number | null;
  maxClipMs: number;
  maxClips: number;
  padding: { beforeMs: number; afterMs: number };
  clips: ClipRow[];
};

/** Validação imediata no navegador (o servidor valida de novo). */
function liveError(start: string, end: string, durationMs: number | null, maxClipMs: number): string | null {
  if (!start.trim() || !end.trim()) return null;
  const s = parseTimecode(start);
  if (!s.ok) return `Início: ${s.error}`;
  const e = parseTimecode(end);
  if (!e.ok) return `Fim: ${e.error}`;
  const err = validateClipRange({ startMs: s.ms, endMs: e.ms }, { videoDurationMs: durationMs, maxClipMs });
  return err ? CLIP_RANGE_MESSAGES[err] : null;
}

function ClipForm({
  action,
  initial,
  submitLabel,
  durationMs,
  maxClipMs,
  currentTimeMs,
  onDone,
  onCancel,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  initial?: Partial<ClipRow>;
  submitLabel: string;
  durationMs: number | null;
  maxClipMs: number;
  currentTimeMs: number | null;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  // Após salvar, o formulário de inclusão é recriado pelo componente pai (key), e o de edição é fechado.
  const [state, formAction] = useActionState(async (prev: ActionResult, form: FormData) => {
    const result = await action(prev, form);
    if (result.ok) onDone?.();
    return result;
  }, { ok: true } as ActionResult);
  const [start, setStart] = useState(initial?.startMs !== undefined ? formatTimecode(initial.startMs) : "");
  const [end, setEnd] = useState(initial?.endMs !== undefined ? formatTimecode(initial.endMs) : "");

  const error = liveError(start, end, durationMs, maxClipMs);
  const preview = !error && start && end ? (() => {
    const s = parseTimecode(start);
    const e = parseTimecode(end);
    return s.ok && e.ok ? formatDuration(e.ms - s.ms) : null;
  })() : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início *" htmlFor={`start-${initial?.id ?? "new"}`} hint="MM:SS ou HH:MM:SS">
          <div className="flex gap-1">
            <Input id={`start-${initial?.id ?? "new"}`} name="start" value={start} onChange={(e) => setStart(e.target.value)} placeholder="12:35" inputMode="decimal" className="tabular" required />
            {currentTimeMs !== null && (
              <Button variant="secondary" size="icon" title="Usar o tempo atual do vídeo" aria-label="Usar tempo atual como início" onClick={() => setStart(formatTimecode(currentTimeMs))}>
                <Flag />
              </Button>
            )}
          </div>
        </Field>
        <Field label="Fim *" htmlFor={`end-${initial?.id ?? "new"}`} hint={preview ? `Duração: ${preview}` : "MM:SS ou HH:MM:SS"}>
          <div className="flex gap-1">
            <Input id={`end-${initial?.id ?? "new"}`} name="end" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="12:52" inputMode="decimal" className="tabular" required />
            {currentTimeMs !== null && (
              <Button variant="secondary" size="icon" title="Usar o tempo atual do vídeo" aria-label="Usar tempo atual como fim" onClick={() => setEnd(formatTimecode(currentTimeMs))}>
                <FlagOff />
              </Button>
            )}
          </div>
        </Field>
      </div>
      {error && <p className="-mt-2 text-xs text-danger" role="alert">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" htmlFor={`title-${initial?.id ?? "new"}`}>
          <Input id={`title-${initial?.id ?? "new"}`} name="title" defaultValue={fieldValue(state, "title", initial?.title ?? "")} maxLength={80} placeholder="Ex.: Assistência" />
        </Field>
        <Field label="Categoria" htmlFor={`category-${initial?.id ?? "new"}`}>
          <Select id={`category-${initial?.id ?? "new"}`} name="category" defaultValue={fieldValue(state, "category", initial?.category ?? "")}>
            <option value="">—</option>
            {CLIP_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CLIP_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Observações" htmlFor={`notes-${initial?.id ?? "new"}`}>
        <Textarea id={`notes-${initial?.id ?? "new"}`} name="notes" defaultValue={fieldValue(state, "notes", initial?.notes ?? "")} maxLength={500} rows={2} />
      </Field>
      <FormResult state={state} />
      <div className="flex gap-2">
        <SubmitButton disabled={!!error || !start || !end} pendingText="Salvando...">{submitLabel}</SubmitButton>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}

export function ClipEditor({ projectId, playbackUrl, durationMs, maxClipMs, maxClips, padding, clips }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [listError, setListError] = useState<string | null>(null);

  const hasPlayer = !!playbackUrl && !videoError;

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentMs(Math.round(v.currentTime * 1000));
    if (stopAtRef.current !== null && v.currentTime * 1000 >= stopAtRef.current) {
      v.pause();
      stopAtRef.current = null;
    }
  }

  function seekBy(deltaMs: number) {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + deltaMs / 1000);
  }

  function preview(clip: ClipRow) {
    const v = videoRef.current;
    if (!v) return;
    const start = Math.max(0, clip.startMs - padding.beforeMs);
    stopAtRef.current = clip.endMs + padding.afterMs;
    v.currentTime = start / 1000;
    void v.play();
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function run(fn: () => Promise<ActionResult>) {
    setListError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setListError(res.error);
    });
  }

  const total = clips.reduce((acc, c) => acc + (c.endMs - c.startMs), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        {playbackUrl && (
          <Card className="overflow-hidden">
            {videoError ? (
              <div className="p-5">
                <Alert tone="warning" title="Seu navegador não conseguiu reproduzir este vídeo">
                  Isso acontece com alguns formatos (ex.: H.265/HEVC em navegadores sem suporte). Você ainda pode digitar os horários manualmente — o processamento funciona normalmente.
                </Alert>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={playbackUrl}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full bg-black"
                  onTimeUpdate={onTimeUpdate}
                  onSeeked={onTimeUpdate}
                  onError={() => setVideoError(true)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => seekBy(-5000)} aria-label="Voltar 5 segundos"><Rewind />5s</Button>
                    <Button variant="secondary" size="sm" onClick={() => seekBy(-1000)} aria-label="Voltar 1 segundo">−1s</Button>
                    <Button variant="secondary" size="sm" onClick={() => seekBy(1000)} aria-label="Avançar 1 segundo">+1s</Button>
                    <Button variant="secondary" size="sm" onClick={() => seekBy(5000)} aria-label="Avançar 5 segundos">5s<FastForward /></Button>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tabular" aria-live="off">{formatTimecode(currentMs)}</span>
                </div>
              </>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Adicionar lance</CardTitle>
            <CardDescription>
              {hasPlayer ? "Pause o vídeo e use os botões de bandeira para preencher início e fim com o tempo atual." : "Digite os horários de início e fim do lance."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clips.length >= maxClips ? (
              <Alert tone="warning">Limite de {maxClips} lances por projeto atingido.</Alert>
            ) : (
              <ClipForm
                key={`new-${clips.length}`}
                action={addClipAction.bind(null, projectId)}
                submitLabel="Adicionar lance"
                durationMs={durationMs}
                maxClipMs={maxClipMs}
                currentTimeMs={hasPlayer ? currentMs : null}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-2 lg:self-start">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Lances ({clips.length})</CardTitle>
            <CardDescription>
              Total: {formatDuration(total)}
              {(padding.beforeMs > 0 || padding.afterMs > 0) && ` + margens de ${padding.beforeMs / 1000}s/${padding.afterMs / 1000}s`}
            </CardDescription>
          </div>
          {clips.length > 1 && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => sortClipsAction(projectId))} title="Ordenar pelo horário de início">
              <ArrowDownUp />Ordenar
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {listError && <Alert tone="error">{listError}</Alert>}
          {clips.length === 0 ? (
            <EmptyState title="Nenhum lance marcado" description="Os lances adicionados aparecem aqui, na ordem em que serão exportados." />
          ) : (
            <ol className="flex flex-col gap-2" data-testid="clip-list">
              {clips.map((c, i) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  {editing === c.id ? (
                    <ClipForm
                      action={updateClipAction.bind(null, projectId, c.id)}
                      initial={c}
                      submitLabel="Salvar"
                      durationMs={durationMs}
                      maxClipMs={maxClipMs}
                      currentTimeMs={hasPlayer ? currentMs : null}
                      onDone={() => setEditing(null)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            <span className="text-muted-foreground">#{c.position}</span>{" "}
                            <span className="tabular">{formatTimecode(c.startMs)} → {formatTimecode(c.endMs)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDuration(c.endMs - c.startMs)}{c.title ? ` · ${c.title}` : ""}</p>
                        </div>
                        {c.category && <Badge tone="success">{CLIP_CATEGORY_LABELS[c.category]}</Badge>}
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground break-words">{c.notes}</p>}
                      <div className="flex flex-wrap gap-1">
                        {hasPlayer && <Button variant="secondary" size="sm" onClick={() => preview(c)}><Play />Prévia</Button>}
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c.id)}><Pencil />Editar</Button>
                        <Button variant="ghost" size="icon" disabled={pending || i === 0} onClick={() => run(() => moveClipAction(projectId, c.id, "up"))} aria-label="Mover para cima"><ArrowUp /></Button>
                        <Button variant="ghost" size="icon" disabled={pending || i === clips.length - 1} onClick={() => run(() => moveClipAction(projectId, c.id, "down"))} aria-label="Mover para baixo"><ArrowDown /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger hover:bg-danger-soft"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Remover o lance #${c.position}?`)) run(() => deleteClipAction(projectId, c.id));
                          }}
                          aria-label={`Remover lance ${c.position}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
