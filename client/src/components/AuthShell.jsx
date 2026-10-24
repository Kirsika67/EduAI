import { Link } from 'react-router-dom'

/** Vihikuvirn ainult CSS-iga (3D kalle, lipikud), sama motiiv mis avalehe 3D-stseenis. */
const STACK = [
  { color: '#3A5BC7', name: 'Mari', shift: -6 },
  { color: '#3FB58A', name: 'Jaan', shift: 4 },
  { color: '#F2B544', name: 'Kertu', shift: -2, flag: '#E5483D' },
  { color: '#E59AB8', name: 'Oskar', shift: 6, flag: '#F0B23A' },
  { color: '#E8604C', name: 'Markus', shift: 0 },
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
    <div className="min-h-screen bg-[#F7F4EE] grid lg:grid-cols-[1.05fr_1fr] lg:p-3 lg:gap-3">
      <aside className="hero-sky relative overflow-hidden text-white px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between lg:rounded-[34px]" style={{ '--p': 0.75 }}>
        <div className="hero-sun pointer-events-none absolute inset-0" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-overlay" />
                <Link to="/avaleht" className="relative flex items-center gap-2 font-serif-brand text-2xl tracking-tight w-fit">
          <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_35%_35%,#FBE3A8,#E8735A)] shadow-[0_0_18px_rgba(232,150,100,0.9)]" />
          EduAI
        </Link>
        <div className="relative my-10 lg:my-0 grid gap-12">
          <div className="hidden lg:[@media(min-height:780px)]:block"><NotebookStack /></div>
          <div className="max-w-md">
            <h2 className="font-serif-brand text-3xl lg:text-[3.2rem] leading-[1.05] tracking-[-0.02em]">
              Esmaspäev võib alata <em className="hero-accent font-serif-italic not-italic">rahulikult</em>.
            </h2>
            <p className="text-white/85 mt-5 leading-relaxed">
              Päevik, hinded, materjalid ja planeerimine ühes kohas. AI aitab ettevalmistusega, aga otsused jäävad sinule.
            </p>
          </div>
        </div>
        <ul className="relative hidden lg:[@media(min-height:700px)]:block space-y-3 text-sm text-white/80">
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
