import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { decryptBackup, encryptBackup, fileDigest, loadBackupKey } from "./crypto.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "aimc-backup-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("encrypted backups round trip binary data and use private files", async (t) => {
  const root = await fixture(t);
  const key = await loadBackupKey(join(root, "key"), { create: true });
  const plaintext = randomBytes(256 * 1024);
  const encrypted = join(root, "archive.enc");
  const restored = join(root, "restored");
  await encryptBackup(Readable.from([plaintext]), encrypted, key);
  assert.equal((await stat(encrypted)).mode & 0o077, 0);
  assert.equal((await fileDigest(encrypted)).length, 64);
  await decryptBackup(encrypted, restored, key);
  assert.deepEqual(await readFile(restored), plaintext);
  assert.equal((await stat(restored)).mode & 0o077, 0);
});

test("tampered ciphertext and the wrong key cannot leave a restorable file", async (t) => {
  const root = await fixture(t);
  const key = randomBytes(32);
  const encrypted = join(root, "archive.enc");
  await encryptBackup(Readable.from([randomBytes(1024)]), encrypted, key);
  await assert.rejects(decryptBackup(encrypted, join(root, "wrong-key"), randomBytes(32)));
  await assert.rejects(stat(join(root, "wrong-key")), { code: "ENOENT" });
  const bytes = await readFile(encrypted);
  bytes[40] ^= 1;
  await writeFile(encrypted, bytes, { mode: 0o600 });
  await assert.rejects(decryptBackup(encrypted, join(root, "tampered"), key));
  await assert.rejects(stat(join(root, "tampered")), { code: "ENOENT" });
});

test("backup operations refuse overwrites and insecure key permissions", async (t) => {
  const root = await fixture(t);
  const keyPath = join(root, "key");
  const key = await loadBackupKey(keyPath, { create: true });
  const encrypted = join(root, "archive.enc");
  await encryptBackup(Readable.from(["original"]), encrypted, key);
  const digest = await fileDigest(encrypted);
  await assert.rejects(encryptBackup(Readable.from(["replacement"]), encrypted, key));
  assert.equal(await fileDigest(encrypted), digest);
  await chmod(keyPath, 0o644);
  await assert.rejects(loadBackupKey(keyPath));
  await assert.rejects(loadBackupKey(keyPath, { create: true }), { code: "EEXIST" });
});
