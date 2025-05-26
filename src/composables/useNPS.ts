import { ref, computed } from 'vue'
import type { NPSData } from '@/types'
import { calculateNPS } from '@/utils'

export function useNPS() {
  const npsData = ref<NPSData[]>([])
  
  const npsScore = computed(() => {
    const scores = npsData.value.map((d: NPSData) => d.score)
    return calculateNPS(scores)
  })
  
  const loadNPSData = async () => {
    // Lógica para carregar dados
    try {
      // Implementar lógica de carregamento
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    }
  }
  
  return {
    npsData,
    npsScore,
    loadNPSData
  }
} 