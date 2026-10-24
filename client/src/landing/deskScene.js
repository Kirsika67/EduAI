/**
 * Avalehe 3D-stseen: õpetaja laud esmaspäeva hommikul.
 *
 * Kerimise edenemine `p` (0..1) viib laua segadusest korda:
 *   0.00–0.12  segadus (hiirega saab vihikuid kergitada)
 *   0.12–0.60  vihikud lendavad virna, lehed ja pliiats joonduvad
 *   0.60–0.80  kolmest vihikust libisevad välja hoiatuslipikud
 *   0.80–1.00  kaamera rahuneb
 *
 * Puhas three.js (ilma react-three-fiberita): üks lõuend, renderdab ainult siis,
 * kui stseen on nähtav. Laetakse dünaamiliselt, et rakenduse põhikimp ei kasvaks.
 */
import * as THREE from 'three'

const NOTEBOOK = { w: 1.48, h: 0.036, d: 2.1 }
const PAPER = { w: 1.62, d: 2.3 }

/** Klassikalised vihikukaaned. Lillat ei kasuta: see on rakenduses AI märk. */
const COVERS = ['#3D6AA3', '#4C8558', '#B5473D', '#D9A63A', '#7C8794', '#2F7F86', '#C46B3A']
const NAMES = [
  'Mari', 'Jaan', 'Kertu', 'Rasmus', 'Liisa', 'Karl', 'Eliise',
  'Oskar', 'Sofia', 'Robin', 'Mia', 'Hugo', 'Lenna', 'Markus',
]
const SUBJECTS = ['Matemaatika', 'Eesti keel', 'Matemaatika', 'Loodusõpetus', 'Matemaatika', 'Ajalugu', 'Matemaatika']

/** Hoiatuslipikud: vihiku indeks, värv. Tekstid on `FLAGS` HeroStory.jsx-is. */
export const FLAGGED = [
  { index: 2, color: '#D94A3F' },
  { index: 7, color: '#E5B23A' },
  { index: 11, color: '#E5B23A' },
]

const BG = '#0F1A2E'
const INK = '#14213D'
const PEN_RED = '#C8322B'

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

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function grain(ctx, w, h, rand, alpha) {
  for (let i = 0; i < (w * h) / 90; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`
    ctx.fillRect(rand() * w, rand() * h, 1.4, 1.4)
  }
}

function coverTexture(color, name, subject, seed) {
  const rand = seeded(seed)
  return canvasTexture(444, 630, (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    grain(ctx, w, h, rand, 0.05)
    // Köite varjuriba
    const g = ctx.createLinearGradient(0, 0, 40, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.28)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 40, h)
    // Silt
    const lx = 70, ly = 150, lw = w - 120, lh = 200
    ctx.fillStyle = '#FBF9F4'
    ctx.fillRect(lx, ly, lw, lh)
    ctx.strokeStyle = 'rgba(20,33,61,0.18)'
    ctx.lineWidth = 2
    for (let i = 1; i <= 3; i++) {
      const y = ly + 40 + i * 42
      ctx.beginPath(); ctx.moveTo(lx + 18, y); ctx.lineTo(lx + lw - 18, y); ctx.stroke()
    }
    ctx.fillStyle = INK
    ctx.font = '600 30px "DM Sans", sans-serif'
    ctx.fillText(subject, lx + 18, ly + 46)
    ctx.font = '600 40px Newsreader, Georgia, serif'
    ctx.fillText(name, lx + 22, ly + 120)
    ctx.font = '500 24px "DM Sans", sans-serif'
    ctx.fillStyle = 'rgba(20,33,61,0.6)'
    ctx.fillText('7.A klass', lx + 22, ly + 165)
  })
}

function paperTexture(seed, mark) {
  const rand = seeded(seed)
  return canvasTexture(486, 690, (ctx, w, h) => {
    ctx.fillStyle = '#FCFBF7'
    ctx.fillRect(0, 0, w, h)
    // Ruuduline paber nagu matemaatikavihikus
    ctx.strokeStyle = 'rgba(80,130,190,0.22)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    // "Käekiri": hallid read
    ctx.strokeStyle = 'rgba(20,33,61,0.55)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (let r = 0; r < 14; r++) {
      const y = 120 + r * 36
      let x = 40
      const end = 80 + rand() * (w - 140)
      ctx.beginPath()
      ctx.moveTo(x, y)
      while (x < end) {
        x += 6 + rand() * 10
        ctx.lineTo(x, y + (rand() - 0.5) * 6)
      }
      ctx.stroke()
      // Punase pliiatsi linnuke reale
      if (rand() > 0.55) {
        ctx.strokeStyle = PEN_RED
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(w - 70, y - 2); ctx.lineTo(w - 58, y + 10); ctx.lineTo(w - 36, y - 16)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(20,33,61,0.55)'
        ctx.lineWidth = 3
      }
    }
    // Hinne ringis
    ctx.strokeStyle = PEN_RED
    ctx.fillStyle = PEN_RED
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.ellipse(w - 84, 66, 44, 38, -0.2, 0, Math.PI * 1.85)
    ctx.stroke()
    ctx.font = '700 58px Newsreader, Georgia, serif'
    ctx.fillText(mark, w - 102, 86)
  })
}

/* ---------------- Objektid ---------------- */

function makeNotebook(i) {
  const color = COVERS[i % COVERS.length]
  const top = new THREE.MeshStandardMaterial({
    map: coverTexture(color, NAMES[i], SUBJECTS[i % SUBJECTS.length], 100 + i),
    roughness: 0.82,
  })
  const plain = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  const pages = new THREE.MeshStandardMaterial({ color: '#F1EEE6', roughness: 0.95 })
  // Järjekord: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(NOTEBOOK.w, NOTEBOOK.h, NOTEBOOK.d),
    [pages, plain, top, plain, pages, pages]
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.index = i
  return mesh
}

function makeFlag(color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.006, 0.16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  )
  mesh.castShadow = true
  return mesh
}

function makePaper(i, mark) {
  const geo = new THREE.PlaneGeometry(PAPER.w, PAPER.d, 8, 8)
  // Kerge kumerus, et paber ei näeks välja nagu plekk
  const pos = geo.attributes.position
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v)
    pos.setZ(v, Math.pow(x / (PAPER.w / 2), 2) * 0.02)
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: paperTexture(300 + i, mark), roughness: 0.92, side: THREE.DoubleSide })
  )
  mesh.receiveShadow = true
  mesh.castShadow = true
  return mesh
}

function makePen() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.25, 20),
    new THREE.MeshStandardMaterial({ color: PEN_RED, roughness: 0.35, metalness: 0.1 })
  )
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.34, 20),
    new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.4 })
  )
  cap.position.y = 0.66
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.14, 20),
    new THREE.MeshStandardMaterial({ color: '#D8D4CC', metalness: 0.6, roughness: 0.3 })
  )
  tip.position.y = -0.69
  tip.rotation.x = Math.PI
  group.add(body, cap, tip)
  group.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return group
}

function makeMug() {
  const group = new THREE.Group()
  const ceramic = new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.45 })
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.9, 40, 1, true), ceramic)
  cup.position.y = 0.45
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.38, 40), ceramic)
  bottom.rotation.x = -Math.PI / 2
  bottom.position.y = 0.01
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 40),
    new THREE.MeshStandardMaterial({ color: '#3B2416', roughness: 0.25 })
  )
  coffee.rotation.x = -Math.PI / 2
  coffee.position.y = 0.78
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.425, 0.415, 0.12, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5 })
  )
  band.position.y = 0.62
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 24, Math.PI * 1.3), ceramic)
  handle.position.set(0.46, 0.46, 0)
  handle.rotation.z = -Math.PI * 0.65
  group.add(cup, bottom, coffee, band, handle)
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

/* ---------------- Paigutus ---------------- */

function layout(isNarrow) {
  const rand = seeded(7)
  const stackX = isNarrow ? 0 : 2.25
  const count = NAMES.length

  const notebooks = []
  // Segadus: kolm lohakat hunnikut ja mõned üksikud vihikud üle laua
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
      y = NOTEBOOK.h / 2 + pileHeights[p] * (NOTEBOOK.h + 0.006) + 0.002
      pileHeights[p] += 1
    }
    const from = {
      pos: new THREE.Vector3(x, y, z),
      quat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06)
      ),
    }
    const to = {
      pos: new THREE.Vector3(stackX + (rand() - 0.5) * 0.02, NOTEBOOK.h / 2 + i * (NOTEBOOK.h + 0.004) + 0.002, 0.15),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.035, 0)),
    }
    notebooks.push({ from, to, delay: i * 0.016 })
  }

  const marks = ['5', '4', '5', '3', '4']
  const papers = marks.map((mark, i) => ({
    mark,
    from: {
      pos: new THREE.Vector3(
        (isNarrow ? -0.4 : -2.4) + (rand() - 0.5) * 2.4,
        0.004 + i * 0.003,
        (rand() - 0.5) * 2.2
      ),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rand() * Math.PI * 2)),
    },
    to: {
      pos: new THREE.Vector3(isNarrow ? -1.4 : stackX - 1.15, 0.004 + i * 0.003, isNarrow ? 0.25 : -0.55),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (rand() - 0.5) * 0.03)),
    },
    delay: 0.05 + i * 0.03,
  }))

  const pen = {
    from: {
      pos: new THREE.Vector3(isNarrow ? 0.3 : -1.2, 0.06, isNarrow ? 0.4 : 0.6),
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

  const mug = new THREE.Vector3(isNarrow ? 1.2 : stackX + 2.5, 0, isNarrow ? -1.6 : -1.9)

  return { notebooks, papers, pen, mug, stackX }
}

/* ---------------- Stseen ---------------- */

export async function createDeskScene(canvas, { reducedMotion = false, onFrame } = {}) {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 40px Newsreader'),
        document.fonts.load('600 30px "DM Sans"'),
        document.fonts.load('500 24px "DM Sans"'),
        document.fonts.load('700 58px Newsreader'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ])
  } catch { /* fondid pole kriitilised */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.95

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 15, 26)

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)

  // Laud: tumesinine, valgus koondub lambi alla
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: '#1A2740', roughness: 0.92 })
  )
  desk.rotation.x = -Math.PI / 2
  desk.receiveShadow = true
  scene.add(desk)

  scene.add(new THREE.HemisphereLight('#C9D4EA', '#0B1322', 0.7))
  const lamp = new THREE.SpotLight('#FFE3BD', 150, 30, Math.PI / 5, 0.65, 1.3)
  lamp.position.set(-2.5, 9, 3.5)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.bias = -0.0004
  lamp.shadow.radius = 6
  scene.add(lamp, lamp.target)
  const rim = new THREE.DirectionalLight('#7FA2E0', 0.55)
  rim.position.set(6, 4, -6)
  scene.add(rim)

  const notebookMeshes = NAMES.map((_, i) => makeNotebook(i))
  notebookMeshes.forEach((m) => scene.add(m))
  const flags = FLAGGED.map(({ index, color }) => {
    const flag = makeFlag(color)
    notebookMeshes[index].add(flag)
    return { flag, index }
  })

  const marks = ['5', '4', '5', '3', '4']
  const paperMeshes = marks.map((m, i) => makePaper(i, m))
  paperMeshes.forEach((m) => scene.add(m))
  const pen = makePen()
  scene.add(pen)
  const mug = makeMug()
  mug.scale.setScalar(0.8)
  scene.add(mug)

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
    if (isNarrow === narrow && state) return
    narrow = isNarrow
    state = layout(isNarrow)
    mug.position.copy(state.mug)
    lamp.target.position.set(state.stackX * 0.5, 0, 0.2)
    if (isNarrow) {
      camFrom.set(0, 12.5, 7.2); lookFrom.set(0, 0, 1.25)
      camTo.set(0.3, 10.6, 6.6); lookTo.set(0, 0.3, 1.35)
    } else {
      camFrom.set(-0.2, 9.0, 7.4); lookFrom.set(0.2, 0, 0.3)
      camTo.set(0.9, 6.6, 6.4); lookTo.set(state.stackX - 0.4, 0.35, 0.1)
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
      const m = notebookMeshes[i]
      const t = fly(n.delay)
      m.position.lerpVectors(n.from.pos, n.to.pos, t)
      m.position.y += Math.sin(t * Math.PI) * 0.9 // kaar lennu ajal
      const target = hovered === i && t === 0 ? 1 : 0
      lifts[i] += (target - lifts[i]) * Math.min(1, dt * 10)
      m.position.y += lifts[i] * 0.22
      m.quaternion.slerpQuaternions(n.from.quat, n.to.quat, t)
      if (lifts[i] > 0.001) {
        tmpQ.setFromAxisAngle(tmp.set(1, 0, 0), -lifts[i] * 0.08)
        m.quaternion.multiply(tmpQ)
      }
    })

    flags.forEach(({ flag }, k) => {
      const t = easeOut(clamp01((p - 0.6 - k * 0.05) / 0.12))
      // Lipik on alguses vihiku sees ja libiseb paremalt servast välja
      flag.position.set(lerp(NOTEBOOK.w / 2 - 0.18, NOTEBOOK.w / 2 + 0.11, t), 0, -0.78 + k * 0.78)
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
      tmp.set(0.17, 0, 0).applyMatrix4(flag.matrixWorld).project(camera)
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
    const hit = raycaster.intersectObjects(notebookMeshes, false)[0]
    const next = hit ? hit.object.userData.index : -1
    if (next !== hovered) {
      hovered = next
      canvas.style.cursor = next >= 0 ? 'grab' : ''
    }
  }

  let raf = 0
  let running = false
  let needsRender = true
  let last = performance.now()

  function frame(now) {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
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
      scene.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => { m.map?.dispose(); m.dispose() })
      })
      renderer.dispose()
    },
  }
}
