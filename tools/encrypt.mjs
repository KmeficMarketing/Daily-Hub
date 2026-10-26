// Encrypt hub data files with the public key in key.json (the password is never needed here).
// Usage:
//   node tools/encrypt.mjs <plain.json> <data/YYYY-MM-DD.json>   encrypt one file
//   node tools/encrypt.mjs --all                                  encrypt every plaintext data/*.json and data/studies/*.json in place (index.json stays plain)
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const S = webcrypto.subtle;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = path.join(root, "key.json");
if (!fs.existsSync(keyPath)) { console.error("key.json not found in repo root; cannot encrypt."); process.exit(2); }
const kj = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const pub = await S.importKey("spki", Buffer.from(kj.pub, "base64"), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
const b64 = (b) => Buffer.from(b).toString("base64");

async function enc(obj) {
  const ak = await S.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const raw = await S.exportKey("raw", ak);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await S.encrypt({ name: "AES-GCM", iv }, ak, new TextEncoder().encode(JSON.stringify(obj)));
  const k = await S.encrypt({ name: "RSA-OAEP" }, pub, raw);
  return { enc: 1, alg: "RSA-OAEP-256/AES-256-GCM", k: b64(k), iv: b64(iv), ct: b64(ct) };
}

const args = process.argv.slice(2);
if (args[0] === "--all") {
  let n = 0;
  for (const dir of [path.join(root, "data"), path.join(root, "data", "studies")]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    const p = path.join(dir, f);
    const obj = JSON.parse(fs.readFileSync(p, "utf8"));
    if (obj.enc) continue;
    fs.writeFileSync(p, JSON.stringify(await enc(obj)));
    n++; console.log("encrypted", path.relative(root, p));
  }
  }
  console.log(n, "file(s) encrypted");
} else if (args.length === 2) {
  const [src, dst] = args;
  if (!/data[\\/]((studies[\\/]|ipo[\\/])?\d{4}-\d{2}-\d{2}|updates[\\/]\d{4}-\d{2}-\d{2}[\\/]\d{4}|circulars[\\/][A-Za-z0-9_-]+\.(pdf|png|pptx)|kb|calc)\.json$/.test(dst)) { console.error("output must be data/YYYY-MM-DD.json, data/studies/YYYY-MM-DD.json, data/ipo/YYYY-MM-DD.json, data/updates/YYYY-MM-DD/HHMM.json data/circulars/<name>.(pdf|png|pptx).json or data/kb.json"); process.exit(1); }
  const obj = JSON.parse(fs.readFileSync(src, "utf8"));
  if (obj.enc) { console.error("input is already encrypted"); process.exit(1); }
  fs.writeFileSync(dst, JSON.stringify(await enc(obj)));
  console.log("encrypted", dst);
} else {
  console.error("usage: node tools/encrypt.mjs <plain.json> <data/YYYY-MM-DD.json> | --all"); process.exit(1);
}
