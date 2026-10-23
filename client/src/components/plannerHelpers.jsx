/** Eraldab vastuse lõpust masinloetava plaaniploki; tagastab {text, plan}. */
export function splitPlan(text) {
  const m = text.match(/```plan\s*([\s\S]*?)```/)
  if (!m) return { text, plan: null }
  let plan = null
  try { plan = JSON.parse(m[1]) } catch { plan = null }
  return { text: text.replace(m[0], '').trim(), plan }
}

export function RichText({ text }) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>
    if (line.startsWith('# ')) return <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(2)}</h3>
    const parts = line.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)
    return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>
  })
}

