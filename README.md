# KMEFIC Daily Hub

Morning market hub for KMEFIC Operations, Electronic Trading, Asset Management and Wealth Management. General market information only, gathered from public sources. Not investment advice.

- `index.html`: the hub page. It loads its data from `data/` at open time. A copy of this file can be shared once, and it keeps fetching the latest day.
- `data/index.json`: `{"dates":[...sorted YYYY-MM-DD], "latest":"YYYY-MM-DD"}`. This is the archive list behind the calendar. Never delete entries.
- `data/YYYY-MM-DD.json`: one file per working day. The schema is the same as the previous day's file. Never edit or delete past days.

## Access and encryption

- The page asks for the team password when the data is encrypted. `setup.html` creates `key.json` on the owner's device, and the password never leaves it.
- `key.json` holds the public key plus the private key sealed with the password (PBKDF2-SHA256 and AES-256-GCM). Each data file uses a fresh AES-256-GCM key wrapped with RSA-OAEP-3072.
- `version.json` holds the page build id. Open pages reload themselves once when a newer build is published.

## Daily refresh (Sunday–Friday, 07:37 Kuwait)

1. Build today's file from `schema.json`, which shows the structure without any content. Keep every key and the `[Arabic, English]` pair format. Earlier day files may be encrypted, so they are not used as templates.
2. Set `today` and `stamp`.
3. Research everything fresh from the web (do not use Awsat, which blocks cloud access):
   - `signal`, `tape`, `pri`, `agenda`, `agendaSrc`, `mgmt`, `stk`, `otcSrc`, `caNotes`, `dept`, `sources`
   - `mk`: the Kuwait entry (`id` `kw`) must include the top 5 gainers and losers as `g` and `l` with price (fils) and % change. Kamco Invest's "MENA Markets Daily Report" is the first source to try; if it isn't available, use Boursa Kuwait, Argaam or Kuwaiti newspapers. Never leave the tables empty without saying why in the note and the gaps line.
   - corporate actions: `ev` is Al‑Mowazi/OTC, `ev2` is main market. Cover upcoming and recent events.
   - `news`: Regional & Political News tab, 6–10 items ranked by impact. Each item gives the facts, the likely effect on the Kuwaiti market, the US market and KMEFIC's brokerage and asset-management activity, plus its sources. Wording is neutral, with no political opinion and no investment advice. Mark single-source reports with `"unv": true`.
     Axios is a primary source for US politics and regional diplomacy. Its "Exclusive" or anonymous-source stories are marked `"unv": true` unless Reuters, AP or an official statement confirms them. Never take market figures from Axios, and add a second source where possible.
4. Studies are not stored in day files. On Sundays, write a fresh studies array to `data/studies/YYYY-MM-DD.json` (shape in `schema.json` under `_studies_example`) and add the date to `index.json` → `studies`. The page shows the latest studies file on or before the viewed day.
5. The Arabic is formal. Cite a source for every figure. If a figure can't be confirmed, say so in the `sources` gaps line rather than guessing.
6. Save the plaintext outside the repo (for example `/tmp/YYYY-MM-DD.plain.json`). If `key.json` exists in the repo root, encrypt it into place with `node tools/encrypt.mjs /tmp/YYYY-MM-DD.plain.json data/YYYY-MM-DD.json` (same for studies). If there is no `key.json` yet, copy the plaintext into `data/`. Never commit plaintext once `key.json` exists.
7. Add the date to `data/index.json` → `dates`, set `latest`, then commit and push to `main`.

## Intraday additions (hourly 09:05–17:05 Kuwait, Sunday–Friday)

- Each run adds only what is new since the last publication: news, corporate actions, priority items, and closes (Kuwait/GCC close after 13:00, US moves later). It writes `data/updates/<date>/<HHMM>.json`, encrypted when `key.json` exists, and adds `HHMM` to `index.json` → `upd[<date>]`. If nothing is new, it writes nothing.
- The page merges these into the day and tags them "New · HH:MM". Market entries in an update replace the entry with the same `id`.
- Duplicate check: `data/updates/<date>/seen.json` holds sha256 hashes of normalized titles/URLs already published that day. The morning run writes it too. Hashes reveal no content.

## Markets: top movers for every market

Last-close rule: each market shows its most recent completed session (indices, turnover and top 5 gainers/losers from that same session), with the session date in `d`. Kuwait, Saudi, Qatar, Oman, Bahrain and Egypt trade Sunday–Thursday; UAE, US, UK and Turkey trade Monday–Friday. So Friday's and Sunday's files show Thursday's Kuwait movers, and Monday's file shows Friday's UAE/US/UK/Turkey movers. Saturday has no file, so the page shows Friday's file. A market that did not trade since the previous file is never left empty for that reason.

Sources in order: Kamco Invest "MENA Markets Daily Report" (all GCC + Egypt, top 5 each; MENAFN mirrors the PDF), then Investing.com "... at close of trade" reports (top 3 each; US Dow/S&P/Nasdaq, Saudi, UAE, Egypt, UK, Turkey), then official bulletins (Saudi Exchange daily report, DFM bulletin) and Business Recorder/Reuters and Arabic market wraps (e.g. Al-Shorouk). Never invent movers; say why when missing.

## Market making, studies by department, holidays

- `mm`: the four companies KMEFIC makes a market in (FACIL, MADAR, THURAYA, TAM): last session close, % change, volume, value, trades and volume vs 20-day average, plus alerts (disclosures, assemblies, record dates, unusual-trading clarifications) and a short summary of market-maker obligations under Boursa Kuwait rules. The intraday run after the Kuwait close replaces `mm.co` with today's session.
- Studies carry `dep` (ops, am, wm, mm) and an optional `a` ("Action for the department"). Sundays: all departments; Wednesdays: Operations only. Dates per department are in `index.json` → `studiesDep`.
- `hol`: upcoming exchange holidays for the market-hours board (regular hours are built into the page).
