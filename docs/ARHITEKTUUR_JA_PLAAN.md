# EduAI — arhitektuur, õiguslikud piirid ja parandatud faasiplaan

*Koostatud 18. august 2026. Aluseks `EduAI_Claude_Code_ehitusjuhend.md` + `EduAI_personaliseerimise_roadmap.md` ja **tegelik koodibaas**.*

See dokument on olemas ühel põhjusel: ehitusjuhend kirjutati koodibaasi kohta, mis on vahepeal edasi
liikunud. Kui juhendi SQL-plokid rakendataks sõna-sõnalt, tekiks vähemalt viis konflikti, millest kaks
lõhuksid töötavat funktsionaalsust. Allpool on kaardistus, konfliktid koos otsustega ja parandatud plaan.

---

## 1. Mis on juba olemas (seis 18.08.2026)

**Stack:** Node/Express + better-sqlite3 (server/) · React 18 + Vite + Tailwind (client/) · npm workspaces.
`app/` kaustas on kasutamata Next.js jäänuk — see ei ole töötav rakendus (vt punkt 5.6).

| Ala | Fail | Seis |
|---|---|---|
| Kontod | `server/src/routes/auth.js` | Tabel on **`teachers`**, mitte `users`. JWT + bcrypt. Rolle ei ole. |
| Autentimine | `server/src/middleware/auth.js` | `requireAuth` → `req.teacherId`. Rollikontrolli ei ole. |
| Klassid/õpilased/hinded | `routes/classes.js`, `students.js`, `grades.js` | Töötab. Kogu skoop käib läbi `classes.teacher_id`. |
| Kohalolek | `db.js` + `routes/studentProfile.js` | **Olemas** — tabel `attendance`, UI `StudentsPage` sees. |
| Käitumine | `db.js` + `routes/studentProfile.js` | **Olemas** — tabel `behavior_notes` (`kind`: positive/concern/incident). |
| Heaolu | `db.js` + `routes/studentProfile.js` | **Olemas** — `wellbeing_checkins` (`mood`: good/ok/hard). |
| Eesmärgid, mentorimärkmed | `db.js` + `routes/studentProfile.js` | **Olemas** — `student_goals`, `mentor_notes`. |
| Riskimudel | `server/src/services/abcRisk.js` | **Olemas ja tõenduspõhine** — ABC (Attendance/Behavior/Course) + selgituste loend. |
| AI | `services/aiOverview.js`, `studentAnalysis.js`, jne | Anthropic Messages API, fallback ilma võtmeta. |

**Järeldus:** juhendi Faasid 1, 3 ja 5 on ~50–60% juba tehtud, aga *teistsuguse* andmemudeliga kui juhend eeldab.
Juhendi Faasid 0, 2, 4, 6, 7, 8 on tegemata.

---

## 2. Konfliktid juhendiga ja tehtud otsused

### K1 — `users` tabelit ei eksisteeri
Juhend: `ALTER TABLE users ADD COLUMN role ...`. Koodis on `teachers`, millele viitab `classes.teacher_id`.
**Otsus:** roll läheb `teachers` tabelile; tabelit ümber ei nimetata (see katkestaks kõik marsruudid ja
FK-d ilma igasuguse kasuta). `teachers` = "kontode tabel", ka vanema ja õpilase kontod elavad seal.
Nii jääb ka üks autentimisvoog, mitte kolm.

### K2 — Olemasolevad tabelid ei ole tühjad lehed
Juhendi `CREATE TABLE attendance (...)` eeldab, et tabelit pole. Tegelik `attendance` on olemas ja
sellel on **`UNIQUE(student_id, date)`** — see teeb tunnipõhise kohaloleku (`lesson_number`)
võimatuks, kuni piirang muutub `UNIQUE(student_id, date, lesson_number)`.

| Tabel | Praegu | Juhend tahab | Otsus |
|---|---|---|---|
| `attendance` | `status`: present/late/absent, `notes`, UNIQUE(student_id,date) | + `class_id`, `lesson_number`, `subject`, `excused`, `reason`, `reported_by`, `confirmed` | Faas 1: lisa veerud, muuda UNIQUE tunnipõhiseks, `excused` lisandub olemasolevatele (`absent` jääb alles) |
| `behavior_notes` | `kind`: positive/concern/incident | `category` + `sentiment`: positive/negative + `is_private` + `teacher_id` | Säilita `kind` (ABC-mudel sõltub `incident`-ist), lisa `category`, `teacher_id`, `is_private`. `sentiment` tuletatakse `kind`-ist, uut veergu ei lisata |
| `wellbeing_checkins` | `mood`: good/ok/hard | `mood_value` 1–5, `week_start` | Lisa `mood_value` (1–5) ja täida olemasolevast: hard=2, ok=3, good=4. `mood` jääb alles |
| `student_goals` + `mentor_notes` | Olemas, lihtne kuju | `mentoring_goals` + `mentoring_checkins` | **Ära loo dubleerivaid tabeleid.** Laienda olemasolevaid (`category`, `target_date`, `mentor_id`, `progress`) |

### K3 — Riskiskoor on juhendis pöördskaalaga (kriitiline)
Juhend: `RISK_SCORE 0–100, kõrgem = suurem risk`, `>= 70 → punane`.
Kood (`abcRisk.js`): `score 0–100, kõrgem = parem` — 100 = "Hea tase", ja Ülevaate + Õpilaste leht
värvivad selle järgi.

Kui juhendi loogika asendaks olemasoleva, läheksid **kõik värvid ja lõiked vastupidiseks**, ilma et
midagi katki läheks nähtavalt — kõige halvem viga, mis andmerakendusel olla saab.

**Otsus:** ABC-mudel jääb tõe allikaks (see põhineb US ED varajase hoiatuse uuringul, juhendi
kaalutud summa mitte). Juhendi soovitud numbriline vaade lisatakse **eraldi väljana** samast mudelist:

```
abc.score      → 0–100, kõrgem = parem  (olemasolev, UI kasutab)
abc.riskScore  → 100 - score            (uus, "kõrgem = riskantsem" vaade)
abc.riskLabel  → "Stabiilne" | "Jälgi" | "Kõrge risk"
```

Lisaks: **täpset riskinumbrit ei kuvata õpilase ega vanema vaates** — ainult tase + "Miks?" selgitus.
Number on tööriist õpetajale, mitte silt lapse küljes (vt A2 punktis 3).

### K4 — Mudeli ID on aegunud
`server/src/constants/ai.js` → `claude-sonnet-4-5`. Juhend kordab seda reeglina.
**Otsus:** ID uuendatakse eraldi sammuna, kontrollides enne kehtivat mudelinimekirja (mitte mälu järgi).
Kuni siis: konstant on ühes failis, nii et see on ühe rea muudatus.

### K5 — Kooli mõiste puudub, aga Faas 6 eeldab seda
Juhend annab rollid `headteacher`/`principal` ja lehe "Kooli ülevaade", aga koodis pole `schools`
tabelit. Ilma selleta tähendab "kooli ülevaade" tegelikult **kõiki andmebaasi klasse** — st direktor
näeks teiste koolide õpilasi. See on andmekaitserikkumine, mis tekiks vaikselt alles Faasis 6.

**Otsus:** `schools` tabel ja `teachers.school_id` lisatakse **Faasis 0**, mitte hiljem.
Rentniku (tenant) piiri tagantjärele lisamine on kordades kallim kui kohe.

### K6 — Faas 3 on osaliselt olemas
Kohaloleku kiirmärkimine on juba `StudentsPage` sees. Eraldi `/kohalolek` leht ei tohi seda
dubleerida — Faas 3 kolib selle loogika ümber, mitte ei kirjuta teist koopiat.

---

## 3. Õiguslikud piirid → disainireeglid

EduAI teeb alaealiste kohta riskihinnanguid. See ei ole "lisaks mõelda" teema, vaid määrab andmemudeli.

**EL AI-määrus (AI Act):**
- Lisa III punkt 3 loeb haridusvaldkonna AI **kõrge riskiga** süsteemiks, sh õpitulemuste hindamine,
  eriti kui seda kasutatakse õppeprotsessi suunamiseks. EduAI riskiskoor + AI-soovitused langevad
  tõenäoliselt sinna, kui need mõjutavad seda, kuidas last koheldakse.
- Emotsioonide tuletamine haridusasutuses on **keelatud praktika** (välja arvatud meditsiini- ja
  ohutuspõhjused).
- ⚠️ *Kontrollimata:* täpne kohaldamise ajakava (Lisa III kohustused, 2026 vs edasilükkamine) tuleb
  enne pilooti üle kontrollida — seda ei tohi kirjutada mälu järgi.

**Sellest tulenevad läbivad reeglid (kehtivad igale faasile):**

- **RULE A1 — inimene otsustab.** AI ega riskiskoor ei tohi käivitada automaatset tagajärge lapsele
  (teavitus, suunamine, märgistus). AI teeb ettepaneku, õpetaja kinnitab. Iga AI-soovitus vajab
  kinnitus- või kõrvaleheitmisnuppu.
- **RULE A2 — must kast on keelatud.** Iga riskitase kannab kaasas selgituste loendit ("Miks?").
  `abcRisk.js` teeb seda juba — see muster ei tohi kaduda.
- **RULE A3 — emotsiooni ei tuletata.** Heaolu tuleb **ainult õpilase enda klõpsust**. AI ei tohi
  vabatekstist, hinnetest ega vestluslogist meeleolu järeldada. Faasi 8 "arusaamise kuumakaart" mõõdab
  ainult seda, milline **alateema** on raske — mitte kuidas laps end tunneb.
- **RULE A4 — tundlik andmepääs logitakse.** Iga tundliku kirje lugemine ja kirjutamine läheb
  `audit_log`-i (kes, mis tegevus, mis kirje, millise lapse kohta).
- **RULE A5 — pseudonüüm AI-päringus.** Väliseks AI-päringuks tuleks pärisnimi asendada
  ("Õpilane A"). *Praegu saadetakse pärisnimed* (`aiOverview.js`, `studentAnalysis.js`) — see on
  eraldi ülesanne Faas 1 järel, mitte vaikne muudatus keset muud tööd.
- **RULE A6 — laps näeb esimesena.** Õpilase tulemus on talle nähtav sama hetkel või varem kui
  vanemale (juhendi RULE R4, Eesti kogemus).

---

## 4. Parandatud faasiplaan

| Faas | Juhendis | Tegelik töö |
|---|---|---|
| **0** | Rollid, audit log | Rollid `teachers` tabelile + **`schools` (K5)** + `parent_student_links` + `audit_log` + `invitations` + `requireRole` + rollipõhine navigatsioon |
| **1** | Uued tabelid + riskiskoor | **Migratsioon**, mitte loomine (K2). Riskiskoor: `riskScore`/`riskLabel` lisandub ABC-mudelile (K3). Uus: `competencies` |
| 1.5 | — | *Uus:* pseudonümiseerimine AI-päringutes (RULE A5) + säilitustähtajad |
| **2** | Tunniplaan | Nagu juhendis (uus moodul, konflikte pole) |
| **3** | Kohaloleku leht | Kolib `StudentsPage` loogika `/kohalolek` lehele (K6), ei dubleeri |
| **4** | Suhtlus | Nagu juhendis |
| **5** | Mentorlus | Laiendab `student_goals`/`mentor_notes`, ei loo `mentoring_*` dublette (K2) |
| **6** | Kooli tasand | Toimib alles siis, kui `schools` on olemas (K5) |
| **7** | Huviringid + vanema vaade | Nagu juhendis + RULE A6 |
| **8** | Läbiv AI | Nagu juhendis + RULE A1/A3 (kuumakaart mõõdab õppimist, mitte emotsiooni) |

Iga faasi lõpus: `npm run dev`, käsitsi test, git commit. Üks faas korraga.
