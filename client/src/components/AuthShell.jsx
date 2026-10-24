import { Link } from 'react-router-dom'

/** Vihikuvirn ainult CSS-iga (3D kalle, lipikud), sama motiiv mis avalehe 3D-stseenis. */
const STACK = [
  { color: '#2C5A70', name: 'Mari', shift: -6 },
  { color: '#5B7656', name: 'Jaan', shift: 4 },
  { color: '#C7953C', name: 'Kertu', shift: -2, flag: '#D8433A' },
  { color: '#363B46', name: 'Oskar', shift: 6, flag: '#E9B43C' },
  { color: '#7A2C29', name: 'Markus', shift: 0 },
]

function NotebookStack() {
  return (
    <div className="auth-stack" aria-hidden="true">
      {STACK.map((n, i) => (
        <div
          key={n.name}
          className="auth-notebook"
          style={{ '--i': i, '--shift': `${n.shift}px`, background: n.color }}
        >
          {n.flag && <span className="auth-flag" style={{ background: n.flag }} />}
          {i === STACK.length - 1 && (
            <span className="auth-label">
              <span className="block text-[10px] font-semibold text-[#14213D]">Matemaatika</span>
              <span className="block font-serif-brand text-base text-[#14213D] leading-tight mt-0.5">{n.name}</span>
              <span className="block text-[9px] text-[#14213D]/60">7.A klass</span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Ühine sisselogimise ja registreerimise raam: vasakul rahulik sõnum, paremal vorm. */
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-[#FBFAF6] grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative overflow-hidden bg-[#0D1424] text-white px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,227,189,0.13),rgba(255,227,189,0))]" />
        <Link to="/avaleht" className="relative font-serif-brand text-2xl tracking-tight w-fit">EduAI</Link>
        <div className="relative my-10 lg:my-0 grid gap-12">
          <div className="hidden lg:[@media(min-height:780px)]:block"><NotebookStack /></div>
          <div className="max-w-md">
            <h2 className="font-serif-brand text-3xl lg:text-5xl leading-[1.08] tracking-[-0.015em]">
              Esmaspäev võib alata rahulikult.
            </h2>
            <p className="text-white/70 mt-5 leading-relaxed">
              Päevik, hinded, materjalid ja planeerimine ühes kohas. AI aitab ettevalmistusega, aga otsused jäävad sinule.
            </p>
          </div>
        </div>
        <ul className="relative hidden lg:[@media(min-height:700px)]:block space-y-3 text-sm text-white/65">
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
