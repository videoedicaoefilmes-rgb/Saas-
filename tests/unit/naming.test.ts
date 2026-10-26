import { describe, expect, it } from "vitest";
import { allowedVideoExtension, clipFilename, sanitizeDisplayFilename, slugifyPart, zipFilename } from "@/lib/naming";

describe("nomes de arquivo", () => {
  it("gera atleta_partida_lance_001.mp4", () => {
    expect(clipFilename({ athleteName: "João Pedro", matchName: "Final Sub-15", position: 1 })).toBe("joao_pedro_final_sub-15_lance_001.mp4");
  });
  it("usa o nome do projeto quando não há atleta/partida", () => {
    expect(clipFilename({ projectName: "Copa Verão!", position: 12 })).toBe("copa_verao_lance_012.mp4");
  });
  it("remove caracteres perigosos", () => {
    expect(slugifyPart("../../etc/passwd")).toBe("etc_passwd");
    expect(slugifyPart('a"b<c>|d')).toBe("a_b_c_d");
  });
  it("zip", () => {
    expect(zipFilename({ athleteName: "Ana", matchName: null })).toBe("ana_lances.zip");
    expect(zipFilename({})).toBe("projeto_lances.zip");
  });
  it("sanitiza nome exibido", () => {
    expect(sanitizeDisplayFilename("C:\\fakepath\\jogo final.mp4")).toBe("jogo final.mp4");
    expect(sanitizeDisplayFilename("../../x\u0000.mov")).toBe("x.mov");
  });
  it("aceita apenas mp4/mov", () => {
    expect(allowedVideoExtension("a.MP4")).toBe("mp4");
    expect(allowedVideoExtension("a.mov")).toBe("mov");
    expect(allowedVideoExtension("a.avi")).toBeNull();
    expect(allowedVideoExtension("a.mp4.exe")).toBeNull();
  });
});
