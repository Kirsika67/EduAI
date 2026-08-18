<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EduAI — juhised agendile

> Ülalolev plokk on masina hallatav ja **ei kehti selle rakenduse kohta**. Juurkaustas olev
> `app/` on kasutamata Next.js jäänuk. Ära ehita selle peale ega loe Next.js dokumentatsiooni.

## Töötav rakendus

- `server/` — Node + Express + better-sqlite3 (ESM, `type: module`)
- `client/` — React 18 + Vite + Tailwind (plain JSX, mitte TypeScript)
- npm workspaces: `npm run dev` juurkaustast käivitab mõlemad

## Enne koodi kirjutamist loe

`docs/ARHITEKTUUR_JA_PLAAN.md` — seal on kaardistus, mis on juba olemas, konfliktid
ehitusjuhendiga (`~/Downloads/EduAI_Claude_Code_ehitusjuhend.md`) ja parandatud faasiplaan.
Juhendi SQL-plokke ei tohi rakendada sõna-sõnalt: mitu tabelit on juba olemas teiste veergudega.

## Kõvad reeglid

- **Kontode tabel on `teachers`, mitte `users`** — seal on kõik rollid, ka vanem ja õpilane.
- **Rollikontroll käib alati backendis** (`requireRole`), frontend peidab ainult UI-d.
- **`abcRisk.score` = kõrgem on parem.** `riskScore` = kõrgem on riskantsem. Ära neid sega.
- **ID-d normaliseeri `Number()`-iga** enne võrdlemist (SQLite annab numbri, URL stringi).
- **ClassContext peab olema laetud enne fetch'i**: `if (classesLoading) return <div>Laadin...</div>`.
- **Mitte kunagi `Promise.all`** — päringud järjest, et üks ebaõnnestunud fetch ei võtaks maha tervet lehte.
- **Kõik kasutajale nähtav tekst on eesti keeles.**
- **Tundlik lugemine/kirjutamine läheb `audit_log`-i** (`services/audit.js`).
- **AI ei tuleta emotsioone** — heaolu tuleb ainult õpilase enda klõpsust.
- **Anthropic mudel on ühes kohas**: `server/src/constants/ai.js`.
- Üks faas korraga: valmis → `npm run dev` → käsitsi test → commit.
