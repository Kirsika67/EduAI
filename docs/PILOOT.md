# EduAI piloot: 5 õpetajat, 1 kuu

Kaks osa: **A. Õpetaja juhend** (saada õpetajatele) ja **B. Kontrollnimekiri** (sulle).

---

## A. Õpetaja juhend

**Mis EduAI on:** õpetaja abiline, mis hoiab klassid, tunniplaani, hinded ja sõnumid ühes kohas ning aitab AI-ga (hinnete tagasiside, õppematerjalid, essee hindamine, päevakokkuvõte).

**Oluline:** AI teeb ettepanekuid, otsustad alati sina. Vaata iga AI vastus üle enne, kui seda kasutad või õpilasele/lapsevanemale saadad. Ära kirjuta märkmetesse tervise- ega perekonnaandmeid.

### Alustamine
1. Ava link, mille sulle saadeti, ja vajuta **Registreeru**.
2. Vali **Liitun kooliga** ja sisesta kooli liitumiskood, mille annab pilootkoordinaator.
3. Parool vähemalt 8 märki. Parooli saab hiljem muuta: paremal üleval **EduAI → Minu profiil**.

### Paremal üleval
- **Klassi nupp** (nt "8CDE"): vali klass, mida vaatad, lisa klass, muuda või kustuta klass.
- **EduAI nupp:** minu profiil, kooli seaded, väljalogimine.

### Ülemine menüü
- **Päevik:** tänased tunnid, asendused, ülesanded ja kontrolltööd, viimased hinded, puudumised ja sõnumid. Nupp **AI päevakokkuvõte** teeb päevast lühikokkuvõtte.
- **Tera:** klasside nimekiri ja otsing.
- **Ülevaade:** valitud klassi seis ja AI hoiatused.
- **Tunniplaan:** nädala tunniplaan, asendused, kontrolltööd.
- **Õpilased, Hinded, Kohalolek:** õpilaste andmed, hinnete sisestus, kohalolek ja käitumismärked.
- **Materjalid** (**AI**): vali tüüp **Teooria (reeglivihik)** (selgitused, põhjendused, näited, joonised), **Tööleht** (harjutused tasemete kaupa) või **Kontrolltöö** (ainult ülesanded, variandid A ja B, punktid). Valemid ja joonised tulevad korralikult välja, **Prindi** prindib ainult materjali. Genereerimine võtab 1–2 minutit.
- **AI planeerija** (**AI**): vestlus, mis küsib täpsustusi ja koostab tunnikava, kodutööd ja kordamise. Lohista või kleebi (`Cmd+V`) kontrolltöö tulemuste pilt ja **kata enne nimed kinni**. Vestlused säilivad 20 päeva viimasest sõnumist (viimasel 10 päeval on kustutamise märge punane). Pilte ei salvestata. Nupuga lisab plaani otse Päevikusse.
- **Planeerimine, Tagasiside, Esseede hindamine** (**AI**): nädalaplaanid, tagasiside õpilastele ja essee hindamine eesti, inglise ja vene keeles (hinne protsentides).
- **Kooli liikmed:** kolleegide nimekiri, sealt saab otse sõnumi saata.
- **Suhtlus:** sõnumid lapsevanemate ja õpilastega. Vahekaardid: Kõik, Lugemata, Lemmikud, Sinu saadetud, Grupid, Kalender.

### Essee hindamine
1. Vali **essee keel** (eesti, inglise või vene) ja **klass**.
2. Kleebi essee tekst ja vajuta **Hinda essee**.
3. Saad üldise tagasiside (eesti keeles), vigade loetelu koos selgitustega, parandatud teksti ja soovitusliku hinde **protsentides**. Hinne on ainult soovitus.

### Kui midagi ei tööta
Leht võib mõne minuti olla maas (502), kui rakendust uuendatakse. Oota ja värskenda (`Cmd+Shift+R`).

Tee ekraanipilt, kirjuta, mida klõpsasid, ja saada see koordinaatorile. Kui leht näitab "502" või "Laadin...", oota paar minutit ja värskenda lehte.

---

## B. Kontrollnimekiri piloodi koordinaatorile

### Enne algust
- [ ] Renderi **Instance Type** on **Starter** (mitte Free) ja püsiketas `/var/data` on olemas.
- [ ] Renderi **Environment** all on kehtiv `ANTHROPIC_API_KEY`.
- [ ] Anthropic Console'is: **Spend limits** on seatud (nt 20–30 $/kuu) ja auto-reload on **välja** lülitatud.
- [ ] Renderi **Logs**-is on rida `[EduAI varundus] koopia tehtud: ...`.
- [ ] Tehtud on käsitsi varukoopia väljapoole Renderit (vt allpool).
- [ ] Liitumiskood on koolil kõigile sama ja ei aegu. Jaga seda ainult piloodiõpetajatele. Kui kood satub valedesse kätesse, loo uus: **EduAI nupp → Kool ja konto → Loo uus kood**.
- [ ] Kooli juhtkonna luba on olemas; vajadusel on lapsevanemaid teavitatud; andmekaitsespetsialisti arvamus on küsitud.
- [ ] Esimese nädala jooksul kasutatakse **testandmeid**, mitte päris õpilasi.
- [ ] Õpetajatele on saadetud link, liitumiskood ja osa A.

### Varukoopia väljapoole Renderit (kord nädalas)
Server teeb öise koopia kausta `/var/data/backups/` ja hoiab 7 päeva. See kaitseb vale kustutamise eest, aga **mitte ketta enda kao eest**. Renderis: eduai-app → **Shell**:

```bash
ls -la /var/data/backups/
```

Laadi uusim fail alla ja hoia see oma arvutis.

### Piloodi ajal
- [ ] Ära pushi koodi koolipäeva ajal: iga deploy annab paariks minutiks 502. Tee muudatusi õhtul pärast 18:00.
- [ ] Vaata Renderi **Logs** hommikuti üle (otsi `error`).
- [ ] Vaata Anthropic Console'ist kulu kord nädalas.
- [ ] Küsi õpetajatelt nädala lõpus: mis aitas, mis segas, mis puudu on.

### Lõpus
- [ ] Laadi viimane varukoopia alla.
- [ ] Otsusta, kas jätkate. Vajadusel kustuta testkontod ja andmed kooli palvel.
