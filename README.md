# KMEFIC Daily Hub

Morning market hub for KMEFIC Operations, Electronic Trading, Asset Management and Wealth Management. General market information only, gathered from public sources. Not investment advice.

- `index.html`: the hub page. It loads its data from `data/` at open time. A copy of this file can be shared once, and it keeps fetching the latest day.
- `data/index.json`: `{"dates":[...sorted YYYY-MM-DD], "latest":"YYYY-MM-DD"}`. This is the archive list behind the calendar. Never delete entries.
- `data/YYYY-MM-DD.json`: one file per working day. The schema is the same as the previous day's file. Never edit or delete past days.

## Access and encryption

- The page asks for the team password when the data is encrypted. `setup.html` creates `key.json` on the owner's device, and the password never leaves it.
- `key.json` holds the public key plus the private key sealed with the password (PBKDF2-SHA256 and AES-256-GCM). Each data file uses a fresh AES-256-GCM key wrapped with RSA-OAEP-3072.
- `version.json` holds the page build id. Open pages reload themselves once when a newer build is published.

## Page layout (since 25 Oct 2026)

- `index.html` is a glass dashboard with one screen per view: Overview, Conclusions, Today, Corporate actions & Al-Mowazi, Market making, Markets, News, Management, Studies, Sources. A side rail (desktop) or bottom bar (phone) switches views; every card or row opens its details, sources, calendar buttons and circular downloads in a side panel. The department selector filters every view; search covers every item.
- The previous design is kept in the branch `V1-backup`.


### Linking and quality check
- Any item that mentions a date or a company shows "Related to this item" in its drawer: the Corporate-actions rows of that day, the company's rows and IPO-radar entries, with a button that opens Corporate actions filtered to that day. For this to work, write company names exactly as in ev/ev2 "a" and dates as "1 نوفمبر" / "1 Nov" or YYYY-MM-DD.
- A count such as "7 جمعيات يوم 1 نوفمبر" is checked against the table; a mismatch shows a warning in the drawer.
- signal.s is one short line (≤ 120 characters); longer text goes in signal.p. No "not investment advice" disclaimer anywhere (the hub is internal).
- Open the page with `?qa=1` to get a quality report on the day's real data after unlocking.

## Conclusions (`inf`)

- Each day file carries `inf` (see `_inf_example` and `_notes.inf` in `schema.json`): 4–8 conclusions that link the day's facts into an equation, say what it means, and give direct recommendations to each department. The hub is internal (department heads and staff), so recommendations are written plainly; no buy/sell calls and no price forecasts.
- The page computes the maths itself from the same data (rights issues: TERP, right value, discount, loss if idle, cum date = record − 3 Kuwait trading days; market read; movers; market-making ranges; operations load).
- Conclusions log: `hub-assets/inf/log.json` (private repo, plaintext) keeps every conclusion with its review date. The morning run marks due items `res` = ok / no / part with `resN`, adds today's items, and copies the last 14 days into today's `inf.log` so the page can show the record.
- Days before 25 Oct 2026 have no `inf`; the page says so.

## IPO radar

- `data/ipo/YYYY-MM-DD.json` (encrypted; dates in `index.json` → `ipo`) holds regional (Kuwait incl. Al-Mowazi, Saudi, UAE, Qatar, Oman, Bahrain, Egypt) and US IPOs: open now, coming, recently priced and pre-IPO names (banks hired, confidential or public filing, intention to float), each with company size, deal terms, who can take part and how, dates, news with sources, outlook, risks and confidence. Shape: `_ipo_example` in `schema.json`.
- `post` tracks IPOs KMEFIC clients took part in (currently SpaceX, SPCX): offer price vs latest close, lock-up and earnings dates.
- The page builds, for each opportunity, numbered options with steps (the decision stays with staff and management), ready answers for client questions, and a one-page management brief to copy or print.
- The morning run writes the radar daily; intraday updates may replace or add items by `id`.

## Daily refresh (Sunday–Friday, 07:37 Kuwait)

1. Build today's file from `schema.json`, which shows the structure without any content. Keep every key and the `[Arabic, English]` pair format. Earlier day files may be encrypted, so they are not used as templates.
2. Set `today` and `stamp`.
3. Research everything fresh from the web (do not use Awsat, which blocks cloud access):
   - `signal`, `tape`, `pri`, `agenda`, `agendaSrc`, `mgmt`, `stk`, `otcSrc`, `caNotes`, `dept`, `sources`, and `inf` (conclusions, see above)
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
- The page merges these into the day and tags them "New · HH:MM". An update may also carry `inf` items (same shape as the morning `inf.items`; an item with an existing `id` replaces it), for example when a rights issue's dates are confirmed or the Kuwait close changes the market read. Market entries in an update replace the entry with the same `id`.
- Duplicate check: `data/updates/<date>/seen.json` holds sha256 hashes of normalized titles/URLs already published that day. The morning run writes it too. Hashes reveal no content.

## Markets: top movers for every market

Last-close rule: each market shows its most recent completed session (indices, turnover and top 5 gainers/losers from that same session), with the session date in `d`. Kuwait, Saudi, Qatar, Oman, Bahrain and Egypt trade Sunday–Thursday; UAE, US, UK and Turkey trade Monday–Friday. So Friday's and Sunday's files show Thursday's Kuwait movers, and Monday's file shows Friday's UAE/US/UK/Turkey movers. Saturday has no file, so the page shows Friday's file. A market that did not trade since the previous file is never left empty for that reason.

Sources in order: Kamco Invest "MENA Markets Daily Report" (all GCC + Egypt, top 5 each; MENAFN mirrors the PDF), then Investing.com "... at close of trade" reports (top 3 each; US Dow/S&P/Nasdaq, Saudi, UAE, Egypt, UK, Turkey), then official bulletins (Saudi Exchange daily report, DFM bulletin) and Business Recorder/Reuters and Arabic market wraps (e.g. Al-Shorouk). Never invent movers; say why when missing.

## Market making, studies by department, holidays

- `mm`: the four companies KMEFIC makes a market in (FACIL, MADAR, THURAYA, TAM): last session close, % change, volume, value, trades and volume vs 20-day average, plus alerts (disclosures, assemblies, record dates, unusual-trading clarifications) and a short summary of market-maker obligations under Boursa Kuwait rules. The intraday run after the Kuwait close replaces `mm.co` with today's session.
- Studies carry `dep` (ops, am, wm, mm) and an optional `a` ("Action for the department"). Sundays: all departments; Wednesdays: Operations only. Dates per department are in `index.json` → `studiesDep`.
- `hol`: upcoming exchange holidays for the market-hours board (regular hours are built into the page).

## Client circulars (capital increase / rights issue)

- When a rights issue appears in corporate actions, the run builds the KMEFIC client circular (A4 portrait, PDF + PNG) with `tools/circular/build.py spec.json OUTDIR --fonts <fonts dir>`, then `tools/circular/pack.py OUTDIR BASE draft|final`, which encrypts both files into `data/circulars/` and prints the `circ` object. That object goes on the matching `ev2` item and `pri` item, and the page shows "Client circular" download buttons (PDF, PNG, editable PowerPoint, and Share on phones). The PowerPoint needs the Eurostile and GE SS fonts installed on the computer that edits it.
- Files are clean and sendable (no watermark): staff download them from the hub and send them to Marketing, who release the circular to clients. A spec only gets a watermark if it carries `"watermark": true`. If a detail in a spec is corrected (edit `circulars/<id>.json` in hub-assets), the next run rebuilds and republishes the circular.
- "Last day to receive the request at KMEFIC" defaults to 3 Kuwait business days (Sun–Thu, excluding holidays) before the subscription end.
- The licensed fonts (Eurostile, GE SS, Calibri) are never committed here. They live in the private repo `KmeficMarketing/hub-assets` (`fonts/`), together with the circular specs (`circulars/<id>.json`). Without them `build.py` exits with code 3 and no circular is published.
