import { statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  addAthleteMark,
  deleteAthleteMark,
  listAthleteMarks,
  MAX_MARKS_PER_VIDEO,
  updateAthleteInfo,
} from "@/server/services/athlete";
import { completeUpload, probeAsset, requestUpload } from "@/server/services/media";
import { createProject } from "@/server/services/projects";
import { fixtures } from "../fixtures/videos";
import { createUser, putLocalObject, resetDb, testFfmpeg } from "../helpers";
import { readyProject } from "./flow-helpers";

describe("identificação do atleta", () => {
  beforeEach(resetDb);

  it("guarda o instante e o ponto clicado, em ordem de tempo", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    await addAthleteMark(u.id, project.id, { timeMs: 30_000, x: 0.25, y: 0.6 });
    await addAthleteMark(u.id, project.id, { timeMs: 5_000, x: 0.5, y: 0.5 });
    const marks = await listAthleteMarks(u.id, project.id);
    expect(marks.map((m) => [m.timeMs, m.x, m.y])).toEqual([
      [5_000, 0.5, 0.5],
      [30_000, 0.25, 0.6],
    ]);
  });

  it("recusa ponto fora da imagem e instante fora do vídeo", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    await expect(addAthleteMark(u.id, project.id, { timeMs: 1000, x: 1.2, y: 0.5 })).rejects.toThrow();
    await expect(addAthleteMark(u.id, project.id, { timeMs: 1000, x: 0.5, y: -0.1 })).rejects.toThrow();
    await expect(addAthleteMark(u.id, project.id, { timeMs: -1, x: 0.5, y: 0.5 })).rejects.toThrow();
    await expect(addAthleteMark(u.id, project.id, { timeMs: 61_000, x: 0.5, y: 0.5 })).rejects.toThrow(/fora da duração/);
  });

  it("exige vídeo validado", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Sem vídeo" });
    await expect(addAthleteMark(u.id, p.id, { timeMs: 0, x: 0.5, y: 0.5 })).rejects.toThrow(/Envie o vídeo/);
  });

  it("limita a quantidade de marcações por vídeo", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    for (let i = 0; i < MAX_MARKS_PER_VIDEO; i++) await addAthleteMark(u.id, project.id, { timeMs: i * 1000, x: 0.5, y: 0.5 });
    await expect(addAthleteMark(u.id, project.id, { timeMs: 59_000, x: 0.5, y: 0.5 })).rejects.toThrow(/Limite/);
  });

  it("marcações de um vídeo substituído deixam de valer", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, []);
    await addAthleteMark(u.id, project.id, { timeMs: 1000, x: 0.5, y: 0.5 });
    const size = statSync(fixtures.movNoAudio).size;
    const { assetId } = await requestUpload(u.id, { projectId: project.id, filename: "novo.mov", sizeBytes: size, rightsConfirmed: true });
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    await putLocalObject(asset.storageKey, fixtures.movNoAudio);
    await completeUpload(u.id, assetId);
    await probeAsset(assetId, testFfmpeg);
    expect(await listAthleteMarks(u.id, project.id)).toHaveLength(0);
  });

  it("cor e número da camisa são validados", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Projeto" });
    await expect(updateAthleteInfo(u.id, p.id, { jerseyColor: "Azul", jerseyNumber: "10a" })).rejects.toThrow(/dígitos/);
    expect(await updateAthleteInfo(u.id, p.id, { jerseyColor: " Azul ", jerseyNumber: "7" })).toEqual({ jerseyColor: "Azul", jerseyNumber: "7" });
    expect(await updateAthleteInfo(u.id, p.id, { jerseyColor: "", jerseyNumber: "" })).toEqual({ jerseyColor: null, jerseyNumber: null });
  });

  it("outro usuário não vê, cria nem apaga marcações", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const { project } = await readyProject(owner.id, []);
    const mark = await addAthleteMark(owner.id, project.id, { timeMs: 1000, x: 0.5, y: 0.5 });
    const code = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof AppError ? e.code : e));
    expect(await code(listAthleteMarks(intruder.id, project.id))).toBe("NOT_FOUND");
    expect(await code(addAthleteMark(intruder.id, project.id, { timeMs: 1000, x: 0.5, y: 0.5 }))).toBe("NOT_FOUND");
    expect(await code(deleteAthleteMark(intruder.id, mark.id))).toBe("NOT_FOUND");
    expect(await code(updateAthleteInfo(intruder.id, project.id, { jerseyNumber: "9" }))).toBe("NOT_FOUND");
    expect(await listAthleteMarks(owner.id, project.id)).toHaveLength(1);
  });
});
