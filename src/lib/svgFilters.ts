import { RealismSettings, ZoneTipo, FinishType, BezierNode } from '../types'

// ─── Genera los SVG <defs> con todos los filtros de realismo ──────────────────
export function buildSVGFilters(realism: RealismSettings): string {
  const { lightAngle, lightIntensity, shadowDepth, finish, glassBlur, glassReflection } = realism

  const rad = (lightAngle * Math.PI) / 180
  const dx = Math.cos(rad) * shadowDepth
  const dy = Math.sin(rad) * shadowDepth

  const specularSurface: Record<FinishType, number> = {
    mate: 0,
    satinado: 0.3,
    brillante: 0.8
  }
  const specular = specularSurface[finish]

  const blurRadius = Math.max(shadowDepth * 0.6, 3)

  return `
  <defs>
    <!-- ── Filtros de acabado ─────────────────────────────── -->

    <!-- Mate: corrección mínima, textura limpia -->
    <filter id="filter-mate">
      <feColorMatrix type="matrix" values="1.02 0 0 0 -0.01  0 1.02 0 0 -0.01  0 0 1.02 0 -0.01  0 0 0 1 0"/>
    </filter>

    <!-- Satinado: saturación + brillo suave -->
    <filter id="filter-satin" x="-5%" y="-5%" width="110%" height="110%">
      <feColorMatrix type="saturate" values="1.1" result="sat"/>
      <feSpecularLighting in="sat" surfaceScale="2.5" specularConstant="0.2"
        specularExponent="20" lightingColor="white" result="spec">
        <feDistantLight azimuth="${lightAngle}" elevation="68"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="sat" operator="in" result="sc"/>
      <feBlend in="sat" in2="sc" mode="screen"/>
    </filter>

    <!-- Brillante: especular pronunciado -->
    <filter id="filter-specular" x="-5%" y="-5%" width="110%" height="110%">
      <feColorMatrix type="saturate" values="1.15" result="sat"/>
      <feSpecularLighting in="sat" surfaceScale="5" specularConstant="${Math.max(specular, 0.55)}"
        specularExponent="30" lightingColor="white" result="spec">
        <feDistantLight azimuth="${lightAngle}" elevation="52"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="sat" operator="in" result="sc"/>
      <feBlend in="sat" in2="sc" mode="screen"/>
    </filter>

    <!-- Moldura -->
    <filter id="filter-moldure-inner" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="${dx*0.2}" dy="${dy*0.2}" stdDeviation="2.5" flood-color="rgba(0,0,0,0.4)"/>
    </filter>

    <!-- Vidrio -->
    <filter id="filter-glass" x="0%" y="0%" width="100%" height="100%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(glassBlur, 0.4)}" result="blur"/>
      <feColorMatrix in="blur" type="saturate" values="1.2"/>
    </filter>

    <!-- ── Efectos de profundidad / relieve ───────────────── -->

    <!-- Blur helper para sombras -->
    <filter id="f-blur-sm"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="f-blur-md"><feGaussianBlur stdDeviation="${blurRadius}"/></filter>
    <filter id="f-blur-lg"><feGaussianBlur stdDeviation="${blurRadius * 1.6}"/></filter>

    <!-- Sombra de profundidad entre panel y marco -->
    <filter id="f-depth-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="${dx * 0.5}" dy="${dy * 0.5}"
        stdDeviation="${blurRadius}" flood-color="rgba(0,0,0,0.55)"/>
    </filter>

    <!-- Sombra interior para paneles recesados -->
    <filter id="f-inner-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${blurRadius * 0.9}" result="blur"/>
      <feOffset dx="${dx * 0.4}" dy="${dy * 0.4}" in="blur" result="offset"/>
      <feFlood flood-color="rgba(0,0,0,0.55)" result="color"/>
      <feComposite in="color" in2="offset" operator="in" result="shadow"/>
      <feComposite in="shadow" in2="SourceAlpha" operator="in" result="clipped"/>
      <feBlend in="SourceGraphic" in2="clipped" mode="multiply"/>
    </filter>

    <!-- ── Gradientes de relieve / luz ───────────────────── -->

    <!-- Bisel del marco: luz arriba-izquierda, sombra abajo-derecha -->
    <linearGradient id="g-bevel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="35%"  stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="60%"  stop-color="rgba(0,0,0,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
    </linearGradient>

    <!-- Viñeta interior del panel (oscurece bordes, simula receso) -->
    <radialGradient id="g-panel-vignette" cx="50%" cy="50%" r="65%">
      <stop offset="30%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
    </radialGradient>

    <!-- Reflejo de vidrio: franja diagonal brillante -->
    <linearGradient id="g-glass-sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(210,235,255,0.92)"/>
      <stop offset="55%"  stop-color="rgba(170,215,245,0.85)"/>
      <stop offset="100%" stop-color="rgba(140,195,235,0.80)"/>
    </linearGradient>
    <linearGradient id="g-glass-streak" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.65)"/>
      <stop offset="18%"  stop-color="rgba(255,255,255,0.0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.0)"/>
    </linearGradient>
    <linearGradient id="g-glass-bottom" x1="0%" y1="80%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.18)"/>
    </linearGradient>

    <!-- Oclusión ambiental -->
    <radialGradient id="ambient-occlusion" cx="50%" cy="50%" r="50%">
      <stop offset="65%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
    </radialGradient>

    <!-- Reflejo en vidrio -->
    <linearGradient id="glass-reflection" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="${glassReflection * 0.6}"/>
      <stop offset="40%" stop-color="white" stop-opacity="${glassReflection * 0.1}"/>
      <stop offset="100%" stop-color="white" stop-opacity="${glassReflection * 0.3}"/>
    </linearGradient>

    <!-- Gradiente de profundidad para moldura -->
    <linearGradient id="moldure-bevel-top" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.4)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.3)"/>
    </linearGradient>

    <linearGradient id="moldure-bevel-left" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.3)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.2)"/>
    </linearGradient>
  </defs>`
}

// ─── Retorna qué filtros aplicar según tipo de zona y acabado ─────────────────
export function getFilterForZone(tipo: ZoneTipo, finish: FinishType): string {
  if (tipo === 'vidrio') return 'url(#filter-glass)'
  if (tipo === 'moldura') return 'url(#filter-moldure-inner)'

  switch (finish) {
    case 'mate':     return 'url(#filter-mate)'
    case 'satinado': return 'url(#filter-satin)'
    case 'brillante': return 'url(#filter-specular)'
    default:         return 'url(#filter-mate)'
  }
}

// ─── archRectToPath: rectangle with elliptical arch top ──────────────────────
export function archRectToPath(x: number, y: number, w: number, h: number, ah: number): string {
  const k = 0.5523
  const hw = w / 2
  return [
    `M ${x} ${y + h}`,
    `L ${x + w} ${y + h}`,
    `L ${x + w} ${y + ah}`,
    `C ${x + w} ${y + ah - ah * k} ${x + hw + hw * k} ${y} ${x + hw} ${y}`,
    `C ${x + hw - hw * k} ${y} ${x} ${y + ah - ah * k} ${x} ${y + ah}`,
    `Z`
  ].join(' ')
}

// ─── chamferRectToPath: rectangle with diagonal cut corners ──────────────────
export function chamferRectToPath(x: number, y: number, w: number, h: number, cs: number): string {
  return [
    `M ${x + cs} ${y}`,
    `L ${x + w - cs} ${y}`,
    `L ${x + w} ${y + cs}`,
    `L ${x + w} ${y + h - cs}`,
    `L ${x + w - cs} ${y + h}`,
    `L ${x + cs} ${y + h}`,
    `L ${x} ${y + h - cs}`,
    `L ${x} ${y + cs}`,
    `Z`
  ].join(' ')
}

// ─── Bezier nodes → SVG cubic bezier path ─────────────────────────────────────
export function bezierNodesToPath(
  nodes: BezierNode[],
  closed: boolean,
  ox = 0,
  oy = 0
): string {
  if (nodes.length < 2) return ''
  const X = (v: number) => (v + ox).toFixed(2)
  const Y = (v: number) => (v + oy).toFixed(2)
  let d = `M ${X(nodes[0].x)} ${Y(nodes[0].y)}`
  const n = nodes.length
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const from = nodes[i]
    const to   = nodes[(i + 1) % n]
    const c1   = from.handleOut
    const c2   = to.handleIn
    if (c1 || c2) {
      const cp1x = c1 ? X(c1.x) : X(from.x)
      const cp1y = c1 ? Y(c1.y) : Y(from.y)
      const cp2x = c2 ? X(c2.x) : X(to.x)
      const cp2y = c2 ? Y(c2.y) : Y(to.y)
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${X(to.x)} ${Y(to.y)}`
    } else {
      d += ` L ${X(to.x)} ${Y(to.y)}`
    }
  }
  if (closed) d += ' Z'
  return d
}

// ─── Catmull-Rom → SVG cubic bezier (para shapeType 'curve') ─────────────────
function catmullRomToSVG(pts: number[], closed: boolean, ox: number, oy: number): string {
  const n = pts.length / 2
  if (n < 2) return ''

  // Coordenadas trasladadas
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(pts[i * 2] + ox)
    ys.push(pts[i * 2 + 1] + oy)
  }

  // Puntos fantasma en los extremos
  let exX: number[], exY: number[]
  if (closed) {
    exX = [xs[n - 1], ...xs, xs[0], xs[1]]
    exY = [ys[n - 1], ...ys, ys[0], ys[1]]
  } else {
    exX = [xs[0], ...xs, xs[n - 1]]
    exY = [ys[0], ...ys, ys[n - 1]]
  }

  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
  const segments = closed ? n : n - 1

  for (let i = 0; i < segments; i++) {
    // exX/exY indices: [phantom-before=0, p0=1, p1=2, ... pn-1=n, phantom-after=n+1]
    const p0x = exX[i],     p0y = exY[i]
    const p1x = exX[i + 1], p1y = exY[i + 1]
    const p2x = exX[i + 2], p2y = exY[i + 2]
    const p3x = exX[i + 3], p3y = exY[i + 3]

    const cp1x = (p1x + (p2x - p0x) / 6).toFixed(2)
    const cp1y = (p1y + (p2y - p0y) / 6).toFixed(2)
    const cp2x = (p2x - (p3x - p1x) / 6).toFixed(2)
    const cp2y = (p2y - (p3y - p1y) / 6).toFixed(2)

    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2x.toFixed(2)} ${p2y.toFixed(2)}`
  }

  if (closed) d += ' Z'
  return d
}

// ─── Genera el path SVG de una forma a partir de los datos del tracer ─────────
export function shapeToSVGPath(shape: {
  shapeType: string
  x: number
  y: number
  width?: number
  height?: number
  radiusX?: number
  radiusY?: number
  archHeight?: number
  chamferSize?: number
  points?: number[]
  nodes?: any[]
  closed?: boolean
}): string {
  if (shape.shapeType === 'archrect' && shape.width && shape.height) {
    const ah = shape.archHeight ?? (shape.width / 2)
    return archRectToPath(shape.x, shape.y, shape.width, shape.height, ah)
  }

  if (shape.shapeType === 'chamferedrect' && shape.width && shape.height) {
    const cs = shape.chamferSize ?? Math.min(shape.width, shape.height) * 0.1
    return chamferRectToPath(shape.x, shape.y, shape.width, shape.height, cs)
  }

  if (shape.shapeType === 'rect' && shape.width && shape.height) {
    return `M ${shape.x} ${shape.y} h ${shape.width} v ${shape.height} h ${-shape.width} Z`
  }

  if (shape.shapeType === 'ellipse' && shape.radiusX && shape.radiusY) {
    const { x, y, radiusX: rx, radiusY: ry } = shape
    return `M ${x - rx} ${y} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`
  }

  if (shape.shapeType === 'line' && shape.points && shape.points.length >= 4) {
    const ox = shape.x || 0, oy = shape.y || 0
    return `M ${shape.points[0] + ox} ${shape.points[1] + oy} L ${shape.points[2] + ox} ${shape.points[3] + oy}`
  }

  if ((shape.shapeType === 'polygon' || shape.shapeType === 'freehand') && shape.points && shape.points.length >= 4) {
    const pts = shape.points
    const ox = shape.x || 0, oy = shape.y || 0
    let d = `M ${pts[0] + ox} ${pts[1] + oy}`
    for (let i = 2; i < pts.length; i += 2) {
      d += ` L ${pts[i] + ox} ${pts[i + 1] + oy}`
    }
    return shape.closed !== false ? d + ' Z' : d
  }

  if (shape.shapeType === 'curve' && shape.points && shape.points.length >= 4) {
    return catmullRomToSVG(shape.points, shape.closed !== false, shape.x || 0, shape.y || 0)
  }

  if (shape.shapeType === 'bezier' && shape.nodes && shape.nodes.length >= 2) {
    return bezierNodesToPath(
      shape.nodes as BezierNode[],
      shape.closed !== false,
      shape.x || 0,
      shape.y || 0
    )
  }

  return ''
}
