@AGENTS.md

# EduAI — kokkuvõte järgmisele vestlusele (okt 2026)

Lisa see enne tööd läbi; `AGENTS.md` (ülal) kehtib endiselt.

## Mis see on
Õpetaja abiline (eesti keel). Stuudiumi-laadne päis, aga meie AI-lisadega. Stack: React 18 + Vite + Tailwind (`client/`), Express + better-sqlite3 (`server/`), Anthropic API, JWT. Live: https://eduai-app-qnhe.onrender.com (Render, Frankfurt, Starter + püsiketas). Repo: `Kirsika67/EduAI`, haru `main`.

## Mis on tehtud (ja pushitud)
- **Päevik** (`/paevik`): tänased tunnid, asendused, puudumised (ka juhtkonna eest), ülesanded/kodutööd, kontrolltööd, tunnikavad, viimased hinded/märked, AI päevakokkuvõte. Alamvahekaardid Ülevaade | Profil | Veel.
- **Tera**, **Suhtlus** (Kõik/Lugemata/Lemmikud/Saadetud/Grupid/Kalender, AI sõnumiabi, vastuvõtja roll), **Kooli liikmed**, **Profiil** (nimi, parool), **Kool ja konto** (liitumiskoodi vahetus).
- **AI planeerija** (`/planeerija`): vestlused salvestuvad serveris 20 päeva (`planner_chats`), pilte ei salvestata; õpilaste andmed (keskmine, viimased hinded, märgete arv) antakse kontekstis, nimed pseudonümiseeritakse. Mobiilis täisekraan (Claude/ChatGPT-stiil), vasakult paneel.
- **Materjalid**: teooria (reeglivihik), tööleht, kontrolltöö (variandid A/B, vastused eraldi), LaTeX-valemid, SVG-joonised (`MaterialView.jsx`), printimine.
- **Esseede hindamine**: et/en/ru, hinne %, värvilised vead. Mudel `ANTHROPIC_MODEL_ESSAY` = sama mis üldine.
- **Automatsioonid** (`/automatsioonid`): õpilase tulemused langevad, tähtaja meeldetuletus (+klassi teade), AI nädalakokkuvõte, hinded lisamata. Kontroll iga 10 min (`services/automations.js`). Kellaikoon päises.
- **n8n webhook** (`services/webhook.js`, `docs/N8N.md`): SSRF-kaitse, õpilaste nimed vaikimisi ei lähe.
- **Hinded**: CSV/Excel import (olemasolev endpoint), mall, CSV eksport; Õpilased: CSV eksport.
- **Mobiil/PWA**: alumine menüü + "Veel" paneel (sõrmega järgiv), manifest, ikoonid, service worker (`public/sw.js`), iOS-i sisestusväljad 16px.
- **Disain**: tinasinine (`#1C3556`/`#14213D`) põhinupud, soe paber taust (`#F7F4EE`), lilla (`#7F77DD`) ainult AI-märgistel, serif-pealkirjad (Newsreader, `font-serif-brand`), fondid self-hosted (`@fontsource`), avaleht `/avaleht`, login/register jagatud raam (`AuthShell.jsx`).
- **Kaitse**: parooli ja PII logi, pseudonümiseerimine (`services/pseudonymise.js`), turvapäised (`middleware/security.js`), audit_log.

## Reeglid (lisaks AGENTS.md-le)
- **Ära pushi ilma kasutaja loata.** Iga push teeb Renderis ~2 min 502. Commit kohapeal on OK.
- **Ära pane API võtmeid, paroole ega tokeneid** chatti, koodi ega commiti. `server/.env` on gitignore'is.
- **Stuudiumi ekraanipilte ei oska keegi ette arvata** — kui on vaja uusi funktsioone, küsi pilti.
- **Kõik kasutajale nähtav tekst eesti keeles**, ka veateated.
- **Õpilaste nimed AI-le** ainult pseudonümiseeritult (`protectedNames`).
- **Ajavöönd:** kuupäevad kohalikud (`Europe/Tallinn`), mitte `toISOString()` (UTC). Osa lehti kasutab veel vana varianti (Kohalolek, Tunniplaan, Mentorlus, Vanemate päev, õpilase kaart) — parandamata.

## Teadaolevad piirid / pooleli
- SQLite (üks kool). Mitme kooli jaoks PostgreSQL (vt `docs/ARHITEKTUUR_JA_PLAAN.md`).
- Stuudiumi "Veel"-menüü ja täpne hinnete vorm pole näinud (vajab ekraanipilti).
- Varajane hoiatus selgitatava põhjusega ja õpetaja tagasiside sellele (plaan `docs/STRATEEGIA.md`).
- Lapsevanemale ja kolleegidele ei saadeta midagi automaatselt; AI ettepanek alati inimese kinnitusega.
- AI joonised (SVG) ja valemid on tehisintellekti loodud — materjal tuleb enne printimist üle vaadata.

## Testimine (kohalik)
- Test-DB: `DATABASE_PATH=<scratch>/smoke.db PORT=3055 JWT_SECRET=... node src/index.js`, konto `smoke@test.local` (ära kasuta päris andmeid).
- `npm test` (server) — pseudonümiseerimise testid.
- `cd client && npx vite build` enne commit.
