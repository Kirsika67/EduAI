import '@fontsource/newsreader/latin-500-italic.css'
import '@fontsource/newsreader/latin-ext-500-italic.css'
import '@fontsource/dm-sans/latin-800.css'
import '@fontsource/dm-sans/latin-ext-800.css'
import HeroStory from '../landing/HeroStory'
import { DayTimeline, PrivacyDemo, MoreList, FinalCta } from '../landing/Sections'

/**
 * Avaleht. Lugu: segane laud (3D) → üks päev päris vaadetega → nimede peitmine → kutse.
 * 3D-stseen laetakse eraldi tükina (`deskScene.js`), seega rakenduse põhikimp ei kasva.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#14213D]">
      <HeroStory />
      <main>
        <DayTimeline />
        <PrivacyDemo />
        <MoreList />
      </main>
      <FinalCta />
    </div>
  )
}
