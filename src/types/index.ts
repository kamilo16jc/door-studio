// ─── Módulos del SVG ──────────────────────────────────────────────────────────
export type ModuleType = 'marco' | 'panel'

export type ZoneTipo = 'madera' | 'vidrio' | 'moldura' | 'metal' | 'pintura'

export type FinishType = 'mate' | 'satinado' | 'brillante'

export type TextureStatus = 'original' | 'processing' | 'ready' | 'error'

export type Tool = 'select' | 'rect' | 'square' | 'ellipse' | 'circle' | 'line' | 'arrow' | 'pen' | 'triangle' | 'diamond' | 'polygon' | 'freehand' | 'curve' | 'delete'

export type AppModule = 'tracer' | 'zones' | 'textures' | 'realism' | 'preview' | 'export'

// ─── Formas trazadas ──────────────────────────────────────────────────────────
export interface TracedShape {
  id: string
  moduleType: ModuleType
  shapeType: 'rect' | 'ellipse' | 'line' | 'polygon' | 'freehand' | 'curve'
  x: number
  y: number
  width?: number
  height?: number
  radiusX?: number
  radiusY?: number
  points?: number[]
  fill: string
  stroke: string
  strokeWidth: number
  closed?: boolean
  rotation?: number
}

// ─── Zonas del panel ──────────────────────────────────────────────────────────
export interface Zone {
  id: string
  shapeId: string
  tipo: ZoneTipo
  textureId?: string
  label: string
}

// ─── Texturas ─────────────────────────────────────────────────────────────────
export interface Texture {
  id: string
  name: string
  tipo: ZoneTipo
  originalUrl: string
  hdUrl?: string
  status: TextureStatus
  scale: number
  rotation: number
  opacity: number
  brightness: number
  contrast: number
  createdAt: number
}

// ─── Configuración de realismo ────────────────────────────────────────────────
export interface RealismSettings {
  lightAngle: number
  lightIntensity: number
  shadowDepth: number
  moldureDepth: number
  finish: FinishType
  ambientOcclusion: number
  glassOpacity: number
  glassBlur: number
  glassReflection: number
}

// ─── Proyecto completo ────────────────────────────────────────────────────────
export interface DoorProject {
  id: string
  name: string
  photoBackground?: string
  photoOpacity: number
  canvasWidth: number
  canvasHeight: number
  shapes: TracedShape[]
  zones: Zone[]
  textures: Texture[]
  realism: RealismSettings
  createdAt: number
  updatedAt: number
}
