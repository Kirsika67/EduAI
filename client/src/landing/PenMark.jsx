import { useEffect, useRef, useState } from 'react'

/** Lisab `true`, kui element jõuab vaatesse. Vähendatud liikumisega kohe `true`. */
export function useInView(options = { threshold: 0.45 }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setInView(true)
      return undefined
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        io.disconnect()
      }
    }, options)
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, inView]
}

/**
 * Õpetaja punase pliiatsi märk elemendi peal: ring, joon alla või linnuke.
 * Joonistub, kui `drawn` muutub tõeseks (vt `.pen-path` index.css-is).
 */
const PATHS = {
  circle: { viewBox: '0 0 200 80', d: 'M150 10 C 190 14, 198 46, 170 64 C 130 84, 40 80, 14 58 C -6 38, 22 10, 70 6 C 104 3, 140 6, 166 16' },
  underline: { viewBox: '0 0 200 20', d: 'M4 12 C 50 6, 110 16, 150 9 S 190 8, 196 11' },
  check: { viewBox: '0 0 40 40', d: 'M6 22 L 16 32 L 36 6' },
}

export default function PenMark({ type = 'circle', drawn, className = '', delay = 0 }) {
  const p = PATHS[type]
  return (
    <svg
      aria-hidden="true"
      viewBox={p.viewBox}
      preserveAspectRatio="none"
      className={`pointer-events-none absolute overflow-visible ${className}`}
    >
      <path
        d={p.d}
        pathLength="1"
        fill="none"
        stroke="#C8322B"
        strokeWidth={type === 'check' ? 4 : 2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={`pen-path ${drawn ? 'is-drawn' : ''}`}
        style={{ transitionDelay: `${delay}ms` }}
      />
    </svg>
  )
}
