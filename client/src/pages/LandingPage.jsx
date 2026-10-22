import { Link } from 'react-router-dom'

const FEATURES = [
  ['Päevik', 'Tänased tunnid, asendused, ülesanded ja kontrolltööd ühel rahulikul lehel.'],
  ['AI planeerija', 'Kirjuta või lisa kontrolltöö foto. Planeerija küsib täpsustusi ja koostab tunnikavad ning kodutööd.'],
  ['Materjalid', 'Teooria, tööleht ja kontrolltöö korralike valemite ja joonistega, valmis printimiseks.'],
  ['Automatsioonid', 'Seadistad reegli ühe korra, server jälgib seda sinu eest ja annab teada.'],
  ['Esseede hindamine', 'Eesti, inglise ja vene keeles: vead selgitustega, parandatud tekst ja soovituslik hinne.'],
  ['Suhtlus', 'Sõnumid kolleegidele ja peredele ning teated klassile, AI aitab sõnastada.'],
]

const STEPS = [
  ['01', 'Loo kool', 'Registreeru ja saa liitumiskood, millega kolleegid sama kooliga liituvad.'],
  ['02', 'Lisa klassid', 'Tunniplaan, õpilased ja hinded jäävad ühte kohta.'],
  ['03', 'Töötab sinu heaks', 'AI aitab ette valmistada, automatsioonid jälgivad, otsused jäävad sinule.'],
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#14213D]">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="font-serif-brand text-2xl tracking-tight">EduAI</span>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/login" className="text-[#14213D]/80 hover:text-[#14213D]">Logi sisse</Link>
          <Link to="/register" className="bg-[#14213D] text-white rounded-lg px-4 py-2 hover:bg-[#1C3556] transition-colors">Registreeru</Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="w-12 h-px bg-[#B08D57] mb-8" />
        <h1 className="font-serif-brand text-5xl lg:text-7xl leading-[1.05] max-w-4xl">
          Õpetaja töö, korraldatud ja rahulik.
        </h1>
        <p className="mt-8 text-lg text-[#14213D]/70 max-w-xl leading-relaxed">
          Päevik, hinded, materjalid ja planeerimine ühes kohas. AI aitab ettevalmistusega,
          aga otsused jäävad alati sinule.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/register" className="bg-[#14213D] text-white rounded-lg px-6 py-3 text-sm hover:bg-[#1C3556] transition-colors">Alusta</Link>
          <Link to="/login" className="text-sm underline underline-offset-4 decoration-[#B08D57]">Mul on juba konto</Link>
        </div>
      </section>

      <section className="border-t border-[#D9D4C7]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-serif-brand text-3xl lg:text-4xl mb-12">Kõik, mida õpetaja päevas vajab.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#D9D4C7] border border-[#D9D4C7]">
            {FEATURES.map(([title, text]) => (
              <div key={title} className="bg-[#F7F4EE] p-8">
                <h3 className="font-serif-brand text-xl mb-3">{title}</h3>
                <p className="text-sm text-[#14213D]/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#14213D] text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-3 gap-12">
          {STEPS.map(([n, title, text]) => (
            <div key={n}>
              <p className="text-[#B08D57] text-sm tracking-widest mb-3">{n}</p>
              <h3 className="font-serif-brand text-2xl mb-3">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-start">
        <h2 className="font-serif-brand text-3xl lg:text-4xl leading-tight">Sinu õpilaste andmed jäävad sinu kooli piiridesse.</h2>
        <ul className="space-y-4 text-[#14213D]/75 leading-relaxed">
          <li className="border-t border-[#D9D4C7] pt-4">Õpilaste nimed asendatakse enne AI-le saatmist märgistega.</li>
          <li className="border-t border-[#D9D4C7] pt-4">Andmed hoitakse Euroopas ja kasutaja näeb ainult oma kooli.</li>
          <li className="border-t border-[#D9D4C7] pt-4">AI teeb ettepanekud. Midagi ei saadeta lapsevanemale ilma sinu kinnituseta.</li>
        </ul>
      </section>

      <footer className="border-t border-[#D9D4C7]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-[#14213D]/60">
          <span className="font-serif-brand text-lg text-[#14213D]">EduAI</span>
          <span>Loovtöö 2026</span>
        </div>
      </footer>
    </div>
  )
}
