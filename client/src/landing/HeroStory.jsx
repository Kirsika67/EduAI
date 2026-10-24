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
    title: ['Laud on juba ', 'täis', '.'],
    body: 'Kolmkümmend vihikut parandada, kontrolltöö homseks, asendustund kolmandaks ja kolm lapsevanemat ootavad vastust.',
  },
  {
    kicker: 'Esmaspäev, 7.52',
    title: ['EduAI teeb sellest ', 'rahuliku hommiku', '.'],
    body: 'Päevik näitab tänast päeva, planeerija koostab kontrolltöö, esseed on eelhinnatud ja sõnumid sõnastatud. Sina vaatad üle ja kinnitad.',
  },
  {
    kicker: 'Esmaspäev, 7.55',
    title: ['Ja ütleb, kes ', 'vajab sind', ' täna.'],
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
  red: 'bg-[#FF3B30]',
  amber: 'bg-[#FFB800]',
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
      // Päikesetõus: taust soojeneb ja päike tõuseb koos kerimisega
      stage.style.setProperty('--p', reduced ? '1' : p.toFixed(3))
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
      className="relative bg-[#070A1F] text-white"
      style={{ height: scrollStory ? '330vh' : 'auto' }}
    >
      <div className={`${scrollStory ? 'sticky top-0 h-[100svh]' : 'relative min-h-[100svh]'} p-2 sm:p-3`}>
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={() => sceneRef.current?.clearPointer()}
          className="hero-sky relative h-full min-h-[calc(100svh-1rem)] rounded-[24px] sm:rounded-[34px] overflow-hidden"
          style={{ '--p': 0 }}
        >
          {/* Päikesetõusu kihid (CSS), 3D-lõuend on läbipaistev nende peal */}
          <div className="hero-sun pointer-events-none absolute inset-0" />
          <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay" />

          {/* 3D-stseen lisab siia oma lõuendi (vt deskScene.js) */}
          {webgl && <div ref={canvasRef} className="absolute inset-0" />}

          {/* Loetavus: pehme tumedam ala teksti taga */}
          <div className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(90deg,rgba(9,12,52,0.72)_0%,rgba(9,12,52,0.4)_38%,rgba(9,12,52,0)_60%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] md:hidden bg-[linear-gradient(0deg,rgba(9,12,52,0.92)_0%,rgba(9,12,52,0.7)_55%,rgba(9,12,52,0)_100%)]" />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 z-10 bg-[linear-gradient(180deg,rgba(9,12,52,0.55),rgba(9,12,52,0))]" />
          <header className="absolute inset-x-0 top-0 z-20">
            <div className="max-w-6xl mx-auto px-5 sm:px-10 py-5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xl font-bold tracking-[-0.03em]">
                <span className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_35%_35%,#FFE59A,#FF7A4D)] shadow-[0_0_18px_rgba(255,170,90,0.9)]" />
                EduAI
              </span>
              <nav className="flex items-center gap-3 sm:gap-5 text-sm">
                <Link to="/login" className="text-white/85 hover:text-white">Logi sisse</Link>
                <Link to="/register" className="bg-white text-[#0E1450] rounded-full px-4 py-2 font-semibold hover:bg-[#FFF3DA] transition-colors">
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
              <span data-leader className="absolute left-0 top-0 h-[1.5px] origin-left bg-white/70" />
              <div className="bg-white text-[#0E1450] rounded-2xl shadow-[0_18px_40px_-12px_rgba(10,15,58,0.55)] px-4 py-3 w-[200px] xl:w-[236px]">
                <p className="flex items-center gap-2 text-[13px] font-bold">
                  <span className={`w-2.5 h-2.5 rounded-full ${toneClass[f.tone]}`} />
                  {f.name}
                  <span className="font-medium text-[#0E1450]/50">{f.level}</span>
                </p>
                <p className="text-[12.5px] text-[#0E1450]/75 mt-0.5 leading-snug">{f.reason}</p>
              </div>
            </div>
          ))}

          <div
            className={`relative z-10 max-w-6xl mx-auto px-5 sm:px-10 ${
              scrollStory ? 'h-full' : 'pt-28 pb-16'
            } flex flex-col justify-end md:justify-center pb-10 md:pb-0`}
          >
            <div className={scrollStory ? 'relative h-[360px] sm:h-[400px] max-w-xl' : 'max-w-xl space-y-14 mt-[45vh] md:mt-0'}>
              {STEPS.map((s, i) => {
                const Heading = i === 0 ? 'h1' : 'h2'
                return (
                  <div
                    key={s.kicker}
                    ref={(el) => { stepRefs.current[i] = el }}
                    className={scrollStory ? 'absolute inset-x-0 bottom-0 md:bottom-auto md:top-0 will-change-transform' : ''}
                    style={scrollStory ? { opacity: i === 0 ? 1 : 0 } : undefined}
                  >
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md px-3 py-1 text-[13px] font-medium text-white/90">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFC23D]" />
                      {s.kicker}
                    </p>
                    <Heading className="font-sans font-bold text-[2.7rem] sm:text-6xl lg:text-[4.6rem] leading-[0.98] tracking-[-0.04em] mt-4 text-white">
                      {s.title[0]}
                      <em className="hero-accent font-serif-italic not-italic">{s.title[1]}</em>
                      {s.title[2]}
                    </Heading>
                    <p className="mt-5 text-white/80 text-base sm:text-lg leading-relaxed max-w-md">{s.body}</p>
                    {i === 2 && webgl && (
                      <ul className="sm:hidden mt-5 space-y-1.5 text-[13px] text-white/85">
                        {FLAGS.map((f) => (
                          <li key={f.name} className="flex items-baseline gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 translate-y-[-1px] ${toneClass[f.tone]}`} />
                            <span><span className="font-semibold text-white">{f.name}</span>: {f.reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(i === 0 || i === 2) && (
                      <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link to="/register" className="bg-white text-[#0E1450] rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_30px_-8px_rgba(255,190,110,0.7)] hover:bg-[#FFF3DA] transition-colors">
                          Proovi oma klassiga
                        </Link>
                        <Link to="/login" className="rounded-full px-5 py-3 text-sm font-medium text-white bg-white/10 border border-white/25 backdrop-blur-md hover:bg-white/20 transition-colors">
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
            <div ref={hintRef} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-xs text-white/70">
              Keri ja vaata, kuidas päev korda saab
              <span className="scroll-hint-line block w-px h-10 bg-white/60" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
