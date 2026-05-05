import { TracedShape, ModuleType } from '../types'
import { v4 as uuidv4 } from 'uuid'

// ─── Cargar imagen ────────────────────────────────────────────────────────────
async function loadImageData(src: string, w: number, h: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(c.getContext('2d')!.getImageData(0, 0, w, h))
    }
    img.onerror = reject
    img.src = src
  })
}

function toGray(data: ImageData): Float32Array {
  const g = new Float32Array(data.width * data.height)
  for (let i = 0; i < g.length; i++) {
    const p = i * 4
    g[i] = 0.299*data.data[p] + 0.587*data.data[p+1] + 0.114*data.data[p+2]
  }
  return g
}

function gaussianBlur(g: Float32Array, w: number, h: number): Float32Array {
  const k = [1,4,7,4,1,4,16,26,16,4,7,26,41,26,7,4,16,26,16,4,1,4,7,4,1]
  const out = new Float32Array(w*h)
  for (let y=2;y<h-2;y++) for (let x=2;x<w-2;x++) {
    let s=0
    for (let ky=-2;ky<=2;ky++) for (let kx=-2;kx<=2;kx++)
      s += g[(y+ky)*w+(x+kx)] * k[(ky+2)*5+(kx+2)]
    out[y*w+x] = s/273
  }
  return out
}

function sobel(g: Float32Array, w: number, h: number): Float32Array {
  const e = new Float32Array(w*h)
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    const gx = -g[(y-1)*w+x-1]+g[(y-1)*w+x+1]-2*g[y*w+x-1]+2*g[y*w+x+1]-g[(y+1)*w+x-1]+g[(y+1)*w+x+1]
    const gy = -g[(y-1)*w+x-1]-2*g[(y-1)*w+x]-g[(y-1)*w+x+1]+g[(y+1)*w+x-1]+2*g[(y+1)*w+x]+g[(y+1)*w+x+1]
    e[y*w+x] = Math.sqrt(gx*gx+gy*gy)
  }
  return e
}

// ─── Proyección + picos ───────────────────────────────────────────────────────
function rowProjection(edges: Float32Array, w: number, h: number): Float32Array {
  const p = new Float32Array(h)
  for (let y=0;y<h;y++) { let s=0; for (let x=0;x<w;x++) s+=edges[y*w+x]; p[y]=s/w }
  return p
}
function colProjection(edges: Float32Array, w: number, h: number): Float32Array {
  const p = new Float32Array(w)
  for (let x=0;x<w;x++) { let s=0; for (let y=0;y<h;y++) s+=edges[y*w+x]; p[x]=s/h }
  return p
}

// Fusiona picos cercanos en su centro
function clusterPeaks(peaks: number[], clusterGap: number): number[] {
  if (!peaks.length) return []
  const clusters: number[][] = [[peaks[0]]]
  for (let i=1;i<peaks.length;i++) {
    const last = clusters[clusters.length-1]
    if (peaks[i] - last[last.length-1] <= clusterGap) last.push(peaks[i])
    else clusters.push([peaks[i]])
  }
  return clusters.map(c => Math.round(c.reduce((a,b)=>a+b,0)/c.length))
}

function findPeaks(proj: Float32Array, minGap: number, clusterGap: number): number[] {
  // Umbral = media + 1σ
  let mean=0; for (let v of proj) mean+=v; mean/=proj.length
  let std=0; for (let v of proj) std+=(v-mean)**2; std=Math.sqrt(std/proj.length)
  const thresh = mean + std * 0.6

  const raw: number[] = []
  for (let i=3;i<proj.length-3;i++) {
    if (proj[i]<thresh) continue
    if (proj[i]>=proj[i-1] && proj[i]>=proj[i+1] &&
        proj[i]>=proj[i-2] && proj[i]>=proj[i+2] &&
        proj[i]>=proj[i-3] && proj[i]>=proj[i+3]) {
      if (!raw.length || i-raw[raw.length-1] > minGap) raw.push(i)
    }
  }
  return clusterPeaks(raw, clusterGap)
}

// ─── Construir rectángulos ────────────────────────────────────────────────────
interface Rect { x:number; y:number; w:number; h:number; score:number }

function buildRects(hL: number[], vL: number[], W: number, H: number): Rect[] {
  const out: Rect[] = []
  const minW=W*0.08, minH=H*0.05
  for (let hi=0;hi<hL.length-1;hi++) for (let hj=hi+1;hj<hL.length;hj++)
    for (let vi=0;vi<vL.length-1;vi++) for (let vj=vi+1;vj<vL.length;vj++) {
      const rw=vL[vj]-vL[vi], rh=hL[hj]-hL[hi]
      if (rw<minW||rh<minH) continue
      out.push({ x:vL[vi], y:hL[hi], w:rw, h:rh, score:(rw*rh)/(W*H) })
    }
  return out.sort((a,b)=>b.score-a.score)
}

// ─── NMS: elimina rectángulos que se solapan demasiado ───────────────────────
function iou(a: Rect, b: Rect): number {
  const ix1=Math.max(a.x,b.x), iy1=Math.max(a.y,b.y)
  const ix2=Math.min(a.x+a.w,b.x+b.w), iy2=Math.min(a.y+a.h,b.y+b.h)
  if (ix2<=ix1||iy2<=iy1) return 0
  const inter=(ix2-ix1)*(iy2-iy1)
  return inter / (a.w*a.h + b.w*b.h - inter)
}

function nms(rects: Rect[], thresh=0.45): Rect[] {
  const kept: Rect[] = []
  const used = new Set<number>()
  for (let i=0;i<rects.length;i++) {
    if (used.has(i)) continue
    kept.push(rects[i])
    for (let j=i+1;j<rects.length;j++) {
      if (!used.has(j) && iou(rects[i],rects[j]) > thresh) used.add(j)
    }
  }
  return kept
}

// ─── Clasificar: marco + paneles ─────────────────────────────────────────────
function classify(rects: Rect[], W: number, H: number) {
  const sig = rects.filter(r=>r.score>=0.15)
  if (!sig.length) return { marco: rects[0]??null, panels: [] }

  const marco = sig[0]
  const panels = sig.slice(1).filter(r => {
    // Debe estar claramente dentro del marco (con margen)
    return r.x >= marco.x-8 && r.y >= marco.y-8 &&
           r.x+r.w <= marco.x+marco.w+8 &&
           r.y+r.h <= marco.y+marco.h+8
  }).slice(0,4)

  return { marco, panels }
}

// ─── Rect → puntos polígono ───────────────────────────────────────────────────
const poly = (r: Rect) => [r.x,r.y, r.x+r.w,r.y, r.x+r.w,r.y+r.h, r.x,r.y+r.h]

// ─── API pública ──────────────────────────────────────────────────────────────
export async function autoTraceImage(
  src: string, canvasW: number, canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {

  onProgress?.('Cargando imagen...')
  const img = await loadImageData(src, canvasW, canvasH)

  onProgress?.('Detectando bordes...')
  const edges = sobel(gaussianBlur(toGray(img), canvasW, canvasH), canvasW, canvasH)

  onProgress?.('Buscando líneas estructurales...')
  // Gap mínimo grande (8% del canvas) → ignora molduras finas, solo detecta paredes principales
  const minGapH = Math.round(canvasH * 0.08)
  const minGapV = Math.round(canvasW * 0.08)
  const clusterGap = Math.round(Math.min(canvasW, canvasH) * 0.03)

  const hLines = findPeaks(rowProjection(edges, canvasW, canvasH), minGapH, clusterGap)
  const vLines = findPeaks(colProjection(edges, canvasW, canvasH), minGapV, clusterGap)

  // Agregar bordes del canvas como líneas ancla
  const hAll = [0, ...hLines, canvasH].sort((a,b)=>a-b)
  const vAll = [0, ...vLines, canvasW].sort((a,b)=>a-b)

  onProgress?.(`Líneas H: ${hLines.length}  V: ${vLines.length} — construyendo formas...`)
  const rects = buildRects(hAll, vAll, canvasW, canvasH)

  onProgress?.('Eliminando duplicados...')
  const clean = nms(rects, 0.45).slice(0, 12)

  onProgress?.('Clasificando marco y paneles...')
  const { marco, panels } = classify(clean, canvasW, canvasH)

  const shapes: TracedShape[] = []
  if (marco) shapes.push({
    id: uuidv4(), moduleType: 'marco' as ModuleType, shapeType: 'polygon',
    x:0, y:0, points: poly(marco), closed:true, fill:'', stroke:'', strokeWidth:1.5
  })
  panels.forEach(p => shapes.push({
    id: uuidv4(), moduleType: 'panel' as ModuleType, shapeType: 'polygon',
    x:0, y:0, points: poly(p), closed:true, fill:'', stroke:'', strokeWidth:1.5
  }))

  onProgress?.(`Listo — ${shapes.length} forma${shapes.length!==1?'s':''} detectada${shapes.length!==1?'s':''}`)
  return shapes
}

// ─── Procesamiento de máscaras SAM → polígonos ───────────────────────────────

// Extrae el bounding-box de una máscara SAM como polígono de 4 puntos.
// Para puertas (formas rectangulares) el bbox es más limpio que trazar el contorno exacto.
async function maskToPolygon(maskUrl: string, w: number, h: number): Promise<number[] | null> {
  const data = await loadImageData(maskUrl, w, h)

  let minX=w, maxX=0, minY=h, maxY=0, count=0

  for (let i = 0; i < w * h; i++) {
    const r = data.data[i*4], g = data.data[i*4+1], b = data.data[i*4+2]
    if (r + g + b > 40) {   // pixel no-negro = parte de la máscara
      const x = i % w, y = Math.floor(i / w)
      if (x < minX) minX = x;  if (x > maxX) maxX = x
      if (y < minY) minY = y;  if (y > maxY) maxY = y
      count++
    }
  }

  // Descartar si cubre menos del 1% del canvas o tiene forma muy delgada
  const mw = maxX - minX, mh = maxY - minY
  if (count < w * h * 0.01) return null
  if (mw < w * 0.05 || mh < h * 0.03) return null

  // Rectángulo de 4 esquinas
  return [minX, minY,  maxX, minY,  maxX, maxY,  minX, maxY]
}

// Douglas-Peucker (iterativo)
function dpSimplify(pts: number[], epsilon: number): number[] {
  const n = pts.length / 2
  if (n <= 2) return pts
  const stack: [number,number][] = [[0, n-1]]
  const keep = new Uint8Array(n); keep[0]=1; keep[n-1]=1
  while (stack.length) {
    const [lo,hi] = stack.pop()!
    if (hi-lo<=1) continue
    let maxD=0, maxI=lo
    const x1=pts[lo*2],y1=pts[lo*2+1],x2=pts[hi*2],y2=pts[hi*2+1]
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)
    for (let i=lo+1;i<hi;i++) {
      const d = len>0 ? Math.abs(dy*(pts[i*2]-x1)-dx*(pts[i*2+1]-y1))/len
                      : Math.hypot(pts[i*2]-x1,pts[i*2+1]-y1)
      if (d>maxD) { maxD=d; maxI=i }
    }
    if (maxD>epsilon) { keep[maxI]=1; stack.push([lo,maxI],[maxI,hi]) }
  }
  const out: number[] = []
  for (let i=0;i<n;i++) if (keep[i]) out.push(pts[i*2],pts[i*2+1])
  return out
}

// Área de polígono (shoelace)
function polyArea(pts: number[]): number {
  const n=pts.length/2; let a=0
  for (let i=0;i<n;i++) { const j=(i+1)%n; a+=pts[i*2]*pts[j*2+1]-pts[j*2]*pts[i*2+1] }
  return Math.abs(a)/2
}

// IoU bounding-box entre dos polígonos
function polyIoU(a: number[], b: number[]): number {
  const bba = { minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity }
  const bbb = { minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity }
  for (let i=0;i<a.length;i+=2) { bba.minX=Math.min(bba.minX,a[i]); bba.maxX=Math.max(bba.maxX,a[i]); bba.minY=Math.min(bba.minY,a[i+1]); bba.maxY=Math.max(bba.maxY,a[i+1]) }
  for (let i=0;i<b.length;i+=2) { bbb.minX=Math.min(bbb.minX,b[i]); bbb.maxX=Math.max(bbb.maxX,b[i]); bbb.minY=Math.min(bbb.minY,b[i+1]); bbb.maxY=Math.max(bbb.maxY,b[i+1]) }
  const ix1=Math.max(bba.minX,bbb.minX),iy1=Math.max(bba.minY,bbb.minY)
  const ix2=Math.min(bba.maxX,bbb.maxX),iy2=Math.min(bba.maxY,bbb.maxY)
  if (ix2<=ix1||iy2<=iy1) return 0
  const inter=(ix2-ix1)*(iy2-iy1)
  const ua=(bba.maxX-bba.minX)*(bba.maxY-bba.minY)
  const ub=(bbb.maxX-bbb.minX)*(bbb.maxY-bbb.minY)
  return inter/(ua+ub-inter)
}

// NMS para polígonos (descarta duplicados con alto solapamiento)
function nmsPolygons(polys: number[][], thresh=0.55): number[][] {
  const sorted = [...polys].sort((a,b)=>polyArea(b)-polyArea(a))
  const kept: number[][] = []
  for (const p of sorted) {
    if (kept.every(k => polyIoU(k,p) < thresh)) kept.push(p)
  }
  return kept
}

// ─── API pública: Auto-trazar desde máscaras SAM ──────────────────────────────
export async function autoTraceFromMasks(
  masks: string[],
  canvasW: number,
  canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {
  const polygons: number[][] = []

  for (let i = 0; i < masks.length; i++) {
    onProgress?.(`Procesando máscara ${i+1} de ${masks.length}...`)
    try {
      const p = await maskToPolygon(masks[i], canvasW, canvasH)
      if (p && p.length >= 6) polygons.push(p)
    } catch { /* skip errores de máscaras individuales */ }
  }

  if (!polygons.length) return []

  onProgress?.('Eliminando duplicados...')
  const unique = nmsPolygons(polygons)

  const totalArea = canvasW * canvasH
  const significant = unique
    .map(p => ({ pts: p, area: polyArea(p) }))
    .filter(p => p.area > totalArea * 0.01)   // mínimo 1% del canvas
    .sort((a,b) => b.area - a.area)

  if (!significant.length) return []

  const shapes: TracedShape[] = []

  // Más grande = Marco
  shapes.push({
    id: uuidv4(), moduleType: 'marco' as ModuleType, shapeType: 'polygon',
    x:0, y:0, points: significant[0].pts, closed:true, fill:'', stroke:'', strokeWidth:1.5
  })

  // Resto = Paneles (máx 6)
  significant.slice(1, 7).forEach(s => {
    shapes.push({
      id: uuidv4(), moduleType: 'panel' as ModuleType, shapeType: 'polygon',
      x:0, y:0, points: s.pts, closed:true, fill:'', stroke:'', strokeWidth:1.5
    })
  })

  onProgress?.(`Listo — ${shapes.length} forma${shapes.length!==1?'s':''} detectada${shapes.length!==1?'s':''}`)
  return shapes
}

// ─── API pública: Auto-trazar desde SVG de Potrace ───────────────────────────

// Extrae pares de coordenadas de comandos M/L en un path SVG
function parseSvgPathPoints(d: string): number[] {
  const pts: number[] = []
  // Tokenizar todos los números precedidos por M o L
  const re = /[ML]\s*([\d.eE+-]+)[,\s]+([\d.eE+-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    pts.push(parseFloat(m[1]), parseFloat(m[2]))
  }
  return pts
}

export async function autoTraceFromSVG(
  svg: string,
  canvasW: number,
  canvasH: number,
  onProgress?: (msg: string) => void
): Promise<TracedShape[]> {
  onProgress?.('Analizando SVG...')

  // Extraer viewBox para escalar coordenadas
  const vbMatch = svg.match(/viewBox="([^"]+)"/)
  let svgW = canvasW, svgH = canvasH
  if (vbMatch) {
    const [, , w, h] = vbMatch[1].split(/\s+/).map(Number)
    if (w > 0 && h > 0) { svgW = w; svgH = h }
  } else {
    const wMatch = svg.match(/width="([^"]+)"/)
    const hMatch = svg.match(/height="([^"]+)"/)
    if (wMatch) svgW = parseFloat(wMatch[1])
    if (hMatch) svgH = parseFloat(hMatch[1])
  }

  const scaleX = canvasW / svgW
  const scaleY = canvasH / svgH

  // Extraer todos los paths
  const pathRe = /<path[^>]+d="([^"]+)"/g
  const allPolys: number[][] = []
  let match: RegExpExecArray | null

  while ((match = pathRe.exec(svg)) !== null) {
    const pts = parseSvgPathPoints(match[1])
    if (pts.length < 6) continue   // mínimo 3 puntos

    // Escalar al canvas
    const scaled: number[] = []
    for (let i = 0; i < pts.length; i += 2) {
      scaled.push(pts[i] * scaleX, pts[i+1] * scaleY)
    }

    // Simplificar con Douglas-Peucker
    const simplified = dpSimplify(scaled, 3)
    if (simplified.length < 6) continue

    allPolys.push(simplified)
  }

  onProgress?.(`${allPolys.length} trazos encontrados — filtrando...`)
  if (!allPolys.length) return []

  // Eliminar duplicados / solapamientos extremos
  const totalArea = canvasW * canvasH
  const significant = allPolys
    .map(p => ({ pts: p, area: polyArea(p) }))
    .filter(p => p.area > totalArea * 0.01 && p.area < totalArea * 0.88)  // entre 1% y 88%
    .sort((a, b) => b.area - a.area)

  const unique = nmsPolygons(significant.map(s => s.pts), 0.6)

  if (!unique.length) return []

  onProgress?.('Clasificando formas...')
  const shapes: TracedShape[] = []

  // El de mayor área = marco
  shapes.push({
    id: uuidv4(), moduleType: 'marco' as ModuleType, shapeType: 'polygon',
    x: 0, y: 0, points: unique[0], closed: true, fill: '', stroke: '', strokeWidth: 1.5
  })

  // Resto = paneles (máx 8)
  unique.slice(1, 9).forEach(pts => {
    shapes.push({
      id: uuidv4(), moduleType: 'panel' as ModuleType, shapeType: 'polygon',
      x: 0, y: 0, points: pts, closed: true, fill: '', stroke: '', strokeWidth: 1.5
    })
  })

  onProgress?.(`Listo — ${shapes.length} forma${shapes.length !== 1 ? 's' : ''} detectada${shapes.length !== 1 ? 's' : ''}`)
  return shapes
}

// ─── Preview bordes ───────────────────────────────────────────────────────────
export async function generateEdgePreview(src: string, w: number, h: number): Promise<string> {
  const img = await loadImageData(src, w, h)
  const edges = sobel(gaussianBlur(toGray(img), w, h), w, h)
  let maxE=0; for (let v of edges) if(v>maxE) maxE=v
  const out = new ImageData(w, h)
  for (let i=0;i<edges.length;i++) {
    const v = Math.min(255, (edges[i]/maxE)*255*3)
    out.data[i*4]=v; out.data[i*4+1]=v; out.data[i*4+2]=v; out.data[i*4+3]=255
  }
  const c = document.createElement('canvas'); c.width=w; c.height=h
  c.getContext('2d')!.putImageData(out, 0, 0)
  return c.toDataURL()
}
