import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import Replicate from 'replicate'
import { v4 as uuidv4 } from 'uuid'
import { generateSVG } from './src/lib/svgExport'
import type { TracedShape, Zone, Texture, RealismSettings, ZoneTipo } from './src/types'

// potrace usa binarios nativos — import lazy para no crashear en Vercel si no está disponible
let _potrace: typeof import('potrace') | null = null
try { _potrace = require('potrace') } catch { _potrace = null }

// Cargar .env si existe
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const app = express()
const PORT = 3001

// Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

// Storage: /tmp en Vercel (efímero), ./uploads en local
const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(process.cwd(), 'uploads')
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  }
})

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// ─── RUTA: Mejorar textura con Real-ESRGAN (upscale HD) ───────────────────────
app.post('/api/texture/upscale', upload.single('texture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const fileBuffer = fs.readFileSync(req.file.path)
    const dataUri = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`
    console.log(`[Replicate] Upscaling: ${req.file.filename} (${Math.round(fileBuffer.length/1024)}KB)`)

    const output = await replicate.run(
      'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee2d96b1c9b524651bf47',
      { input: { image: dataUri, scale: 4, face_enhance: false } }
    )

    fs.unlink(req.file.path, () => {})
    res.json({ success: true, hdUrl: output, originalFile: req.file.filename })
  } catch (err: any) {
    console.error('[Replicate Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Generar textura nueva con IA desde descripción ─────────────────────
app.post('/api/texture/generate', async (req, res) => {
  try {
    const { prompt, tipo } = req.body

    const promptMap: Record<string, string> = {
      madera: `seamless wood texture, ${prompt}, high resolution, photorealistic, 4k, tileable`,
      vidrio: `glass texture, ${prompt}, transparent, realistic reflections, high resolution`,
      metal: `metal texture, ${prompt}, brushed, high resolution, photorealistic, 4k, tileable`,
      pintura: `painted surface texture, ${prompt}, high resolution, photorealistic, 4k, tileable`
    }

    const finalPrompt = promptMap[tipo] || `${prompt}, seamless texture, high resolution, 4k, photorealistic`

    console.log(`[Replicate] Generating texture: ${finalPrompt}`)

    const output = await replicate.run(
      'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      {
        input: {
          prompt: finalPrompt,
          negative_prompt: 'low quality, blurry, distorted, watermark',
          width: 1024,
          height: 1024,
          num_inference_steps: 30,
          guidance_scale: 7.5
        }
      }
    )

    const outputArray = output as string[]
    res.json({ success: true, hdUrl: outputArray[0] })
  } catch (err: any) {
    console.error('[Replicate Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Mejorar textura con img2img (mantiene estilo, mejora calidad) ──────
app.post('/api/texture/enhance', upload.single('texture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const { tipo = 'madera' } = req.body

    const fileBuffer = fs.readFileSync(req.file.path)
    const dataUri = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`

    const promptMap: Record<string, string> = {
      madera: 'seamless wood texture, high resolution, photorealistic, 4k, detailed wood grain',
      vidrio: 'glass texture, transparent, realistic reflections, high resolution',
      metal: 'metal texture, brushed finish, high resolution, photorealistic',
      pintura: 'painted surface, smooth finish, high resolution, uniform color'
    }

    console.log(`[Replicate] Enhancing ${tipo}: ${req.file.filename} (${Math.round(fileBuffer.length/1024)}KB)`)

    const output = await replicate.run(
      'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      {
        input: {
          prompt: promptMap[tipo] || 'seamless texture, high resolution, 4k, photorealistic',
          image: dataUri,
          strength: 0.4,
          negative_prompt: 'low quality, blurry, distorted',
          num_inference_steps: 30
        }
      }
    )

    fs.unlink(req.file.path, () => {})
    const outputArray = output as string[]
    res.json({ success: true, hdUrl: outputArray[0], originalFile: req.file.filename })
  } catch (err: any) {
    console.error('[Replicate Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Auto-trazar puerta con IA (convierte a plano técnico limpio) ───────
app.post('/api/door/blueprint', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    // Leer el archivo y convertir a base64 data URI
    // Replicate no puede acceder a localhost, así que enviamos la imagen directamente
    const filePath = req.file.path
    const fileBuffer = fs.readFileSync(filePath)
    const mimeType = req.file.mimetype || 'image/jpeg'
    const base64 = fileBuffer.toString('base64')
    const dataUri = `data:${mimeType};base64,${base64}`

    console.log(`[Replicate] Enviando imagen como base64 (${Math.round(fileBuffer.length / 1024)}KB)`)

    const output = await replicate.run(
      'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      {
        input: {
          prompt: 'architectural technical blueprint drawing of a door, black thin lines on pure white background, no fill, precise line drawing, CAD style, flat 2D front view, clean edges, no shadows, no texture, minimal',
          negative_prompt: 'colors, texture, photo, realistic, shadow, gradient, background, noise',
          image: dataUri,
          strength: 0.75,
          num_inference_steps: 35,
          guidance_scale: 10
        }
      }
    )

    const outputArray = output as string[]
    console.log(`[Replicate] Plano generado: ${outputArray[0]}`)

    // Limpiar archivo temporal
    fs.unlink(filePath, () => {})

    res.json({ success: true, blueprintUrl: outputArray[0] })
  } catch (err: any) {
    console.error('[Replicate Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: SAM-2 — segmentación automática (meta/sam-2) ──────────────────────
app.post('/api/door/segment', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const fileBuffer = fs.readFileSync(req.file.path)
    const dataUri    = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`

    console.log(`[SAM-2] Segmentando imagen (${Math.round(fileBuffer.length/1024)}KB) en modo automático...`)

    const output = await replicate.run(
      'meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83',
      {
        input: {
          image:                  dataUri,
          points_per_side:        32,    // grilla 32×32 = 1024 puntos → detecta más regiones
          pred_iou_thresh:        0.60,  // umbral bajo → más máscaras candidatas
          stability_score_thresh: 0.75   // umbral bajo → incluye regiones menos estables
        }
      }
    ) as { combined_mask: string; individual_masks: string[] }

    fs.unlink(req.file.path, () => {})

    const masks = output.individual_masks ?? []
    console.log(`[SAM-2] ${masks.length} máscaras individuales generadas`)

    if (!masks.length) return res.status(500).json({ error: 'SAM-2 no devolvió máscaras' })

    res.json({ success: true, masks })
  } catch (err: any) {
    console.error('[SAM-2 Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Potrace — foto → SVG vectorial limpio ─────────────────────────────
app.post('/api/door/trace', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const filePath = req.file.path
    console.log(`[Potrace] Trazando imagen: ${req.file.filename} (${Math.round(req.file.size/1024)}KB)`)

    potrace.trace(filePath, {
      threshold:    128,  // umbral medio → traza bordes oscuros de la puerta
      turdSize:     80,   // ignora manchas pequeñas (ruido)
      alphaMax:     0,    // esquinas afiladas → líneas rectas
      optCurve:     false,// sin curvas Bezier → solo líneas
      optTolerance: 0.2,
      turnPolicy:   'minority' // mejor para imágenes arquitectónicas
    }, (err: Error | null, svg: string) => {
      fs.unlink(filePath, () => {})
      if (err) {
        console.error('[Potrace Error]', err.message)
        return res.status(500).json({ error: err.message })
      }
      console.log(`[Potrace] SVG generado (${Math.round(svg.length/1024)}KB)`)
      res.json({ success: true, svg })
    })
  } catch (err: any) {
    console.error('[Potrace Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Render SVG desde shapes + zonas (motor headless) ──────────────────
//
//  Body esperado:
//  {
//    width:   number,              // ancho del canvas (ej. 800)
//    height:  number,              // alto del canvas (ej. 1200)
//    shapes:  ShapeInput[],        // array de formas (sin id, sin fill/stroke)
//    zones:   ZoneInput[],         // array de zonas por índice de shape
//    textures?: Texture[],         // opcional — texturas a aplicar
//    realism?:  Partial<RealismSettings>  // opcional — ajustes de realismo
//  }
//
//  ShapeInput: { shapeType, moduleType, x, y, width?, height?, archHeight?,
//               chamferSize?, points?, nodes?, closed?, rotation?, svgPath? }
//  ZoneInput:  { shapeIndex: number, tipo: ZoneTipo, label?: string }
//
app.post('/api/render', (req, res) => {
  try {
    const { width = 800, height = 1200, shapes: rawShapes = [], zones: rawZones = [], textures = [], realism: rawRealism = {} } = req.body

    if (!Array.isArray(rawShapes) || rawShapes.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una forma en "shapes"' })
    }

    // Generar IDs para cada shape y completar campos requeridos
    const shapes: TracedShape[] = rawShapes.map((s: any) => ({
      id:          uuidv4(),
      moduleType:  s.moduleType  || 'panel',
      shapeType:   s.shapeType   || 'rect',
      x:           s.x           ?? 0,
      y:           s.y           ?? 0,
      width:       s.width,
      height:      s.height,
      radiusX:     s.radiusX,
      radiusY:     s.radiusY,
      archHeight:  s.archHeight,
      chamferSize: s.chamferSize,
      points:      s.points,
      nodes:       s.nodes,
      closed:      s.closed !== false,
      rotation:    s.rotation    || 0,
      svgPath:     s.svgPath,
      fill:        '#8B5E3C',
      stroke:      '#5C3A1E',
      strokeWidth: 1,
    }))

    // Construir zonas referenciando los IDs generados
    const zones: Zone[] = rawZones
      .filter((z: any) => z.shapeIndex >= 0 && z.shapeIndex < shapes.length)
      .map((z: any) => ({
        id:      uuidv4(),
        shapeId: shapes[z.shapeIndex].id,
        tipo:    (z.tipo || 'madera') as ZoneTipo,
        label:   z.label || z.tipo || 'madera',
      }))

    // Valores por defecto de realismo
    const realism: RealismSettings = {
      lightAngle:       rawRealism.lightAngle       ?? 45,
      lightIntensity:   rawRealism.lightIntensity   ?? 0.7,
      shadowDepth:      rawRealism.shadowDepth      ?? 0.5,
      moldureDepth:     rawRealism.moldureDepth     ?? 0.4,
      finish:           rawRealism.finish           ?? 'satinado',
      ambientOcclusion: rawRealism.ambientOcclusion ?? 0.6,
      glassOpacity:     rawRealism.glassOpacity     ?? 0.15,
      glassBlur:        rawRealism.glassBlur        ?? 4,
      glassReflection:  rawRealism.glassReflection  ?? 0.8,
    }

    const svg = generateSVG({ shapes, zones, textures: textures as Texture[], realism, width, height })

    console.log(`[Render] SVG generado — ${shapes.length} shapes, ${zones.length} zonas, ${Math.round(svg.length / 1024)}KB`)

    res.json({ success: true, svg, shapeCount: shapes.length, zoneCount: zones.length })
  } catch (err: any) {
    console.error('[Render Error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── RUTA: Health check ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    replicate: !!process.env.REPLICATE_API_TOKEN ? 'conectado' : 'sin token'
  })
})

// Solo escucha en local — en Vercel se exporta como serverless function
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚪 Door Studio Server corriendo en http://localhost:${PORT}`)
    console.log(`   Replicate: ${process.env.REPLICATE_API_TOKEN ? '✓ API key detectada' : '✗ Sin API key'}`)
  })
}

export default app
