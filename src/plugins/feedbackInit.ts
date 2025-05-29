import { useFeedbackStore } from '../stores/feedback'

export const initializeFeedback = async () => {
  const feedbackStore = useFeedbackStore()
  
  // Tentar carregar do cache primeiro
  const { hasCache } = feedbackStore.loadFromCache()
  
  // Sempre fazer o fetch para garantir dados atualizados
  try {
    await feedbackStore.fetchData()
  } catch (error) {
    console.error('Erro ao inicializar dados:', error)
  }

  return hasCache
} 