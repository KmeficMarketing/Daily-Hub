// Content quality check on a PLAINTEXT day file or update file, run before encrypting.
// Usage: node tools/qa_check.mjs <plain.json> [--update]
// Exit code 0 = no errors (warnings may be printed), 1 = errors that must be fixed before publishing.
import fs from "node:fs";

const file = process.argv[2];
const isUpd = process.argv.includes("--update");
if (!file) { console.error("usage: node tools/qa_check.mjs <plain.json> [--update]"); process.exit(2); }
const D = JSON.parse(fs.readFileSync(file, "utf8"));
const E = [], W = [];
const err = (where, msg) => E.push(`${where}: ${msg}`);
const warn = (where, msg) => W.push(`${where}: ${msg}`);
const A = x => Array.isArray(x) ? (x[0] || "") : String(x || "");
const B = x => Array.isArray(x) ? (x[1] || "") : String(x || "");
const both = x => A(x) + " | " + B(x);

// 1. no disclaimers anywhere (the hub is internal)
const DISC = /(معلومات\s+(سوقية\s+)?عامة[^"]{0,40}(توصية|نصيحة)\s+استثمارية|ليست\s+(توصية|نصيحة)\s+استثمارية|not\s+(an?\s+)?investment\s+(advice|recommendation)|general\s+(market\s+)?information,?\s+not)/i;
const walk = (o, p) => { if (typeof o === "string") { if (DISC.test(o)) err(p, "disclaimer text: " + o.slice(0, 80)); } else if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], p + "." + k); };
walk(D, "file");

// 2. headline and summary: short, plain, every causal claim backed by referenced items
const CAUSE = /(بسبب|بفعل|نتيجة|إثر|جراء|يضغط|تضغط|ضغط على|يدفع|تدفع|مع\s+(استمرار|تصاعد|تراجع|ارتفاع)|\bdue to\b|\bamid\b|\bweighs?\b|\bdriven by\b|\bon (fears|worries|hopes)\b|\bas\s+\w+\s+(rise|fall|rages|continue)s?)/i;
const NICK = /(^|[\s،,(])(تداول|تاسي|إي جي إكس|EGX ?30|TASI|DFMGI|FADGI|QSI|BKP)(?=$|[\s،,.)])/i;
if (D.signal) {
  const s = D.signal;
  if (!isUpd || s.t) {
    if (A(s.t).length > 80) err("signal.t", `headline too long (${A(s.t).length} chars, max 80): ${A(s.t)}`);
    if (A(s.s).length > 120) err("signal.s", `subtitle too long (${A(s.s).length} chars, max 120)`);
    for (const k of ["t", "s"]) if (NICK.test(A(s[k])) || NICK.test(B(s[k]))) err("signal." + k, "exchange nickname or index code in the headline/subtitle (write \"السوق السعودية\", \"البورصة المصرية\"...): " + both(s[k]));
    const claims = ["t", "s", "p"].filter(k => CAUSE.test(A(s[k])) || CAUSE.test(B(s[k])));
    const refs = Array.isArray(s.refs) ? s.refs : [];
    const ssrc = Array.isArray(s.src) ? s.src : [];
    if (claims.length && !refs.length && !ssrc.length) err("signal", `causal wording in ${claims.join(", ")} but no signal.refs pointing to the items whose sources say so (or signal.src in a correction)`);
    refs.forEach(r => {
      const [kind, id] = String(r).split(":");
      let it = null, src = null;
      if (kind === "news") { it = (D.news || [])[+id]; src = it && it.s; }
      else if (kind === "pri") { it = (D.pri || [])[+id]; src = it && it.s; }
      else if (kind === "inf") { it = ((D.inf || {}).items || []).find(x => x.id === id); src = it && it.ev; }
      else if (kind === "mk") { it = (D.mk || []).find(x => x.id === id); src = it && it.src; }
      if (!it) err("signal.refs", `${r} does not exist in this file`);
      else if (!src || !src.length) err("signal.refs", `${r} has no sources`);
    });
  }
}

// 3. every briefing item cites a source
["pri", "news", "caNotes"].forEach(k => (D[k] || []).forEach((x, i) => { if (!(x.s || []).length) err(`${k}[${i}]`, "no source: " + A(x.t)); }));
((D.inf || {}).items || []).forEach(x => { if (!(x.ev || []).length) err(`inf.${x.id}`, "no evidence/sources"); if (!(x.rec || []).length) warn(`inf.${x.id}`, "no recommendations"); if (!x.chk) warn(`inf.${x.id}`, "no review date"); });

// 3b. conclusions: guidance tone (no orders) and the four-axis cross-study
const GUIDE = /^(من المفيد|المتعارف عليه|يُنصح|ينصح|يُستحسن|يستحسن|قد يكون|قد |في حال|عند |عادةً|يفيد|لا يُستحسن)/;
((D.inf || {}).items || []).forEach(x => {
  (x.rec || []).forEach(r => { const t = A(r[1]).trim(); if (t && !GUIDE.test(t)) err(`inf.${x.id}.rec.${r[0]}`, "written as an order; start with guidance (من المفيد… / المتعارف عليه… / يُنصح عادةً… / قد…): " + t.slice(0, 70)); });
  const pred = ["rights", "market", "movers", "mm", "note", "ipo"].includes(x.kind) && !x.x4na;
  if (pred) {
    const ax = x.x4 || {};
    const miss = ["news", "mkt", "geo", "str"].filter(k => !ax[k]);
    if (miss.length) err(`inf.${x.id}`, "cross-study missing axes: " + miss.join(", ") + " (news, market, geopolitics, strength; write gap:true when no sourced info)");
    ["news", "mkt", "geo", "str"].forEach(k => { const a = ax[k]; if (a && !a.gap && !(a.s || []).length) err(`inf.${x.id}.x4.${k}`, "axis has no source"); });
    if (!(x.chain || []).length) warn(`inf.${x.id}`, "no causal chain");
  }
});
// 4. counts tied to a day match the corporate-action rows
const MON = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MEN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = D.today || (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
const yr = +(today.slice(0, 4) || new Date().getFullYear());
const iso = (m, d) => `${yr}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const datesIn = t => { const o = []; MON.forEach((m, i) => { const r = new RegExp("(\\d{1,2})\\s+" + m, "g"); let x; while ((x = r.exec(t))) o.push(iso(i, +x[1])); }); MEN.forEach((m, i) => { const r = new RegExp("(\\d{1,2})\\s+" + m, "g"); let x; while ((x = r.exec(t))) o.push(iso(i, +x[1])); }); return o; };
const rows = d => (D.ev || []).filter(r => r[0] === d).length + (D.ev2 || []).filter(e => e.d === d).length;
const asm = d => (D.ev || []).filter(r => r[0] === d && /جمعية|assembly|agm|egm/i.test(JSON.stringify(r))).length + (D.ev2 || []).filter(e => e.d === d && /جمعية|assembly|agm|egm/i.test(both(e.k))).length;
const W2N = { "ثلاث": 3, "أربع": 4, "خمس": 5, "ست": 6, "سبع": 7, "ثماني": 8, "تسع": 9, "عشر": 10 };
if (!isUpd && (D.ev || D.ev2)) {
  const texts = [];
  ["pri", "caNotes", "agenda", "mgmt"].forEach(k => (D[k] || []).forEach((x, i) => texts.push([`${k}[${i}]`, JSON.stringify(x)])));
  if (D.signal) texts.push(["signal", JSON.stringify(D.signal)]);
  ((D.inf || {}).items || []).forEach(x => texts.push([`inf.${x.id}`, JSON.stringify(x)]));
  texts.forEach(([where, t]) => {
    const r = /(\d+|ثلاث|أربع|خمس|ست|سبع|ثماني|تسع|عشر)\s*(جمعيات|جمعية)/g; let x;
    while ((x = r.exec(t))) {
      const n = W2N[x[1]] || +x[1];
      const aft = t.slice(x.index + x[0].length, x.index + x[0].length + 32), bef = t.slice(Math.max(0, x.index - 32), x.index);
      if (/بين|حتى|إلى|خلال/.test(aft + " " + bef.slice(-14))) continue;
      const da = datesIn(aft), db = datesIn(bef);
      let d = da.length === 1 ? da[0] : (!da.length && db.length ? db[db.length - 1] : null);
      if (!d && /^\s*(عامة\s+)?اليوم/.test(aft)) d = today;
      if (!d) continue;
      const real = asm(d);
      if (real !== n) err(where, `says ${n} assemblies on ${d}, the ev/ev2 tables have ${real} (all rows that day: ${rows(d)})`);
    }
  });
}

// 5. markets: indices and movers or a reason
(D.mk || []).forEach(m => {
  if (!(m.idx || []).length) err(`mk.${m.id}`, "no indices");
  if (!((m.g || []).length && (m.l || []).length) && !A(m.note)) err(`mk.${m.id}`, "no top gainers/losers and no reason in note");
  if (!(m.src || []).length) warn(`mk.${m.id}`, "no source line");
});

console.log(JSON.stringify({ file, errors: E, warnings: W }, null, 1));
process.exit(E.length ? 1 : 0);
