import { TracedShape, Zone, Texture, RealismSettings, ZoneTipo } from '../types'
import { buildSVGFilters, getFilterForZone, shapeToSVGPath } from './svgFilters'

const ZONE_COLORS: Record<ZoneTipo, string> = {
  madera:  '#8B5E3C',
  vidrio:  '#7EB8D4',
  moldura: '#A0856C',
  metal:   '#8C9BAB',
  pintura: '#C4A882'
}

interface ExportOptions {
  shapes: TracedShape[]
  zones: Zone[]
  textures: Texture[]
  realism: RealismSettings
  width: number
  height: number
}

// ─── Centro geométrico de una forma ──────────────────────────────────────────
function getShapeCenter(shape: TracedShape): { cx: number; cy: number } {
  if ((shape.shapeType === 'archrect' || shape.shapeType === 'chamferedrect' || shape.shapeType === 'compound') && shape.width && shape.height)
    return { cx: shape.x + shape.width / 2, cy: shape.y + shape.height / 2 }
  if (shape.shapeType === 'rect' && shape.width && shape.height)
    return { cx: shape.x + shape.width / 2, cy: shape.y + shape.height / 2 }
  if (shape.shapeType === 'ellipse')
    return { cx: shape.x, cy: shape.y }
  if (shape.points && shape.points.length >= 2) {
    let sx = 0, sy = 0, n = shape.points.length / 2
    for (let i = 0; i < shape.points.length; i += 2) { sx += shape.points[i]; sy += shape.points[i + 1] }
    return { cx: sx / n + (shape.x || 0), cy: sy / n + (shape.y || 0) }
  }
  if (shape.shapeType === 'bezier' && (shape as any).nodes && (shape as any).nodes.length >= 2) {
    const nodes = (shape as any).nodes as Array<{x:number;y:number}>
    let sx = 0, sy = 0
    nodes.forEach((n: {x:number;y:number}) => { sx += n.x; sy += n.y })
    return { cx: sx / nodes.length + (shape.x || 0), cy: sy / nodes.length + (shape.y || 0) }
  }
  return { cx: shape.x, cy: shape.y }
}

// ─── Genera el SVG completo idéntico a la vista previa ───────────────────────
export function generateSVG(opts: ExportOptions): string {
  const { shapes, zones, textures, realism, width, height } = opts

  const textureMap = new Map(textures.map((t) => [t.id, t]))
  const zoneMap    = new Map(zones.map((z) => [z.shapeId, z]))

  // Patrones de textura
  const patterns = zones
    .filter((z) => z.textureId)
    .map((zone) => {
      const tex = textureMap.get(zone.textureId!)
      if (!tex) return ''
      const url = tex.hdUrl || tex.originalUrl
      const patternSize = 200 * (tex.scale || 1)
      return `<pattern id="tex-${zone.id}" patternUnits="userSpaceOnUse"
        width="${patternSize}" height="${patternSize}"
        patternTransform="rotate(${tex.rotation || 0})">
        <image href="${url}" x="0" y="0"
          width="${patternSize}" height="${patternSize}"
          preserveAspectRatio="xMidYMid slice"/>
      </pattern>`
    })
    .join('\n')

  // Fondo: textura del marco si tiene una asignada, si no → blanco
  const marcoShape = shapes.find(s => s.moduleType === 'marco')
  const marcoZone  = marcoShape ? zoneMap.get(marcoShape.id) : null
  let baseFill: string
  if (marcoZone?.textureId && textureMap.get(marcoZone.textureId)) {
    baseFill = `url(#tex-${marcoZone.id})`
  } else {
    baseFill = 'white'
  }

  // ClipPaths y elementos de cada forma
  const clips: string[]    = []
  const elements: string[] = []

  shapes.forEach((shape) => {
    const zone    = zoneMap.get(shape.id)
    const tipo    = (zone?.tipo || 'madera') as ZoneTipo
    const texture = zone?.textureId ? textureMap.get(zone.textureId) : undefined
    const fill    = texture ? `url(#tex-${zone!.id})` : ZONE_COLORS[tipo]
    const filter  = getFilterForZone(tipo, realism.finish)
    const path    = shapeToSVGPath(shape)
    if (!path) return

    const isGlass  = tipo === 'vidrio'
    const isMarco  = shape.moduleType === 'marco'
    const isPanel  = shape.moduleType === 'panel'
    const isMoldura = tipo === 'moldura'
    const clipId   = `clip-${shape.id}`

    clips.push(`<clipPath id="${clipId}"><path d="${path}"/></clipPath>`)

    const rotation = shape.rotation || 0
    const { cx, cy } = getShapeCenter(shape)
    // compound svgPath uses local coords (relative to shape.x/y) → needs translate
    // All other shapes: Konva rotates around the node's local origin (shape.x, shape.y),
    // so SVG must also rotate around that same point, not the centroid.
    let transformAttr = ''
    if (shape.shapeType === 'compound') {
      const tx = shape.x || 0, ty = shape.y || 0
      const parts = []
      if (tx !== 0 || ty !== 0) parts.push(`translate(${tx},${ty})`)
      if (rotation) parts.push(`rotate(${rotation},${(cx-tx).toFixed(2)},${(cy-ty).toFixed(2)})`)
      if (parts.length) transformAttr = ` transform="${parts.join(' ')}"`
    } else {
      // shape.x / shape.y = local origin in canvas space (Konva rotates around this point)
      const rx = shape.x || 0, ry = shape.y || 0
      transformAttr = rotation ? ` transform="rotate(${rotation}, ${rx}, ${ry})"` : ''
    }

    let inner = ''

    if (isGlass) {
      const glassOpacity = Math.min(realism.glassOpacity + 0.4, 0.85)
      inner = `
        <path d="${path}" fill="url(#g-glass-sky)" opacity="0.92"/>
        ${texture ? `<path d="${path}" fill="${fill}" filter="${filter}" opacity="0.25"/>` : ''}
        <path d="${path}" fill="url(#g-glass-bottom)" opacity="0.6"/>
        <path d="${path}" fill="url(#g-glass-streak)" opacity="${realism.glassReflection * 0.9}"/>
        <path d="${path}" fill="url(#glass-reflection)" opacity="0.5"/>
        <path d="${path}" fill="url(#ambient-occlusion)" opacity="${realism.ambientOcclusion * 0.6}"/>`
      void glassOpacity
    } else {
      // stroke del mismo color que el fill para cerrar micro-huecos entre shapes adyacentes
      const gapStroke = texture ? fill : ZONE_COLORS[tipo]
      inner = `
        <path d="${path}" fill="${fill}" stroke="${gapStroke}" stroke-width="1.2" stroke-linejoin="round" filter="${filter}"/>`

      if (isPanel) {
        inner += `
        <path d="${path}" fill="url(#g-panel-vignette)" opacity="0.65"/>
        <path d="${path}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="6" clip-path="url(#${clipId})"/>`
      }

      if (isMarco) {
        inner += `
        <path d="${path}" fill="url(#g-bevel)" opacity="0.55"/>`
      }

      if (isMoldura) {
        inner += `
        <path d="${path}" fill="url(#moldure-bevel-top)" opacity="0.45"/>
        <path d="${path}" fill="url(#moldure-bevel-left)" opacity="0.3"/>`
      }

      inner += `
        <path d="${path}" fill="url(#ambient-occlusion)" opacity="${realism.ambientOcclusion}"/>`
    }

    elements.push(`<g data-modulo="${shape.moduleType}" data-tipo="${tipo}"${transformAttr}>${inner}</g>`)
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${buildSVGFilters(realism)}
  <defs>
    ${patterns}
    ${clips.join('\n')}
  </defs>
  <rect width="${width}" height="${height}" fill="${baseFill}"/>
  ${elements.join('\n')}
</svg>`
}

// ─── Descarga el SVG como archivo ─────────────────────────────────────────────
export function downloadSVG(svgContent: string, filename = 'puerta.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Exporta como PNG usando canvas ───────────────────────────────────────────
export function exportAsPNG(svgContent: string, filename = 'puerta.png') {
  const img = new Image()
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = img.naturalWidth  * 2
    canvas.height = img.naturalHeight * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0)
    const pngUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  img.src = url
}
