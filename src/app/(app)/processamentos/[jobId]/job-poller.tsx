"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Consulta o status a cada 2 s e atualiza a página quando algo muda. */
export function JobPoller({ jobId }: { jobId: string }) {
  const router = useRouter();
  const last = useRef<string>("");
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { status: string; exports: { status: string }[] };
          const sig = `${body.status}:${body.exports.map((e) => e.status).join(",")}`;
          if (last.current && sig !== last.current) router.refresh();
          last.current = sig;
          if (body.status !== "QUEUED" && body.status !== "RUNNING") {
            router.refresh();
            return;
          }
        }
      } catch {
        // rede instável: tenta de novo
      }
      if (!stop) timer = setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId, router]);
  return null;
}
