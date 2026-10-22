# EduAI + n8n: automaatsed töövood

EduAI saadab iga automatsiooni teavituse (nt "tähtaeg homme", "õpilase tulemused langevad", AI nädalakokkuvõte) sinu n8n **Webhook** sõlme. Sealt saad teha mida tahes: e-kiri, Slack, Google Calendar, Notion jne.

## Seadistus (5 minutit)

1. n8n-is loo uus töövoog ja lisa esimeseks sõlmeks **Webhook**:
   - HTTP Method: **POST**
   - Authentication: None (kui kasutad salajast võtit, vt allpool)
2. Kopeeri sõlme **Production URL** (algab `https://...`). Test URL on ainult katsetamiseks.
3. EduAI-s: **Automatsioonid → Ühenda n8n (webhook)** → kleebi aadress → **Salvesta** → **Saada katse**.
4. n8n-is peaks katse sõnum ilmuma. Aktiveeri töövoog (lüliti "Active").

## Mida EduAI saadab (JSON)

```json
{
  "event": "automation",
  "type": "deadline_reminder",
  "title": "8CDE: tähtaeg homme",
  "body": "Kodutöö: Lk 45 ül 1-6 (Matemaatika)",
  "link": "/paevik",
  "createdAt": "2026-10-23T05:00:00.000Z"
}
```

- `event`: `automation` või `test`.
- `type`: `grade_drop`, `deadline_reminder`, `weekly_summary` või `no_grades`.
- **Õpilaste nimed** ei lähe kaasa (`grade_drop` puhul puudub `body`), kui sa pole seadetes eraldi nime lubanud.

## Salajane võti (soovitatav)

Kui lisad EduAI-s "Salajane võti", saadetakse see päisega `X-EduAI-Secret`. n8n-is lisa Webhook sõlme järele **IF** sõlm, mis kontrollib, et `{{$json.headers["x-eduai-secret"]}}` on sinu võti, ja jätka ainult siis.

## Näidistöövood

- **Meeldetuletus e-kirjaga:** Webhook → IF (`type` = `deadline_reminder`) → Gmail (saada endale `title` ja `body`).
- **Nädalakokkuvõte Slacki:** Webhook → IF (`type` = `weekly_summary`) → Slack (postita `body` kanalisse).
- **Kalendrisse:** Webhook → IF (`type` = `deadline_reminder`) → Google Calendar (lisa sündmus).

## Turvalisus

- Aadress peab olema **https** ja ei tohi viidata sisevõrku ega serveri enda masinasse (SSRF-kaitse).
- Saatmine ei oota vastust kauem kui 6 sekundit ja viga ei peata automatsiooni.
- Kohalikuks testimiseks (arenduses): `ALLOW_PRIVATE_WEBHOOKS=on` lubab ka `http://localhost`.
