import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subDays, parseISO, isAfter, isBefore, isEqual, startOfDay, endOfDay } from 'date-fns'

export interface FeedbackData {
  user_id: string;
  score: number;
  reason: string;
  created_at: string;
  company_id: string;
  role: string;
  _uid?: string;
}

export const useFeedbackStore = defineStore('feedback', () => {
  const feedbackData = ref<FeedbackData[]>([])
  const filteredData = ref<FeedbackData[]>([])
  const isLoading = ref(false)
  
  const currentFilters = ref({
    period: 'all',
    roles: [] as string[],
    scores: [] as number[],
    startDate: null as Date | null,
    endDate: null as Date | null
  })
  
  const generateUID = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
  }

  const addFeedbackData = (data: FeedbackData[]) => {
    const dataWithUID = data.map(item => ({
      ...item,
      _uid: generateUID()
    }))
    
    feedbackData.value = dataWithUID
    filteredData.value = dataWithUID
  }

  const totalResponses = computed(() => feedbackData.value.length)
  
  const npsScore = computed(() => {
    if (feedbackData.value.length === 0) return 0
    
    const promoters = feedbackData.value.filter(f => f.score >= 9).length
    const detractors = feedbackData.value.filter(f => f.score <= 6).length
    const total = feedbackData.value.length
    
    return Math.round(((promoters - detractors) / total) * 100)
  })

  const filterFeedback = (
    period: string, 
    roles: string[], 
    scores: number[],
    startDate: Date | null = null,
    endDate: Date | null = null
  ) => {
    currentFilters.value = {
      period,
      roles: [...roles],
      scores: [...scores],
      startDate,
      endDate
    }
    
    console.log('Aplicando filtros:', { period, roles, scores, startDate, endDate })
    
    let filtered = [...feedbackData.value]
    
    if (period !== 'all') {
      const today = new Date()
      filtered = filtered.filter(item => {
        const date = parseISO(item.created_at)
        
        if (period === 'custom' && startDate && endDate) {
          return isAfter(date, startOfDay(startDate)) && 
                 isBefore(date, endOfDay(endDate))
        }

        switch (period) {
          case 'today':
            return isAfter(date, subDays(today, 1))
          case 'week':
            return isAfter(date, subDays(today, 7))
          case 'month':
            return isAfter(date, subDays(today, 30))
          case 'quarter':
            return isAfter(date, subDays(today, 90))
          case 'year':
            return isAfter(date, subDays(today, 365))
          default:
            return true
        }
      })
    }

    if (roles.length > 0) {
      filtered = filtered.filter(item => roles.includes(item.role))
    }

    if (scores.length > 0) {
      filtered = filtered.filter(item => scores.includes(item.score))
    }

    console.log(`Filtrado: ${filtered.length} itens de ${feedbackData.value.length}`)
    
    filteredData.value = [...filtered]
  }

  const getCurrentFilters = () => currentFilters.value

  return {
    feedbackData,
    filteredData,
    isLoading,
    addFeedbackData,
    filterFeedback,
    getCurrentFilters,
    totalResponses,
    npsScore
  }
})