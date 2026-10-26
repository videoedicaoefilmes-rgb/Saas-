import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createProject, deleteProject, getProjectDetail, updateProject } from "@/server/services/projects";
import { addClip, deleteClip, moveClip, sortClipsByTime, updateClip } from "@/server/services/clips";
import { getStorage } from "@/server/storage";
import { createUser, resetDb } from "../helpers";
import { readyProject } from "./flow-helpers";

describe("projetos e lances", () => {
  beforeEach(resetDb);

  it("cria projeto com campos opcionais e margens", async () => {
    const u = await createUser();
    const p = await createProject(u.id, {
      name: "  Copa Verão  ",
      athleteName: "Ana",
      teamName: "",
      matchName: "Semifinal",
      matchDate: "2026-10-20",
      cutMode: "FAST",
      paddingBeforeSeconds: 2,
      paddingAfterSeconds: 3,
    });
    expect(p).toMatchObject({ name: "Copa Verão", athleteName: "Ana", teamName: null, cutMode: "FAST", paddingBeforeMs: 2000, paddingAfterMs: 3000 });
    expect(p.matchDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
  });

  it("valida nome, data e margens", async () => {
    const u = await createUser();
    await expect(createProject(u.id, { name: "" })).rejects.toThrow();
    await expect(createProject(u.id, { name: "Ok", matchDate: "20/10/2026" })).rejects.toThrow();
    await expect(createProject(u.id, { name: "Ok", paddingBeforeSeconds: 99 })).rejects.toThrow();
    const p = await createProject(u.id, { name: "Ok" });
    await expect(updateProject(u.id, p.id, { name: "x" })).rejects.toThrow();
  });

  it("adiciona lances convertendo horários e validando contra a duração do vídeo", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    const c = await addClip(u.id, project.id, { start: "00:12", end: "0:20.5", title: "Assistência", category: "ASSIST", notes: "lado esquerdo" });
    expect(c).toMatchObject({ startMs: 12_000, endMs: 20_500, position: 1, category: "ASSIST" });
    await expect(addClip(u.id, project.id, { start: "00:50", end: "01:10" })).rejects.toThrow(/ultrapassa/);
    await expect(addClip(u.id, project.id, { start: "00:20", end: "00:10" })).rejects.toThrow(/depois do início/);
    await expect(addClip(u.id, project.id, { start: "-1", end: "00:10" })).rejects.toThrow(/negativo/);
    await expect(addClip(u.id, project.id, { start: "ab", end: "00:10" })).rejects.toThrow(/Início/);
    await expect(addClip(u.id, project.id, { start: "1", end: "2", category: "INVALIDA" as never })).rejects.toThrow();
  });

  it("edita, reordena, ordena por tempo e remove renumerando", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, [["00:40", "00:45"], ["00:10", "00:15"], ["00:25", "00:30"]]);
    const ids = async () => (await db.clip.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } })).map((c) => c.startMs);
    expect(await ids()).toEqual([40_000, 10_000, 25_000]);

    const second = await db.clip.findFirstOrThrow({ where: { projectId: project.id, position: 2 } });
    await moveClip(u.id, second.id, "up");
    expect(await ids()).toEqual([10_000, 40_000, 25_000]);
    await moveClip(u.id, second.id, "up"); // já é o primeiro: sem efeito
    expect(await ids()).toEqual([10_000, 40_000, 25_000]);

    await sortClipsByTime(u.id, project.id);
    expect(await ids()).toEqual([10_000, 25_000, 40_000]);

    await updateClip(u.id, second.id, { start: "00:11", end: "00:16", title: "Gol" });
    expect(await ids()).toEqual([11_000, 25_000, 40_000]);

    await deleteClip(u.id, second.id);
    const rest = await db.clip.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } });
    expect(rest.map((c) => c.position)).toEqual([1, 2]);
  });

  it("limite de lances por projeto", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    const { updateSettings } = await import("@/server/settings");
    await updateSettings({ maxClipsPerJob: 2 }, u.id);
    await addClip(u.id, project.id, { start: "1", end: "2" });
    await addClip(u.id, project.id, { start: "3", end: "4" });
    await expect(addClip(u.id, project.id, { start: "5", end: "6" })).rejects.toThrow(/Limite de 2/);
  });

  it("excluir projeto remove registros e arquivos", async () => {
    const u = await createUser();
    const { project, storageKey } = await readyProject(u.id, [["1", "2"]]);
    expect(await getStorage().head(storageKey)).not.toBeNull();
    await deleteProject(u.id, project.id);
    expect(await getStorage().head(storageKey)).toBeNull();
    await expect(getProjectDetail(u.id, project.id)).rejects.toThrow(/não encontrado/);
    expect(await db.clip.count()).toBe(0);
  });
});
