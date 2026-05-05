import { create } from 'zustand'
import { Texture, ZoneTipo } from '../types'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { buildDefaultTextures } from '../lib/defaultTextures'

interface TextureState {
  textures: Texture[]
  selectedTextureId: string | null
  isProcessing: boolean

  // Actions
  addTexture: (texture: Omit<Texture, 'id' | 'createdAt'>) => string
  updateTexture: (id: string, updates: Partial<Texture>) => void
  deleteTexture: (id: string) => void
  selectTexture: (id: string | null) => void
  uploadAndUpscale: (file: File, tipo: ZoneTipo) => Promise<void>
  uploadAndEnhance: (file: File, tipo: ZoneTipo) => Promise<void>
  generateTexture: (prompt: string, tipo: ZoneTipo, name: string) => Promise<void>
  getTexturesByTipo: (tipo: ZoneTipo) => Texture[]
}

export const useTextureStore = create<TextureState>((set, get) => ({
  textures: buildDefaultTextures(),
  selectedTextureId: null,
  isProcessing: false,

  addTexture: (texture) => {
    const id = uuidv4()
    const newTexture: Texture = {
      ...texture,
      id,
      createdAt: Date.now()
    }
    set((state) => ({ textures: [...state.textures, newTexture] }))
    return id
  },

  updateTexture: (id, updates) =>
    set((state) => ({
      textures: state.textures.map((t) => (t.id === id ? { ...t, ...updates } : t))
    })),

  deleteTexture: (id) =>
    set((state) => ({
      textures: state.textures.filter((t) => t.id !== id),
      selectedTextureId: state.selectedTextureId === id ? null : state.selectedTextureId
    })),

  selectTexture: (id) => set({ selectedTextureId: id }),

  // Subir textura y hacer upscale 4x con Real-ESRGAN
  uploadAndUpscale: async (file, tipo) => {
    set({ isProcessing: true })
    const originalUrl = URL.createObjectURL(file)
    const id = get().addTexture({
      name: file.name.replace(/\.[^.]+$/, ''),
      tipo,
      originalUrl,
      status: 'processing',
      scale: 1,
      rotation: 0,
      opacity: 1,
      brightness: 1,
      contrast: 1
    })

    try {
      const formData = new FormData()
      formData.append('texture', file)
      const res = await axios.post('/api/texture/upscale', formData)
      get().updateTexture(id, { hdUrl: res.data.hdUrl, status: 'ready' })
    } catch (err) {
      get().updateTexture(id, { status: 'error' })
      console.error('Error upscaling:', err)
    } finally {
      set({ isProcessing: false })
    }
  },

  // Subir textura y mejorar con img2img (mantiene estilo)
  uploadAndEnhance: async (file, tipo) => {
    set({ isProcessing: true })
    const originalUrl = URL.createObjectURL(file)
    const id = get().addTexture({
      name: file.name.replace(/\.[^.]+$/, ''),
      tipo,
      originalUrl,
      status: 'processing',
      scale: 1,
      rotation: 0,
      opacity: 1,
      brightness: 1,
      contrast: 1
    })

    try {
      const formData = new FormData()
      formData.append('texture', file)
      formData.append('tipo', tipo)
      const res = await axios.post('/api/texture/enhance', formData)
      get().updateTexture(id, { hdUrl: res.data.hdUrl, status: 'ready' })
    } catch (err) {
      get().updateTexture(id, { status: 'error' })
      console.error('Error enhancing:', err)
    } finally {
      set({ isProcessing: false })
    }
  },

  // Generar textura nueva desde descripción de texto
  generateTexture: async (prompt, tipo, name) => {
    set({ isProcessing: true })
    const id = get().addTexture({
      name,
      tipo,
      originalUrl: '',
      status: 'processing',
      scale: 1,
      rotation: 0,
      opacity: 1,
      brightness: 1,
      contrast: 1
    })

    try {
      const res = await axios.post('/api/texture/generate', { prompt, tipo })
      get().updateTexture(id, { hdUrl: res.data.hdUrl, originalUrl: res.data.hdUrl, status: 'ready' })
    } catch (err) {
      get().updateTexture(id, { status: 'error' })
      console.error('Error generating:', err)
    } finally {
      set({ isProcessing: false })
    }
  },

  getTexturesByTipo: (tipo) => get().textures.filter((t) => t.tipo === tipo)
}))
