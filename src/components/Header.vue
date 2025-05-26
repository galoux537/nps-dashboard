<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Papa from 'papaparse'
import { useFeedbackStore, type FeedbackData } from '../stores/feedback'
import { parseISO, isAfter, subDays, format } from 'date-fns'
import { DatePicker } from 'v-calendar'
import 'v-calendar/style.css'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const feedbackStore = useFeedbackStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedPeriod = ref('Último Trimestre')
const selectedRoles = ref<string[]>([])
const selectedScores = ref<number[]>([])
const uploadError = ref('')
const showTable = ref(false)
const isRolesOpen = ref(false)
const isScoresOpen = ref(false)
const searchPerformed = ref(false)
const isPeriodOpen = ref(false)
const showDatePicker = ref(false)
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)
const isSelectingRange = ref(false)
const route = useRoute()
const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())
const calendarDays = ref<{ date: Date; isCurrentMonth: boolean }[]>([
  // Preencha com a lógica para gerar os dias do calendário
])

const allRoles = ['agent', 'manager', 'supervisor']
const allScores = Array.from({ length: 10 }, (_, i) => i + 1)

const allRolesSelected = computed(() => selectedRoles.value.length === allRoles.length)
const allScoresSelected = computed(() => selectedScores.value.length === allScores.length)

const toggleAllRoles = () => {
  selectedRoles.value = allRolesSelected.value ? [] : [...allRoles]
  feedbackStore.filterFeedback(
    selectedPeriod.value,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}

const toggleAllScores = () => {
  selectedScores.value = allScoresSelected.value ? [] : [...allScores]
  feedbackStore.filterFeedback(
    selectedPeriod.value,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}

const periods = [
  { value: 'all', label: 'Todo Período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última Semana' },
  { value: 'month', label: 'Último Mês' },
  { value: 'quarter', label: 'Último Trimestre' },
  { value: 'year', label: 'Último Ano' },
  { value: 'custom', label: 'Personalizado' }
]

// Definir interface para o periodMapping
interface PeriodMapping {
  [key: string]: string; // Adiciona assinatura de índice para permitir acesso usando strings
  'Todo Período': string;
  'Hoje': string;
  'Última Semana': string;
  'Último Mês': string;
  'Último Trimestre': string;
  'Último Ano': string;
  'Personalizado': string;
}

// Definir o objeto periodMapping com a interface correta
const periodMapping: PeriodMapping = {
  'Todo Período': 'all',
  'Hoje': 'today',
  'Última Semana': 'week',
  'Último Mês': 'month',
  'Último Trimestre': 'quarter',
  'Último Ano': 'year',
  'Personalizado': 'custom'
}

// Computed properties para contagens dinâmicas baseadas nos filtros atuais
const filteredData = computed(() => {
  let data = [...feedbackStore.feedbackData]
  
  // Aplica filtro de período
  if (selectedPeriod.value !== 'all') {
    const today = new Date()
    data = data.filter(item => {
      const date = parseISO(item.created_at)
      switch (selectedPeriod.value) {
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

  // Aplica filtro de funções
  if (selectedRoles.value.length > 0) {
    data = data.filter(item => selectedRoles.value.includes(item.role))
  }

  // Aplica filtro de scores
  if (selectedScores.value.length > 0) {
    data = data.filter(item => selectedScores.value.includes(item.score))
  }

  return data
})

// Contagens dinâmicas para roles baseadas no período selecionado
const roleCounts = computed(() => {
  const counts: Record<string, number> = {
    agent: 0,
    manager: 0,
    supervisor: 0
  }
  
  filteredData.value.forEach(item => {
    if (item.role in counts) {
      counts[item.role]++
    }
  })
  
  return counts
})

// Contagens dinâmicas para scores baseadas no período e roles selecionados
const scoreCounts = computed(() => {
  const counts = Array(11).fill(0)
  filteredData.value.forEach(item => {
    if (item.score >= 1 && item.score <= 10) {
      counts[item.score]++
    }
  })
  
  return counts
})

const roles = computed(() => [
  { value: 'agent', label: 'Agente', count: `${roleCounts.value.agent} respostas` },
  { value: 'manager', label: 'Gestor', count: `${roleCounts.value.manager} respostas` },
  { value: 'supervisor', label: 'Supervisor', count: `${roleCounts.value.supervisor} respostas` }
])

const scores = computed(() => 
  Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: (i + 1).toString(),
    count: `${scoreCounts.value[i + 1]} respostas`
  }))
)

const toggleRoles = () => {
  isRolesOpen.value = !isRolesOpen.value
  if (isRolesOpen.value) isScoresOpen.value = false
}

const toggleScores = () => {
  isScoresOpen.value = !isScoresOpen.value
  if (isScoresOpen.value) isRolesOpen.value = false
}

const handleScoreToggle = (score: number) => {
  const index = selectedScores.value.indexOf(score)
  if (index === -1) {
    selectedScores.value.push(score)
  } else {
    selectedScores.value.splice(index, 1)
  }
  feedbackStore.filterFeedback(
    selectedPeriod.value,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}

const handleRoleToggle = (role: string) => {
  const index = selectedRoles.value.indexOf(role)
  if (index === -1) {
    selectedRoles.value.push(role)
  } else {
    selectedRoles.value.splice(index, 1)
  }
  feedbackStore.filterFeedback(
    selectedPeriod.value,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-container')) {
    isRolesOpen.value = false
    isScoresOpen.value = false
  }
}

const handleUploadClick = () => {
  uploadError.value = ''
  fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    feedbackStore.isLoading = true
    uploadError.value = ''
    
    Papa.parse(file, {
      complete: (results) => {
        try {
          const processedData = results.data.map((row: any) => ({
            user_id: String(row.user_id || ''),
            score: Number(row.score) || 0,
            reason: String(row.reason || ''),
            created_at: String(row.created_at || new Date().toISOString()),
            company_id: String(row.company_id || ''),
            role: String(row.role || 'não especificado')
          }))
          
          feedbackStore.addFeedbackData(processedData)
          resetFilters()
          console.log('Dados importados com sucesso:', processedData)
        } catch (error) {
          console.error('Erro ao processar arquivo:', error)
          uploadError.value = 'Erro ao processar o arquivo. Verifique o formato dos dados.'
        } finally {
          feedbackStore.isLoading = false
        }
      },
      error: (error) => {
        console.error('Erro ao fazer parse do arquivo:', error)
        uploadError.value = 'Erro ao ler o arquivo. Verifique se é um CSV válido.'
        feedbackStore.isLoading = false
      },
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim()
    })
  }
  
  if (target) target.value = ''
}

const hasActiveFilters = computed(() => {
  return selectedPeriod.value !== 'all' || 
         selectedRoles.value.length > 0 || 
         selectedScores.value.length > 0
})

const resetFilters = () => {
  selectedPeriod.value = 'all'
  selectedRoles.value = []
  selectedScores.value = []
  showTable.value = false
  feedbackStore.filterFeedback('all', [], [])
}

// Atualiza os dados filtrados imediatamente quando qualquer filtro muda
watch([selectedPeriod, selectedRoles, selectedScores, startDate, endDate], () => {
  feedbackStore.filterFeedback(
    selectedPeriod.value,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}, { immediate: true })

const togglePeriod = () => {
  isPeriodOpen.value = !isPeriodOpen.value
  isRolesOpen.value = false
  isScoresOpen.value = false
}

// Computed para mostrar datas selecionadas
const customDateLabel = computed(() => {
  if (selectedPeriod.value === 'custom' && startDate.value && endDate.value) {
    return `${startDate.value.toLocaleDateString()} - ${endDate.value.toLocaleDateString()}`
  }
  return periods.find(p => p.value === selectedPeriod.value)?.label || 'Selecionar período'
})

// Adiciona ref para o range de datas
const dateRange = ref(null)

// Adiciona ref para o Datepicker
const datepickerRef = ref()

// Atualiza a função handleDateSelection
const handleDateSelection = (dates: [Date, Date]) => {
  if (dates && dates.length === 2) {
    startDate.value = dates[0]
    endDate.value = dates[1]
    selectedPeriod.value = 'custom'
    
    feedbackStore.filterFeedback(
      'custom',
      selectedRoles.value,
      selectedScores.value,
      startDate.value,
      endDate.value
    )
  }
}

// Atualiza a função de clique nos períodos
const handlePeriodClick = (period: { value: string, label: string }) => {
  if (period.value === 'custom') {
    selectedPeriod.value = 'custom'
    isPeriodOpen.value = false
    // Força a abertura do calendário imediatamente
    nextTick(() => {
      datepickerRef.value?.openMenu()
    })
  } else {
    selectedPeriod.value = period.value
    isPeriodOpen.value = false
  }
}

// Atualiza as configurações do datepicker
const datepickerConfig = {
  locale: 'pt-BR',
  format: 'dd/MM/yyyy',
  autoApply: true,
  placeholder: 'Selecione o período',
  inline: false,
  closeOnAutoApply: true,
  enableTimePicker: false,
  monthNameFormat: 'long',
  weekNumName: 'S',
  menuClassName: 'dp-custom-menu',
  range: true,
  openOnFocus: true,
  autoOpen: false // Mudado para false para controlar manualmente
}

const handleDateChange = (date: Date) => {
  selectedDate.value = date
}

const previousMonth = () => {
  // Lógica para mudar para o mês anterior
}

const formatMonthYear = (date: Date) => {
  return format(date, 'MMMM yyyy', { locale: ptBR })
}

const nextMonth = () => {
  // Lógica para mudar para o próximo mês
}

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const handleDateClick = (date: Date) => {
  // Lógica para lidar com o clique na data
}

// Primeiro, defina o formato de data personalizado
const customDateFormat = ref('dd/MM/yyyy')

onMounted(() => {
  applyFilters()
})

const applyFilters = () => {
  // Use o valor mapeado para o período selecionado
  const periodValue = periodMapping[selectedPeriod.value] || 'all'
  
  feedbackStore.filterFeedback(
    periodValue,
    selectedRoles.value,
    selectedScores.value,
    startDate.value,
    endDate.value
  )
}
</script>

<template>
  <header class="bg-white border-b border-gray-200" @click="handleClickOutside">
    <div class="px-4 md:px-6 py-4">
      <div class="flex items-center justify-between mb-4">
        <!-- Mobile menu button -->
        <button
          class="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100"
          @click="$emit('toggle-sidebar')"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h2 class="text-lg font-medium text-gray-800">
          {{ route.name || 'Dashboard' }}
        </h2>
        
        <div class="flex items-center space-x-4">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleFileChange"
          />
          <button 
            class="btn btn-primary relative"
            @click="handleUploadClick"
            :disabled="feedbackStore.isLoading"
          >
            <span :class="{ 'opacity-0': feedbackStore.isLoading }">
              Upload Data
            </span>
            <div 
              v-if="feedbackStore.isLoading" 
              class="absolute inset-0 flex items-center justify-center"
            >
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div v-if="uploadError" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
        {{ uploadError }}
      </div>

      <!-- Responsive filters section -->
      <div class="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <!-- Período filter -->
        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <div class="relative">
            <DatePicker
              v-if="showDatePicker"
              v-model="selectedDate"
              :locale="ptBR.code"
              :masks="{ 
                input: 'DD/MM/YYYY'
              }"
              :enable-time-picker="false"
              class="custom-datepicker"
              @update:modelValue="handleDateChange"
            />
            <div 
              v-else
              @click="togglePeriod"
              class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
            >
              <span class="text-gray-700">
                {{ customDateLabel }}
              </span>
              <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isPeriodOpen }" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
          
          <!-- Lista de períodos -->
          <div v-if="isPeriodOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  v-for="period in periods"
                  :key="period.value"
                  @click="handlePeriodClick(period)"
                  class="flex items-center px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded"
                  :class="{ 'bg-blue-50 text-blue-600': selectedPeriod === period.value }"
                >
                  <span class="text-gray-700" :class="{ 'text-blue-600': selectedPeriod === period.value }">
                    {{ period.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Funções filter -->
        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Funções</label>
          <div 
            @click="toggleRoles"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
          >
            <span class="text-gray-700">{{ selectedRoles.length ? `${selectedRoles.length} selecionados` : 'Selecionar cargo' }}</span>
            <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isRolesOpen }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <div v-if="isRolesOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  @click="toggleAllRoles"
                  class="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 rounded border-b border-gray-200 mb-1"
                >
                  <input
                    type="checkbox"
                    :checked="allRolesSelected"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-gray-700 font-medium">Selecionar todos</span>
                </div>
                <div
                  v-for="role in ['agent', 'manager', 'supervisor']"
                  :key="role"
                  @click="handleRoleToggle(role)"
                  class="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 rounded"
                >
                  <input
                    type="checkbox"
                    :checked="selectedRoles.includes(role)"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-gray-700 capitalize">{{ role }}</span>
                  <span class="ml-auto text-gray-500">{{ roleCounts[role] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notas filter -->
        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Notas</label>
          <div 
            @click="toggleScores"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
          >
            <span class="text-gray-700">{{ selectedScores.length ? `${selectedScores.length} selecionados` : 'Selecionar nota' }}</span>
            <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isScoresOpen }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <div v-if="isScoresOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  @click="toggleAllScores"
                  class="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 rounded border-b border-gray-200 mb-1"
                >
                  <input
                    type="checkbox"
                    :checked="allScoresSelected"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-gray-700 font-medium">Selecionar todos</span>
                </div>
                <div
                  v-for="score in [1,2,3,4,5,6,7,8,9,10]"
                  :key="score"
                  @click="handleScoreToggle(score)"
                  class="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 rounded"
                >
                  <input
                    type="checkbox"
                    :checked="selectedScores.includes(score)"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-gray-700">{{ score }}</span>
                  <span class="ml-auto text-gray-500">{{ scoreCounts[score] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-2 mt-4 md:mt-0">
          <button
            :disabled="!hasActiveFilters"
            :class="[
              'btn btn-secondary h-[42px] min-w-[100px]',
              !hasActiveFilters ? 'opacity-50 cursor-not-allowed' : ''
            ]"
            @click="resetFilters"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Novo calendário customizado -->
  <div 
    v-if="showDatePicker" 
    class="calendar-container bg-white rounded-lg shadow-lg border border-gray-200"
  >
    <div class="p-3 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <button @click="previousMonth" class="p-1 hover:bg-gray-100 rounded">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="text-sm font-medium">{{ formatMonthYear(currentMonth) }}</span>
        <button @click="nextMonth" class="p-1 hover:bg-gray-100 rounded">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
    
    <div class="p-2">
      <div class="grid grid-cols-7 gap-1">
        <!-- Cabeçalho dos dias da semana -->
        <div v-for="day in weekDays" :key="day" class="text-center text-xs text-gray-500 py-2">
          {{ day }}
        </div>
        
        <!-- Dias do calendário -->
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          @click="handleDateClick(day.date)"
          class="text-center py-1 cursor-pointer rounded-full"
          :class="{
            'text-gray-400': !day.isCurrentMonth,
            'bg-blue-500 text-white': startDate && day.date.getTime() === startDate.getTime(),
            'bg-blue-100': startDate && endDate && day.date >= startDate && day.date <= endDate
          }"
        >
          {{ day.date.getDate() }}
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.dp__theme_light {
  --dp-background-color: #fff;
  --dp-text-color: #374151;
  --dp-hover-color: #f3f4f6;
  --dp-hover-text-color: #374151;
  --dp-hover-icon-color: #374151;
  --dp-primary-color: #3b82f6;
  --dp-primary-text-color: #fff;
  --dp-secondary-color: #dbeafe;
  --dp-border-color: #e5e7eb;
  --dp-menu-border-width: 1px;
  --dp-border-radius: 8px;
}

.dp__input {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  width: 100%;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.dp-custom-menu {
  margin-top: 4px;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.custom-datepicker {
  width: 100%;
}

.dp__trigger {
  cursor: pointer;
}
</style>