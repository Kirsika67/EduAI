/** Näitab essee originaalteksti, kus AI leitud vead on esile tõstetud. */
export default function HighlightedEssay({ text, errors }) {
  const spans = []
  for (const err of errors || []) {
    let from = 0
    // Märgi kõik esinemised; kattuvad lõigud jäetakse vahele.
    while (err.wrong && (from = text.indexOf(err.wrong, from)) !== -1) {
      spans.push({ start: from, end: from + err.wrong.length, err })
      from += err.wrong.length
    }
  }
  spans.sort((a, b) => a.start - b.start)

  const parts = []
  let pos = 0
  for (const s of spans) {
    if (s.start < pos) continue
    if (s.start > pos) parts.push(text.slice(pos, s.start))
    parts.push(
      <mark
        key={s.start}
        title={[s.err.correct && `→ ${s.err.correct}`, s.err.note].filter(Boolean).join(' — ')}
        className="bg-red-100 text-red-800 rounded px-0.5 underline decoration-wavy decoration-red-400 cursor-help"
      >
        {text.slice(s.start, s.end)}
      </mark>
    )
    pos = s.end
  }
  if (pos < text.length) parts.push(text.slice(pos))

  return <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{parts}</p>
}
