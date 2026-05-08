import { BezierNode, ModuleType, TracedShape } from '../types'

export interface DoorTemplate {
  id: string
  label: string
  icon: string  // SVG path d attribute for 40x28 thumbnail
  multiShape?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scaleNodes(rawNodes: BezierNode[], W: number, H: number): BezierNode[] {
  const s = (n: {x:number;y:number}) => ({ x: n.x * W, y: n.y * H })
  return rawNodes.map(n => ({
    x: n.x * W,
    y: n.y * H,
    handleIn:  n.handleIn  ? s(n.handleIn)  : undefined,
    handleOut: n.handleOut ? s(n.handleOut) : undefined,
  }))
}

// ─── Template definitions (normalized 0..1) ────────────────────────────────────

// Arch with arch height = 38% of total height
const archNodes01: BezierNode[] = [
  { x: 0,   y: 1 },
  { x: 1,   y: 1 },
  { x: 1,   y: 0.38, handleOut: { x: 1,    y: 0.10 } },
  { x: 0.5, y: 0,    handleIn:  { x: 0.80, y: 0    }, handleOut: { x: 0.20, y: 0    } },
  { x: 0,   y: 0.38, handleIn:  { x: 0,    y: 0.10 } },
]

// Tall cathedral arch (arch height = 58%)
const cathedralNodes01: BezierNode[] = [
  { x: 0,   y: 1 },
  { x: 1,   y: 1 },
  { x: 1,   y: 0.42, handleOut: { x: 1,    y: 0.12 } },
  { x: 0.5, y: 0,    handleIn:  { x: 0.82, y: 0    }, handleOut: { x: 0.18, y: 0    } },
  { x: 0,   y: 0.42, handleIn:  { x: 0,    y: 0.12 } },
]

// Pointed Gothic arch
const gothicNodes01: BezierNode[] = [
  { x: 0,   y: 1 },
  { x: 1,   y: 1 },
  { x: 1,   y: 0.48, handleOut: { x: 1,   y: 0.18 } },
  { x: 0.5, y: 0 },   // sharp corner at peak
  { x: 0,   y: 0.48, handleIn:  { x: 0,   y: 0.18 } },
]

// ─── Template factories ────────────────────────────────────────────────────────

export function createTemplateShapes(
  templateId: string,
  canvasWidth: number,
  canvasHeight: number,
  moduleType: ModuleType = 'panel'
): Omit<TracedShape, 'id'>[] {
  const cx = canvasWidth  / 2
  const cy = canvasHeight / 2

  // Default panel dimensions: 40% of canvas width, 55% of canvas height
  const W = Math.round(canvasWidth  * 0.40)
  const H = Math.round(canvasHeight * 0.55)
  const x = Math.round(cx - W / 2)
  const y = Math.round(cy - H / 2)

  const base = {
    fill: '', stroke: '', strokeWidth: 1.5,
    rotation: 0, closed: true, x, y,
  }

  switch (templateId) {

    case 'rect-panel':
      return [{ ...base, moduleType, shapeType: 'rect' as const, width: W, height: H }]

    case 'arch-panel':
      return [{
        ...base, moduleType, shapeType: 'bezier' as const,
        nodes: scaleNodes(archNodes01, W, H),
      }]

    case 'cathedral-arch':
      return [{
        ...base, moduleType, shapeType: 'bezier' as const,
        nodes: scaleNodes(cathedralNodes01, W, H),
      }]

    case 'gothic-arch':
      return [{
        ...base, moduleType, shapeType: 'bezier' as const,
        nodes: scaleNodes(gothicNodes01, W, H),
      }]

    case 'full-door': {
      // 3 shapes: outer frame (marco) + upper arch panel + lower rect panel
      const fW = Math.round(canvasWidth  * 0.52)
      const fH = Math.round(canvasHeight * 0.82)
      const fx = Math.round(cx - fW / 2)
      const fy = Math.round(cy - fH / 2)

      const padding = Math.round(fW * 0.10)
      const pW = fW - padding * 2
      const divider = Math.round(fH * 0.48)  // divider between upper and lower panels

      const upperH = divider - padding * 2
      const lowerH = fH - divider - padding

      const baseFrame = { fill: '', stroke: '', strokeWidth: 1.5, rotation: 0, closed: true }

      return [
        // 1. Marco exterior
        {
          ...baseFrame, moduleType: 'marco' as ModuleType, shapeType: 'rect' as const,
          x: fx, y: fy, width: fW, height: fH,
        },
        // 2. Panel superior con arco
        {
          ...baseFrame, moduleType: 'panel' as ModuleType, shapeType: 'bezier' as const,
          x: fx + padding, y: fy + padding,
          nodes: scaleNodes(archNodes01, pW, upperH),
        },
        // 3. Panel inferior rectangular
        {
          ...baseFrame, moduleType: 'panel' as ModuleType, shapeType: 'rect' as const,
          x: fx + padding, y: fy + divider,
          width: pW, height: lowerH,
        },
      ]
    }

    default:
      return []
  }
}

// ─── Template list for UI ──────────────────────────────────────────────────────
export const DOOR_TEMPLATES: DoorTemplate[] = [
  {
    id: 'rect-panel',
    label: 'Panel recto',
    icon: 'M2 2 H38 V28 H2 Z',
  },
  {
    id: 'arch-panel',
    label: 'Panel arco',
    icon: 'M2 28 L2 11 Q2 2 20 2 Q38 2 38 11 L38 28 Z',
  },
  {
    id: 'cathedral-arch',
    label: 'Arco catedral',
    icon: 'M2 28 L2 14 Q2 2 20 2 Q38 2 38 14 L38 28 Z',
  },
  {
    id: 'gothic-arch',
    label: 'Arco gótico',
    icon: 'M2 27 L2 15 C2 2 20 2 20 2 C20 2 38 2 38 15 L38 27 Z',
  },
  {
    id: 'full-door',
    label: 'Puerta completa',
    icon: 'M1 1 H39 V29 H1 Z M4 4 H36 V14 Q36 4 20 4 Q4 4 4 14 Z M4 17 H36 V26 H4 Z',
    multiShape: true,
  },
]
