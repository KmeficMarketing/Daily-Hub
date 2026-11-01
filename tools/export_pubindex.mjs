// One-off / periodic export (run by the key owner, on their own machine):
// decrypts the Hub's corporate-action data with the team password and writes a PLAIN, non-sensitive
// index of what was already published (company, type, dates), so scheduled routines can skip
// duplicates without ever holding the password.
// Usage:  HUB_PW='<password>' node tools/export_pubindex.mjs <out.json>
// The password is read from the environment only; it is never written anywhere.
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const S = webcrypto.subtle, root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = process.env.HUB_PW, out = process.argv[2];
if (!pw || !out) { console.error("usage: HUB_PW=... node tools/export_pubindex.mjs <out.json>"); process.exit(1); }
const u = (s) => Buffer.from(s, "base64");
const kj = JSON.parse(fs.readFileSync(path.join(root, "key.json"), "utf8"));
const base = await S.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
const ak = await S.deriveKey({ name: "PBKDF2", salt: u(kj.salt), iterations: kj.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
let priv;
try { priv = await S.importKey("pkcs8", await S.decrypt({ name: "AES-GCM", iv: u(kj.iv) }, ak, u(kj.ct)), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]); }
catch { console.error("wrong password"); process.exit(2); }
async function dec(f) {
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!o.enc) return o;
  const raw = await S.decrypt({ name: "RSA-OAEP" }, priv, u(o.k));
  const k = await S.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv: u(o.iv) }, k, u(o.ct))));
}
const D = path.join(root, "data"), rows = [], seen = new Set();
const add = (r) => { const k = JSON.stringify(r); if (!seen.has(k)) { seen.add(k); rows.push(r); } };
const files = [];
for (const f of fs.readdirSync(D)) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) files.push([f.slice(0, 10), path.join(D, f)]);
const UD = path.join(D, "updates");
if (fs.existsSync(UD)) for (const d of fs.readdirSync(UD)) for (const f of fs.readdirSync(path.join(UD, d))) if (/^\d{4}\.json$/.test(f)) files.push([d, path.join(UD, d, f)]);
for (const [d, f] of files) {
  const o = await dec(f);
  for (const src of ["ev", "ev2"]) for (const x of o[src] || []) add({ pub: d, src, co: x.a || x.n || null, t: x.t || x.ty || null, dt: x.d || x.dt || null });
}
const OU = path.join(D, "opsupd");
const opsFiles = [path.join(D, "ops.json"), ...(fs.existsSync(OU) ? fs.readdirSync(OU).map((f) => path.join(OU, f)) : [])];
for (const f of opsFiles) {
  if (!fs.existsSync(f)) continue;
  const o = await dec(f);
  for (const r of Array.isArray(o) ? o : o.rows || []) add({ ops: 1, id: r.id, code: r.code, name: r.name, ev: r.ev, cum: r.cum, dist: r.dist });
}
fs.writeFileSync(out, JSON.stringify({ asof: new Date().toISOString().slice(0, 10), n: rows.length, rows }, null, 1));
console.log("wrote", out, rows.length, "rows");
