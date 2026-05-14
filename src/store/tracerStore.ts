import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TracedShape, Tool, ModuleType } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface TracerState {
  shapes: TracedShape[]
  selectedShapeId: string | null      // último seleccionado (compat toolbar)
  selectedShapeIds: string[]           // selección múltiple
  activeTool: Tool
  activeModule: ModuleType
  photoBackground: string | null
  photoOpacity: number
  canvasWidth: number
  canvasHeight: number
  baseWidth: number
  baseHeight: number
  canvasScale: number
  isDrawing: boolean
  drawingPoints: number[]

  // Actions
  setActiveTool: (tool: Tool) => void
  setActiveModule: (module: ModuleType) => void
  setPhotoBackground: (url: string | null) => void
  setPhotoOpacity: (opacity: number) => void
  setCanvasSize: (width: number, height: number) => void
  setCanvasScale: (scale: number) => void
  addShape: (shape: Omit<TracedShape, 'id'>) => string
  updateShape: (id: string, updates: Partial<TracedShape>) => void
  deleteShape: (id: string) => void
  selectShape: (id: string | null) => void
  selectShapes: (ids: string[]) => void
  toggleShapeSelection: (id: string) => void
  setIsDrawing: (drawing: boolean) => void
  setDrawingPoints: (points: number[]) => void
  clearAll: () => void
  // Layer ordering
  moveShapeUp:      (id: string) => void
  moveShapeDown:    (id: string) => void
  moveShapeToFront: (id: string) => void
  moveShapeToBack:  (id: string) => void
  reorderShapes:    (from: number, to: number) => void
}

export const useTracerStore = create<TracerState>()(
  persist(
    (set) => ({
  shapes: [],
  selectedShapeId: null,
  selectedShapeIds: [],
  activeTool: 'select',
  activeModule: 'marco',
  photoBackground: null,
  photoOpacity: 0.5,
  canvasWidth: 800,
  canvasHeight: 600,
  baseWidth: 800,
  baseHeight: 600,
  canvasScale: 1,
  isDrawing: false,
  drawingPoints: [],

  setActiveTool: (tool) => set({ activeTool: tool, isDrawing: false, drawingPoints: [] }),
  setActiveModule: (module) => set({ activeModule: module }),
  setPhotoBackground: (url) => set({ photoBackground: url }),
  setPhotoOpacity: (opacity) => set({ photoOpacity: opacity }),
  setCanvasSize: (width, height) => set({
    canvasWidth: width, canvasHeight: height,
    baseWidth: width, baseHeight: height,
    canvasScale: 1
  }),
  setCanvasScale: (scale) => set((state) => ({
    canvasScale: scale,
    canvasWidth: Math.round(state.baseWidth * scale),
    canvasHeight: Math.round(state.baseHeight * scale)
  })),

  addShape: (shape) => {
    const id = uuidv4()
    set((state) => ({ shapes: [...state.shapes, { ...shape, id }] }))
    return id
  },

  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s))
    })),

  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
      selectedShapeIds: state.selectedShapeIds.filter((sid) => sid !== id)
    })),

  selectShape: (id) => set({
    selectedShapeId: id,
    selectedShapeIds: id ? [id] : []
  }),

  selectShapes: (ids) => set({
    selectedShapeId: ids.length > 0 ? ids[ids.length - 1] : null,
    selectedShapeIds: ids
  }),

  toggleShapeSelection: (id) => set((state) => {
    const already = state.selectedShapeIds.includes(id)
    const newIds = already
      ? state.selectedShapeIds.filter((sid) => sid !== id)
      : [...state.selectedShapeIds, id]
    return {
      selectedShapeIds: newIds,
      selectedShapeId: newIds.length > 0 ? newIds[newIds.length - 1] : null
    }
  }),

  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  setDrawingPoints: (points) => set({ drawingPoints: points }),
  clearAll: () => set({ shapes: [], selectedShapeId: null, selectedShapeIds: [], isDrawing: false, drawingPoints: [] }),

  // Layer ordering — array index = render order (0 = bottom, last = top)
  moveShapeUp: (id) => set((state) => {
    const arr = [...state.shapes]
    const i = arr.findIndex(s => s.id === id)
    if (i < arr.length - 1) { [arr[i], arr[i+1]] = [arr[i+1], arr[i]] }
    return { shapes: arr }
  }),
  moveShapeDown: (id) => set((state) => {
    const arr = [...state.shapes]
    const i = arr.findIndex(s => s.id === id)
    if (i > 0) { [arr[i], arr[i-1]] = [arr[i-1], arr[i]] }
    return { shapes: arr }
  }),
  moveShapeToFront: (id) => set((state) => {
    const arr = [...state.shapes]
    const i = arr.findIndex(s => s.id === id)
    if (i !== -1) { arr.push(arr.splice(i, 1)[0]) }
    return { shapes: arr }
  }),
  moveShapeToBack: (id) => set((state) => {
    const arr = [...state.shapes]
    const i = arr.findIndex(s => s.id === id)
    if (i !== -1) { arr.unshift(arr.splice(i, 1)[0]) }
    return { shapes: arr }
  }),
  reorderShapes: (from, to) => set((state) => {
    const arr = [...state.shapes]
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    return { shapes: arr }
  })
    }),
    {
      name: 'door-studio-tracer',
      storage: createJSONStorage(() => sessionStorage), // sobrevive sleep, se borra al cerrar pestaña
      partialize: (state) => ({
        shapes: state.shapes,
        canvasWidth: state.canvasWidth,
        canvasHeight: state.canvasHeight,
        baseWidth: state.baseWidth,
        baseHeight: state.baseHeight,
        canvasScale: state.canvasScale,
        photoOpacity: state.photoOpacity,
      })
    }
  )
)
