import { getEnv } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";

let instance: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (instance) return instance;
  const env = getEnv();
  if (env.STORAGE_DRIVER === "s3") {
    instance = new S3Storage(env.S3_BUCKET!, {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  } else {
    instance = new LocalStorage(env.STORAGE_LOCAL_DIR, env.STORAGE_SIGNING_SECRET!, env.APP_URL);
  }
  return instance;
}

export function getLocalStorage(): LocalStorage | null {
  const s = getStorage();
  return s instanceof LocalStorage ? s : null;
}

/** Apenas para testes. */
export function setStorageForTests(driver: StorageDriver | null): void {
  instance = driver;
}
