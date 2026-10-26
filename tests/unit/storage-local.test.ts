import { describe, expect, it } from "vitest";
import { LocalStorage } from "@/server/storage/local";
import { exportKey, sourceKey, assertSafeKey } from "@/server/storage/keys";

const storage = new LocalStorage("/tmp/gm-test-storage", "s".repeat(40), "http://localhost:3000");

function tokenFrom(url: string) {
  return new URL(url).searchParams.get("t")!;
}

describe("URLs assinadas do driver local", () => {
  it("token válido é aceito apenas para a operação correta", async () => {
    const url = await storage.createDownloadUrl("users/abcdefgh/a.mp4", { ttlSeconds: 60 });
    const t = tokenFrom(url);
    expect(storage.verify(t, "get")?.k).toBe("users/abcdefgh/a.mp4");
    expect(storage.verify(t, "put")).toBeNull();
  });
  it("token adulterado é rejeitado", async () => {
    const t = tokenFrom(await storage.createDownloadUrl("users/abcdefgh/a.mp4", { ttlSeconds: 60 }));
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "users/outro1234/b.mp4", o: "get", e: 9999999999 })).toString("base64url");
    expect(storage.verify(`${forged}.${sig}`, "get")).toBeNull();
    expect(storage.verify(`${body}.${sig}x`, "get")).toBeNull();
  });
  it("token expirado é rejeitado", () => {
    const t = storage.sign({ k: "users/abcdefgh/a.mp4", o: "get", e: Math.floor(Date.now() / 1000) - 1 });
    expect(storage.verify(t, "get")).toBeNull();
  });
  it("token assinado com outro segredo é rejeitado", () => {
    const other = new LocalStorage("/tmp/x", "z".repeat(40), "http://localhost:3000");
    const t = other.sign({ k: "users/abcdefgh/a.mp4", o: "get", e: 9999999999 });
    expect(storage.verify(t, "get")).toBeNull();
  });
});

describe("chaves de armazenamento (path traversal)", () => {
  it("chaves geradas são seguras", () => {
    expect(sourceKey("user12345", "proj12345", "asset12345", "mp4")).toBe("users/user12345/projects/proj12345/source/asset12345.mp4");
    expect(exportKey("user12345", "proj12345", "job123456", "exp123456")).toMatch(/^users\/user12345\/projects\/proj12345\/jobs\/job123456\/exp123456\.mp4$/);
  });
  it("IDs com caracteres perigosos são rejeitados", () => {
    expect(() => sourceKey("../etc", "proj12345", "asset12345", "mp4")).toThrow();
    expect(() => sourceKey("user12345", "proj/../x", "asset12345", "mp4")).toThrow();
  });
  it.each(["../x.mp4", "users/../../etc/passwd", "/abs/path.mp4", "a//b.mp4", "a/b c.mp4", "a/b.mp4/.."])("rejeita %j", (key) => {
    expect(() => assertSafeKey(key)).toThrow();
    expect(() => storage.resolvePath(key)).toThrow();
  });
});
