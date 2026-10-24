/**
 * Avalehe 3D-stseen: esmaspäeva hommiku vihikud, stuudiovalguses.
 *
 * Kunstiline suund: mitte realistlik tuba (see näeb WebGL-is alati välja nagu vana mäng),
 * vaid "tootefoto": erksad, pehmete servadega vihikud hõljuvad läbipaistval lõuendil,
 * all ainult pehme vari. Taust (päikesetõusu gradient) on CSS-is, vt HeroStory.jsx.
 *
 * Kerimise edenemine `p` (0..1):
 *   0.00–0.12  vihikud hõljuvad segamini (hiirega saab neid tõugata)
 *   0.12–0.60  vihikud lendavad virna, lehed ja pliiatsid joonduvad
 *   0.60–0.80  kolmest vihikust libisevad välja hoiatuslipikud
 *   0.80–1.00  kaamera rahuneb
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const NOTEBOOK = { w: 1.48, h: 0.07, d: 2.1 }
const PAPER = { w: 1.6, d: 2.26 }

/** Rõõmsad, erksad kaaned. Igal oma graafiline motiiv nagu disainikirjatarvetel. */
const COVERS = [
  { base: '#FFC23D', print: '#FFD873', motif: 'sun' },      // päikesekollane
  { base: '#3D5BFF', print: '#6A82FF', motif: 'stripes' },  // koobalt
  { base: '#FF5E4D', print: '#FF8A7D', motif: 'dots' },     // korall
  { base: '#2FD39A', print: '#6CE5B9', motif: 'arc' },      // münt
  { base: '#FF8CC8', print: '#FFB3DA', motif: 'sun' },      // roosa
  { base: '#F4F1EA', print: '#E4DED2', motif: 'stripes' },  // valge
  { base: '#1E2A78', print: '#33419B', motif: 'arc' },      // öösinine (virna pealmine)
]
const NAMES = [
  'Mari', 'Jaan', 'Kertu', 'Rasmus', 'Liisa', 'Karl', 'Eliise',
  'Oskar', 'Sofia', 'Robin', 'Mia', 'Hugo', 'Lenna', 'Markus',
]
const SUBJECTS = ['Matemaatika', 'Eesti keel', 'Matemaatika', 'Loodusõpetus', 'Matemaatika', 'Ajalugu', 'Matemaatika']

/** Hoiatuslipikud: vihiku indeks ja värv. Tekstid on HeroStory.jsx-is. */
export const FLAGGED = [
  { index: 2, color: '#FF3B30' },
  { index: 7, color: '#FFB800' },
  { index: 11, color: '#FFB800' },
]

const PEN_RED = '#FF3B30'
const BALLPOINT = '#2338A8'

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
const lerp = (a, b, t) => a + (b - a) * t

/* ---------------- Tekstuurid ---------------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function coverTexture(cover, name, subject, seed) {
  const rand = seeded(seed)
  const [c, ctx] = makeCanvas(740, 1050)
  const w = c.width, h = c.height
  ctx.fillStyle = cover.base
  ctx.fillRect(0, 0, w, h)

  // Graafiline motiiv
  ctx.fillStyle = cover.print
  ctx.strokeStyle = cover.print
  if (cover.motif === 'sun') {
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.86, 230, 0, Math.PI * 2); ctx.fill()
  } else if (cover.motif === 'stripes') {
    ctx.lineWidth = 34
    for (let i = -4; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * 110, h); ctx.lineTo(i * 110 + 420, h - 420); ctx.stroke()
    }
  } else if (cover.motif === 'dots') {
    for (let y = 640; y < h - 40; y += 64) {
      for (let x = 60; x < w - 40; x += 64) {
        ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill()
      }
    }
  } else if (cover.motif === 'arc') {
    ctx.lineWidth = 46
    for (let r = 120; r < 520; r += 92) {
      ctx.beginPath(); ctx.arc(w * 0.15, h, r, -Math.PI / 2, 0); ctx.stroke()
    }
  }

  // Silt: suur, ümarate nurkadega
  const lx = 92, ly = 150, lw = w - 184, lh = 330
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  roundRect(ctx, lx, ly + 8, lw, lh, 28); ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, lx, ly, lw, lh, 28); ctx.fill()
  ctx.fillStyle = 'rgba(20,24,60,0.45)'
  ctx.font = '600 26px "DM Sans", sans-serif'
  ctx.fillText(subject.toUpperCase(), lx + 36, ly + 66)
  ctx.save()
  ctx.translate(lx + 34, ly + 190)
  ctx.rotate((rand() - 0.5) * 0.06)
  ctx.fillStyle = BALLPOINT
  ctx.font = 'italic 500 92px Newsreader, Georgia, serif'
  ctx.fillText(name, 0, 0)
  ctx.restore()
  ctx.fillStyle = 'rgba(20,24,60,0.45)'
  ctx.font = '600 26px "DM Sans", sans-serif'
  ctx.fillText('7.A KLASS', lx + 36, ly + 284)
  return toTexture(c)
}

function paperTexture(seed, mark) {
  const rand = seeded(seed)
  const [c, ctx] = makeCanvas(640, 904)
  const w = c.width, h = c.height
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(61,91,255,0.16)'
  ctx.lineWidth = 1.2
  for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  ctx.fillStyle = '#14183C'
  ctx.font = '700 30px "DM Sans", sans-serif'
  ctx.fillText('Kontrolltöö: murrud', 44, 72)
  for (let r = 0; r < 8; r++) {
    const y = 170 + r * 86
    ctx.fillStyle = '#14183C'
    ctx.font = '700 22px "DM Sans", sans-serif'
    ctx.fillText(`${r + 1}.`, 44, y)
    ctx.strokeStyle = BALLPOINT
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    let x = 86
    const end = 240 + rand() * (w - 360)
    ctx.beginPath()
    ctx.moveTo(x, y - 8)
    while (x < end) { x += 6 + rand() * 10; ctx.lineTo(x, y - 8 + (rand() - 0.5) * 10) }
    ctx.stroke()
    ctx.strokeStyle = PEN_RED
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(w - 92, y - 12); ctx.lineTo(w - 76, y + 4); ctx.lineTo(w - 46, y - 30)
    ctx.stroke()
  }
  ctx.strokeStyle = PEN_RED
  ctx.fillStyle = PEN_RED
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.ellipse(w - 100, 74, 54, 46, -0.25, 0.2, Math.PI * 2.05)
  ctx.stroke()
  ctx.font = 'italic 500 72px Newsreader, Georgia, serif'
  ctx.fillText(mark, w - 120, 98)
  return toTexture(c)
}

/* ---------------- Objektid ---------------- */

function softMaterial(color, extra = {}) {
  // Pehme "soft touch" pind: kerge läige servadel, mitte plastik
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.62, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#FFFFFF'),
    clearcoat: 0.15, clearcoatRoughness: 0.6, ...extra,
  })
}

function makeNotebook(i, shared) {
  const cover = COVERS[i % COVERS.length]
  const group = new THREE.Group()
  group.userData.index = i
  const plain = softMaterial(cover.base)
  const top = softMaterial('#FFFFFF', { map: coverTexture(cover, NAMES[i], SUBJECTS[i % SUBJECTS.length], 100 + i) })

  const coverH = 0.014
  const topCover = new THREE.Mesh(shared.coverGeo, [plain, plain, top, plain, plain, plain])
  topCover.position.y = NOTEBOOK.h / 2 - coverH / 2
  const bottomCover = new THREE.Mesh(shared.coverGeo, plain)
  bottomCover.position.y = -NOTEBOOK.h / 2 + coverH / 2
  const pages = new THREE.Mesh(shared.pagesGeo, shared.pagesMat)
  pages.position.x = 0.01

  group.add(topCover, bottomCover, pages)
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.userData.index = i }
  })
  return group
}

function makeFlag(color) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(0.38, 0.012, 0.2, 2, 0.005),
    softMaterial(color, { roughness: 0.4, clearcoat: 0.5 })
  )
  mesh.castShadow = true
  return mesh
}

function makePaper(i, mark) {
  const geo = new THREE.PlaneGeometry(PAPER.w, PAPER.d, 16, 16)
  const pos = geo.attributes.position
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v) / (PAPER.w / 2)
    pos.setZ(v, Math.pow(x, 2) * 0.05)
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: paperTexture(300 + i, mark), roughness: 0.7, side: THREE.DoubleSide })
  )
  mesh.castShadow = true
  return mesh
}

function lathe(points, segments = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments)
}

function makePen() {
  const group = new THREE.Group()
  const red = new THREE.MeshPhysicalMaterial({ color: PEN_RED, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2 })
  const white = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 })
  const steel = new THREE.MeshStandardMaterial({ color: '#E8E6E1', metalness: 1, roughness: 0.2 })
  const body = new THREE.Mesh(lathe([[0, -0.72], [0.014, -0.71], [0.04, -0.6], [0.058, -0.48], [0.06, 0.3], [0, 0.3]]), red)
  const tip = new THREE.Mesh(lathe([[0, -0.8], [0.008, -0.795], [0.016, -0.72], [0, -0.72]], 24), steel)
  const cap = new THREE.Mesh(lathe([[0, 0.3], [0.062, 0.3], [0.064, 0.33], [0.064, 0.72], [0.05, 0.77], [0, 0.78]]), white)
  const clip = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.36, 0.016, 2, 0.007), white)
  clip.position.set(0, 0.55, 0.074)
  group.add(body, tip, cap, clip)
  group.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return group
}

function makePencil() {
  const group = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: '#FFC23D', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.3 })
  const wood = new THREE.MeshStandardMaterial({ color: '#F2D3A8', roughness: 0.8 })
  const graphite = new THREE.MeshStandardMaterial({ color: '#2A2A35', roughness: 0.35, metalness: 0.3 })
  const pink = new THREE.MeshStandardMaterial({ color: '#FF8CC8', roughness: 0.75 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), paint)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), wood)
  cone.position.y = -0.65; cone.rotation.x = Math.PI
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 12), graphite)
  lead.position.y = -0.725; lead.rotation.x = Math.PI
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 24), pink)
  eraser.position.y = 0.61
  group.add(body, cone, lead, eraser)
  group.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return group
}

/* ---------------- Paigutus ---------------- */

function layout(isNarrow) {
  const rand = seeded(9)
  const stackX = isNarrow ? 0 : 2.25
  const count = NAMES.length
  const notebooks = []
  for (let i = 0; i < count; i++) {
    // Segadus: vihikud hõljuvad õhus eri kõrgustel ja nurkade all
    const ang = (i / count) * Math.PI * 2 * 1.618 + rand() * 0.6
    const rad = (isNarrow ? 0.9 : 1.0) + rand() * (isNarrow ? 0.9 : 1.4)
    const from = {
      pos: new THREE.Vector3(
        (isNarrow ? 0 : 3.3) + Math.cos(ang) * rad * (isNarrow ? 0.85 : 1.05),
        0.9 + rand() * 2.2,
        Math.sin(ang) * rad * 0.75 + (isNarrow ? 0.6 : 0.2)
      ),
      quat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rand() - 0.5) * 1.1, rand() * Math.PI * 2, (rand() - 0.5) * 1.1)
      ),
    }
    const to = {
      pos: new THREE.Vector3(stackX + (rand() - 0.5) * 0.03, NOTEBOOK.h / 2 + i * (NOTEBOOK.h + 0.004), 0.15),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.06, 0)),
    }
    notebooks.push({ from, to, delay: i * 0.016, phase: rand() * Math.PI * 2 })
  }

  const papers = ['5', '4', '5'].map((mark, i) => ({
    mark,
    from: {
      pos: new THREE.Vector3((isNarrow ? -0.9 : 2.1) + i * (isNarrow ? 0.9 : 1.2), 1.8 + rand() * 1.2, (rand() - 0.5) * 2 - 0.6),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (rand() - 0.5) * 1.2, (rand() - 0.5) * 0.8, rand() * Math.PI)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? -1.45 : stackX - 0.75, 0.006 + i * 0.004, isNarrow ? -0.45 : -1.15),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.08 + i * 0.05)),
    },
    delay: 0.05 + i * 0.04,
    phase: rand() * Math.PI * 2,
  }))

  const pen = {
    from: {
      pos: new THREE.Vector3(isNarrow ? 0.9 : 4.7, 2.4, isNarrow ? 1.6 : 1.4),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, 0.4, 1.1)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? stackX + 1.05 : stackX + 0.25, 0.065, isNarrow ? 0.2 : 1.62),
      quat: new THREE.Quaternion().setFromEuler(isNarrow ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler(0, 0.12, Math.PI / 2)),
    },
    delay: 0.2,
    phase: 1.3,
  }
  const pencil = {
    from: {
      pos: new THREE.Vector3(isNarrow ? -1.2 : 2.2, 2.8, isNarrow ? 1.4 : 1.6),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.2, 0.7)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? -1.55 : stackX + 1.55, 0.05, isNarrow ? -1.5 : 0.1),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, isNarrow ? 0.4 : -0.3)),
    },
    delay: 0.26,
    phase: 2.1,
  }

  return { notebooks, papers, pen, pencil, stackX }
}

/* ---------------- Stseen ---------------- */

/**
 * `container`: element, kuhu stseen lisab oma lõuendi. Iga stseen loob oma lõuendi ja
 * eemaldab selle ise, sest kaks WebGL-renderdajat ühel lõuendil (nt React StrictMode'i
 * topelt-käivitus arenduses) jagaksid konteksti ja rikuksid teineteise oleku.
 */
export async function createDeskScene(container, { reducedMotion = false, onFrame } = {}) {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('italic 500 92px Newsreader'),
        document.fonts.load('600 26px "DM Sans"'),
        document.fonts.load('700 30px "DM Sans"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ])
  } catch { /* fondid pole kriitilised */ }

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'absolute inset-0 w-full h-full'
  canvas.style.opacity = '0'
  canvas.style.transition = 'opacity 700ms ease'
  container.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.3
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)

  const shared = {
    pagesMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85 }),
    coverGeo: new RoundedBoxGeometry(NOTEBOOK.w, 0.014, NOTEBOOK.d, 3, 0.006),
    pagesGeo: new RoundedBoxGeometry(NOTEBOOK.w - 0.04, NOTEBOOK.h - 0.026, NOTEBOOK.d - 0.04, 2, 0.008),
  }

  // Ainult vari: läbipaistev "maapind", mille peale vihikud maanduvad
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: '#0A0F3A', opacity: 0.32 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Stuudiovalgus: valge võtmevalgus + värvilised servavalgused (korall paremalt, koobalt vasakult)
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#6C7BFF', 0.45))
  const key = new THREE.DirectionalLight('#FFF6EA', 2.6)
  key.position.set(-3, 10, 5)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.radius = 10
  key.shadow.blurSamples = 16
  key.shadow.bias = -0.0005
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 })
  scene.add(key, key.target)
  const rimWarm = new THREE.DirectionalLight('#FF7A5C', 1.8)
  rimWarm.position.set(7, 3, -5)
  const rimCool = new THREE.DirectionalLight('#5D6BFF', 1.3)
  rimCool.position.set(-7, 2, -3)
  scene.add(rimWarm, rimCool)

  const notebookGroups = NAMES.map((_, i) => makeNotebook(i, shared))
  notebookGroups.forEach((g) => scene.add(g))
  const flags = FLAGGED.map(({ index, color }) => {
    const flag = makeFlag(color)
    notebookGroups[index].add(flag)
    return { flag, index }
  })
  const paperMeshes = ['5', '4', '5'].map((m, i) => makePaper(i, m))
  paperMeshes.forEach((m) => scene.add(m))
  const pen = makePen()
  const pencil = makePencil()
  scene.add(pen, pencil)

  let state = null
  let narrow = null
  let width = 1
  let height = 1
  let progress = reducedMotion ? 1 : 0
  let time = 0
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: null, py: null }
  const nudges = new Array(NAMES.length).fill(0)
  let hovered = -1
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const tmp = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const tmpE = new THREE.Euler()
  const camFrom = new THREE.Vector3()
  const camTo = new THREE.Vector3()
  const lookFrom = new THREE.Vector3()
  const lookTo = new THREE.Vector3()
  const look = new THREE.Vector3()

  /** Kaamera sõltub laiusest: kitsamal ekraanil nihkub virn paremale, et tekst jääks vabaks. */
  function framing(isNarrow) {
    const stackX = isNarrow ? 0 : 2.25
    if (isNarrow) {
      camFrom.set(0, 9.0, 9.0); lookFrom.set(0, 1.1, 2.0)
      camTo.set(0.2, 8.2, 6.0); lookTo.set(0, 0.2, 1.5)
    } else {
      const aspect = width / height
      // Kitsamal ekraanil vii kaamera kaugemale (mitte külili): virn jääb tekstist paremale
      // ja hoiatussiltidele jääb paremal vähemalt ~275 px (arvutatud 1024–1920 px laiusel)
      const zoom = THREE.MathUtils.clamp((1440 - width) / 560, 0, 1)
      camFrom.set(1.2, 7.6 + zoom, 11.8 + zoom * 1.5); lookFrom.set(1.6, 1.3, 0.3)
      camTo.set(0.9, 6.6 + zoom * 1.6, 6.4 + zoom * 2.2); lookTo.set(stackX - 1.05, 0.35, 0.1)
    }
  }

  function relayout() {
    const isNarrow = width < 768
    framing(isNarrow)
    if (isNarrow === narrow && state) return
    narrow = isNarrow
    state = layout(isNarrow)
    key.target.position.set(state.stackX * 0.5, 0, 0)
  }

  function resize(w, h) {
    width = Math.max(1, w)
    height = Math.max(1, h)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Püstkaadris laiem vaateväli, muidu näeb ainult kitsast riba keskelt
    camera.fov = camera.aspect < 1 ? 46 : 30
    camera.updateProjectionMatrix()
    relayout()
    needsRender = true
  }

  /** Hõljumine: õrn üles-alla ja pöörlemine, ainult segaduse faasis. */
  function bob(obj, phase, strength) {
    if (strength <= 0) return
    obj.position.y += Math.sin(time * 0.9 + phase) * 0.08 * strength
    tmpE.set(Math.sin(time * 0.6 + phase) * 0.05 * strength, Math.sin(time * 0.4 + phase) * 0.08 * strength, 0)
    obj.quaternion.multiply(tmpQ.setFromEuler(tmpE))
  }

  function apply(p, dt) {
    const fly = (delay) => easeInOut(clamp01((p - 0.12 - delay) / 0.3))
    const floatK = reducedMotion ? 0 : 1

    state.notebooks.forEach((n, i) => {
      const m = notebookGroups[i]
      const t = fly(n.delay)
      m.position.lerpVectors(n.from.pos, n.to.pos, t)
      m.position.y += Math.sin(t * Math.PI) * 0.6
      m.quaternion.slerpQuaternions(n.from.quat, n.to.quat, t)
      bob(m, n.phase, (1 - t) * floatK)
      // Hiirega tõuge: vihik keerleb ja tõuseb natuke
      const target = hovered === i && t === 0 ? 1 : 0
      nudges[i] += (target - nudges[i]) * Math.min(1, dt * 8)
      if (nudges[i] > 0.001) {
        m.position.y += nudges[i] * 0.35
        tmpQ.setFromAxisAngle(tmp.set(0, 1, 0), nudges[i] * 0.5)
        m.quaternion.premultiply(tmpQ)
      }
    })

    flags.forEach(({ flag }, k) => {
      const raw = clamp01((p - 0.6 - k * 0.05) / 0.12)
      const t = easeOutBack(raw)
      flag.position.set(lerp(NOTEBOOK.w / 2 - 0.2, NOTEBOOK.w / 2 + 0.12, t), 0, -0.78 + k * 0.78)
      flag.visible = raw > 0.001
    })

    state.papers.forEach((pp, i) => {
      const m = paperMeshes[i]
      const t = easeInOut(clamp01((p - 0.12 - pp.delay) / 0.32))
      m.position.lerpVectors(pp.from.pos, pp.to.pos, t)
      m.position.y += Math.sin(t * Math.PI) * 0.4
      m.quaternion.slerpQuaternions(pp.from.quat, pp.to.quat, t)
      bob(m, pp.phase, (1 - t) * floatK)
    })

    for (const [obj, spec] of [[pen, state.pen], [pencil, state.pencil]]) {
      const t = easeInOut(clamp01((p - 0.12 - spec.delay) / 0.3))
      obj.position.lerpVectors(spec.from.pos, spec.to.pos, t)
      obj.position.y += Math.sin(t * Math.PI) * 0.5
      obj.quaternion.slerpQuaternions(spec.from.quat, spec.to.quat, t)
      bob(obj, spec.phase, (1 - t) * floatK)
    }

    const c = easeInOut(clamp01(p / 0.85))
    camera.position.lerpVectors(camFrom, camTo, c)
    look.lerpVectors(lookFrom, lookTo, c)
    if (!reducedMotion) {
      camera.position.x += pointer.x * 0.5
      camera.position.y += pointer.y * 0.3
    }
    camera.lookAt(look)
  }

  function anchors() {
    return flags.map(({ flag }) => {
      flag.updateWorldMatrix(true, false)
      tmp.set(0.19, 0, 0).applyMatrix4(flag.matrixWorld).project(camera)
      return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, visible: flag.visible }
    })
  }

  function pick() {
    if (pointer.px == null || progress > 0.1 || reducedMotion) {
      if (hovered !== -1) { hovered = -1; canvas.style.cursor = '' }
      return
    }
    ndc.set((pointer.px / width) * 2 - 1, -(pointer.py / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(notebookGroups, true)[0]
    const next = hit ? hit.object.userData.index ?? -1 : -1
    if (next !== hovered) {
      hovered = next
      canvas.style.cursor = next >= 0 ? 'pointer' : ''
    }
  }

  let raf = 0
  let running = false
  let needsRender = true
  let last = performance.now()
  let slowFrames = 0

  /** Nõrgal seadmel: kui kaadrid on järjest aeglased, langeta eraldusvõimet. */
  function adapt(rawMs) {
    if (dpr <= 1) return
    slowFrames = rawMs > 34 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
    if (slowFrames > 10) {
      dpr = Math.max(1, dpr - 0.5)
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height, false)
      slowFrames = 0
    }
  }

  function frame(now) {
    raf = 0
    const rawMs = now - last
    const dt = Math.min(0.05, rawMs / 1000)
    last = now
    if (rawMs < 200) adapt(rawMs)
    time += dt
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3)
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3)
    pick()
    apply(progress, dt)
    renderer.render(scene, camera)
    onFrame?.(anchors(), progress)
    needsRender = false
    // Hõljumise ajal joonistame pidevalt; korras virnaga ainult muutuste korral
    const floating = !reducedMotion && progress < 0.45
    const settling =
      Math.abs(pointer.tx - pointer.x) > 0.001 ||
      Math.abs(pointer.ty - pointer.y) > 0.001 ||
      nudges.some((l, i) => Math.abs((hovered === i ? 1 : 0) - l) > 0.002)
    if (running && (floating || settling || needsRender)) raf = requestAnimationFrame(frame)
  }

  function kick() {
    needsRender = true
    if (running && !raf) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  return {
    resize,
    setProgress(p) {
      const next = reducedMotion ? 1 : clamp01(p)
      if (next !== progress) { progress = next; kick() }
    },
    setPointer(px, py) {
      if (reducedMotion) return
      pointer.px = px
      pointer.py = py
      pointer.tx = (px / width) * 2 - 1
      pointer.ty = -((py / height) * 2 - 1)
      kick()
    },
    clearPointer() {
      pointer.px = null
      pointer.tx = 0
      pointer.ty = 0
      kick()
    },
    setRunning(on) {
      running = on
      if (on) kick()
      else if (raf) { cancelAnimationFrame(raf); raf = 0 }
    },
    renderOnce() {
      apply(progress, 0)
      renderer.render(scene, camera)
      onFrame?.(anchors(), progress)
      canvas.style.opacity = '1'
    },
    dispose() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      const seen = new Set()
      scene.traverse((o) => {
        if (!o.isMesh) return
        if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose() }
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => {
          if (seen.has(m)) return
          seen.add(m)
          if (m.map && !seen.has(m.map)) { seen.add(m.map); m.map.dispose() }
          m.dispose()
        })
      })
      envRT.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
