import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { subDays, parseISO, isAfter, isBefore, isEqual, startOfDay, endOfDay, format } from 'date-fns'
import api from '../nps-module/plugins/axios'
import { useProgressStore } from './progress'
import { useLoadingStore } from './loading'

export interface FeedbackData {
  user_id: string;
  score: number;
  reason: string;
  created_at: string;
  company_id: string;
  role: string;
  _uid?: string;
  user_name: string;
  company_name: string;
}

const CACHE_KEY = 'nps_feedback_data'
const CACHE_TIMESTAMP_KEY = 'nps_feedback_last_update'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 horas em millisegundos

const getLastThreeMonthsDates = () => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setMonth(today.getMonth() - 3)
  startDate.setDate(1)
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  }
}

const getQuarterDates = (quarterIndex: number) => {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setMonth(today.getMonth() - (quarterIndex * 3))
  
  const startDate = new Date(endDate)
  startDate.setMonth(endDate.getMonth() - 3)
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  }
}

export const useFeedbackStore = defineStore('feedback', () => {
  const feedbackData = ref<FeedbackData[]>([])
  const filteredData = ref<FeedbackData[]>([])
  const isLoading = ref(false)
  const isDataLoaded = ref(false)
  const progressStore = useProgressStore()
  const loadingStore = useLoadingStore()
  const lastFetchDate = ref<string | null>(null)
  
  // Definir filtros padrão (3 meses)
  const defaultFilters = {
    period: 'quarter', // 3 meses
    roles: [] as string[],
    scores: [] as number[],
    startDate: null as Date | null,
    endDate: null as Date | null
  }

  // Modificar para salvar os filtros no localStorage também
  const FILTERS_CACHE_KEY = 'nps_feedback_filters'

  // Carregar filtros salvos ou usar padrão
  const loadSavedFilters = () => {
    try {
      const savedFilters = localStorage.getItem(FILTERS_CACHE_KEY)
      if (savedFilters) {
        return JSON.parse(savedFilters)
      }
    } catch (error) {
      console.error('Erro ao carregar filtros:', error)
    }
    return defaultFilters
  }

  // Inicializar com filtros salvos ou padrão
  const currentFilters = ref(loadSavedFilters())

  const generateUID = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
  }

  // Função para salvar no cache com data da última atualização
  const saveToCache = (data: FeedbackData[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      localStorage.setItem('last_fetch_date', format(new Date(), 'yyyy-MM-dd'))
    } catch (error) {
      console.error('Erro ao salvar cache:', error)
    }
  }

  // Função para carregar dados do cache
  const loadFromCache = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY)
      const lastFetch = localStorage.getItem('last_fetch_date')
      
      if (cachedData) {
        feedbackData.value = JSON.parse(cachedData)
        lastFetchDate.value = lastFetch
        return { hasCache: true, lastFetch }
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error)
    }
    return { hasCache: false, lastFetch: null }
  }

  // Função para buscar apenas dados novos
  const fetchNewData = async () => {
    try {
      const today = new Date()
      const startDate = lastFetchDate.value 
        ? parseISO(lastFetchDate.value)
        : subDays(today, 365) // Se não tiver cache, busca último ano

      const response = await api.get('/nps', {
        params: {
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(today, 'yyyy-MM-dd'),
          per_page: 10000
        }
      })

      const newData = response.data.data || response.data

      // Mesclar dados novos com existentes
      if (Array.isArray(newData) && newData.length > 0) {
        const existingIds = new Set(feedbackData.value.map(item => item._uid))
        const uniqueNewData = newData.filter(item => !existingIds.has(item._uid))

        if (uniqueNewData.length > 0) {
          feedbackData.value = [...uniqueNewData, ...feedbackData.value]
          saveToCache(feedbackData.value)
          console.log(`${uniqueNewData.length} novos registros adicionados`)
        }
      }

      return true
    } catch (error) {
      console.error('Erro ao buscar dados novos:', error)
      return false
    }
  }

  // Função principal de inicialização
  const initializeData = async () => {
    const { hasCache } = loadFromCache()

    if (!hasCache) {
      // Primeira vez: mostrar loading e buscar dados completos
      loadingStore.startLoading()
      await fetchNewData()
      loadingStore.finishLoading()
    } else {
      // Tem cache: buscar silenciosamente apenas dados novos
      fetchNewData()
    }
  }

  const totalResponses = computed(() => feedbackData.value.length)
  
  const npsScore = computed(() => {
    if (feedbackData.value.length === 0) return 0
    
    const promoters = feedbackData.value.filter(f => f.score >= 9).length
    const detractors = feedbackData.value.filter(f => f.score <= 6).length
    const total = feedbackData.value.length
    
    return Math.round(((promoters - detractors) / total) * 100)
  })

  // Adicionar computed properties para cálculos pesados
  const npsScoreByRole = computed(() => {
    const cache: Record<string, number> = {}
    return (role: string) => {
      if (cache[role]) return cache[role]
      
      const filtered = filteredData.value.filter(f => f.role === role)
      const total = filtered.length
      if (total === 0) return 0
      
      const promoters = filtered.filter(f => f.score >= 9).length
      const detractors = filtered.filter(f => f.score <= 6).length
      const nps = Math.round(((promoters - detractors) / total) * 100)
      
      cache[role] = nps
      return nps
    }
  })

  // Otimizar filterFeedback mantendo a funcionalidade de períodos
  const filterFeedback = (
    period: string,
    roles: string[],
    scores: number[],
    startDate: Date | null = null,
    endDate: Date | null = null
  ) => {
    // Atualizar filtros atuais
    const newFilters = {
      period,
      roles: [...roles],
      scores: [...scores],
      startDate,
      endDate
    }
    
    currentFilters.value = newFilters
    
    // Salvar filtros no localStorage
    try {
      localStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(newFilters))
    } catch (error) {
      console.error('Erro ao salvar filtros:', error)
    }

    if (!feedbackData.value.length) return

    // Usar Set para busca mais rápida
    const rolesSet = new Set(roles)
    const scoresSet = new Set(scores)

    filteredData.value = feedbackData.value.filter(item => {
      const date = parseISO(item.created_at)
      const matchesRole = roles.length === 0 || rolesSet.has(item.role)
      const matchesScore = scores.length === 0 || scoresSet.has(item.score)
      
      // Otimizar verificação de datas
      let matchesDate = true
      const today = new Date()

      if (period === 'custom' && startDate && endDate) {
        matchesDate = isAfter(date, startOfDay(startDate)) && 
                     isBefore(date, endOfDay(endDate))
      } else {
        switch (period) {
          case 'today':
            matchesDate = isAfter(date, subDays(today, 1))
            break
          case 'week':
            matchesDate = isAfter(date, subDays(today, 7))
            break
          case 'month':
            matchesDate = isAfter(date, subDays(today, 30))
            break
          case 'quarter':
            matchesDate = isAfter(date, subDays(today, 90))
            break
          case 'year':
            matchesDate = isAfter(date, subDays(today, 365))
            break
          case 'all':
          default:
            matchesDate = true
            break
        }
      }

      return matchesRole && matchesScore && matchesDate
    })

    // Limpar cache de computações quando os filtros mudam
    computedCache.clear()
  }

  const getCurrentFilters = () => currentFilters.value

  // Função para atualizar apenas dados novos
  const updateWithNewData = (newData: FeedbackData[]) => {
    const existingIds = new Set(feedbackData.value.map(item => item._uid))
    const newItems = newData.filter(item => !existingIds.has(item._uid))
    
    if (newItems.length > 0) {
      feedbackData.value = [...newItems, ...feedbackData.value]
      saveToCache(feedbackData.value)
    }
  }

  // Função para carregar dados com suporte a cache
  const fetchData = async () => {
    // Verificar cache primeiro, sem mostrar loading
    const { hasCache, lastFetch } = loadFromCache()
    if (hasCache && lastFetch && !isCacheExpired(new Date(lastFetch))) {
      return // Se tiver cache válido, retorna silenciosamente
    }

    try {
      // Só inicia o loading se precisar fazer a requisição
      loadingStore.startLoading()
      isLoading.value = true
      loadingStore.updateProgress(10)

      let allData: any[] = []

      // Buscar dados de cada trimestre (4 trimestres = 1 ano)
      for (let quarter = 0; quarter < 4; quarter++) {
        const dates = getQuarterDates(quarter)
        
        const response = await api.get('/nps', {
          params: {
            start_date: dates.start,
            end_date: dates.end,
            per_page: 10000,
            page: 1
          }
        })

        const dados = response.data.data || response.data
        if (Array.isArray(dados)) {
          allData = [...allData, ...dados]
        }

        loadingStore.updateProgress(25 + (quarter * 20))
      }

      // Processar todos os dados coletados
      if (allData.length > 0) {
        const processedData = allData.map(item => ({
          user_id: item.user_id,
          score: Number(item.score),
          reason: item.Motivo || '-',
          created_at: item['Criado em'],
          company_id: item.company_id,
          role: item.Função?.toLowerCase() === 'gestor' ? 'manager' : 
                item.Função?.toLowerCase() === 'supervisor' ? 'supervisor' : 'agent',
          _uid: item.user_id.toString(),
          user_name: item.user_name,
          company_name: item.company_name
        }))

        feedbackData.value = processedData
        filteredData.value = processedData
        isDataLoaded.value = true
        saveToCache(processedData)
        applyCurrentFilters()
      }

      loadingStore.updateProgress(100)
      loadingStore.finishLoading()

    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      const { hasCache } = loadFromCache()
      if (!hasCache) {
        feedbackData.value = []
        filteredData.value = []
      }
      loadingStore.finishLoading()
    } finally {
      isLoading.value = false
    }
  }

  const startAutoUpdate = () => {
    fetchData()
    setInterval(fetchData, 12 * 60 * 60 * 1000)
  }

  // Adicionar função para limpar os dados se necessário
  const clearData = () => {
    feedbackData.value = []
    filteredData.value = []
    isDataLoaded.value = false
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    localStorage.removeItem(FILTERS_CACHE_KEY)
    currentFilters.value = { ...defaultFilters }
  }

  // Função para resetar filtros para o padrão
  const resetFilters = () => {
    filterFeedback(
      defaultFilters.period,
      defaultFilters.roles,
      defaultFilters.scores,
      defaultFilters.startDate,
      defaultFilters.endDate
    )
  }

  // Adicionar função para aplicar filtros atuais
  const applyCurrentFilters = () => {
    if (currentFilters.value) {
      filterFeedback(
        currentFilters.value.period,
        currentFilters.value.roles,
        currentFilters.value.scores,
        currentFilters.value.startDate,
        currentFilters.value.endDate
      )
    }
  }

  // Adicionar debounce para salvar no localStorage
  let saveTimeout: NodeJS.Timeout
  const debouncedSaveToCache = (data: FeedbackData[]) => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveToCache(data)
    }, 1000)
  }

  // Cache para computações pesadas
  const computedCache = new Map()
  
  // Memoização para cálculos frequentes
  const memoize = (key: string, fn: Function) => {
    if (!computedCache.has(key)) {
      computedCache.set(key, fn())
    }
    return computedCache.get(key)
  }

  // Limpar cache quando os dados mudam
  watch(() => feedbackData.value, () => {
    computedCache.clear()
  })

  // Otimizar cálculos de NPS com memoização
  const calculateNPS = (data: FeedbackData[]) => {
    return memoize(`nps-${data.length}`, () => {
      const promoters = data.filter(f => f.score >= 9).length
      const detractors = data.filter(f => f.score <= 6).length
      return Math.round(((promoters - detractors) / data.length) * 100)
    })
  }

  // Lazy loading dos dados
  const loadData = async () => {
    const { hasCache } = loadFromCache()
    if (!hasCache) {
      await fetchData()
    }
  }

  // Otimizar filterFeedback com índices
  const createIndexes = (data: FeedbackData[]) => {
    return memoize('indexes', () => ({
      byRole: data.reduce((acc, item) => {
        (acc[item.role] = acc[item.role] || []).push(item)
        return acc
      }, {} as Record<string, FeedbackData[]>),
      byScore: data.reduce((acc, item) => {
        (acc[item.score] = acc[item.score] || []).push(item)
        return acc
      }, {} as Record<number, FeedbackData[]>)
    }))
  }

  // Verificar se o cache está expirado
  const isCacheExpired = (lastUpdate: Date) => {
    return Date.now() - lastUpdate.getTime() > CACHE_DURATION
  }

  // Ajustar a função addFeedbackData para incluir todos os campos necessários
  const addFeedbackData = (data: any[]) => {
    const dataWithUID = data.map(item => ({
      user_id: String(item.user_id || ''),
      score: Number(item.score) || 0,
      reason: String(item.reason || '-'),
      created_at: String(item.created_at || new Date().toISOString()),
      company_id: String(item.company_id || ''),
      role: String(item.role || 'agent'),
      user_name: String(item.user_name || ''),
      company_name: String(item.company_name || ''),
      _uid: generateUID()
    }))
    
    // Mesclar com dados existentes evitando duplicatas
    const existingIds = new Set(feedbackData.value.map(item => item._uid))
    const uniqueNewData = dataWithUID.filter(item => !existingIds.has(item._uid))
    
    if (uniqueNewData.length > 0) {
      feedbackData.value = [...uniqueNewData, ...feedbackData.value]
      filteredData.value = feedbackData.value
      isDataLoaded.value = true
      saveToCache(feedbackData.value)
    }
  }

  return {
    feedbackData,
    filteredData,
    isLoading,
    isDataLoaded,
    addFeedbackData,
    filterFeedback,
    getCurrentFilters,
    totalResponses,
    npsScore,
    fetchData,
    startAutoUpdate,
    clearData,
    resetFilters,
    defaultFilters,
    currentFilters,
    applyCurrentFilters,
    npsScoreByRole,
    debouncedSaveToCache,
    loadData,
    createIndexes,
    loadFromCache,
    initializeData
  }
})