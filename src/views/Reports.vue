<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import { subDays, format, parseISO } from 'date-fns'
import type { FeedbackData } from '../stores/feedback'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { formatDateTime } from '../utils/dateFormat'
import Papa from 'papaparse'

// Estender o tipo jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const feedbackStore = useFeedbackStore()
const isTableMounted = ref(true) // Alterado para sempre true
const searchQuery = ref('') // Novo estado para o campo de busca

// Interface para ordenação
interface SortConfig {
  field: keyof FeedbackData | null
  direction: 'asc' | 'desc'
}

// Estados locais
const sortConfig = ref<SortConfig>({
  field: null,
  direction: 'asc'
})

// Adicionar estado para controlar o filtro de comentários
const showOnlyWithComments = ref(false)

// Usar os filtros atuais do store
const currentFilters = computed(() => feedbackStore.currentFilters)

// Watch para dados do feedbackStore
watch(() => feedbackStore.feedbackData, (newData) => {
  if (newData.length > 0) {
    isTableMounted.value = true
  }
}, { immediate: true })

const tableData = computed(() => 
  isTableMounted.value ? feedbackStore.filteredData : []
)

// Função modificada para classificar conforme as notas individuais
const getNPSZone = (score: number) => {
  if (score >= 9) return { zone: 'Excelência', color: 'bg-emerald-100 text-emerald-800', textColor: 'text-emerald-800' }
  if (score >= 7) return { zone: 'Melhoria', color: 'bg-yellow-100 text-yellow-800', textColor: 'text-yellow-800' }
  if (score <= 5) return { zone: 'Crítica', color: 'bg-red-100 text-red-800', textColor: 'text-red-800' }
  return { zone: 'Melhoria', color: 'bg-yellow-100 text-yellow-800', textColor: 'text-yellow-800' } // Para nota 6
}

// Função para alternar ordenação
const toggleSort = (field: string) => {
  if (sortConfig.value.field === field) {
    // Se já está ordenando por este campo, inverte a direção
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // Se é um novo campo, define ele como padrão e direção descendente
    sortConfig.value.field = field as keyof FeedbackData
    sortConfig.value.direction = 'desc'
  }
}

// Filtragem baseada na pesquisa
const filteredBySearch = computed(() => {
  if (!searchQuery.value.trim()) return tableData.value
  
  const query = searchQuery.value.toLowerCase().trim()
  return tableData.value.filter(item => {
    return (
      (item.user_name && item.user_name.toLowerCase().includes(query)) ||
      String(item.score).toLowerCase().includes(query) ||
      (item.reason && item.reason.toLowerCase().includes(query)) ||
      String(item.created_at).toLowerCase().includes(query) ||
      (item.company_name && item.company_name.toLowerCase().includes(query)) ||
      (item.role && item.role.toLowerCase().includes(query))
    )
  })
})

// Computed para dados filtrados e ordenados
const sortedData = computed(() => {
  // Começar com uma cópia dos dados do store
  // Usar Set para garantir unicidade dos registros baseado no _uid
  const uniqueData = Array.from(
    new Map(feedbackStore.filteredData.map(item => [item._uid, item])).values()
  )

  // Aplicar filtros locais
  let filteredData = uniqueData.filter(item => {
    // Filtro de comentários
    if (showOnlyWithComments.value) {
      if (!item.reason || item.reason.trim() === '' || item.reason === '-') {
        return false
      }
    }

    // Filtro de busca
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      return (
        (item.user_name?.toLowerCase() || '').includes(query) ||
        String(item.score).includes(query) ||
        (item.reason?.toLowerCase() || '').includes(query) ||
        (item.company_name?.toLowerCase() || '').includes(query) ||
        (item.role?.toLowerCase() || '').includes(query)
      )
    }

    return true
  })

  // Aplicar ordenação
  if (sortConfig.value.field) {
    const { field, direction } = sortConfig.value
    filteredData.sort((a, b) => {
      const valueA = a[field]
      const valueB = b[field]

      // Tratamento especial para datas
      if (field === 'created_at') {
        const dateA = new Date(valueA as string).getTime()
        const dateB = new Date(valueB as string).getTime()
        return direction === 'asc' ? dateA - dateB : dateB - dateA
      }

      // Tratamento para números
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return direction === 'asc' ? valueA - valueB : valueB - valueA
      }

      // Tratamento para strings
      const stringA = String(valueA || '').toLowerCase()
      const stringB = String(valueB || '').toLowerCase()
      return direction === 'asc' 
        ? stringA.localeCompare(stringB)
        : stringB.localeCompare(stringA)
    })
  }

  return filteredData
})

// Adicionar estado para o menu de exportação
const isExportMenuOpen = ref(false)

// Fechar o menu quando clicar fora dele
const closeExportMenu = (event: MouseEvent) => {
  if (isExportMenuOpen.value) {
    isExportMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeExportMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeExportMenu)
})

// Função para formatar dados para download
const formatDataForExport = () => {
  return feedbackStore.filteredData.map(feedback => ({
    'Nome do Agente': feedback.user_name || '-',
    'Empresa': feedback.company_name || '-',
    'Nota': feedback.score,
    'Status': getNPSZone(feedback.score).zone,
    'Comentário': feedback.reason || '-',
    'Data': formatDateTime(feedback.created_at),
    'Função': feedback.role
  }))
}

// Função para exportar CSV
const exportToCSV = () => {
  const data = formatDataForExport()
  const csvContent = Papa.unparse(data)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `relatorio-nps-${formatDateTime(new Date())}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Função para exportar PDF
const exportToPDF = () => {
  const doc = new jsPDF()
  const data = formatDataForExport()

  // Configurar cabeçalho do PDF
  doc.setFontSize(18)
  doc.text('Relatório NPS', 14, 20)
  doc.setFontSize(11)
  doc.text(`Data: ${formatDateTime(new Date())}`, 14, 30)
  doc.text(`Total de registros: ${data.length}`, 14, 40)

  // Configurar colunas da tabela
  const columns = [
    'Nome do Agente',
    'Empresa',
    'Nota',
    'Status',
    'Comentário',
    'Data',
    'Função'
  ]

  // Formatar dados para a tabela do PDF
  const rows = data.map(item => [
    item['Nome do Agente'],
    item['Empresa'],
    item['Nota'],
    item['Status'],
    item['Comentário'],
    item['Data'],
    item['Função']
  ])

  // Gerar tabela
  doc.autoTable({
    startY: 50,
    head: [columns],
    body: rows,
    headStyles: { fillColor: [59, 130, 246] },
    styles: { overflow: 'linebreak' },
    columnStyles: {
      4: { cellWidth: 50 } // Ajustar largura da coluna de comentários
    }
  })

  // Salvar PDF
  doc.save(`relatorio-nps-${formatDateTime(new Date())}.pdf`)
}

// Função para alternar o filtro de comentários
const toggleCommentFilter = () => {
  showOnlyWithComments.value = !showOnlyWithComments.value
}

const resetAllFilters = () => {
  feedbackStore.filterFeedback('all', [], [], null, null)
}

watch(() => tableData.value.length, (newLength, oldLength) => {
  if (newLength === 0 && oldLength > 0) {
    // Se os dados filtrados ficarem vazios, resetar filtros
    console.log('Dados filtrados ficaram vazios. Resetando filtros...')
    resetAllFilters()
  }
})

// Função para obter ícone de ordenação
const getSortIcon = (field: keyof FeedbackData) => {
  if (sortConfig.value.field !== field) return '↕'
  return sortConfig.value.direction === 'asc' ? '↑' : '↓'
}

// Função para ordenação
const handleSort = (field: keyof FeedbackData) => {
  sortConfig.value = {
    field,
    direction: sortConfig.value.field === field && sortConfig.value.direction === 'asc' 
      ? 'desc' 
      : 'asc'
  }
}

// Limpar ordenação quando os filtros do store mudam
watch(() => feedbackStore.filteredData, () => {
  sortConfig.value = {
    field: null,
    direction: 'asc'
  }
}, { deep: true })
</script>

<template>
  <div class="flex-1 bg-[#F9FAFC]">
    <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
      <div class="flex items-center justify-between py-4 px-6">
        <div class="flex items-center gap-2 flex-1">
          <div class="relative flex-1">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Buscar detalhes do NPS"
              class="w-full py-2 pl-10 pr-4 text-gray-700 bg-transparent focus:outline-none"
            />
            <svg 
              class="absolute left-0 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        <!-- Botão para baixar a lista -->
        <div class="relative" v-if="tableData.length > 0">
          <button 
            @click.stop="isExportMenuOpen = !isExportMenuOpen"
            class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar Lista
          </button>
          
          <!-- Menu Dropdown -->
          <div 
            v-if="isExportMenuOpen" 
            class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10"
          >
            <div class="py-1">
              <button 
                @click.stop="exportToCSV"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Exportar como CSV
              </button>
              <button 
                @click.stop="exportToPDF"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Exportar como PDF
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="border-t border-[#E1E9F4]">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-[#F0F4FA]">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
                <th 
                  @click="toggleSort('score')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sortable"
                >
                  <div class="flex items-center">
                    NOTA
                    <span class="sort-icon ml-1">
                      {{ getSortIcon('score') }}
                    </span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div class="flex items-center gap-2">
                    <span>Comentário</span>
                    <div class="flex items-center ml-2">
                      <input 
                        type="checkbox" 
                        id="show-comments-filter" 
                        v-model="showOnlyWithComments"
                        class="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500"
                      >
                      <label for="show-comments-filter" class="ml-2 text-xs font-normal normal-case text-gray-700">
                        Exibir somente com comentários
                      </label>
                    </div>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATA</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMPRESA</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FUNÇÃO</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr 
                v-for="item in sortedData" 
                :key="item._uid" 
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" :title="item.user_name">
                  {{ item.user_name?.length > 30 ? item.user_name.substring(0, 30) + '...' : item.user_name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="getNPSZone(item.score).textColor">{{ item.score }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="[getNPSZone(item.score).color, 'text-xs font-medium px-2.5 py-0.5 rounded-full']">
                    {{ getNPSZone(item.score).zone }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">{{ item.reason }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDateTime(item.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" :title="item.company_name">
                  {{ item.company_name?.length > 30 ? item.company_name.substring(0, 30) + '...' : item.company_name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.role }}</td>
              </tr>
              <tr v-if="sortedData.length === 0">
                <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum resultado encontrado
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background-color: #f5f5f5;
}

.sort-icon {
  margin-left: 5px;
}

/* Remover estilo de borda do input quando em foco */
input:focus {
  outline: none;
  box-shadow: none;
}
</style>
