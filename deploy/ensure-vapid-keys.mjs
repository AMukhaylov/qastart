import { readFile, writeFile } from "node:fs/promises";
import webpush from "web-push";

const envPath = new URL("../.env", import.meta.url);
const contents = await readFile(envPath, "utf8");
const hasPublic = /^VAPID_PUBLIC_KEY=.+$/m.test(contents);
const hasPrivate = /^VAPID_PRIVATE_KEY=.+$/m.test(contents);

if (hasPublic && hasPrivate) {
  console.log("Existing VAPID push keys found.");
} else {
  const keys = webpush.generateVAPIDKeys();
  const lines = contents
    .split(/\r?\n/)
    .filter((line) => !/^VAPID_(PUBLIC|PRIVATE)_KEY=/.test(line));
  lines.push(`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`);
  await writeFile(envPath, `${lines.filter(Boolean).join("\n")}\n`, { mode: 0o600 });
  console.log("Generated VAPID keys for web push.");
}
