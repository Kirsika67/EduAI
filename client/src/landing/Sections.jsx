import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PenMark, { useInView } from './PenMark'

/* ------------------------------------------------------------------ */
/* Üks päev: neli hetke, igaühel päris rakenduse vaate järeleaimamine. */
/* ------------------------------------------------------------------ */

function Moment({ time, title, text, children }) {
  const [ref, drawn] = useInView()
  return (
    <li ref={ref} className="relative grid md:grid-cols-[180px_1fr] gap-6 md:gap-12 pb-20 md:pb-28 last:pb-0">
      <div className="md:pt-1">
        <p className="font-serif-brand text-5xl md:text-6xl text-[#14213D] tabular-nums leading-none">{time}</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8 lg:gap-12 items-start">
        <div className="max-w-md">
          <h3 className="font-serif-brand text-2xl md:text-[1.9rem] leading-tight text-[#14213D]">{title}</h3>
          <p className="mt-3 text-[#14213D]/70 leading-relaxed">{text}</p>
        </div>
        <div className="relative">{typeof children === 'function' ? children(drawn) : children}</div>
      </div>
    </li>
  )
}

function Frame({ label, ai, children }) {
  return (
    <div className="bg-white rounded-xl border border-[#14213D]/10 shadow-[0_1px_2px_rgba(20,33,61,0.05),0_18px_40px_-18px_rgba(20,33,61,0.25)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#14213D]/10 bg-[#FBFAF6]">
        <span className="text-xs font-medium text-[#14213D]/60">{label}</span>
        {ai && <span className="text-[10px] font-semibold text-white bg-[#7F77DD] rounded px-1.5 py-0.5">AI</span>}
      </div>
      <div className="p-4 sm:p-5 text-sm text-[#14213D]">{children}</div>
    </div>
  )
}

const LESSONS = [
  ['8.15', 'Matemaatika', '7.A', null],
  ['9.05', 'Matemaatika', '8.B', null],
  ['10.00', 'Füüsika', '9.A', 'Asendus'],
  ['11.00', 'Matemaatika', '7.A', 'Kontrolltöö'],
]

function PaevikMock({ drawn }) {
  return (
    <Frame label="Päevik, esmaspäev">
      <ul className="divide-y divide-[#14213D]/10">
        {LESSONS.map(([t, subject, cls, tag]) => (
          <li key={t} className="relative flex items-center gap-3 py-2.5">
            <span className="w-12 text-[#14213D]/50 tabular-nums">{t}</span>
            <span className="flex-1 font-medium">{subject} <span className="font-normal text-[#14213D]/55">{cls}</span></span>
            {tag && (
              <span className={`relative text-xs rounded-full px-2.5 py-0.5 ${tag === 'Asendus' ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#E6F1FB] text-[#185FA5]'}`}>
                {tag}
                {tag === 'Asendus' && <PenMark type="circle" drawn={drawn} className="-inset-x-3 -inset-y-2 w-[calc(100%+24px)] h-[calc(100%+16px)]" />}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[#14213D]/55">2 kodutööd tähtajaga täna, 1 lapsevanema sõnum vastamata</p>
    </Frame>
  )
}

function PlannerMock({ drawn }) {
  return (
    <Frame label="AI planeerija" ai>
      <div className="space-y-3">
        <p className="ml-auto max-w-[85%] bg-[#14213D] text-white rounded-2xl rounded-br-md px-3.5 py-2.5 leading-snug">
          Kontrolltöö murdudest 7.A-le, 45 minutit, kaks varianti.
        </p>
        <div className="max-w-[90%] bg-[#F5F4FB] rounded-2xl rounded-bl-md px-3.5 py-2.5 leading-snug">
          Koostasin 8 ülesannet, A- ja B-variandi ning{' '}
          <span className="relative inline-block">
            vastused eraldi lehel
            <PenMark type="underline" drawn={drawn} className="left-0 -bottom-2 w-full h-3" />
          </span>
          . Kas lisan ühe joonisega ülesande?
        </div>
        <div className="flex items-center gap-2 border border-[#14213D]/10 rounded-lg px-3 py-2 w-fit">
          <span className="w-6 h-7 rounded-sm bg-[#FBFAF6] border border-[#14213D]/15 grid place-items-center text-[9px] font-semibold text-[#14213D]/60">A4</span>
          <span className="text-xs"><span className="font-medium">Kontrolltöö: murrud</span><span className="text-[#14213D]/55">, variandid A ja B</span></span>
        </div>
      </div>
    </Frame>
  )
}

function EssayMock({ drawn }) {
  return (
    <Frame label="Esseede hindamine, eesti keel" ai>
      <p className="leading-[1.9] text-[15px]">
        Eile me{' '}
        <span className="bg-[#FCEBEB] text-[#A32D2D] rounded px-1 line-through decoration-[#A32D2D]/60">käisme</span>{' '}
        <span className="text-[#3B6D11] font-medium">käisime</span> muuseumis, kus oli palju huvitavaid{' '}
        <span className="bg-[#FCEBEB] text-[#A32D2D] rounded px-1 line-through decoration-[#A32D2D]/60">asjad</span>{' '}
        <span className="text-[#3B6D11] font-medium">asju</span>. Kõige rohkem meeldis mulle{' '}
        <span className="bg-[#FAEEDA] text-[#854F0B] rounded px-1">vanad kaardid</span>.
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-[#14213D]/10 pt-3">
        <span className="text-xs text-[#14213D]/55">3 viga, selgitused juures</span>
        <span className="relative font-serif-brand text-2xl px-2">
          82%
          <PenMark type="circle" drawn={drawn} className="-inset-x-3 -inset-y-2 w-[calc(100%+24px)] h-[calc(100%+16px)]" />
        </span>
      </div>
      <p className="mt-2 text-xs text-[#14213D]/55">Soovituslik hinne. Lõpliku hinde paned sina.</p>
    </Frame>
  )
}

const RISKS = [
  { name: 'Kertu', level: 'Tähelepanu', reason: '3 järjestikust hinnet alla 50%', tone: 'bg-[#D94A3F]' },
  { name: 'Oskar', level: 'Tugi vajalik', reason: '2 puudumist 30 päeva jooksul (piir: 2)', tone: 'bg-[#E5B23A]' },
]

function RiskMock({ drawn }) {
  const [verdicts, setVerdicts] = useState({})
  return (
    <Frame label="Varajane hoiatus, 7.A">
      <ul className="space-y-4">
        {RISKS.map((r, i) => (
          <li key={r.name}>
            <p className="flex items-center gap-2 font-medium">
              <span className={`w-2 h-2 rounded-full ${r.tone}`} />
              {r.name}
              <span className="font-normal text-[#14213D]/55">{r.level}</span>
            </p>
            <p className="relative w-fit mt-0.5 text-[#14213D]/75">
              {r.reason}
              {i === 1 && <PenMark type="underline" drawn={drawn} className="left-0 -bottom-2 w-full h-3" />}
            </p>
            <div className="mt-2.5 flex gap-2" role="group" aria-label={`Kas ${r.name} hoiatus vastab tõele?`}>
              {[['was', 'Oli risk'], ['not', 'Ei olnud risk']].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={verdicts[r.name] === v}
                  onClick={() => setVerdicts((s) => ({ ...s, [r.name]: v }))}
                  className={`text-xs rounded-lg px-3 py-1.5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8322B] ${
                    verdicts[r.name] === v
                      ? 'bg-[#14213D] text-white border-[#14213D]'
                      : 'border-[#14213D]/20 hover:bg-[#14213D]/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[#14213D]/55" aria-live="polite">
        {Object.keys(verdicts).length
          ? 'Hinnang salvestatud. Nii näed hiljem, kui täpsed sinu piirid on.'
          : 'Proovi: kas see hoiatus vastab tõele?'}
      </p>
    </Frame>
  )
}

export function DayTimeline() {
  return (
    <section className="paper-grid border-t border-[#14213D]/10" aria-labelledby="paev">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 md:py-32">
        <h2 id="paev" className="font-serif-brand text-4xl md:text-6xl leading-[1.05] tracking-[-0.015em] text-[#14213D] max-w-3xl">
          Üks tavaline päev, natuke kergemalt.
        </h2>
        <p className="mt-5 text-lg text-[#14213D]/70 max-w-xl leading-relaxed">
          Need on päris vaated rakendusest. Punane pliiats näitab, mida õpetaja tavaliselt kõige enne märkab.
        </p>

        <ol className="mt-20 md:mt-24">
          <Moment
            time="7.45"
            title="Päev ühe pilguga"
            text="Tänased tunnid, asendused, kontrolltööd ja tähtajad samal lehel. Ei pea viiest kohast kokku otsima."
          >
            {(drawn) => <PaevikMock drawn={drawn} />}
          </Moment>
          <Moment
            time="10.15"
            title="Kontrolltöö vahetunniga"
            text="Kirjelda või pildista eelmine töö. Planeerija küsib üle, koostab variandid, valemid ja joonised ning paneb vastused eraldi lehele."
          >
            {(drawn) => <PlannerMock drawn={drawn} />}
          </Moment>
          <Moment
            time="13.30"
            title="Esseed eelhinnatud"
            text="Eesti, inglise ja vene keeles. Vead on selgitatud ja hinne on soovitus, mille sina üle vaatad."
          >
            {(drawn) => <EssayMock drawn={drawn} />}
          </Moment>
          <Moment
            time="16.00"
            title="Keegi ei jää märkamata"
            text="Kui õpilase hinded langevad või puudumisi koguneb, näed põhjust ja piiri, mille ise paika panid. Sinu hinnang teeb hoiatused aja jooksul täpsemaks."
          >
            {(drawn) => <RiskMock drawn={drawn} />}
          </Moment>
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Nimede peitmine: sama loogika nagu serveri `pseudonymise.js`.      */
/* ------------------------------------------------------------------ */

const ROSTER = ['Mari Tamm', 'Jaan Kask', 'Kertu Lepik', 'Oskar Saar']
const SAMPLE = 'Mari Tamm sai kontrolltööst 45 punkti. Marile sobiks lisatund koos Jaaniga, Kertu aitab.'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Tagastab tekstilõigud: { text } või { token }. */
function maskNames(text, roster) {
  const aliases = []
  roster.forEach((name, i) => {
    const token = `[Õ${i + 1}]`
    aliases.push({ alias: name, token })
    name.split(' ').forEach((part) => { if (part.length >= 3) aliases.push({ alias: part, token }) })
  })
  aliases.sort((a, b) => b.alias.length - a.alias.length)
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])(${aliases.map((a) => escapeRegex(a.alias)).join('|')})\\p{L}{0,4}(?![\\p{L}\\p{N}])`,
    'giu'
  )
  const out = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    const hit = aliases.find((a) => a.alias.toLowerCase() === m[1].toLowerCase())
    out.push({ token: hit.token, original: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export function PrivacyDemo() {
  const [text, setText] = useState(SAMPLE)
  const parts = useMemo(() => maskNames(text, ROSTER), [text])
  const hidden = parts.filter((p) => p.token).length

  return (
    <section className="bg-[#FBFAF6] border-t border-[#14213D]/10" aria-labelledby="nimed">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 md:py-32 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-start">
        <div>
          <h2 id="nimed" className="font-serif-brand text-4xl md:text-6xl leading-[1.05] tracking-[-0.015em] text-[#14213D]">
            Lapse nimi ei lahku koolist.
          </h2>
          <p className="mt-6 text-lg text-[#14213D]/70 leading-relaxed max-w-md">
            Enne kui midagi AI-le saadetakse, asendatakse õpilaste nimed märgistega. AI näeb hindeid ja teemasid,
            aga mitte seda, kelle omad need on. Vastuses pannakse nimed tagasi.
          </p>
          <ul className="mt-8 space-y-3 text-[#14213D]/75 max-w-md">
            <li className="border-t border-[#14213D]/15 pt-3">Andmed hoitakse Euroopas ja iga kasutaja näeb ainult oma kooli.</li>
            <li className="border-t border-[#14213D]/15 pt-3">Lapsevanemale ei lähe midagi ilma sinu kinnituseta.</li>
            <li className="border-t border-[#14213D]/15 pt-3">Iga tundlik vaatamine ja muutmine jääb logisse.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-[#14213D]/10 shadow-[0_24px_60px_-28px_rgba(20,33,61,0.35)] p-5 sm:p-7">
          <label htmlFor="privacy-demo" className="text-sm font-medium text-[#14213D]">Sinu märkus</label>
          <textarea
            id="privacy-demo"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 400))}
            rows={3}
            className="mt-2 w-full resize-none rounded-lg border border-[#14213D]/15 px-3.5 py-3 text-[15px] leading-relaxed text-[#14213D] outline-none focus:border-[#14213D]/40 focus:ring-2 focus:ring-[#C8322B]/20"
          />
          <p className="mt-2 text-xs text-[#14213D]/50">
            Klassi nimekiri selles näites: {ROSTER.join(', ')}. Proovi kirjutada mõni neist nimedest, ka käändes.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span className="text-sm font-medium text-[#14213D]">Mida AI näeb</span>
            <span className="text-[10px] font-semibold text-white bg-[#7F77DD] rounded px-1.5 py-0.5">AI</span>
          </div>
          <p className="mt-2 rounded-lg bg-[#F5F4FB] px-3.5 py-3 text-[15px] leading-[1.9] text-[#14213D] min-h-[5.5rem]" aria-live="polite">
            {parts.map((p, i) =>
              p.token
                ? <span key={i} className="pseudo-token" title={`Peidetud: ${p.original}`}>{p.token}</span>
                : <span key={i}>{p.text}</span>
            )}
          </p>
          <p className="mt-3 text-xs text-[#14213D]/55">
            {hidden ? `${hidden} nime peidetud.` : 'Selles tekstis pole klassi nimekirja nimesid.'}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

const MORE = [
  ['Materjalid', 'Teooria, tööleht ja kontrolltöö korralike valemite ja joonistega, valmis printimiseks.'],
  ['Automatsioonid', 'Seadistad reegli ühe korra, näiteks tähtaja meeldetuletuse, ja server jälgib seda sinu eest.'],
  ['Suhtlus', 'Sõnumid kolleegidele ja peredele ning teated klassile. AI aitab sõnastada, saadad sina.'],
  ['Hinded ja tabelid', 'Impordi hinded CSV- või Exceli failist ja ekspordi need tagasi. Topeltsisestust jääb vähemaks.'],
  ['Telefonis', 'Lisa avakuvale nagu rakendus. Tundide vahel on kõige tähtsam pöidla ulatuses.'],
  ['Kool koos', 'Kolleegid liituvad kooli koodiga. Juhtkond näeb kokkuvõtet, klassid jäävad õpetaja omaks.'],
]

export function MoreList() {
  return (
    <section className="bg-[#FBFAF6] border-t border-[#14213D]/10" aria-labelledby="veel">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-20">
        <h2 id="veel" className="font-serif-brand text-3xl md:text-5xl leading-[1.08] text-[#14213D]">
          Ja kõik see muu, mida päev nõuab.
        </h2>
        <dl className="grid sm:grid-cols-2 gap-x-10">
          {MORE.map(([term, desc]) => (
            <div key={term} className="border-t border-[#14213D]/15 py-5">
              <dt className="font-medium text-[#14213D]">{term}</dt>
              <dd className="mt-1.5 text-[#14213D]/65 leading-relaxed text-[15px]">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function FinalCta() {
  const [ref, drawn] = useInView({ threshold: 0.6 })
  return (
    <section ref={ref} className="bg-[#0D1424] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 md:py-32">
        <h2 className="font-serif-brand text-4xl md:text-7xl leading-[1.02] tracking-[-0.02em] max-w-4xl">
          Järgmine esmaspäev võib alata{' '}
          <span className="relative inline-block">
            rahulikult
            <PenMark type="underline" drawn={drawn} className="left-0 -bottom-3 w-full h-4" delay={200} />
          </span>
          .
        </h2>
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Link to="/register" className="bg-[#C8322B] text-white rounded-full px-7 py-3.5 font-medium hover:bg-[#B02A24] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Proovi oma klassiga
          </Link>
          <p className="text-white/60 text-sm max-w-xs leading-relaxed">
            Konto loomine võtab minuti. Kolleegid liituvad hiljem sinu kooli koodiga.
          </p>
        </div>
      </div>
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex items-center justify-between text-sm text-white/55">
          <span className="font-serif-brand text-lg text-white">EduAI</span>
          <nav className="flex gap-5">
            <Link to="/login" className="hover:text-white">Logi sisse</Link>
            <Link to="/register" className="hover:text-white">Loo konto</Link>
          </nav>
        </div>
      </footer>
    </section>
  )
}
