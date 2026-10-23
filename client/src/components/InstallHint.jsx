import { useState, useEffect } from 'react'

/** "Lisa kodukuvale": Androidis/Chrome'is nupp, iPhone'is juhis. Peidus, kui juba paigaldatud. */
export default function InstallHint() {
  const [prompt, setPrompt] = useState(null)
  const [done, setDone] = useState(false)
  const standalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e) }
    const onInstalled = () => setDone(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || done) return null
  if (!prompt && !ios) return null

  return (
    <div className="mb-6 border border-[#D9D4C7] bg-white rounded-lg p-4 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-[#14213D]">Kasuta EduAI-d nagu rakendust</p>
        <p className="text-xs text-[#6B6B66] mt-1">
          {ios
            ? 'Vajuta Safaris jagamisnuppu (ruut noolega) ja vali "Lisa kodukuvale".'
            : 'Lisa kodukuvale, et avada see ühe puudutusega, ilma brauseri aadressiribata.'}
        </p>
      </div>
      {prompt && (
        <button
          onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null) }}
          className="bg-[#14213D] text-white text-sm rounded-lg px-4 py-2 flex-shrink-0 hover:bg-[#1C3556]">
          Lisa
        </button>
      )}
    </div>
  )
}
