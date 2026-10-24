import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

/** Hoiatuslipikute tekstid — samas vormis nagu rakenduse päris varajane hoiatus. */
const FLAGS = [
  { name: 'Kertu', level: 'Tähelepanu', reason: '3 järjestikust hinnet alla 50%', tone: 'red' },
  { name: 'Oskar', level: 'Tugi vajalik', reason: '2 puudumist 30 päeva jooksul (piir: 2)', tone: 'amber' },
  { name: 'Hugo', level: 'Tugi vajalik', reason: 'Keskmine langes kuuga 18%', tone: 'amber' },
]

const STEPS = [
  {
    kicker: 'Esmaspäev, 7.45',
    title: 'Laud on juba täis.',
    body: 'Kolmkümmend vihikut parandada, kontrolltöö homseks, asendustund kolmandaks ja kolm lapsevanemat ootavad vastust.',
  },
  {
    kicker: 'Esmaspäev, 7.52',
    title: 'EduAI paneb selle korda enne esimest kella.',
    body: 'Päevik näitab tänast päeva, planeerija koostab kontrolltöö, esseed on eelhinnatud ja sõnumid sõnastatud. Sina vaatad üle ja kinnitad.',
  },
  {
    kicker: 'Esmaspäev, 7.55',
    title: 'Ja ütleb, kes vajab sind täna.',
    body: 'Varajane hoiatus näitab põhjust ja piiri, mitte ainult värvi. Piirid paned sina ja sina otsustad, kas see oli päriselt risk.',
  },
]

/** Millal iga samm on nähtav (kerimise edenemine 0..1). */
const WINDOWS = [[-2, -1, 0.16], [0.2, 0.3, 0.52], [0.58, 0.68, 2]]

function stepOpacity(p, [start, peak, end]) {
  if (p < start || p > end + 0.08) return 0
  if (p < peak) return Math.min(1, (p - start) / Math.max(0.0001, peak - start))
  if (p <= end) return 1
  return Math.max(0, 1 - (p - end) / 0.08)
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const toneClass = {
  red: 'bg-[#D94A3F]',
  amber: 'bg-[#E5B23A]',
}

export default function HeroStory() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const stepRefs = useRef([])
  const calloutRefs = useRef([])
  const hintRef = useRef(null)
  const sceneRef = useRef(null)
  const [reduced] = useState(prefersReducedMotion)
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!webgl) return undefined
    let disposed = false
    let ro, io
    const stage = stageRef.current
    const section = sectionRef.current

    const placeCallouts = (anchors, p) => {
      const w = stage.clientWidth
      // Sildid ei tohi üksteist katta: järjesta y järgi ja hoia vahe
      const items = anchors
        .map((a, i) => ({ a, i, el: calloutRefs.current[i] }))
        .filter((it) => it.el)
        .sort((x, y) => x.a.y - y.a.y)
      let floor = -Infinity
      items.forEach(({ a, i, el }) => {
        const show = a.visible && p > 0.66 + i * 0.04
        const cw = el.offsetWidth || 230
        const ch = el.offsetHeight || 56
        // Hoia silt lipiku paremal pool; kitsal ekraanil nihuta vasakule, mitte üle virna
        const flip = false
        const x = Math.max(a.x + 18, Math.min(a.x + 56, w - cw - 16))
        const y = Math.max(a.y - ch / 2, floor + 10)
        floor = y + ch
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`
        el.style.opacity = show ? '1' : '0'
        // Juhtjoon lipikust sildini
        const line = el.querySelector('[data-leader]')
        if (line) {
          const dx = flip ? a.x - (x + cw) : x - a.x
          const dy = y + ch / 2 - a.y
          const len = Math.hypot(dx, dy)
          const ang = Math.atan2(dy, dx) * (180 / Math.PI)
          line.style.width = `${len}px`
          line.style.transform = flip
            ? `translate(${cw}px, ${ch / 2}px) rotate(${ang + 180}deg)`
            : `translate(0px, ${ch / 2}px) rotate(${ang + 180}deg)`
        }
      })
    }

    const updateText = (p) => {
      WINDOWS.forEach((win, i) => {
        const el = stepRefs.current[i]
        if (!el) return
        const o = reduced ? 1 : stepOpacity(p, win)
        el.style.opacity = String(o)
        el.style.transform = reduced ? 'none' : `translate3d(0, ${(1 - o) * 14}px, 0)`
        el.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
        el.setAttribute('aria-hidden', o > 0.5 ? 'false' : 'true')
      })
      if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - p * 8))
    }

    const progress = () => {
      if (reduced) return 1
      const r = section.getBoundingClientRect()
      const span = r.height - window.innerHeight
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const p = progress()
        updateText(p)
        sceneRef.current?.setProgress(p)
      })
    }

    import('./deskScene.js')
      .then(({ createDeskScene }) =>
        createDeskScene(canvasRef.current, { reducedMotion: reduced, onFrame: placeCallouts })
      )
      .then((scene) => {
        if (disposed) { scene.dispose(); return }
        sceneRef.current = scene
        const size = () => scene.resize(stage.clientWidth, stage.clientHeight)
        size()
        ro = new ResizeObserver(size)
        ro.observe(stage)
        io = new IntersectionObserver(([entry]) => scene.setRunning(entry.isIntersecting))
        io.observe(stage)
        scene.setProgress(progress())
        scene.renderOnce()
        updateText(progress())
        setReady(true)
        /** Arenduses: `__hero(0.7)` joonistab kindla oleku ka siis, kui vahekaart on taustal. */
        if (import.meta.env.DEV) {
          window.__hero = (p) => { updateText(p); scene.setProgress(p); scene.renderOnce() }
        }
      })
      .catch(() => { /* WebGL ebaõnnestus: tekst jääb alles, lõuend peidus */ })

    updateText(progress())
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      disposed = true
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro?.disconnect()
      io?.disconnect()
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [webgl, reduced])

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || !sceneRef.current) return
    const r = stageRef.current.getBoundingClientRect()
    sceneRef.current.setPointer(e.clientX - r.left, e.clientY - r.top)
  }

  const scrollStory = !reduced && webgl

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#0D1424] text-white"
      style={{ height: scrollStory ? '330vh' : 'auto' }}
    >
      <div
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => sceneRef.current?.clearPointer()}
        className={`${scrollStory ? 'sticky top-0 h-[100svh]' : 'relative min-h-[100svh]'} overflow-hidden`}
      >
        {webgl && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {/* Filmilik viimistlus: vinjett ja peen tera (ainult CSS, ei koorma GPU-d) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_60%_45%,rgba(13,20,36,0)_45%,rgba(8,12,22,0.55)_100%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay" />
        {/* Loetavus: teksti taga tumedam ala (laual vasakul, telefonis all) */}
        <div className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(90deg,#0D1424_0%,rgba(13,20,36,0.92)_30%,rgba(13,20,36,0.35)_55%,rgba(13,20,36,0)_70%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] md:hidden bg-[linear-gradient(0deg,#0D1424_0%,rgba(13,20,36,0.94)_55%,rgba(13,20,36,0)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(13,20,36,0.85),rgba(13,20,36,0))]" />

        <header className="absolute inset-x-0 top-0 z-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
            <span className="font-serif-brand text-2xl tracking-tight">EduAI</span>
            <nav className="flex items-center gap-4 sm:gap-6 text-sm">
              <Link to="/login" className="text-white/80 hover:text-white">Logi sisse</Link>
              <Link to="/register" className="bg-white text-[#14213D] rounded-full px-4 py-2 font-medium hover:bg-[#F3EFE6] transition-colors">
                Loo konto
              </Link>
            </nav>
          </div>
        </header>

        {/* Hoiatuslipikute sildid, mis järgivad 3D-lipikuid */}
        {webgl && FLAGS.map((f, i) => (
          <div
            key={f.name}
            ref={(el) => { calloutRefs.current[i] = el }}
            className="hero-callout pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-300 hidden sm:block"
          >
            <span data-leader className="absolute left-0 top-0 h-px origin-left bg-white/45" />
            <div className="bg-[#FCFBF7] text-[#14213D] rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.35)] px-3.5 py-2.5 w-[230px]">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span className={`w-2 h-2 rounded-full ${toneClass[f.tone]}`} />
                {f.name}
                <span className="font-normal text-[#14213D]/55">{f.level}</span>
              </p>
              <p className="text-[12.5px] text-[#14213D]/75 mt-0.5 leading-snug">{f.reason}</p>
            </div>
          </div>
        ))}

        <div
          className={`relative z-10 max-w-6xl mx-auto px-5 sm:px-8 ${
            scrollStory ? 'h-full' : 'pt-28 pb-16'
          } flex flex-col justify-end md:justify-center pb-14 md:pb-0`}
        >
          <div className={scrollStory ? 'relative h-[340px] sm:h-[380px] max-w-xl' : 'max-w-xl space-y-14 mt-[45vh] md:mt-0'}>
            {STEPS.map((s, i) => {
              const Heading = i === 0 ? 'h1' : 'h2'
              return (
                <div
                  key={s.title}
                  ref={(el) => { stepRefs.current[i] = el }}
                  className={scrollStory ? 'absolute inset-x-0 bottom-0 md:bottom-auto md:top-0 will-change-transform' : ''}
                  style={scrollStory ? { opacity: i === 0 ? 1 : 0 } : undefined}
                >
                  <p className="font-serif-brand text-[#E8B9A4] text-lg">{s.kicker}</p>
                  <Heading className="font-serif-brand text-[2.6rem] sm:text-6xl lg:text-[4.4rem] leading-[1.02] tracking-[-0.02em] mt-3 text-white">
                    {s.title}
                  </Heading>
                  <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-md">{s.body}</p>
                  {i === 2 && webgl && (
                    <ul className="sm:hidden mt-5 space-y-1.5 text-[13px] text-white/80">
                      {FLAGS.map((f) => (
                        <li key={f.name} className="flex items-baseline gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 translate-y-[-1px] ${toneClass[f.tone]}`} />
                          <span><span className="font-semibold text-white">{f.name}</span>: {f.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(i === 0 || i === 2) && (
                    <div className="mt-8 flex flex-wrap items-center gap-5">
                      <Link to="/register" className="bg-[#C8322B] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-[#B02A24] transition-colors">
                        Proovi oma klassiga
                      </Link>
                      <Link to="/login" className="text-sm text-white/80 underline underline-offset-4 decoration-white/30 hover:decoration-white">
                        Mul on konto
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {scrollStory && (
          <div ref={hintRef} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-xs text-white/55">
            Keri ja vaata, kuidas laud korda saab
            <span className="scroll-hint-line block w-px h-10 bg-white/40" />
          </div>
        )}
      </div>
    </section>
  )
}
