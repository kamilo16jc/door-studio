import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Zone, ZoneTipo } from '../types'
import { v4 as uuidv4 } from 'uuid'

const ZONE_COLORS: Record<ZoneTipo, string> = {
  madera: '#8B5E3C',
  vidrio: '#7EB8D4',
  moldura: '#A0856C',
  metal: '#8C9BAB',
  pintura: '#C4A882'
}

const ZONE_LABELS: Record<ZoneTipo, string> = {
  madera: 'Madera',
  vidrio: 'Vidrio',
  moldura: 'Moldura',
  metal: 'Metal',
  pintura: 'Pintura'
}

interface ZoneState {
  zones: Zone[]
  selectedZoneId: string | null
  activeZoneTipo: ZoneTipo

  // Actions
  addZone: (shapeId: string) => string
  updateZone: (id: string, updates: Partial<Zone>) => void
  deleteZone: (id: string) => void
  selectZone: (id: string | null) => void
  setActiveZoneTipo: (tipo: ZoneTipo) => void
  assignTexture: (zoneId: string, textureId: string) => void
  getZoneColor: (tipo: ZoneTipo) => string
  getZoneLabel: (tipo: ZoneTipo) => string
  getZoneByShapeId: (shapeId: string) => Zone | undefined
}

export const useZoneStore = create<ZoneState>()(persist((set, get) => ({
  zones: [],
  selectedZoneId: null,
  activeZoneTipo: 'madera',

  addZone: (shapeId) => {
    const { activeZoneTipo, zones } = get()
    // Reemplaza si ya existe una zona para esa forma
    const existing = zones.find((z) => z.shapeId === shapeId)
    if (existing) {
      set((state) => ({
        zones: state.zones.map((z) =>
          z.shapeId === shapeId
            ? { ...z, tipo: activeZoneTipo, label: ZONE_LABELS[activeZoneTipo] }
            : z
        )
      }))
      return existing.id
    }
    const id = uuidv4()
    const zone: Zone = {
      id,
      shapeId,
      tipo: activeZoneTipo,
      label: ZONE_LABELS[activeZoneTipo]
    }
    set((state) => ({ zones: [...state.zones, zone] }))
    return id
  },

  updateZone: (id, updates) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === id ? { ...z, ...updates } : z))
    })),

  deleteZone: (id) =>
    set((state) => ({
      zones: state.zones.filter((z) => z.id !== id),
      selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId
    })),

  selectZone: (id) => set({ selectedZoneId: id }),
  setActiveZoneTipo: (tipo) => set({ activeZoneTipo: tipo }),

  assignTexture: (zoneId, textureId) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === zoneId ? { ...z, textureId } : z))
    })),

  getZoneColor: (tipo) => ZONE_COLORS[tipo],
  getZoneLabel: (tipo) => ZONE_LABELS[tipo],
  getZoneByShapeId: (shapeId) => get().zones.find((z) => z.shapeId === shapeId)
}), {
  name: 'door-studio-zones',
  partialize: (state) => ({ zones: state.zones })
}))
