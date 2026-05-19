import { TracedShape, ModuleType } from '../types'
import { v4 as uuidv4 } from 'uuid'

// ─── Cargar imagen en ImageData ───────────────────────────────────────────────
async function loadImageData(src: string, w: number, h: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(ctx.getImageData(0, 0, w, h))
    }
    img.onerror = reject
    img.src = src
  })
}

// ─── Umbral adaptativo de Otsu ────────────────────────────────────────────────
// Mucho mejor que umbral fijo para imágenes con fondos beige/crema
function otsuThreshold(data: ImageData): number {
  const hist = new Int32Array(256)
  const n = data.width * data.height
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const g = Math.round(0.299 * data.data[p] + 0.587 * data.data[p+1] + 0.114 * data.data[p+2])
    hist[g]++
  }
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, maxVar = 0, thr = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue
    const wF = n - wB; if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) * (mB - mF)
    if (v > maxVar) { maxVar = v; thr = t }
  }
  // Bajamos el umbral para asegurarnos de capturar bien las líneas marrones oscuras
  return Math.max(thr - 15, 80)
}

// ─── Umbralizar a blanco/negro ────────────────────────────────────────────────
function threshold(data: ImageData, thresh?: number): Uint8Array {
  const t = thresh ?? otsuThreshold(data)
  const binary = new Uint8Array(data.width * data.height)
  for (let i = 0; i < binary.length; i++) {
    const p = i * 4
    const gray = 0.299 * data.data[p] + 0.587 * data.data[p+1] + 0.114 * data.data[p+2]
    binary[i] = gray > t ? 1 : 0   // 1 = blanco (espacio), 0 = negro (línea)
  }
  return binary
}

// ─── Dilatar píxeles oscuros para cerrar pequeñas grietas en líneas ──────────
// binary: 1=blanco, 0=oscuro. Dilata los 0s para sellar gaps.
function dilateLines(binary: Uint8Array, w: number, h: number, r = 1): Uint8Array {
  const out = binary.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x]) continue // pixel blanco, no dilatar
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy, nx = x + dx
          if (ny >= 0 && ny < h && nx >= 0 && nx < w)
            out[ny * w + nx] = 0
        }
      }
    }
  }
  return out
}

// ─── Flood fill iterativo (BFS) ───────────────────────────────────────────────
function floodFill(binary: Uint8Array, w: number, h: number, seeds: number[]): Uint8Array {
  const visited = new Uint8Array(binary.length)
  const queue = [...seeds]
  let head = 0

  while (head < queue.length) {
    const idx = queue[head++]
    if (visited[idx] || !binary[idx]) continue
    visited[idx] = 1
    const x = idx % w, y = (idx / w) | 0
    if (x > 0)     queue.push(idx - 1)
    if (x < w - 1) queue.push(idx + 1)
    if (y > 0)     queue.push(idx - w)
    if (y < h - 1) queue.push(idx + w)
  }
  return visited
}

// ─── Connected Component Labeling (4-conectividad, two-pass) ──────────────────
function labelComponents(binary: Uint8Array, w: number, h: number): Int32Array {
  const labels = new Int32Array(binary.length).fill(-1)
  const parent: number[] = []

  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  const union = (a: number, b: number) => {
    a = find(a); b = find(b); if (a !== b) parent[b] = a
  }

  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!binary[i]) continue
      const top  = y > 0 && binary[(y-1)*w+x] ? labels[(y-1)*w+x] : -1
      const left = x > 0 && binary[y*w+x-1]   ? labels[y*w+x-1]   : -1

      if (top < 0 && left < 0) { labels[i] = n; parent.push(n); n++ }
      else if (top >= 0 && left < 0) labels[i] = find(top)
      else if (top < 0 && left >= 0) labels[i] = find(left)
      else { labels[i] = find(top); union(top, left) }
    }
  }
  for (let i = 0; i < labels.length; i++)
    if (labels[i] >= 0) labels[i] = find(labels[i])

  return labels
}

// ─── Recolectar bounding boxes por componente ─────────────────────────────────
interface CompInfo {
  minX: number; maxX: number; minY: number; maxY: number; count: number
}
function collectBBoxes(labels: Int32Array, w: number, h: number): Map<number, CompInfo> {
  const comps = new Map<number, CompInfo>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = labels[y * w + x]
      if (l < 0) continue
      if (!comps.has(l)) comps.set(l, { minX: x, maxX: x, minY: y, maxY: y, count: 0 })
      const c = comps.get(l)!
      if (x < c.minX) c.minX = x;  if (x > c.maxX) c.maxX = x
      if (y < c.minY) c.minY = y;  if (y > c.maxY) c.maxY = y
      c.count++
    }
  }
  return comps
}

// ─── Clasificar forma de un componente ───────────────────────────────────────
// Retorna: 'rect' | 'ellipse' | 'polygon'
// NOTA: Un semicírculo tiene fill ratio ≈ π/4 ≈ 0.785 — NO es rect
function classifyShape(comp: CompInfo): 'rect' | 'ellipse' | 'polygon' {
  const bW = comp.maxX - comp.minX
  const bH = comp.maxY - comp.minY
  const bboxArea = bW * bH
  if (bboxArea === 0) return 'rect'
  const fill = comp.count / bboxArea

  // Rect: casi perfecto ≥ 0.90
  if (fill >= 0.90) return 'rect'

  // Ellipse completa: fill ≈ π/4 = 0.785 → rango [0.68, 0.90)
  // Semicírculo (arco): fill ≈ π/4 en su bbox → mismo rango
  if (fill >= 0.62 && fill < 0.90) {
    // Verificar con fórmula de elipse: pixeles_esperados ≈ π * rX * rY
    const rX = bW / 2, rY = bH / 2
    const ellipseArea = Math.PI * rX * rY
    const ratio = comp.count / ellipseArea
    // ratio ≈ 1.0 = elipse completa, ≈ 0.5 = media elipse (arco)
    if (ratio >= 0.40 && ratio <= 1.15) return 'ellipse'
  }

  return 'polygon'
}

// ─── Trazar contorno mejorado (scan horizontal + vertical combinado) ──────────
function traceContour(labels: Int32Array, label: number, w: number, h: number,
                      bbox: CompInfo, step = 2): number[] {
  // Top/Bottom por columna (captura curvas horizontales como arcos)
  const topPts: [number, number][] = []
  const botPts: [number, number][] = []
  for (let x = bbox.minX; x <= bbox.maxX; x += step) {
    let top = -1, bot = -1
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      if (labels[y * w + x] === label) { if (top < 0) top = y; bot = y }
    }
    if (top >= 0) { topPts.push([x, top]); botPts.push([x, bot]) }
  }

  // Left/Right por fila (captura curvas verticales como arcos laterales)
  const leftPts: [number, number][] = []
  const rightPts: [number, number][] = []
  for (let y = bbox.minY; y <= bbox.maxY; y += step) {
    let left = -1, right = -1
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (labels[y * w + x] === label) { if (left < 0) left = x; right = x }
    }
    if (left >= 0) { leftPts.push([left, y]); rightPts.push([right, y]) }
  }

  // Detectar si la forma tiene curvatura significativa en X vs Y
  const topVariance = topPts.reduce((s, [, y]) => s + y, 0) / (topPts.length || 1)
  const topDiff = topPts.reduce((s, [, y]) => s + Math.abs(y - topVariance), 0)
  const leftVariance = leftPts.reduce((s, [x]) => s + x, 0) / (leftPts.length || 1)
  const leftDiff = leftPts.reduce((s, [x]) => s + Math.abs(x - leftVariance), 0)

  let pts: number[]
  if (topDiff >= leftDiff) {
    // Curvatura principalmente en top/bottom (ej. arco, semicírculo)
    if (topPts.length < 2) return []
    pts = []
    for (const [x, y] of topPts) pts.push(x, y)
    for (const [x, y] of [...botPts].reverse()) pts.push(x, y)
  } else {
    // Curvatura principalmente en lados izq/der
    if (leftPts.length < 2) return []
    pts = []
    for (const [x, y] of leftPts) pts.push(x, y)
    for (const [x, y] of [...rightPts].reverse()) pts.push(x, y)
  }
  return pts
}

// ─── Douglas-Peucker simplification ──────────────────────────────────────────
function dpSimplify(pts: number[], epsilon: number): number[] {
  const n = pts.length / 2
  if (n <= 2) return pts
  const stack: [number, number][] = [[0, n - 1]]
  const keep = new Uint8Array(n); keep[0] = 1; keep[n - 1] = 1
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    if (hi - lo <= 1) continue
    let maxD = 0, maxI = lo
    const x1=pts[lo*2],y1=pts[lo*2+1],x2=pts[hi*2],y2=pts[hi*2+1]
    const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)
    for (let i = lo+1; i < hi; i++) {
      const d = len > 0
        ? Math.abs(dy*(pts[i*2]-x1) - dx*(pts[i*2+1]-y1)) / len
        : Math.hypot(pts[i*2]-x1, pts[i*2+1]-y1)
      if (d > maxD) { maxD = d; maxI = i }
    }
    if (maxD > epsilon) { keep[maxI] = 1; stack.push([lo, maxI], [maxI, hi]) }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i*2], pts[i*2+1])
  return out
}

// ═══════════════════════════════════════════════════════════════════════════════
// API PRINCIPAL: Auto-trazar por regiones cerradas
// Cada región blanca cerrada en la imagen = 1 TracedShape independiente
// Mejoras v2: umbral Otsu, detección elipse/arco, dilation de líneas
// ═══════════════════════════════════════════════════════════════════════════════
export async function autoTraceRegions(
  src: string,
  canvasW: number,
  canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {
  onProgress?.('Cargando imagen...')
  const imgData = await loadImageData(src, canvasW, canvasH)

  onProgress?.('Calculando umbral adaptativo (Otsu)...')
  // Umbral adaptativo: mucho mejor para puertas beige/crema con líneas marrones
  const binary = threshold(imgData)

  onProgress?.('Sellando grietas en líneas...')
  // Dilatar líneas oscuras r=1 para cerrar pequeños gaps y asegurar regiones selladas
  const sealed = dilateLines(binary, canvasW, canvasH, 1)

  onProgress?.('Identificando fondo exterior...')
  const seeds: number[] = []
  for (let x = 0; x < canvasW; x++) {
    if (sealed[x]) seeds.push(x)
    if (sealed[(canvasH-1)*canvasW+x]) seeds.push((canvasH-1)*canvasW+x)
  }
  for (let y = 1; y < canvasH-1; y++) {
    if (sealed[y*canvasW]) seeds.push(y*canvasW)
    if (sealed[y*canvasW+canvasW-1]) seeds.push(y*canvasW+canvasW-1)
  }
  const background = floodFill(sealed, canvasW, canvasH, seeds)

  onProgress?.('Aislando regiones cerradas...')
  // Usar el binary original (sin dilatar) para las regiones — más preciso
  const enclosed = new Uint8Array(canvasW * canvasH)
  for (let i = 0; i < enclosed.length; i++) {
    enclosed[i] = binary[i] && !background[i] ? 1 : 0
  }

  onProgress?.('Etiquetando componentes...')
  const labels = labelComponents(enclosed, canvasW, canvasH)
  const comps  = collectBBoxes(labels, canvasW, canvasH)

  onProgress?.(`${comps.size} regiones encontradas — filtrando...`)

  // Reducido a 0.1% para capturar regiones pequeñas (piezas del abanico, etc.)
  const minPixels = canvasW * canvasH * 0.001
  const maxPixels = canvasW * canvasH * 0.95

  const sorted = Array.from(comps.entries())
    .filter(([, c]) => c.count >= minPixels && c.count <= maxPixels)
    .sort((a, b) => b[1].count - a[1].count)

  onProgress?.(`Construyendo ${sorted.length} formas...`)

  const shapes: TracedShape[] = []

  for (const [label, comp] of sorted) {
    const bW = comp.maxX - comp.minX
    const bH = comp.maxY - comp.minY
    if (bW < 4 || bH < 4) continue

    const kind = classifyShape(comp)

    if (kind === 'rect') {
      shapes.push({
        id: uuidv4(),
        moduleType: 'panel' as ModuleType,
        shapeType: 'rect',
        x: comp.minX, y: comp.minY,
        width: bW, height: bH,
        fill: '', stroke: '#3B82F6', strokeWidth: 1.5
      })
    } else if (kind === 'ellipse') {
      // Centro de la elipse
      const cx = comp.minX + bW / 2
      const cy = comp.minY + bH / 2
      shapes.push({
        id: uuidv4(),
        moduleType: 'panel' as ModuleType,
        shapeType: 'ellipse',
        x: cx, y: cy,
        radiusX: bW / 2,
        radiusY: bH / 2,
        fill: '', stroke: '#3B82F6', strokeWidth: 1.5
      })
    } else {
      // Región curva/irregular → trazar contorno real
      const rawPts = traceContour(labels, label, canvasW, canvasH, comp, 2)
      if (rawPts.length < 8) continue
      const simplified = dpSimplify(rawPts, 1.5)  // epsilon menor = curvas más suaves
      if (simplified.length < 8) continue
      shapes.push({
        id: uuidv4(),
        moduleType: 'panel' as ModuleType,
        shapeType: 'polygon',
        x: 0, y: 0,
        points: simplified,
        closed: true,
        fill: '', stroke: '#3B82F6', strokeWidth: 1.5
      })
    }
  }

  onProgress?.(`✓ ${shapes.length} forma${shapes.length !== 1 ? 's' : ''} detectada${shapes.length !== 1 ? 's' : ''}`)
  return shapes
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preview de bordes detectados
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateEdgePreview(src: string, w: number, h: number): Promise<string> {
  const imgData = await loadImageData(src, w, h)
  const binary  = threshold(imgData)
  const sealed  = dilateLines(binary, w, h, 1)
  const seeds: number[] = []
  for (let x = 0; x < w; x++) {
    if (sealed[x]) seeds.push(x)
    if (sealed[(h-1)*w+x]) seeds.push((h-1)*w+x)
  }
  for (let y = 1; y < h-1; y++) {
    if (sealed[y*w]) seeds.push(y*w)
    if (sealed[y*w+w-1]) seeds.push(y*w+w-1)
  }
  const bg       = floodFill(sealed, w, h, seeds)
  const enclosed = new Uint8Array(w * h)
  for (let i = 0; i < enclosed.length; i++)
    enclosed[i] = binary[i] && !bg[i] ? 1 : 0

  const labels = labelComponents(enclosed, w, h)
  const comps  = collectBBoxes(labels, w, h)
  const minPx  = w * h * 0.001  // mismo umbral que en autoTraceRegions

  const out = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const gray = binary[i] ? 240 : 40
    out.data[i*4]=gray; out.data[i*4+1]=gray; out.data[i*4+2]=gray; out.data[i*4+3]=255
  }

  const palette = [[59,130,246],[16,185,129],[245,158,11],[239,68,68],[168,85,247],[20,184,166]]
  let ci = 0
  for (const [label, comp] of comps.entries()) {
    if (comp.count < minPx) continue
    const [r,g,b] = palette[ci++ % palette.length]
    for (let y = comp.minY; y <= comp.maxY; y++) {
      for (let x = comp.minX; x <= comp.maxX; x++) {
        if (labels[y*w+x] === label) {
          const i = y*w+x
          out.data[i*4]=r; out.data[i*4+1]=g; out.data[i*4+2]=b; out.data[i*4+3]=200
        }
      }
    }
  }

  const c = document.createElement('canvas'); c.width=w; c.height=h
  c.getContext('2d')!.putImageData(out, 0, 0)
  return c.toDataURL()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy: Auto-trazar desde SVG de Potrace (mantener compatibilidad)
// ═══════════════════════════════════════════════════════════════════════════════
export async function autoTraceFromSVG(
  svg: string, canvasW: number, canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {
  onProgress?.('Analizando SVG...')
  const vbMatch = svg.match(/viewBox="([^"]+)"/)
  let svgW = canvasW, svgH = canvasH
  if (vbMatch) {
    const [,,w,h] = vbMatch[1].split(/\s+/).map(Number)
    if (w > 0 && h > 0) { svgW = w; svgH = h }
  }
  const scaleX = canvasW / svgW, scaleY = canvasH / svgH
  const pathRe = /<path[^>]+d="([^"]+)"/g
  const allPolys: number[][] = []
  let match: RegExpExecArray | null
  while ((match = pathRe.exec(svg)) !== null) {
    const pts: number[] = []
    const re = /[ML]\s*([\d.eE+-]+)[,\s]+([\d.eE+-]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(match[1])) !== null)
      pts.push(parseFloat(m[1]), parseFloat(m[2]))
    if (pts.length < 6) continue
    const scaled = pts.map((v, i) => v * (i%2===0 ? scaleX : scaleY))
    const simplified = dpSimplify(scaled, 3)
    if (simplified.length >= 6) allPolys.push(simplified)
  }
  const polyArea = (p: number[]) => {
    const n=p.length/2; let a=0
    for(let i=0;i<n;i++){const j=(i+1)%n;a+=p[i*2]*p[j*2+1]-p[j*2]*p[i*2+1]}
    return Math.abs(a)/2
  }
  const totalArea = canvasW * canvasH
  const significant = allPolys
    .map(p=>({pts:p,area:polyArea(p)}))
    .filter(p=>p.area>totalArea*0.01&&p.area<totalArea*0.88)
    .sort((a,b)=>b.area-a.area)
  if (!significant.length) return []
  const shapes: TracedShape[] = [
    { id:uuidv4(), moduleType:'marco' as ModuleType, shapeType:'polygon',
      x:0,y:0,points:significant[0].pts,closed:true,fill:'',stroke:'',strokeWidth:1.5 }
  ]
  significant.slice(1,9).forEach(s=>shapes.push({
    id:uuidv4(),moduleType:'panel' as ModuleType,shapeType:'polygon',
    x:0,y:0,points:s.pts,closed:true,fill:'',stroke:'',strokeWidth:1.5
  }))
  return shapes
}

// ─── Legacy: desde máscaras SAM ───────────────────────────────────────────────
async function maskToPolygon(maskUrl: string, w: number, h: number): Promise<number[]|null> {
  const data = await loadImageData(maskUrl, w, h)
  let minX=w,maxX=0,minY=h,maxY=0,count=0
  for (let i=0;i<w*h;i++) {
    const r=data.data[i*4],g=data.data[i*4+1],b=data.data[i*4+2]
    if (r+g+b>40) {
      const x=i%w,y=(i/w)|0
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;count++
    }
  }
  const mw=maxX-minX,mh=maxY-minY
  if (count<w*h*0.01||mw<w*0.05||mh<h*0.03) return null
  return [minX,minY,maxX,minY,maxX,maxY,minX,maxY]
}

export async function autoTraceFromMasks(
  masks: string[], canvasW: number, canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {
  const polygons: number[][] = []
  for (let i=0;i<masks.length;i++) {
    onProgress?.(`Procesando máscara ${i+1}/${masks.length}...`)
    try {
      const p = await maskToPolygon(masks[i], canvasW, canvasH)
      if (p && p.length>=6) polygons.push(p)
    } catch {}
  }
  if (!polygons.length) return []
  const polyArea = (p:number[])=>{const n=p.length/2;let a=0;for(let i=0;i<n;i++){const j=(i+1)%n;a+=p[i*2]*p[j*2+1]-p[j*2]*p[i*2+1]}return Math.abs(a)/2}
  const sorted = polygons.map(p=>({pts:p,area:polyArea(p)})).filter(p=>p.area>canvasW*canvasH*0.01).sort((a,b)=>b.area-a.area)
  if (!sorted.length) return []
  const shapes: TracedShape[] = [
    {id:uuidv4(),moduleType:'marco' as ModuleType,shapeType:'polygon',x:0,y:0,points:sorted[0].pts,closed:true,fill:'',stroke:'',strokeWidth:1.5}
  ]
  sorted.slice(1,7).forEach(s=>shapes.push({id:uuidv4(),moduleType:'panel' as ModuleType,shapeType:'polygon',x:0,y:0,points:s.pts,closed:true,fill:'',stroke:'',strokeWidth:1.5}))
  return shapes
}
