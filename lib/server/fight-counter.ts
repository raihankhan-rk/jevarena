import "server-only";

import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export type CounterPersistence = "volume" | "temporary";

interface CounterStorage {
  file: string;
  persistence: CounterPersistence;
}

interface CounterFile {
  fights: number;
}

let storagePromise: Promise<CounterStorage> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

async function writableStorage(
  directory: string,
  persistence: CounterPersistence,
) {
  await mkdir(directory, { recursive: true });
  await access(directory, constants.W_OK);
  return {
    file: path.join(directory, "fights.json"),
    persistence,
  };
}

async function resolveStorage(): Promise<CounterStorage> {
  try {
    return await writableStorage("/data", "volume");
  } catch {
    return writableStorage("/tmp/jevarena", "temporary");
  }
}

function storage() {
  storagePromise ??= resolveStorage();
  return storagePromise;
}

async function readCount(file: string) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<CounterFile>;
    return Number.isSafeInteger(parsed.fights) && (parsed.fights ?? -1) >= 0
      ? (parsed.fights as number)
      : 0;
  } catch {
    return 0;
  }
}

async function writeCount(file: string, fights: number) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify({ fights }), "utf8");
  await rename(temporary, file);
}

export async function getFightCount() {
  await mutationQueue;
  const target = await storage();
  return {
    fights: await readCount(target.file),
    persistence: target.persistence,
  };
}

export function incrementFightCount() {
  const operation = mutationQueue.then(async () => {
    const target = await storage();
    const fights = (await readCount(target.file)) + 1;
    await writeCount(target.file, fights);
    console.log(
      `fight_click total=${fights} persistence=${target.persistence}`,
    );
    return { fights, persistence: target.persistence };
  });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
