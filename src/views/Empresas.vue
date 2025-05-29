<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import { subMonths, isAfter, parseISO } from 'date-fns'
import { XMarkIcon } from '@heroicons/vue/24/outline'

interface FeedbackData {
  user_id: string
  score: number
  reason: string
  created_at: string
  company_id: string
  company_name: string
  role: string
  _uid?: string
}

interface ComplaintCount {
  texto: string
  score: number
  role: string
  data: string
  count: number
}

interface RoleStats {
  total: number
  nps: number
  reclamacoes: string[]
}

interface Empresa {
  company_id: string
  nome: string
  maiorReclamacao: string
  maiorReclamacaoCompleta: string
  nps: number
  totalAvaliacoes: number
  feedbacks: FeedbackData[]
  detalhes: {
    avaliacoesNegativas: ComplaintCount[]
    roleBreakdown: Record<string, RoleStats>
    notasClicadas: {
      score: number
      reason: string
      role: string
      created_at: string
      company_id: string
      user_id: string
    }[]
  }
}

interface UserComplaint {
  count: number
  role: string
  complaints: string[]
}

// Definir uma interface para o tipo de feedback
interface Feedback {
  score: number;
  reason: string;
  created_at: string;
  user_id: string;
  company_id: string;
  role: string;
  [key: string]: any; // Para outras propriedades que possam existir
}

const feedbackStore = useFeedbackStore()
const searchQuery = ref('')
const showDetailsModal = ref(false)
const empresasAnalisadas = ref<Empresa[]>([])
const selectedEmpresaDetails = ref<Empresa | null>(null)

// Usar os filtros atuais do store
const currentFilters = computed(() => feedbackStore.currentFilters)

// Adicionar no início do script
const sortOrder = ref<'asc' | 'desc'>('asc')
const sortField = ref('nps')

// Função para ordenar empresas
const sortEmpresas = (empresas: Empresa[]) => {
  return [...empresas].sort((a, b) => {
    if (sortField.value === 'nps') {
      // Ordenar por NPS
      const comparison = sortOrder.value === 'asc' ? a.nps - b.nps : b.nps - a.nps
      // Em caso de empate, ordenar por total de avaliações
      if (comparison === 0) {
        return b.totalAvaliacoes - a.totalAvaliacoes
      }
      return comparison
    }
    return 0
  })
}

// Função para categorizar reclamações
const categorizarReclamacao = (texto: string): string => {
  if (!texto || texto.length < 3) return 'N/A'

  const categorias = {
    'Problemas com Suporte': ['suporte', 'atendimento', 'demora'],
    'Instabilidade do Sistema': ['instabilidade', 'erro', 'bug'],
    'Problemas de Conexão': ['conexão', 'internet', 'offline'],
    'Qualidade do Serviço': ['qualidade', 'ruim', 'insatisfeito']
  }

  for (const [categoria, palavrasChave] of Object.entries(categorias)) {
    if (palavrasChave.some(palavra => texto.includes(palavra))) {
      return categoria
    }
  }

  return 'Outros'
}

// Função para verificar se um texto é válido (não é apenas caracteres repetidos ou sem sentido)
const isValidText = (text: string): boolean => {
  if (!text || text.trim().length < 3) return false;
  
  // Verifica se é uma sequência repetida do mesmo caractere (ex: "xxxxxxxx" ou "........")
  const repeatedChar = /^(.)\1+$/;
  if (repeatedChar.test(text.trim()) && text.trim().length > 10) return false;
  
  // Verifica se é uma sequência de caracteres sem sentido (maioria não alfabética)
  const nonAlphaCount = (text.match(/[^a-zA-Z0-9áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ ,.!?()-]/g) || []).length;
  if (nonAlphaCount > text.length * 0.7) return false;
  
  return true;
}

// Função para preparar dados para análise
const prepareDataForAnalysis = () => {
  // Usar dados filtrados se disponíveis, senão usar dados dos últimos 3 meses
  const sourceData = feedbackStore.filteredData.length > 0 
    ? feedbackStore.filteredData 
    : feedbackStore.feedbackData

  // Agrupar feedbacks por empresa usando os dados filtrados
  const feedbacksByCompany = sourceData
    .reduce((acc, feedback) => {
      const id = feedback.company_id
      if (!acc[id]) {
        acc[id] = []
      }
      acc[id].push(feedback)
      return acc
    }, {} as Record<string, FeedbackData[]>)

  // Processar cada empresa usando os dados filtrados
  empresasAnalisadas.value = Object.entries(feedbacksByCompany)
    .map(([companyId, feedbacks]): Empresa | null => {
      const bestName = feedbacks[0]?.company_name || ''
      if (!bestName) return null

      // Aplicar filtros de cargo se existirem
      const filteredFeedbacks = feedbacks.filter(f => {
        if (currentFilters.value.roles.length > 0) {
          return currentFilters.value.roles.includes(f.role)
        }
        return true
      })

      // Se não houver feedbacks após filtro, retornar null
      if (filteredFeedbacks.length === 0) return null

      const total = filteredFeedbacks.length
      const promotores = filteredFeedbacks.filter(f => f.score >= 9).length
      const detratores = filteredFeedbacks.filter(f => f.score <= 6).length
      const nps = Math.round(((promotores - detratores) / total) * 100)

      const reclamacoes = filteredFeedbacks
        .filter(f => f.score <= 6 && f.reason?.trim())
        .reduce((acc, f) => {
          const texto = f.reason.trim()
          if (!acc[texto]) {
            acc[texto] = { count: 0, texto, score: f.score, role: f.role, data: f.created_at }
          }
          acc[texto].count++
          return acc
        }, {} as Record<string, ComplaintCount>)

      const reclamacoesSorted = Object.values(reclamacoes).sort((a, b) => b.count - a.count)

      return {
        company_id: companyId,
        nome: bestName,
        feedbacks: filteredFeedbacks, // Usar feedbacks filtrados
        maiorReclamacao: reclamacoesSorted.length > 0 ? categorizarReclamacao(reclamacoesSorted[0].texto) : 'Sem reclamações',
        maiorReclamacaoCompleta: reclamacoesSorted[0]?.texto || '',
        totalAvaliacoes: total,
        nps,
        detalhes: {
          avaliacoesNegativas: reclamacoesSorted,
          roleBreakdown: processRoleBreakdown(filteredFeedbacks),
          notasClicadas: filteredFeedbacks.map(f => ({
            score: f.score,
            reason: f.reason,
            role: f.role,
            created_at: f.created_at,
            company_id: f.company_id,
            user_id: f.user_id
          }))
        }
      } as Empresa
    })
    .filter((empresa): empresa is Empresa => empresa !== null)
    // Ordenar primeiro por NPS (do menor para o maior)
    // Em caso de empate no NPS, ordenar por quantidade de avaliações (do maior para o menor)
    .sort((a, b) => {
      if (a.nps === b.nps) {
        return b.totalAvaliacoes - a.totalAvaliacoes
      }
      return a.nps - b.nps
    })

  console.log('Total de empresas listadas:', empresasAnalisadas.value.length)
  console.log('Total de feedbacks processados:', sourceData.length)
}

// Função para calcular NPS por função
const calculateRoleNPS = (roleFeedbacks: FeedbackData[]): number => {
  if (roleFeedbacks.length === 0) return 0
  const promoters = roleFeedbacks.filter(f => f.score >= 9).length
  const detractors = roleFeedbacks.filter(f => f.score <= 6).length
  return Math.round(((promoters - detractors) / roleFeedbacks.length) * 100)
}

// Função para processar os dados por função
const processRoleBreakdown = (feedbacks: FeedbackData[]): Record<string, RoleStats> => {
  // Agrupar por função
  const roles = [...new Set(feedbacks.map(f => f.role))]
  
  const breakdown: Record<string, RoleStats> = {}
  
  // Para cada função, calcular estatísticas
  roles.forEach(role => {
    const roleFeedbacks = feedbacks.filter(f => f.role === role)
    breakdown[role] = {
      total: roleFeedbacks.length,
      nps: calculateRoleNPS(roleFeedbacks),
      reclamacoes: roleFeedbacks
        .filter(f => f.score <= 6 && f.reason)
        .map(f => f.reason)
    }
  })
  
  // Renomear as chaves para os termos em português
  const translatedBreakdown: Record<string, RoleStats> = {}
  Object.entries(breakdown).forEach(([role, stats]) => {
    const translatedRole = 
      role === 'agent' ? 'agente' : 
      role === 'manager' ? 'gestor' : 
      role === 'supervisor' ? 'supervisor' : role;
    
    translatedBreakdown[translatedRole] = stats;
  });
  
  return translatedBreakdown;
}

// Função para truncar texto
const truncateText = (text: string, limit: number = 50) => {
  if (!text) return ''
  return text.length > limit ? text.substring(0, limit) + '...' : text
}

// Substituir o processamento em chunks por uma versão funcional
const processEmpresas = (data: FeedbackData[]) => {
  const fourMonthsAgo = subMonths(new Date(), 4)
  const empresasMap = new Map<string, {
    feedbacks: FeedbackData[],
    empresa: Empresa | null
  }>()

  // Primeiro passo: agrupar feedbacks por empresa
  data.forEach(feedback => {
    if (!isAfter(parseISO(feedback.created_at), fourMonthsAgo)) return
    if (!feedback.company_name) return
    if (feedback.company_name === 'Empresa sem nome') return
    if (feedback.company_name.toLowerCase().includes('seller')) return

    const key = feedback.company_id
    if (!empresasMap.has(key)) {
      empresasMap.set(key, {
        feedbacks: [],
        empresa: null
      })
    }
    empresasMap.get(key)?.feedbacks.push(feedback)
  })

  // Segundo passo: processar cada empresa
  const empresas = Array.from(empresasMap.entries()).map(([companyId, data]): Empresa | null => {
    const feedbacks = data.feedbacks
    if (feedbacks.length < 5) return null // Ignorar empresas com menos de 5 feedbacks

    // Pegar o nome mais recente da empresa
    const bestName = feedbacks
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      ?.company_name || ''

    // Calcular métricas
    const total = feedbacks.length
    const promotores = feedbacks.filter(f => f.score >= 9).length
    const detratores = feedbacks.filter(f => f.score <= 6).length
    const nps = Math.round(((promotores - detratores) / total) * 100)

    // Processar reclamações
    const reclamacoes = feedbacks
      .filter(f => f.score <= 6 && f.reason?.trim())
      .reduce((acc, f) => {
        const texto = f.reason.trim()
        if (!acc[texto]) {
          acc[texto] = { count: 0, texto, score: f.score, role: f.role, data: f.created_at }
        }
        acc[texto].count++
        return acc
      }, {} as Record<string, ComplaintCount>)

    const reclamacoesSorted = Object.values(reclamacoes)
      .sort((a, b) => b.count - a.count)

    return {
      company_id: companyId,
      nome: bestName,
      feedbacks,
      maiorReclamacao: reclamacoesSorted.length > 0 
        ? categorizarReclamacao(reclamacoesSorted[0].texto)
        : 'Sem reclamações',
      maiorReclamacaoCompleta: reclamacoesSorted[0]?.texto || '',
      totalAvaliacoes: total,
      nps,
      detalhes: {
        avaliacoesNegativas: reclamacoesSorted,
        roleBreakdown: processRoleBreakdown(feedbacks)
      }
    }
  }).filter((empresa): empresa is Empresa => empresa !== null)
    .sort((a, b) => a.nps - b.nps)

  return empresas
}

// Cache de resultados processados
const processedResultsCache = new Map()

// Computed otimizado com cache
const processedEmpresas = computed(() => {
  const cacheKey = JSON.stringify({
    data: feedbackStore.filteredData.length,
    filters: feedbackStore.currentFilters
  })

  if (processedResultsCache.has(cacheKey)) {
    return processedResultsCache.get(cacheKey)
  }

  const result = processEmpresas(feedbackStore.filteredData.length > 0 
    ? feedbackStore.filteredData 
    : feedbackStore.feedbackData)
  processedResultsCache.set(cacheKey, result)
  return result
})

// Atualizar o computed empresasFiltradas
const empresasFiltradas = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  const empresas = query 
    ? empresasAnalisadas.value.filter((empresa: Empresa) => {
        return (
          empresa.nome.toLowerCase().includes(query) ||
          empresa.company_id.toString().includes(query) ||
          empresa.maiorReclamacao.toLowerCase().includes(query) ||
          empresa.nps.toString().includes(query) ||
          empresa.detalhes?.avaliacoesNegativas.some((av: ComplaintCount) => 
            av.texto.toLowerCase().includes(query)
          )
        )
      })
    : empresasAnalisadas.value

  return sortEmpresas(empresas)
})

const showPlainData = (empresa: any) => {
  // Filtrar feedbacks negativos com razões válidas
  return feedbackStore.feedbackData
    .filter((f: Feedback) => f.score <= 6 && f.reason && f.reason.trim().length > 5)
    .map((f: Feedback) => ({
      texto: f.reason,
      score: f.score,
      role: f.role,
      data: f.created_at,
      count: 1
    }));
};

const handleVerDetalhes = (empresa: Empresa) => {
  selectedEmpresaDetails.value = empresa
  
  // Buscar todos os feedbacks da empresa, incluindo as notas
  const allCompanyFeedbacks = feedbackStore.feedbackData.filter(f => 
    f.company_id === empresa.company_id && 
    isAfter(parseISO(f.created_at), subMonths(new Date(), 4))
  )

  // Processar notas clicadas
  const notasClicadas = allCompanyFeedbacks
    .filter(f => f.score)
    .map(f => ({
      score: f.score,
      reason: f.reason || '',
      role: f.role,
      created_at: f.created_at,
      company_id: f.company_id,
      user_id: f.user_id
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Atualizar detalhes da empresa
  empresa.detalhes = empresa.detalhes || {
    avaliacoesNegativas: [],
    roleBreakdown: {},
    notasClicadas: []
  }

  empresa.detalhes.notasClicadas = notasClicadas

  // Processar reclamações negativas
  if (!empresa.detalhes.avaliacoesNegativas?.length) {
    const reclamacoes = allCompanyFeedbacks
      .filter(f => f.score <= 6 && f.reason && f.reason.trim().length > 3)
      .map(f => ({
        texto: f.reason,
        score: f.score,
        role: f.role,
        data: f.created_at,
        count: 1
      }))

    if (reclamacoes.length > 0) {
      empresa.detalhes.avaliacoesNegativas = reclamacoes
    }
  }

  // Ordenar avaliações negativas
  if (empresa.detalhes.avaliacoesNegativas) {
    empresa.detalhes.avaliacoesNegativas.sort((a, b) => (b.count || 1) - (a.count || 1))
  }

  showDetailsModal.value = true
}

// Função corrigida para agregar reclamações
const aggregateComplaints = (complaints: string[]): string[] => {
  const acc: Record<string, number> = {}
  complaints.forEach(complaint => {
    acc[complaint] = (acc[complaint] || 0) + 1
  })

  return Object.entries(acc)
    .sort(([, a], [, b]) => b - a)
    .map(([complaint, count]) => `${complaint} (${count} vezes)`)
}

// Função corrigida para processar reclamações
const processComplaints = (feedbacks: FeedbackData[]): ComplaintCount[] => {
  const complaintsMap = new Map<string, ComplaintCount>()
  
  feedbacks.forEach(feedback => {
    if (feedback.score <= 6 && feedback.reason) {
      const key = feedback.reason
      if (!complaintsMap.has(key)) {
        complaintsMap.set(key, {
          texto: feedback.reason,
          score: feedback.score,
          role: feedback.role,
          data: feedback.created_at,
          count: 0
        })
      }
      const complaint = complaintsMap.get(key)!
      complaint.count++
    }
  })

  return Array.from(complaintsMap.values())
    .sort((a, b) => b.count - a.count)
}

// Função corrigida para análise de usuários
const analyzeUsers = (feedbacks: FeedbackData[]): Map<string, UserComplaint> => {
  const userComplaints = new Map<string, UserComplaint>()

  feedbacks.forEach(feedback => {
    if (feedback.score <= 6) {
      if (!userComplaints.has(feedback.user_id)) {
        userComplaints.set(feedback.user_id, {
          count: 0,
          role: feedback.role,
          complaints: []
        })
      }
      const user = userComplaints.get(feedback.user_id)!
      user.count++
      if (feedback.reason) {
        user.complaints.push(feedback.reason)
      }
    }
  })

  return userComplaints
}

// Atualizar a função countNotesByScore
const countNotesByScore = (companyId: string, score: number): number => {
  if (!companyId) return 0;
  
  // Pegar a empresa dos dados analisados
  const empresa = empresasAnalisadas.value.find(e => e.company_id === companyId);
  if (!empresa) return 0;

  // Contar as notas usando os feedbacks da empresa
  return empresa.feedbacks.filter(f => f.score === score).length;
}

// Atualizar a função hasAnyScores
const hasAnyScores = (companyId: string): boolean => {
  if (!companyId) return false;
  
  // Pegar a empresa dos dados analisados
  const empresa = empresasAnalisadas.value.find(e => e.company_id === companyId);
  if (!empresa) return false;

  // Verificar se tem alguma nota
  return empresa.feedbacks.length > 0;
}

// Computed properties para calcular os tipos de empresas
const empresasPromotoras = computed(() => {
  return empresasAnalisadas.value.filter(empresa => empresa.nps >= 50).length
})

const empresasNeutras = computed(() => {
  return empresasAnalisadas.value.filter(empresa => empresa.nps >= 0 && empresa.nps < 50).length
})

const empresasDetratoras = computed(() => {
  return empresasAnalisadas.value.filter(empresa => empresa.nps < 0).length
})

// Atualizar os watches e onMounted
onMounted(() => {
  prepareDataForAnalysis()
})

// Atualizar o watch para processar os dados quando os filtros mudarem
watch([
  () => feedbackStore.filteredData,
  () => currentFilters.value
], () => {
  prepareDataForAnalysis()
}, { deep: true })

// Simplificar o watch do searchQuery
watch(searchQuery, (newValue) => {
  // Apenas sanitizar a entrada
  if (newValue) {
    searchQuery.value = newValue.replace(/[^\w\sÀ-ÿ]/gi, '').slice(0, 50)
  }
})

// Função para contar os clicks por nota
const getNotasClicadas = (empresa: Empresa | null) => {
  if (!empresa?.feedbacks) return [];
  
  // Criar um mapa para contar as ocorrências de cada nota
  const notasMap = empresa.feedbacks.reduce((acc, feedback) => {
    acc[feedback.score] = (acc[feedback.score] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  // Converter para array e ordenar
  return Object.entries(notasMap)
    .map(([score, count]) => ({
      score: Number(score),
      count
    }))
    .sort((a, b) => a.score - b.score);
}

// Função para alternar ordenação
const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}
</script>

<template>
  <div>
    <!-- Card de Tipos de Empresas -->
    <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)] mb-6">
      <!-- Cabeçalho com título -->
      <div class="px-6 pt-4 pb-3">
        <h2 class="text-lg font-medium text-[#373753]">NPS das empresas</h2>
      </div>

      <!-- Divider -->
      <div class="h-px bg-[#E1E9F4]"></div>

      <!-- Conteúdo do card -->
      <div class="px-6 py-4">
        <div class="flex items-center justify-between">
          <!-- Promotores -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">😊</span>
              <p class="text-[18px] font-normal text-[#677C92]">Promotores</p>
            </div>
            <p class="text-2xl font-medium text-emerald-500">
              {{ empresasPromotoras }}
            </p>
          </div>

          <!-- Neutros -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">😐</span>
              <p class="text-[18px] font-normal text-[#677C92]">Neutros</p>
            </div>
            <p class="text-2xl font-medium text-yellow-500">
              {{ empresasNeutras }}
            </p>
          </div>

          <!-- Detratores -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg" style="color: #EF4444">😡</span>
              <p class="text-[18px] font-normal text-[#677C92]">Detratores</p>
            </div>
            <p class="text-2xl font-medium text-red-500">
              {{ empresasDetratoras }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela com borda -->
    <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
      <!-- Cabeçalho com busca -->
      <div class="px-6 py-4 flex justify-between items-center">
        <div class="flex items-center gap-2 flex-1">
          <div class="relative flex-1">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Buscar empresas"
              class="w-full px-4 py-2 pl-10 pr-4 text-gray-700 bg-transparent focus:outline-none"
            />
            <svg 
              class="absolute left-0 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Divisor -->
      <div class="h-px bg-[#E1E9F4]"></div>

      <!-- Tabela -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                EMPRESA
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MAIOR RECLAMAÇÃO
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                TOTAL AVALIAÇÕES
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                @click="toggleSort"
              >
                NPS
                <span class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="empresa in empresasFiltradas" 
                :key="empresa.company_id" 
                class="hover:bg-gray-50 group">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ empresa.company_id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" :title="empresa.nome">
                {{ empresa.nome?.length > 30 ? empresa.nome.substring(0, 30) + '...' : empresa.nome }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ empresa.maiorReclamacao }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ empresa.totalAvaliacoes }}</td>
              <td class="px-6 py-4 whitespace-nowrap flex items-center justify-between">
                <span :class="{
                  'px-2 py-1 text-xs font-medium rounded-full': true,
                  'bg-red-100 text-red-800': empresa.nps < 0,
                  'bg-yellow-100 text-yellow-800': empresa.nps >= 0 && empresa.nps < 50,
                  'bg-green-100 text-green-800': empresa.nps >= 50
                }">
                  {{ empresa.nps }}% NPS
                </span>
                <button
                  @click.stop="handleVerDetalhes(empresa)"
                  class="ml-4 px-3 py-1 border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  Ver Detalhes
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal de Detalhes -->
  <div v-if="showDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)] max-w-4xl w-full max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center px-6 py-4 border-b border-[#E1E9F4]">
        <h2 class="text-lg font-medium text-[#373753]">Detalhes da Empresa {{ selectedEmpresaDetails?.nome }}</h2>
        <button @click="showDetailsModal = false" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Conteúdo do Modal -->
      <div class="overflow-y-auto">
        <div class="space-y-6 px-6 py-6">
          <div>
            <!-- Métricas Principais -->
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-white p-4 rounded-lg border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
                <div class="flex items-center gap-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_22074_34972)">
                      <path d="M15.1781 1.63112C13.3875 1.12018 11.5172 2.15612 11.0063 3.94675L10.7391 4.88425C10.5656 5.49362 10.2516 6.05612 9.825 6.52487L7.42031 9.16862C7.00313 9.628 7.03594 10.3405 7.49531 10.7577C7.95469 11.1749 8.66719 11.1421 9.08438 10.6827L11.4891 8.03893C12.15 7.31237 12.6328 6.44518 12.9 5.503L13.1672 4.5655C13.3359 3.97018 13.9594 3.62331 14.5594 3.79206C15.1594 3.96081 15.5016 4.58425 15.3328 5.18425L15.0656 6.12175C14.7984 7.05456 14.3766 7.93581 13.8187 8.72331C13.575 9.0655 13.5469 9.5155 13.7391 9.8905C13.9313 10.2655 14.3156 10.4999 14.7375 10.4999H21C21.4125 10.4999 21.75 10.8374 21.75 11.2499C21.75 11.5686 21.5484 11.8452 21.2625 11.953C20.9156 12.0842 20.6531 12.3749 20.5641 12.7358C20.475 13.0967 20.5688 13.4764 20.8125 13.753C20.9297 13.8842 21 14.0577 21 14.2499C21 14.6155 20.7375 14.9202 20.3906 14.9858C20.0063 15.0608 19.6828 15.328 19.5469 15.6983C19.4109 16.0686 19.4719 16.4811 19.7156 16.7905C19.8141 16.9171 19.875 17.0764 19.875 17.2546C19.875 17.5686 19.6781 17.8452 19.3969 17.953C18.8578 18.1639 18.5672 18.7452 18.7219 19.303C18.7406 19.3639 18.75 19.4342 18.75 19.5046C18.75 19.9171 18.4125 20.2546 18 20.2546H13.4297C12.8391 20.2546 12.2578 20.0811 11.7656 19.753L8.87344 17.8264C8.35781 17.4796 7.65938 17.6202 7.3125 18.1405C6.96562 18.6608 7.10625 19.3546 7.62656 19.7014L10.5187 21.628C11.3812 22.2046 12.3937 22.5092 13.4297 22.5092H18C19.6266 22.5092 20.9484 21.2155 21 19.603C21.6844 19.0546 22.125 18.2108 22.125 17.2592C22.125 17.0483 22.1016 16.8467 22.0641 16.6499C22.7859 16.1014 23.25 15.2342 23.25 14.2592C23.25 13.9546 23.2031 13.6592 23.1188 13.3827C23.6625 12.8296 24 12.0796 24 11.2499C24 9.59518 22.6594 8.24987 21 8.24987H16.6734C16.8938 7.76237 17.0813 7.25612 17.2266 6.7405L17.4938 5.803C18.0047 4.01237 16.9687 2.14206 15.1781 1.63112ZM1.5 8.99987C0.670312 8.99987 0 9.67018 0 10.4999V20.9999C0 21.8296 0.670312 22.4999 1.5 22.4999H4.5C5.32969 22.4999 6 21.8296 6 20.9999V10.4999C6 9.67018 5.32969 8.99987 4.5 8.99987H1.5Z" fill="#3057F2"/>
                    </g>
                  </svg>
                  <h3 class="text-sm font-medium text-[#677C92]">NPS</h3>
                </div>
                <p class="mt-1 text-2xl font-medium" :class="{
                  'text-red-600': (selectedEmpresaDetails?.nps ?? 0) < 0,
                  'text-yellow-600': (selectedEmpresaDetails?.nps ?? 0) >= 0 && (selectedEmpresaDetails?.nps ?? 0) < 50,
                  'text-green-600': (selectedEmpresaDetails?.nps ?? 0) >= 50
                }">
                  {{ selectedEmpresaDetails?.nps ?? 'N/A' }}%
                </p>
              </div>
              <div class="bg-white p-4 rounded-lg border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
                <div class="flex items-center gap-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 10.5H2.25V16.5C2.25 19.4016 4.59844 21.75 7.5 21.75H10.5C13.4016 21.75 15.75 19.4016 15.75 16.5V10.5H9ZM18 8.25V9.375V10.5V16.5C18 20.6438 14.6438 24 10.5 24H7.5C3.35625 24 0 20.6438 0 16.5V10.5V9.375V8.25V7.5C0 3.35625 3.35625 0 7.5 0H7.875H9H10.125H10.5C14.6438 0 18 3.35625 18 7.5V8.25ZM10.125 2.25V8.25H15.75V7.5C15.75 4.59844 13.4016 2.25 10.5 2.25H10.125ZM7.875 2.25H7.5C4.59844 2.25 2.25 4.59844 2.25 7.5V8.25H7.875V2.25Z" fill="#3057F2"/>
                  </svg>
                  <h3 class="text-sm font-medium text-[#677C92]">Notas clicadas</h3>
                </div>
                <div class="mt-3">
                  <div v-if="!selectedEmpresaDetails?.feedbacks?.length" class="text-center text-gray-500 py-2">
                    Nenhuma nota registrada
                  </div>
                  
                  <div v-else class="flex flex-wrap gap-2">
                    <template v-for="nota in getNotasClicadas(selectedEmpresaDetails)" :key="nota.score">
                      <div class="flex flex-col items-center">
                        <!-- Número da nota em azul -->
                        <div class="text-xs font-medium px-2 py-1 rounded-md bg-blue-50 text-blue-700 mb-0.5">
                          {{ nota.score }}
                        </div>
                        <!-- Contagem com cor baseada no tipo de nota -->
                        <div class="text-xs font-medium px-1.5 py-0.5 rounded-full"
                             :class="{
                               'bg-red-100 text-red-800': nota.score <= 6,
                               'bg-yellow-100 text-yellow-800': nota.score === 7 || nota.score === 8,
                               'bg-green-100 text-green-800': nota.score >= 9
                             }">
                          {{ nota.count }}
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div class="bg-white p-4 rounded-lg border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
                <div class="flex items-center gap-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_22074_34974)">
                      <path d="M11.6437 3.95156C11.7187 3.825 11.8547 3.75 12 3.75C12.1453 3.75 12.2813 3.825 12.3563 3.95156L21.6516 19.2188C21.7172 19.3266 21.75 19.4484 21.75 19.5703C21.75 19.9453 21.4453 20.25 21.0703 20.25H2.92969C2.55469 20.25 2.25 19.9453 2.25 19.5703C2.25 19.4437 2.28281 19.3219 2.34844 19.2188L11.6437 3.95156ZM9.72187 2.77969L0.426563 18.0469C0.145313 18.5063 0 19.0312 0 19.5703C0 21.1875 1.3125 22.5 2.92969 22.5H21.0703C22.6875 22.5 24 21.1875 24 19.5703C24 19.0312 23.85 18.5063 23.5734 18.0469L14.2781 2.77969C13.7953 1.9875 12.9328 1.5 12 1.5C11.0672 1.5 10.2047 1.9875 9.72187 2.77969ZM13.5 17.25C13.5 16.8522 13.342 16.4706 13.0607 16.1893C12.7794 15.908 12.3978 15.75 12 15.75C11.6022 15.75 11.2206 15.908 10.9393 16.1893C10.658 16.4706 10.5 16.8522 10.5 17.25C10.5 17.6478 10.658 18.0294 10.9393 18.3107C11.2206 18.592 11.6022 18.75 12 18.75C12.3978 18.75 12.7794 18.592 13.0607 18.3107C13.342 18.0294 13.5 17.6478 13.5 17.25ZM13.125 8.625C13.125 8.00156 12.6234 7.5 12 7.5C11.3766 7.5 10.875 8.00156 10.875 8.625V13.125C10.875 13.7484 11.3766 14.25 12 14.25C12.6234 14.25 13.125 13.7484 13.125 13.125V8.625Z" fill="#3057F2"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_22074_34974">
                        <rect width="24" height="24" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                  <h3 class="text-sm font-medium text-[#677C92]">Principal Reclamação</h3>
                </div>
                <p class="mt-1 text-sm font-medium text-[#373753] line-clamp-3">
                  {{ selectedEmpresaDetails?.maiorReclamacaoCompleta }}
                </p>
              </div>
            </div>
          </div>

          <!-- Reclamações Frequentes -->
          <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
            <div class="px-6 pt-4">
              <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium text-[#373753]">Reclamações relevantes</h3>
                <span class="text-sm text-gray-500">
                  Total: {{ selectedEmpresaDetails?.detalhes?.avaliacoesNegativas?.length || 0 }} Reclamações
                </span>
              </div>
            </div>
            <div class="border-b border-[#E1E9F4] mt-4"></div>
            <div class="p-6">
              <div v-if="selectedEmpresaDetails?.detalhes?.avaliacoesNegativas?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="(reclamacao, index) in selectedEmpresaDetails.detalhes.avaliacoesNegativas" 
                     :key="index"
                     class="p-3 bg-white border border-[#E1E9F4] rounded-lg flex flex-col">
                  <div class="flex justify-between text-xs mb-2">
                    <span class="text-sm font-medium text-[#373753]">{{ 
                      reclamacao.role === 'agent' ? 'Agente' : 
                      reclamacao.role === 'manager' ? 'Gestor' : 
                      reclamacao.role === 'supervisor' ? 'Supervisor' :
                      reclamacao.role.charAt(0).toUpperCase() + reclamacao.role.slice(1) 
                    }}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full"
                          :class="{
                            'bg-red-100 text-red-800': reclamacao.score <= 6,
                            'bg-yellow-100 text-yellow-800': reclamacao.score === 7 || reclamacao.score === 8,
                            'bg-green-100 text-green-800': reclamacao.score >= 9
                          }">
                      Nota {{ reclamacao.score }}
                    </span>
                  </div>
                  <p class="text-sm text-[#677C92]">{{ reclamacao.texto }}</p>
                </div>
              </div>
              <div v-else class="p-6 text-center text-gray-500">
                <p>Não há reclamações registradas para esta empresa.</p>
              </div>
            </div>
          </div>

          <!-- Plano de Ação -->
          <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
            <div class="px-6 pt-4">
              <h3 class="text-lg font-medium text-[#373753]">Plano de Ação</h3>
            </div>
            <div class="border-b border-[#E1E9F4] mt-4"></div>
            <div class="p-6 prose max-w-none whitespace-pre-line text-sm text-gray-700">
              <p>{{ selectedEmpresaDetails?.planoAcao }}</p>
              <div class="p-3 bg-blue-50 text-blue-700 rounded-md flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Em breve você poderá gerar um <strong>plano de ação com IA</strong> 😉</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilos base */
:deep(.max-h-90vh) {
  max-height: 90vh;
}

:deep(.overflow-y-auto) {
  overflow-y: auto;
}

.complaint-card {
  @apply bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r mb-2;
}

/* Estilos de sombra */
.card-shadow {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.modal-shadow {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style> 