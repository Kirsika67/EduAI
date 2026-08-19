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

**EL AI-määrus (AI Act) — kontrollitud 18.08.2026:**

- **Emotsioonide tuletamine haridusasutuses on keelatud praktika** ja see keeld **kehtib juba
  praegu** — keelatud praktikad hakkasid kohalduma 2. veebruaril 2025. Erand on ainult
  meditsiini- ja ohutuspõhjustel. Põhjendus: selliste süsteemide teaduslik alus on nõrk ja
  koolis on võimusuhe ebavõrdne.
- **Haridusvaldkonna AI on Lisa III järgi kõrge riskiga**: vastuvõtt, õpitulemuste hindamine
  (sh kui seda kasutatakse õppeprotsessi suunamiseks), sobiva haridustaseme määramine ja
  eksamite jälgimine. EduAI riskiskoor + AI-soovitused langevad sinna, kui need mõjutavad
  seda, kuidas last koheldakse.
- **Kõrge riski kohustuste tähtaeg lükkus edasi**: määrusega (EL) 2026/1744 (nn digitaalne
  omnibus, avaldatud 24.07.2026, jõustus 27.07.2026) nihkus eraldiseisvate Lisa III süsteemide
  nõuete kohaldamine 2. augustilt 2026 **2. detsembrile 2027**. Läbipaistvusnõuded ja
  AI-pädevuse kohustus jäid esialgsesse ajakavasse.

**Mida see praktikas tähendab:** emotsioonikeeld on juba täna siduv, seega heaolu-check-in'i
disaini ei tohi valesti teha. Kõrge riski nõuete (riskijuhtimine, andmekvaliteet, logimine,
inimjärelevalve, tehniline dokumentatsioon) täitmiseks on aega detsembrini 2027 — aga need
määravad andmemudeli, mistõttu need otsused tuleb teha nüüd, mitte 2027. aastal.

*Allikad:* [AI Act Lisa III](https://artificialintelligenceact.eu/annex/3/) ·
[FPF: emotsioonituvastuse keeld haridusasutustes](https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/) ·
[Gibson Dunn: omnibus ja edasilükatud tähtajad](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)

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
| **1** | Uued tabelid + riskiskoor | ✅ **Tehtud.** Riskiskoor: `riskScore`/`riskLabel` lisandus ABC-mudelile (K3). 1a: `competencies` + 8 üldpädevust. 1b: `attendance` ümber ehitatud (`UNIQUE(student_id, date, lesson_number)`, + `class_id`, `subject`, `reason`, `reported_by`, `confirmed`, staatus `excused`), `behavior_notes` + `category`/`teacher_id`/`is_private`, `wellbeing_checkins` + `mood_value` |
| 1.5 | — | *Uus:* pseudonümiseerimine AI-päringutes (RULE A5) + säilitustähtajad |
| **2** | Tunniplaan | ✅ **Tehtud.** timetable_entries, substitutions, exams, parent_meeting_slots + /tunniplaan (nädal/päev/eksamid) ja /tunniplaan/vanemapaev. Koormuse hoiatus on arvutatud, AI annab ainult soovituse (RULE A1). Vanem näeb teiste broneeringuid ilma nimeta |
| **3** | Kohaloleku leht | ✅ **Tehtud.** Loogika kolis Õpilaste lehelt /kohalolek lehele (K6, ei dubleeritud). Kiirsisestus 4 staatusega + põhjus, käitumismärkused kategooriatega, krooniliste puudumiste hoiatus, õpilase detaillehel kohaloleku %, mini-graafik ja riskiring koos "Miks?" selgitusega |
| **4** | Suhtlus | ✅ **Tehtud.** conversations/messages/participants/reads + /sonumid. Kaks tüüpi: isiklik vestlus (osalejad kirjas) ja klassi teade (nähtavus klassist, ühesuunaline). AI abi sõnastamisel — ei saada kunagi ise (RULE A1) |
| **5** | Mentorlus | ✅ **Tehtud.** Laiendatud `student_goals` (category, target_date, mentor_id, progress, detail) ja `mentor_notes` (mentor_id, kind, is_private, next_meeting_date, date) — `mentoring_*` dublette ei loodud (K2). /mentorlus: eesmärgid edenemisribaga, vestluse märkmed (vaikimisi privaatsed), "ootab vestlust" hoiatus, AI vahesammud |
| **6** | Kooli tasand | Toimib alles siis, kui `schools` on olemas (K5) |
| **7** | Huviringid + vanema vaade | Nagu juhendis + RULE A6 |
| **8** | Läbiv AI | Nagu juhendis + RULE A1/A3 (kuumakaart mõõdab õppimist, mitte emotsiooni) |

Iga faasi lõpus: `npm run dev`, käsitsi test, git commit. Üks faas korraga.
