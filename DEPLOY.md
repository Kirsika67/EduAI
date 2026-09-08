# EduAI juurutamine — püsiv link

Repo: https://github.com/Kirsika67/EduAI

---

## 0. Enne juurutamist: vii kood `main` haru peale

**See on kõige olulisem samm.** Render võtab koodi harust `main`, aga kogu töö
(faasid 0–8) on harul `faas-0-rollid`. Ilma selleta juurutuks vana rakendus.

Ava Terminal ja kopeeri plokk korraga:

```bash
cd ~/Documents/EduAI

# Vana lukustusfail, mis takistab git'i (tekkis kaugühendusest, on tühi):
rm -f .git/index.lock

# Salvesta turvauuendused
git add -A
git commit -m "Turvakiht, pseudonümiseerimine ja püsiv andmebaas juurutamiseks"

# Vii kõik main harule
git checkout main
git merge faas-0-rollid
git push origin main
```

`main` on haru otsene esivanem, seega merge on **fast-forward** — konflikte ei tule.
Kui git siiski konfliktist teatab, **peatu ja küsi abi** — ära lahenda kiirustades.

---

## 1. Render (üks kord)

1. Ava https://dashboard.render.com ja logi sisse **GitHubiga** (konto Kirsika67).
2. Kui küsib, luba Renderil näha repo't **EduAI**.
3. **New +** → **Blueprint**
4. Vali repo **EduAI**, haru **main**
5. Render loeb `render.yaml` ja küsib ühte väärtust: **ANTHROPIC_API_KEY**.
   Kleebi see sinna (võti on ka failis `server/.env`). Kui jätad tühjaks,
   töötab rakendus edasi, aga AI-kohtades on varutekst.
6. Vajuta **Apply** ja oota ~5 min (staatus **Live**).
7. Kopeeri URL, nt `https://eduai.onrender.com`.

### Mida `render.yaml` ette ütleb

| Seade | Väärtus | Miks |
|---|---|---|
| `plan` | **starter** (~7 $/kuus) | Tasuta paketil on ketas ajutine — andmebaas kustuks iga juurutuse järel. Starter ei uinu ka. |
| `region` | **frankfurt** | Õpilasandmed jäävad EL-i. |
| `disk` | 1 GB, `/var/data` | SQLite fail elab siin üle juurutuste ja taaskäivituste. |
| `NODE_ENV` | production | Lülitab sisse HTTPS-i sunni, turvapäised ja öise varunduse. |
| `JWT_SECRET` | Render genereerib | Server **keeldub käivitumast**, kui see puudub. |
| `ANTHROPIC_API_KEY` | küsitakse sinult | `sync: false` — ei satu kunagi Giti. |
| `AI_PSEUDONYMISE` | on | Õpilaste nimed asendatakse enne AI-le saatmist märgistega. |

---

## 2. Kontrolli, et kõik töötab

```bash
curl https://SINU-URL.onrender.com/api/health
# ootus: {"ok":true,"service":"EduAI API"}
```

Seejärel brauseris: registreeru → loo klass → lisa õpilased → sisesta hinded →
vaata, kas Ülevaade näitab andmeid ja AI-ülevaade tuleb.

**Renderi logides peab olema:**
```
EduAI töötab pordil 10000 (frontend + API, tootmine)
[EduAI varundus] koopia tehtud: /var/data/backups/eduai-2026-08-20.db
```

---

## 3. Saada õpetajale

Saada **Renderi link** (mitte localhost).

Õpetaja: avab lingi → **Registreeru** → e-post + parool (min 8 tähemärki) →
lisab klassid ja õpilased ise.

---

## Varukoopiad

**Automaatne (juba sees):** server teeb iga 24 tunni tagant koopia kausta
`/var/data/backups/` ja hoiab alles 7 viimast päeva. See kaitseb kustutatud
klassi, katkise migratsiooni ja vale UPDATE'i vastu.

**Varukoopia väljapoole (tee seda käsitsi kord nädalas):** püsiketas ei ole
varukoopia — ketta enda kadu võtab ka koopiad kaasa. Renderi paneelis
**Shell** all:

```bash
ls -la /var/data/backups/
```

ja tõmba uusim fail alla (Render Shell → `cat` või Renderi failihaldur).

---

## Mis selle juurutuse jaoks muudeti

1. **Püsiv andmebaas** — SQLite läks püsikettale `/var/data`, mitte koodikausta.
2. **Pseudonümiseerimine** (`server/src/services/pseudonymise.js`) — õpilaste
   nimed asendatakse enne Anthropicule saatmist märgistega `[Õ1]`, `[Õ2]` ja
   pannakse vastuses tagasi. Anthropic näeb hindeid ja teemasid, aga mitte
   seda, kelle omad need on. Kaetud: klassi ülevaade, õpilase analüüs, kirjad
   lapsevanemale, hinnete tagasiside, mentorluse ettepanekud, sõnumiabi.
   Test: `npm test`.
3. **JWT_SECRET on kohustuslik** — varem oli koodis vaikeväärtus
   `"arendus-vale-võti"`; kui muutuja puudus, käivitus server vaikselt edasi ja
   igaüks oleks saanud endale kehtiva tokeni allkirjastada. Nüüd katkeb
   käivitus tootmises kohe.
4. **Turvapäised ja HTTPS** (`server/src/middleware/security.js`) — CSP,
   HSTS, `X-Frame-Options`, HTTP → HTTPS suunamine.
5. **Päringupiirangud** — sisselogimisele 20 katset 15 min kohta (paroolide
   äraarvamise vastu), kogu API-le 400 päringut 5 min kohta (katkise tsükli ja
   ootamatu AI-arve vastu).
6. **Öine varundus** (`server/src/services/backup.js`).

---

## Teadaolevad piirid — järgmised sammud

| Teema | Praegu | Millal see loeb |
|---|---|---|
| **SQLite** | Üks fail püsikettal | Kuni ~1 kool. Mitme kooli või paralleelse kirjutamise korral on vaja PostgreSQL-i. Vt allpool. |
| **Päringupiirang** | Loendur mälus | Töötab ühe instantsiga. Kui Renderis on mitu instantsi, korrutub limiit — siis on vaja jagatud loendurit. |
| **Varukoopia** | Samal kettal | Ketta kadu võtab koopiad kaasa. Vt "Varukoopia väljapoole". |
| **Kutsed** | Link ekraanil | Päris e-kirja saatmist veel ei ole. |

### PostgreSQL — miks mitte kohe

Serveris on **236 andmebaasipäringut 32 failis**, kõik `better-sqlite3`
sünkroonses stiilis. Postgresile minnes muutub iga üks neist asünkroonseks
(`await`), iga neid sisaldav funktsioon `async`-iks, ja see kandub edasi läbi
kõigi marsruutide. Lisaks 43 × `lastInsertRowid`, 42 × `datetime('now')`,
28 × `AUTOINCREMENT`, 24 × `COLLATE NOCASE`, 13 tehingut.

See on 1–2 päeva keskendunud tööd. Püsiketas ei ole raiskamine: Postgresile
üleminek on pärast täpselt sama töö, aga vahepeal on andmed kaitstud.
