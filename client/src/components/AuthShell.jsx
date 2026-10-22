import { Link } from 'react-router-dom'

/** Ühine sisselogimise ja registreerimise raam: vasakul rahulik sõnum, paremal vorm. */
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-[#F7F4EE] grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-[#14213D] text-white px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between">
        <Link to="/avaleht" className="font-serif-brand text-2xl tracking-tight">EduAI</Link>
        <div className="my-10 lg:my-0 max-w-md">
          <div className="w-10 h-px bg-[#B08D57] mb-6" />
          <h2 className="font-serif-brand text-3xl lg:text-5xl leading-[1.1]">Õpetaja töö, korraldatud ja rahulik.</h2>
          <p className="text-white/70 mt-5 leading-relaxed">
            Päevik, hinded, materjalid ja planeerimine ühes kohas. AI aitab ettevalmistusega, aga otsused jäävad sinule.
          </p>
        </div>
        <ul className="hidden lg:block space-y-3 text-sm text-white/65">
          <li>Õpilaste nimed ei jõua AI-ni, need asendatakse enne märgistega.</li>
          <li>Andmed jäävad Euroopasse ja kooli piiridesse.</li>
          <li>AI teeb ettepanekud, sina kinnitad.</li>
        </ul>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
