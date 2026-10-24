# EduAI strateegia ja tegevuskava

Alus: kriitiline analüüs (okt 2026), mida on siin **faktiliselt parandatud** vastavalt sellele, mis rakenduses tegelikult on.

## 1. Parandused analüüsi väidetesse

| Analüüs väidab | Tegelikkus |
|---|---|
| "SQLite on kohalik, ühe arvuti peal, pole pilve ega varukoopiat" | Rakendus töötab Renderis (Frankfurt) püsikettaga ja teeb öise varukoopia. Päris piir on see, et SQLite sobib ühele koolile; mitme kooli jaoks on vaja PostgreSQL-i (vt `DEPLOY.md`). |
| "Pole lapsevanema portaali, õpilase profiili, kooli adminipaneeli" | On olemas: lapsevanema ja õpilase kontod kutsega ("Minu laps"), juhtkonna vaade ("Kool"), kooli liikmed, sõnumid. Need on lihtsad ja vajavad kasutajatelt tagasisidet. |
| "Õpetaja ei saa koostööd teha" | Kooli liikmed, otsesõnumid, teated klassile ja jagatud kooliandmed on olemas. Üksikud klassid on privaatsuse pärast teadlikult õpetajapõhised. |
| "Integratsioon Kool.ee / ÕIS-iga" | ÕIS on ülikoolide süsteem. Üldhariduskoolides on levinud Stuudium, eKool, Google Workspace ja Microsoft 365. Stuudiumi/eKooli avatud API-d ei pruugi olla, see tuleb **kontrollida**. |
| Arvud ("$20K/kuu reklaam", "1M õpilast", hinnad) | Need on väljamõeldud ega põhine andmetel. |
| "Kollane alla 65%" on heuristika | Õige: piirid on valideerimata ja tuleb õpetajatega üle vaadata. |

## 2. Mis analüüsis on õige ja mida võtame

1. **Fookus ja ostja puudub:** keda teenime esimesena (õpetaja, kool?), kes maksab, kui palju?
2. **Mobiil:** õpetaja kasutab seda tundide vahel, seega peab mobiil olema tugev.
3. **Integratsioonid:** topeltsisestus on suurim takistus. Alustame lihtsast (CSV).
4. **Riskiennustus peab olema selgitatav ja valideeritud**, mitte salapärane skoor.
5. **Valideerimine enne laiendamist:** 5–10 õpetajat, mõõdetud ajasääst.

## 3. Mida me ei tee (praegu)

- Ei hüppa "kogu hariduse intelligentsusplatvormi" peale. Esimese sammuna on vaja **ühe asja, mida ühele õpetajale on kindlalt vaja**, ja seda kinnitavaid kasutajaid.
- Ei ennusta "miljoni õpilase andmete" põhjal. Laste andmed on tundlikud (GDPR, kooli luba), ja ennustus nõuab päris ajalugu, mida meil pole.
- Ei hanki ministeeriumi raha enne, kui üks kool maksab või kinnitab väärtust.

## 4. Tegevuskava

**Nädal 1–2: valideerimine (sinu töö, mina toetan)**
- [ ] 5 õpetajat kasutab 4 nädalat (`docs/PILOOT.md`), testandmetega esimese nädala.
- [ ] 30-minutilised intervjuud: mida teevad iganädalaselt, mis võtab kõige rohkem aega, mida nad maksaksid.
- [ ] Mõõda: mitu minutit säästetakse kontrolltöö ettevalmistusest ja tagasisidest.
- [ ] Küsi: kes koolis otsustab ostu (õpetaja, õppealajuhataja, IT)?

**Nädal 3–4: toode (mina ehitan)**
- [ ] **Mobiil:** telefoni rakenduse kogemus (PWA: kodukuvale lisatav, alumine menüü, kiired tegevused).
- [ ] **Import ja eksport:** CSV hinnete ja õpilaste import ning eksport, et topeltsisestust vähendada.
- [x] **Selgitatav varajane hoiatus:** õpetaja muudab piire, näeb põhjuseid (mis hinded, kui palju) ja saab märkida "tõesti oli risk / ei olnud", et saaksime tulemust hiljem võrrelda.
- [ ] **Eri vaated:** lihtne lapsevanema ja õpilase vaade ning juhtkonna kokkuvõte (olemas, vajab lihvi).

**Kuu 2: esimene tasuv klient**
- [ ] Hinnahüpotees: kool maksab per õpetaja või per kool. Küsi pilootkoolilt, kas nad maksaksid ja kui palju.
- [ ] Üks kool, üks esindaja, mõõdetud tulemus. Alles siis laienda.

## 5. Valikud, mis tuleb teha (sinu otsus)

1. **Esimene sihtrühm:** õpetaja (maksab ise, väike summa) või kool (suurem tehing, aeglasem müük)?
2. **Eristav lubadus:** "kontrolltööst plaanini" (planeerija) või "varajane hoiatus" (õpilaste mahajäämus)?
3. **Hinnastus:** per õpetaja, per kool või per õpilane?

## 6. Edu mõõdikud (4 nädala piloot)

- vähemalt 3 viiest õpetajast kasutab iga nädal;
- mõõdetud ajasääst vähemalt 1 tund nädalas õpetaja kohta;
- vähemalt 1 õpetaja ütleb, et ta maksaks;
- vähemalt 1 kooli esindaja tahab järgmist kohtumist.
