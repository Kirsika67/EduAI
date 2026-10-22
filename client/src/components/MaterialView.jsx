import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * Õppematerjal päris välimusega: Markdown + LaTeX-valemid (korralikud murrud, astmed,
 * kirjalik arvutamine) + SVG-joonised. AI väljund on mitteusaldatav, seega kõik läheb
 * läbi DOMPurify.
 */
function renderMath(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, output: 'html' })
  } catch {
    return `<code>${tex.replace(/</g, '&lt;')}</code>`
  }
}

export function materialToHtml(source) {
  const slots = []
  const hold = (html) => { slots.push(html); return `@@SLOT${slots.length - 1}@@` }
  let text = String(source || '')

  // SVG-joonised ```svg ... ```
  text = text.replace(/```svg\s*\n([\s\S]*?)```/g, (_, svg) => {
    const clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: false }, FORBID_TAGS: ['script', 'foreignObject', 'image', 'a', 'use'] })
    return `\n\n${hold(`<div class="mat-figure">${clean}</div>`)}\n\n`
  })
  // Lehekülje vahetus
  text = text.replace(/^\s*\[\[LEHEKULG\]\]\s*$/gm, () => `\n\n${hold('<div class="mat-pagebreak"></div>')}\n\n`)
  // Valemid: $$...$$ ja $...$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => hold(`<div class="mat-math">${renderMath(tex.trim(), true)}</div>`))
  text = text.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (_, tex) => hold(renderMath(tex.trim(), false)))

  let html = marked.parse(text, { gfm: true, breaks: false })
  html = html.replace(/@@SLOT(\d+)@@/g, (_, i) => slots[Number(i)] ?? '')
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['svg', 'path', 'line', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'g', 'tspan'],
    ADD_ATTR: ['viewBox', 'xmlns', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'text-anchor', 'font-size', 'font-family', 'transform', 'width', 'height', 'style', 'aria-hidden'],
  })
}

export default function MaterialView({ content }) {
  const html = useMemo(() => materialToHtml(content), [content])
  return <div className="material-doc" dangerouslySetInnerHTML={{ __html: html }} />
}
