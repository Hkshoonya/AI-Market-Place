import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, lstat, open, readFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("AIMCBACKUP1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export async function loadBackupKey(path, { create = false } = {}) {
  if (create) {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(randomBytes(32));
    } finally {
      await handle.close();
    }
  }
  const info = await lstat(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size !== 32) {
    throw new Error("Backup key must be a private, regular, 32-byte file (mode 600).");
  }
  return readFile(path);
}

export async function encryptBackup(input, path, key) {
  const header = Buffer.concat([MAGIC, randomBytes(IV_BYTES)]);
  const cipher = createCipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  cipher.setAAD(header);
  const output = createWriteStream(path, { flags: "wx", mode: 0o600 });
  let created = false;
  output.once("open", () => { created = true; });
  try {
    output.write(header);
    await pipeline(input, cipher, output);
    await appendFile(path, cipher.getAuthTag());
  } catch (error) {
    if (created) await rm(path, { force: true });
    throw error;
  }
}

export async function encryptJson(value, path, key) {
  await encryptBackup(Readable.from([JSON.stringify(value, null, 2)]), path, key);
}

// Authenticate the entire archive before making any plaintext available to a restore.
export async function decryptBackup(path, destination, key) {
  const info = await lstat(path);
  if (!info.isFile() || info.size <= MAGIC.length + IV_BYTES + TAG_BYTES) {
    throw new Error("Invalid encrypted backup.");
  }
  const handle = await open(path, "r");
  const header = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, info.size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Invalid encrypted backup format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  let created = false;
  output.once("open", () => { created = true; });
  try {
    await pipeline(
      createReadStream(path, { start: header.length, end: info.size - TAG_BYTES - 1 }),
      decipher,
      output,
    );
  } catch {
    if (created) await rm(destination, { force: true });
    throw new Error("Backup authentication failed; plaintext was removed.");
  }
}

export async function fileDigest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
