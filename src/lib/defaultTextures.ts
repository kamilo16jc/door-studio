import { Texture } from '../types'
import { v4 as uuidv4 } from 'uuid'

// ─── Parámetros de cada fintura ───────────────────────────────────────────────
interface WoodDef {
  name: string
  // Color claro (zonas de luz del veteado)
  lr: number; lg: number; lb: number
  // Color oscuro (vetas)
  dr: number; dg: number; db: number
  // Frecuencia X (ancho del veteado), Y (densidad vertical)
  fx: number; fy: number
  seed: number
  octaves?: number
}

const WOODS: WoodDef[] = [
  // ── ALDER ────────────────────────────────────────────────────────────────────
  { name: 'Alder Acero',
    lr:228, lg:218, lb:202,  dr:182, dg:168, db:148,  fx:.007, fy:.30, seed:1 },
  { name: 'Alder Chiaro',
    lr:155, lg:105, lb: 62,  dr:108, dg: 68, db: 33,  fx:.005, fy:.20, seed:2 },
  { name: 'Alder Scuro',
    lr:132, lg: 76, lb: 30,  dr: 86, dg: 44, db: 14,  fx:.006, fy:.22, seed:3 },

  // ── CAFFÈ ────────────────────────────────────────────────────────────────────
  { name: 'Caffè Toulipier 002',
    lr: 58, lg: 34, lb: 22,  dr: 22, dg: 10, db:  8,  fx:.008, fy:.36, seed:4 },
  { name: 'Caffè Toulipier 011',
    lr: 62, lg: 36, lb: 24,  dr: 26, dg: 12, db:  8,  fx:.007, fy:.34, seed:5 },

  // ── CASTAGNO ─────────────────────────────────────────────────────────────────
  { name: 'Castagno Antico',
    lr:214, lg:208, lb:200,  dr:152, dg:146, db:138,  fx:.006, fy:.26, seed:6 },
  { name: 'Castagno Base Opaco',
    lr:196, lg:142, lb: 60,  dr:136, dg: 88, db: 22,  fx:.008, fy:.25, seed:7 },
  { name: 'Castagno Base',
    lr:192, lg:130, lb: 42,  dr:120, dg: 74, db: 16,  fx:.010, fy:.30, seed:8 },
  { name: 'Castagno Grigio Topo',
    lr:182, lg:174, lb:162,  dr:138, dg:130, db:118,  fx:.006, fy:.28, seed:9 },
  { name: 'Castagno Invecchiato Extra',
    lr:138, lg: 78, lb: 38,  dr: 86, dg: 44, db: 18,  fx:.009, fy:.23, seed:10 },
  { name: 'Castagno Scuro',
    lr: 94, lg: 50, lb: 22,  dr: 52, dg: 24, db:  8,  fx:.007, fy:.25, seed:11 },
  { name: 'Castagno Vissuto',
    lr:148, lg: 96, lb: 48,  dr: 94, dg: 56, db: 22,  fx:.010, fy:.24, seed:12, octaves:5 },

  // ── FAGGIO ───────────────────────────────────────────────────────────────────
  { name: 'Faggio Base',
    lr:218, lg:188, lb:144,  dr:174, dg:144, db:100,  fx:.006, fy:.22, seed:13 },

  // ── GRIGIO ───────────────────────────────────────────────────────────────────
  { name: 'Grigio Bianco Pino',
    lr:226, lg:222, lb:216,  dr:186, dg:182, db:176,  fx:.006, fy:.30, seed:14 },
  { name: 'Grigio Nero Pino',
    lr: 82, lg: 80, lb: 76,  dr: 32, dg: 30, db: 28,  fx:.006, fy:.28, seed:15, octaves:5 },
  { name: 'Grigio Rovere 008',
    lr:156, lg:152, lb:146,  dr:110, dg:106, db:100,  fx:.008, fy:.24, seed:16 },
  { name: 'Grigio Toulipier 006',
    lr:148, lg:142, lb:136,  dr:102, dg: 96, db: 90,  fx:.007, fy:.26, seed:17 },

  // ── NATURALE ─────────────────────────────────────────────────────────────────
  { name: 'Naturale Rovere 006',
    lr:196, lg:148, lb: 64,  dr:142, dg: 98, db: 28,  fx:.009, fy:.26, seed:18 },

  // ── PINO ─────────────────────────────────────────────────────────────────────
  { name: 'Pino Base',
    lr:158, lg:106, lb: 54,  dr:104, dg: 64, db: 22,  fx:.007, fy:.28, seed:19 },
  { name: 'Pino Ciliegio',
    lr:188, lg:116, lb: 52,  dr:134, dg: 72, db: 20,  fx:.008, fy:.26, seed:20 },
  { name: 'Pino Invecchiato Extra Opaco',
    lr:142, lg:106, lb: 60,  dr: 88, dg: 60, db: 26,  fx:.008, fy:.24, seed:21 },
  { name: 'Pino Miele',
    lr:212, lg:164, lb: 72,  dr:156, dg:110, db: 28,  fx:.008, fy:.26, seed:22 },
  { name: 'Pino Palissandro',
    lr: 46, lg: 26, lb: 14,  dr: 18, dg:  8, db:  6,  fx:.005, fy:.20, seed:23, octaves:5 },
  { name: 'Pino Spazzolato Anticato',
    lr:168, lg:158, lb:144,  dr:118, dg:108, db: 94,  fx:.004, fy:.35, seed:24, octaves:3 },
  { name: 'Pino Superbianco',
    lr:244, lg:242, lb:238,  dr:212, dg:208, db:202,  fx:.005, fy:.32, seed:25 },
  { name: 'Pino Verde Tabacco',
    lr: 58, lg: 62, lb: 22,  dr: 26, dg: 30, db:  8,  fx:.007, fy:.28, seed:26 },
  { name: 'Pino Blue Night',
    lr: 60, lg: 70, lb: 84,  dr: 32, dg: 40, db: 56,  fx:.006, fy:.30, seed:27 },

  // ── ROVERE ───────────────────────────────────────────────────────────────────
  { name: 'Rovere Base',
    lr:196, lg:140, lb: 56,  dr:138, dg: 90, db: 22,  fx:.009, fy:.26, seed:28 },
  { name: 'Rovere Naturale Opaco',
    lr:176, lg:122, lb: 48,  dr:120, dg: 76, db: 18,  fx:.009, fy:.25, seed:29 },
  { name: 'Rovere Naturale',
    lr:182, lg:124, lb: 52,  dr:128, dg: 80, db: 20,  fx:.009, fy:.25, seed:30 },
  { name: 'Rovere Scuro',
    lr:106, lg: 62, lb: 22,  dr: 58, dg: 30, db:  8,  fx:.008, fy:.24, seed:31 },

  // ── SBIANCATO ────────────────────────────────────────────────────────────────
  { name: 'Sbiancato Rovere',
    lr:216, lg:200, lb:182,  dr:172, dg:154, db:136,  fx:.007, fy:.26, seed:32 },

  // ── SCURO ────────────────────────────────────────────────────────────────────
  { name: 'Scuro Castagno',
    lr: 72, lg: 40, lb: 16,  dr: 30, dg: 14, db:  6,  fx:.007, fy:.26, seed:33 },

  // ── TOULIPIER ────────────────────────────────────────────────────────────────
  { name: 'Toulipier Acero',
    lr:220, lg:208, lb:190,  dr:182, dg:170, db:150,  fx:.007, fy:.28, seed:34 },
  { name: 'Toulipier Base con Sfumatura',
    lr:118, lg: 72, lb: 32,  dr: 72, dg: 40, db: 14,  fx:.007, fy:.24, seed:35 },
  { name: 'Toulipier Base',
    lr:118, lg: 72, lb: 32,  dr: 70, dg: 38, db: 12,  fx:.006, fy:.22, seed:36 },
  { name: 'Toulipier Ciliegio',
    lr:182, lg:110, lb: 48,  dr:126, dg: 66, db: 18,  fx:.008, fy:.26, seed:37 },
  { name: 'Toulipier Invecchiato Extra Opaco',
    lr:126, lg: 78, lb: 36,  dr: 76, dg: 42, db: 16,  fx:.009, fy:.23, seed:38 },
  { name: 'Toulipier Invecchiato Extra',
    lr:132, lg: 82, lb: 38,  dr: 80, dg: 46, db: 18,  fx:.009, fy:.23, seed:39 },
  { name: 'Toulipier Laccato Anticato',
    lr:236, lg:228, lb:214,  dr:198, dg:190, db:174,  fx:.005, fy:.20, seed:40 },
  { name: 'Toulipier Laccato Pennellato',
    lr:232, lg:224, lb:210,  dr:194, dg:186, db:170,  fx:.004, fy:.18, seed:41, octaves:3 },
  { name: 'Toulipier Laccato Screpolato',
    lr:228, lg:220, lb:206,  dr:186, dg:178, db:162,  fx:.012, fy:.12, seed:42, octaves:5 },
  { name: 'Toulipier Mogano',
    lr:148, lg: 30, lb: 22,  dr: 90, dg: 12, db:  8,  fx:.007, fy:.26, seed:43 },
  { name: 'Toulipier Spazzolato Anticato',
    lr:174, lg:164, lb:150,  dr:124, dg:114, db:100,  fx:.004, fy:.34, seed:44, octaves:3 },
  { name: 'Toulipier Superbianco',
    lr:244, lg:242, lb:240,  dr:214, dg:210, db:206,  fx:.005, fy:.32, seed:45 },

  // ── WENGÉ ────────────────────────────────────────────────────────────────────
  { name: 'Wengé Rovere',
    lr: 42, lg: 24, lb: 14,  dr: 16, dg:  6, db:  4,  fx:.006, fy:.36, seed:46 },
  { name: 'Wengé Toulipier',
    lr: 38, lg: 20, lb: 12,  dr: 14, dg:  4, db:  2,  fx:.005, fy:.38, seed:47 },
]

// ─── Genera SVG data URI para una fintura ────────────────────────────────────
function makeWoodURI(d: WoodDef): string {
  const sR = ((d.lr - d.dr) / 255).toFixed(4)
  const sG = ((d.lg - d.dg) / 255).toFixed(4)
  const sB = ((d.lb - d.db) / 255).toFixed(4)
  const iR = (d.dr / 255).toFixed(4)
  const iG = (d.dg / 255).toFixed(4)
  const iB = (d.db / 255).toFixed(4)
  const oct = d.octaves ?? 4

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +
    `<defs><filter id="w" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${d.fx} ${d.fy}" numOctaves="${oct}" seed="${d.seed}" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="${sR} 0 0 0 ${iR} ${sG} 0 0 0 ${iG} ${sB} 0 0 0 ${iB} 0 0 0 0 1"/>` +
    `</filter></defs>` +
    `<rect width="512" height="512" filter="url(#w)"/>` +
    `</svg>`

  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

// ─── Exporta las 47 texturas listas para el store ────────────────────────────
export function buildDefaultTextures(): Texture[] {
  return WOODS.map((d) => ({
    id:          uuidv4(),
    name:        d.name,
    tipo:        'madera' as const,
    originalUrl: makeWoodURI(d),
    status:      'ready'  as const,
    scale:       1,
    rotation:    0,
    opacity:     1,
    brightness:  1,
    contrast:    1,
    createdAt:   0,
  }))
}
