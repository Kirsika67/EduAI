/**
 * Avalehe 3D-stseen: õpetaja laud esmaspäeval kell 7.45.
 *
 * Oktoobris on Eestis sel ajal veel pime: laualamp annab sooja valgusringi,
 * aknast tuleb külm sinine hommikuvalgus. Pinnad peegeldavad ruumi (RoomEnvironment),
 * laud on protseduuriline tamm, vihikud on päris ehitusega (kaaned, lehepakk, selg).
 *
 * Kerimise edenemine `p` (0..1):
 *   0.00–0.12  segadus (hiirega saab vihikuid kergitada)
 *   0.12–0.60  vihikud lendavad virna, lehed ja pliiats joonduvad
 *   0.60–0.80  kolmest vihikust libisevad välja hoiatuslipikud
 *   0.80–1.00  kaamera rahuneb
 *
 * Renderdab ainult siis, kui midagi muutub. Laetakse dünaamiliselt (eraldi tükk).
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const NOTEBOOK = { w: 1.48, h: 0.034, d: 2.1 }
const PAPER = { w: 1.64, d: 2.32 }

/** Trükivärvid nagu päris koolivihikutel: sügavad, veidi tuhmid. Lillat ei kasuta (AI märk). */
const COVERS = [
  { base: '#5B7656', ink: '#F4EFE4' }, // sammal
  { base: '#2C5A70', ink: '#F4EFE4' }, // petrooleum
  { base: '#C7953C', ink: '#2A2118' }, // ooker
  { base: '#9DB0BF', ink: '#1E2A36' }, // tuhm sinine
  { base: '#DCD1BC', ink: '#2A2118' }, // manila
  { base: '#363B46', ink: '#F4EFE4' }, // grafiit
  { base: '#7A2C29', ink: '#F4EFE4' }, // veinipunane (virna pealmine)
]
const NAMES = [
  'Mari', 'Jaan', 'Kertu', 'Rasmus', 'Liisa', 'Karl', 'Eliise',
  'Oskar', 'Sofia', 'Robin', 'Mia', 'Hugo', 'Lenna', 'Markus',
]
const SUBJECTS = ['Matemaatika', 'Eesti keel', 'Matemaatika', 'Loodusõpetus', 'Matemaatika', 'Ajalugu', 'Matemaatika']

/** Hoiatuslipikud: vihiku indeks ja värv. Tekstid on HeroStory.jsx-is. */
export const FLAGGED = [
  { index: 2, color: '#D8433A' },
  { index: 7, color: '#E9B43C' },
  { index: 11, color: '#E9B43C' },
]

const BG = '#0D1424'
const PEN_RED = '#B8261F'
const BALLPOINT = '#22366E'

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const lerp = (a, b, t) => a + (b - a) * t

/* ---------------- Tekstuurid (joonistatud lõuendile) ---------------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function toTexture(canvas, { srgb = true, repeat } = {}) {
  const tex = new THREE.CanvasTexture(canvas)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
  }
  return tex
}

/** Peen paberi-/papikiud: kasutatakse kõikide paberpindade kühmukaardina. */
function fiberTexture() {
  const [c, ctx] = makeCanvas(512, 512)
  const rand = seeded(11)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const v = 110 + rand() * 40
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`
    ctx.lineWidth = 0.6 + rand() * 0.8
    const x = rand() * 512, y = rand() * 512, a = rand() * Math.PI, l = 2 + rand() * 7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  return toTexture(c, { srgb: false, repeat: [3, 3] })
}

/** Tamm: lauad, süü lainetus, pooride täpid, lauavahed. */
function woodTexture() {
  const size = 1024
  const [c, ctx] = makeCanvas(size, size)
  const rand = seeded(42)
  const plank = size / 4
  for (let p = 0; p < 4; p++) {
    const y0 = p * plank
    const tint = (rand() - 0.5) * 18
    const base = [104 + tint, 76 + tint * 0.8, 56 + tint * 0.6]
    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
    ctx.fillRect(0, y0, size, plank)
    for (let i = 0; i < 80; i++) {
      const y = y0 + rand() * plank
      const amp = 1 + rand() * 5
      const freq = 0.002 + rand() * 0.008
      const phase = rand() * 10
      const dark = rand() > 0.5
      ctx.strokeStyle = dark
        ? `rgba(52,34,22,${0.05 + rand() * 0.13})`
        : `rgba(180,146,112,${0.03 + rand() * 0.07})`
      ctx.lineWidth = 0.8 + rand() * 3
      ctx.beginPath()
      for (let x = 0; x <= size; x += 8) {
        const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(45,26,14,${0.12 + rand() * 0.25})`
      ctx.fillRect(rand() * size, y0 + rand() * plank, 1 + rand() * 3, 0.8)
    }
    ctx.fillStyle = 'rgba(30,18,10,0.45)'
    ctx.fillRect(0, y0, size, 1.5)
  }
  const tex = toTexture(c, { repeat: [1.4, 1.4] })
  // Süü jookseb kaamera poole: perspektiivis näeb laud loomulikum välja
  tex.center.set(0.5, 0.5)
  tex.rotation = Math.PI / 2
  return tex
}

/** Lehepaki serv: tihedad horisontaalsed jooned. */
function pagesTexture() {
  const [c, ctx] = makeCanvas(64, 64)
  ctx.fillStyle = '#F4F0E6'
  ctx.fillRect(0, 0, 64, 64)
  for (let y = 0; y < 64; y += 4) {
    ctx.fillStyle = 'rgba(120,108,90,0.28)'
    ctx.fillRect(0, y, 64, 1)
  }
  return toTexture(c)
}

function coverTexture(cover, name, subject, seed) {
  const rand = seeded(seed)
  const [c, ctx] = makeCanvas(592, 840)
  const w = c.width, h = c.height
  ctx.fillStyle = cover.base
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 26000; i++) {
    const a = rand() * 0.05
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5)
  }
  // trükitud raam
  ctx.strokeStyle = cover.ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 2
  ctx.strokeRect(34, 34, w - 68, h - 68)
  ctx.lineWidth = 1
  ctx.strokeRect(42, 42, w - 84, h - 84)
  ctx.globalAlpha = 0.7
  ctx.fillStyle = cover.ink
  ctx.font = '600 26px "DM Sans", sans-serif'
  ctx.fillText('V I H I K', w / 2 - 66, h - 78)
  ctx.globalAlpha = 1
  // silt
  const lx = 92, ly = 190, lw = w - 184, lh = 250
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(lx + 3, ly + 4, lw, lh)
  ctx.fillStyle = '#FBF8F1'
  ctx.fillRect(lx, ly, lw, lh)
  ctx.strokeStyle = 'rgba(40,40,40,0.25)'
  ctx.lineWidth = 1.5
  ctx.font = '500 17px "DM Sans", sans-serif'
  for (const [label, y] of [['Aine', 70], ['Nimi', 148], ['Klass', 214]]) {
    ctx.fillStyle = 'rgba(40,40,40,0.55)'
    ctx.fillText(label, lx + 20, ly + y)
    ctx.beginPath()
    ctx.moveTo(lx + 82, ly + y + 4)
    ctx.lineTo(lx + lw - 20, ly + y + 4)
    ctx.stroke()
  }
  // käsitsi kirjutatud pastakaga
  ctx.fillStyle = BALLPOINT
  const hand = (text, x, y, size) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((rand() - 0.5) * 0.05)
    ctx.font = `italic 600 ${size}px Newsreader, Georgia, serif`
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  hand(subject, lx + 92, ly + 66, 30)
  hand(name, lx + 92, ly + 143, 44)
  hand('7.A', lx + 92, ly + 210, 30)
  return toTexture(c)
}

function paperTexture(seed, mark) {
  const rand = seeded(seed)
  const [c, ctx] = makeCanvas(620, 880)
  const w = c.width, h = c.height
  ctx.fillStyle = '#FBFAF4'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(90,140,200,0.26)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  ctx.fillStyle = '#1D2433'
  ctx.font = '700 26px "DM Sans", sans-serif'
  ctx.fillText('Kontrolltöö 2: murrud', 40, 62)
  ctx.font = '500 16px "DM Sans", sans-serif'
  ctx.fillStyle = 'rgba(29,36,51,0.6)'
  ctx.fillText('7.A klass, variant ' + (seed % 2 ? 'A' : 'B'), 40, 88)
  for (let r = 0; r < 9; r++) {
    const y = 150 + r * 76
    ctx.fillStyle = '#1D2433'
    ctx.font = '700 18px "DM Sans", sans-serif'
    ctx.fillText(`${r + 1}.`, 40, y)
    ctx.strokeStyle = BALLPOINT
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    let x = 78
    const end = 220 + rand() * (w - 330)
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    while (x < end) {
      x += 5 + rand() * 9
      ctx.lineTo(x, y - 6 + (rand() - 0.5) * 9)
    }
    ctx.stroke()
    ctx.strokeStyle = PEN_RED
    ctx.lineWidth = 3.6
    ctx.beginPath()
    if (rand() > 0.22) {
      ctx.moveTo(w - 86, y - 10); ctx.lineTo(w - 72, y + 4); ctx.lineTo(w - 46, y - 26)
    } else {
      ctx.moveTo(w - 84, y - 22); ctx.lineTo(w - 56, y + 4)
      ctx.moveTo(w - 56, y - 22); ctx.lineTo(w - 84, y + 4)
    }
    ctx.stroke()
  }
  ctx.strokeStyle = PEN_RED
  ctx.fillStyle = PEN_RED
  ctx.lineWidth = 4.5
  ctx.beginPath()
  ctx.ellipse(w - 96, 70, 50, 42, -0.25, 0.2, Math.PI * 2.05)
  ctx.stroke()
  ctx.font = 'italic 700 64px Newsreader, Georgia, serif'
  ctx.fillText(mark, w - 116, 92)
  return toTexture(c)
}

/* ---------------- Objektid ---------------- */

function makeNotebook(i, shared) {
  const cover = COVERS[i % COVERS.length]
  const group = new THREE.Group()
  group.userData.index = i

  const plain = new THREE.MeshStandardMaterial({ color: cover.base, roughness: 0.78, bumpMap: shared.fiber, bumpScale: 0.6 })
  const top = new THREE.MeshStandardMaterial({
    map: coverTexture(cover, NAMES[i], SUBJECTS[i % SUBJECTS.length], 100 + i),
    roughness: 0.74, bumpMap: shared.fiber, bumpScale: 0.6,
  })

  const coverH = 0.004
  const topCover = new THREE.Mesh(shared.coverGeo, [plain, plain, top, plain, plain, plain])
  topCover.position.y = NOTEBOOK.h / 2 - coverH / 2
  const bottomCover = new THREE.Mesh(shared.coverGeo, plain)
  bottomCover.position.y = -NOTEBOOK.h / 2 + coverH / 2
  const pages = new THREE.Mesh(shared.pagesGeo, shared.pagesMat)
  pages.position.x = 0.012
  const spine = new THREE.Mesh(shared.spineGeo, plain)
  spine.position.x = -NOTEBOOK.w / 2 + 0.004

  for (const z of [-0.55, 0.55]) {
    const staple = new THREE.Mesh(shared.stapleGeo, shared.metal)
    staple.position.set(-NOTEBOOK.w / 2 + 0.03, NOTEBOOK.h / 2 + 0.0005, z)
    group.add(staple)
  }

  group.add(topCover, bottomCover, pages, spine)
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.index = i }
  })
  return group
}

function makeFlag(color) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(0.36, 0.004, 0.17, 1, 0.0015),
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.5 })
  )
  mesh.castShadow = true
  return mesh
}

function makePaper(i, mark, shared) {
  const geo = new THREE.PlaneGeometry(PAPER.w, PAPER.d, 16, 16)
  // kerge kaardumine ja üks üles kõverduv nurk
  const pos = geo.attributes.position
  const rand = seeded(500 + i)
  const curl = rand() > 0.5 ? 1 : -1
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v) / (PAPER.w / 2)
    const y = pos.getY(v) / (PAPER.d / 2)
    const corner = Math.max(0, (x * curl + y - 1.2) / 0.8)
    pos.setZ(v, Math.pow(x, 2) * 0.012 + Math.pow(corner, 2) * 0.08)
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: paperTexture(300 + i, mark), roughness: 0.88, side: THREE.DoubleSide,
      bumpMap: shared.fiber, bumpScale: 0.35,
    })
  )
  mesh.receiveShadow = true
  mesh.castShadow = true
  return mesh
}

function lathe(points, segments = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments)
}

/** Punane pastakas: profiil keerutatud, kork klambriga, metallots. */
function makePen() {
  const group = new THREE.Group()
  const red = new THREE.MeshPhysicalMaterial({ color: PEN_RED, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 })
  const black = new THREE.MeshPhysicalMaterial({ color: '#15171C', roughness: 0.35, clearcoat: 0.6 })
  const steel = new THREE.MeshStandardMaterial({ color: '#D9D6D0', metalness: 1, roughness: 0.25 })
  const body = new THREE.Mesh(lathe([[0, -0.7], [0.012, -0.69], [0.034, -0.6], [0.046, -0.5], [0.048, 0.3], [0.046, 0.36], [0, 0.36]]), red)
  const tip = new THREE.Mesh(lathe([[0, -0.78], [0.006, -0.775], [0.014, -0.7], [0, -0.7]], 24), steel)
  const ring = new THREE.Mesh(lathe([[0.049, 0.28], [0.05, 0.3], [0.05, 0.34], [0.049, 0.36]]), steel)
  const cap = new THREE.Mesh(lathe([[0, 0.36], [0.05, 0.36], [0.052, 0.38], [0.052, 0.72], [0.04, 0.76], [0, 0.765]]), black)
  const clip = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.34, 0.012, 1, 0.005), steel)
  clip.position.set(0, 0.56, 0.058)
  group.add(body, tip, ring, cap, clip)
  group.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return group
}

/** Teritatud harilik pliiats: kuusnurkne, puit ja grafiit. */
function makePencil() {
  const group = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: '#1F3B33', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.3 })
  const wood = new THREE.MeshStandardMaterial({ color: '#D9B48A', roughness: 0.85 })
  const graphite = new THREE.MeshStandardMaterial({ color: '#2A2A2E', roughness: 0.4, metalness: 0.4 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.1, 6), paint)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.16, 6), wood)
  cone.position.y = -0.63
  cone.rotation.x = Math.PI
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.05, 12), graphite)
  lead.position.y = -0.69
  lead.rotation.x = Math.PI
  const end = new THREE.Mesh(new THREE.CylinderGeometry(0.0365, 0.0365, 0.004, 6), wood)
  end.position.y = 0.552
  group.add(body, cone, lead, end)
  group.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return group
}

function makeEraser() {
  const g = new THREE.Group()
  const rubber = new THREE.Mesh(
    new RoundedBoxGeometry(0.34, 0.09, 0.2, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: '#E9E2D6', roughness: 0.9 })
  )
  const band = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.094, 0.204, 2, 0.02),
    new THREE.MeshStandardMaterial({ color: '#2C5A70', roughness: 0.7 })
  )
  band.position.x = 0.09
  g.add(rubber, band)
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

/** Glasuuritud kruus päris profiiliga: seinapaksus, serv, sees kohv. */
function makeMug() {
  const group = new THREE.Group()
  const glaze = new THREE.MeshPhysicalMaterial({ color: '#EDE7DC', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide })
  const band = new THREE.MeshPhysicalMaterial({ color: '#1C2B48', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 })
  const profile = [
    [0, 0.0], [0.33, 0.0], [0.36, 0.015], [0.375, 0.05], [0.4, 0.8], [0.405, 0.83], [0.395, 0.845],
    [0.37, 0.835], [0.355, 0.8], [0.335, 0.08], [0, 0.07],
  ]
  const cup = new THREE.Mesh(lathe(profile, 64), glaze)
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.396, 0.389, 0.09, 64, 1, true), band)
  stripe.position.y = 0.66
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.352, 48),
    new THREE.MeshPhysicalMaterial({ color: '#2A170D', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 })
  )
  coffee.rotation.x = -Math.PI / 2
  coffee.position.y = 0.66
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 16, 32, Math.PI * 1.15), glaze)
  handle.position.set(0.39, 0.43, 0)
  handle.rotation.z = -Math.PI * 0.575
  group.add(cup, stripe, coffee, handle)
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

/* ---------------- Paigutus ---------------- */

function layout(isNarrow) {
  const rand = seeded(7)
  const stackX = isNarrow ? 0 : 2.25
  const count = NAMES.length

  const notebooks = []
  const piles = isNarrow
    ? [[-1.0, -0.3], [0.9, 0.6], [-0.2, 1.4]]
    : [[-0.9, -0.5], [2.2, 0.4], [0.7, 1.5]]
  const pileHeights = [0, 0, 0]
  for (let i = 0; i < count; i++) {
    let x, z, y
    if (i % 4 === 3) {
      x = (rand() - 0.5) * (isNarrow ? 3.2 : 6.6) + (isNarrow ? 0 : 0.6)
      z = (rand() - 0.5) * 3.2
      y = NOTEBOOK.h / 2 + 0.002
    } else {
      const p = i % 3
      x = piles[p][0] + (rand() - 0.5) * 0.7
      z = piles[p][1] + (rand() - 0.5) * 0.7
      y = NOTEBOOK.h / 2 + pileHeights[p] * (NOTEBOOK.h + 0.004) + 0.002
      pileHeights[p] += 1
    }
    const from = {
      pos: new THREE.Vector3(x, y, z),
      quat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05)
      ),
    }
    const to = {
      pos: new THREE.Vector3(stackX + (rand() - 0.5) * 0.025, NOTEBOOK.h / 2 + i * (NOTEBOOK.h + 0.002) + 0.002, 0.15),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.04, 0)),
    }
    notebooks.push({ from, to, delay: i * 0.016 })
  }

  const marks = ['5', '4', '5', '3', '4']
  const papers = marks.map((mark, i) => ({
    mark,
    from: {
      pos: new THREE.Vector3((isNarrow ? -0.4 : -2.4) + (rand() - 0.5) * 2.4, 0.004 + i * 0.003, (rand() - 0.5) * 2.2),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rand() * Math.PI * 2)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? -1.45 : stackX - 1.15, 0.004 + i * 0.003, isNarrow ? -0.45 : -0.55),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (rand() - 0.5) * 0.04)),
    },
    delay: 0.05 + i * 0.03,
  }))

  const pen = {
    from: {
      pos: new THREE.Vector3(isNarrow ? 0.3 : -1.2, 0.05, isNarrow ? 0.4 : 0.6),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.9, Math.PI / 2)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? stackX + 1.0 : stackX + 0.2, 0.05, isNarrow ? 0.2 : 1.6),
      quat: new THREE.Quaternion().setFromEuler(
        isNarrow ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler(0, 0.12, Math.PI / 2)
      ),
    },
    delay: 0.2,
  }

  // Liikumatud: tass, harilik pliiats, kustutuskumm
  const mug = new THREE.Vector3(isNarrow ? 1.2 : stackX + 2.5, 0, isNarrow ? -1.6 : -1.9)
  const pencil = {
    pos: new THREE.Vector3(isNarrow ? -1.5 : stackX + 1.55, 0.037, isNarrow ? -1.4 : 0.05),
    rot: new THREE.Euler(Math.PI / 2, 0, isNarrow ? 0.4 : -0.3),
  }
  const eraser = {
    pos: new THREE.Vector3(isNarrow ? 1.5 : stackX + 1.75, 0.046, isNarrow ? -0.3 : 0.95),
    rotY: 0.6,
  }

  return { notebooks, papers, pen, mug, pencil, eraser, stackX }
}

/* ---------------- Stseen ---------------- */

export async function createDeskScene(canvas, { reducedMotion = false, onFrame } = {}) {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('italic 600 40px Newsreader'),
        document.fonts.load('italic 700 64px Newsreader'),
        document.fonts.load('600 26px "DM Sans"'),
        document.fonts.load('500 17px "DM Sans"'),
        document.fonts.load('700 26px "DM Sans"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ])
  } catch { /* fondid pole kriitilised */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5)
  let dpr = maxDpr
  renderer.setPixelRatio(dpr)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 13, 24)

  // Ruumi peegeldused: annab läikivatele pindadele (tass, pliiats, lakk) päris helgi
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.22
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)

  const shared = {
    fiber: fiberTexture(),
    pagesMat: new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: '#C9C6C0', metalness: 1, roughness: 0.3 }),
    stapleGeo: new THREE.BoxGeometry(0.012, 0.002, 0.12),
    coverGeo: new RoundedBoxGeometry(NOTEBOOK.w, 0.004, NOTEBOOK.d, 2, 0.0018),
    pagesGeo: new RoundedBoxGeometry(NOTEBOOK.w - 0.03, NOTEBOOK.h - 0.007, NOTEBOOK.d - 0.035, 1, 0.004),
    spineGeo: new THREE.BoxGeometry(0.008, NOTEBOOK.h, NOTEBOOK.d),
  }

  // Laud: lakitud tamm
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    // Standard, mitte Physical: laud katab suurema osa ekraanist ja lakikiht oleks kõige kallim osa
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.5, metalness: 0 })
  )
  desk.rotation.x = -Math.PI / 2
  desk.receiveShadow = true
  scene.add(desk)

  // Valgus: soe lamp (võtmevalgus) + külm aknavalgus + väga nõrk taevavalgus
  scene.add(new THREE.HemisphereLight('#7F93BD', '#1A120C', 0.22))
  const lamp = new THREE.SpotLight('#FFE2BD', 260, 28, Math.PI / 5.2, 0.9, 1.6)
  lamp.position.set(-2.2, 8.6, 2.4)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.bias = -0.00025
  lamp.shadow.normalBias = 0.02
  lamp.shadow.camera.near = 2
  lamp.shadow.camera.far = 20
  scene.add(lamp, lamp.target)
  const windowLight = new THREE.DirectionalLight('#8FAEEA', 1.5)
  windowLight.position.set(8, 5, -6)
  scene.add(windowLight)

  const notebookGroups = NAMES.map((_, i) => makeNotebook(i, shared))
  notebookGroups.forEach((g) => scene.add(g))
  const flags = FLAGGED.map(({ index, color }) => {
    const flag = makeFlag(color)
    notebookGroups[index].add(flag)
    return { flag, index }
  })

  const marks = ['5', '4', '5', '3', '4']
  const paperMeshes = marks.map((m, i) => makePaper(i, m, shared))
  paperMeshes.forEach((m) => scene.add(m))
  const pen = makePen()
  const pencil = makePencil()
  const eraser = makeEraser()
  const mug = makeMug()
  mug.scale.setScalar(0.82)
  scene.add(pen, pencil, eraser, mug)

  let state = null
  let narrow = null
  let width = 1
  let height = 1
  let progress = reducedMotion ? 1 : 0
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: null, py: null }
  const lifts = new Array(NAMES.length).fill(0)
  let hovered = -1
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const tmp = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const camFrom = new THREE.Vector3()
  const camTo = new THREE.Vector3()
  const lookFrom = new THREE.Vector3()
  const lookTo = new THREE.Vector3()
  const look = new THREE.Vector3()

  function relayout() {
    const isNarrow = width < 768
    framing(isNarrow)
    if (isNarrow === narrow && state) return
    narrow = isNarrow
    state = layout(isNarrow)
    mug.position.copy(state.mug)
    pencil.position.copy(state.pencil.pos)
    pencil.rotation.copy(state.pencil.rot)
    eraser.position.copy(state.eraser.pos)
    eraser.rotation.y = state.eraser.rotY
    lamp.target.position.set(state.stackX * 0.6, 0, 0.3)
  }

  /** Kaamera sõltub kuvasuhtest: kitsamal laual nihkub virn paremale, et tekst jääks vabaks. */
  function framing(isNarrow) {
    const stackX = isNarrow ? 0 : 2.25
    if (isNarrow) {
      camFrom.set(0, 12.5, 7.2); lookFrom.set(0, 0, 1.5)
      camTo.set(0.3, 10.6, 6.6); lookTo.set(0, 0.3, 1.85)
    } else {
      const aspect = width / height
      // Tekstiveerg on pikslites fikseeritud: mida kitsam ekraan, seda rohkem nihutame
      const shift = THREE.MathUtils.clamp((1440 - width) / 420 * 0.8 + (1.75 - aspect) * 0.8, 0, 1.2)
      camFrom.set(-0.2 - shift, 9.0, 7.4); lookFrom.set(0.2 - shift, 0, 0.3)
      camTo.set(0.9 - shift, 6.6, 6.4); lookTo.set(stackX - 0.4 - shift, 0.35, 0.1)
    }
  }

  function resize(w, h) {
    width = Math.max(1, w)
    height = Math.max(1, h)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    relayout()
    needsRender = true
  }

  function apply(p, dt) {
    const fly = (delay) => easeInOut(clamp01((p - 0.12 - delay) / 0.3))

    state.notebooks.forEach((n, i) => {
      const m = notebookGroups[i]
      const t = fly(n.delay)
      m.position.lerpVectors(n.from.pos, n.to.pos, t)
      m.position.y += Math.sin(t * Math.PI) * 0.9
      const target = hovered === i && t === 0 ? 1 : 0
      lifts[i] += (target - lifts[i]) * Math.min(1, dt * 10)
      m.position.y += lifts[i] * 0.22
      m.quaternion.slerpQuaternions(n.from.quat, n.to.quat, t)
      // lennu ajal kerge kalle, et liikumine tunduks füüsiline
      if (t > 0 && t < 1) {
        tmpQ.setFromAxisAngle(tmp.set(0, 0, 1), Math.sin(t * Math.PI) * 0.12 * (i % 2 ? 1 : -1))
        m.quaternion.multiply(tmpQ)
      }
      if (lifts[i] > 0.001) {
        tmpQ.setFromAxisAngle(tmp.set(1, 0, 0), -lifts[i] * 0.08)
        m.quaternion.multiply(tmpQ)
      }
    })

    flags.forEach(({ flag }, k) => {
      const t = easeOut(clamp01((p - 0.6 - k * 0.05) / 0.12))
      flag.position.set(lerp(NOTEBOOK.w / 2 - 0.19, NOTEBOOK.w / 2 + 0.11, t), 0, -0.78 + k * 0.78)
      flag.visible = t > 0.001
    })

    state.papers.forEach((pp, i) => {
      const m = paperMeshes[i]
      const t = easeInOut(clamp01((p - 0.12 - pp.delay) / 0.32))
      m.position.lerpVectors(pp.from.pos, pp.to.pos, t)
      m.position.y += Math.sin(t * Math.PI) * 0.3
      m.quaternion.slerpQuaternions(pp.from.quat, pp.to.quat, t)
    })

    {
      const t = easeInOut(clamp01((p - 0.12 - state.pen.delay) / 0.3))
      pen.position.lerpVectors(state.pen.from.pos, state.pen.to.pos, t)
      pen.position.y += Math.sin(t * Math.PI) * 0.5
      pen.quaternion.slerpQuaternions(state.pen.from.quat, state.pen.to.quat, t)
    }

    const c = easeInOut(clamp01(p / 0.85))
    camera.position.lerpVectors(camFrom, camTo, c)
    look.lerpVectors(lookFrom, lookTo, c)
    if (!reducedMotion) {
      camera.position.x += pointer.x * 0.45
      camera.position.y += pointer.y * 0.25
    }
    camera.lookAt(look)
  }

  function anchors() {
    return flags.map(({ flag }) => {
      flag.updateWorldMatrix(true, false)
      tmp.set(0.18, 0, 0).applyMatrix4(flag.matrixWorld).project(camera)
      return {
        x: (tmp.x * 0.5 + 0.5) * width,
        y: (-tmp.y * 0.5 + 0.5) * height,
        visible: flag.visible,
      }
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
      canvas.style.cursor = next >= 0 ? 'grab' : ''
    }
  }

  let raf = 0
  let running = false
  let needsRender = true
  let last = performance.now()

  /** Nõrgal seadmel: kui kaadrid on järjest aeglased, langeta eraldusvõimet. */
  let slowFrames = 0
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
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3)
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3)
    pick()
    apply(progress, dt)
    renderer.render(scene, camera)
    onFrame?.(anchors(), progress)
    needsRender = false
    const settling =
      Math.abs(pointer.tx - pointer.x) > 0.001 ||
      Math.abs(pointer.ty - pointer.y) > 0.001 ||
      lifts.some((l, i) => Math.abs((hovered === i ? 1 : 0) - l) > 0.002)
    if (running && (settling || needsRender)) raf = requestAnimationFrame(frame)
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
          for (const key of ['map', 'bumpMap']) {
            if (m[key] && !seen.has(m[key])) { seen.add(m[key]); m[key].dispose() }
          }
          m.dispose()
        })
      })
      envRT.dispose()
      renderer.dispose()
    },
  }
}
