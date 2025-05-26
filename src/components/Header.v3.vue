<script setup lang="ts">
import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { useFeedbackStore, type FeedbackData } from '../stores/feedback'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRoute } from 'vue-router'

const feedbackStore = useFeedbackStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedPeriod = ref('all')
const selectedRoles = ref<string[]>([])
const selectedScores = ref<number[]>([])
const uploadError = ref('')
const showTable = ref(false)
const isRolesOpen = ref(false)
const isScoresOpen = ref(false)
const isPeriodOpen = ref(false)
const showDatePicker = ref(false)
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)

// Obtenha a rota atual usando o hook useRoute
const route = useRoute()

const periods = [
  { value: 'all', label: 'Todo Período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última Semana' },
  { value: 'month', label: 'Último Mês' },
  { value: 'quarter', label: 'Último Trimestre' },
  { value: 'year', label: 'Último Ano' },
  { value: 'custom', label: 'Personalizado' }
]

const selectedPeriodLabel = computed(() => {
  if (selectedPeriod.value === 'custom' && startDate.value && endDate.value) {
    return `${format(startDate.value, 'dd/MM/yyyy')} - ${format(endDate.value, 'dd/MM/yyyy')}`
  }
  return periods.find(p => p.value === selectedPeriod.value)?.label || 'Selecione'
})

// Computed properties para calcular contagens reais
const roleCounts = computed(() => {
  const counts = {
    agent: 0,
    manager: 0,
    supervisor: 0
  }
  
  feedbackStore.feedbackData.forEach(item => {
    if (item.role in counts) {
      counts[item.role as keyof typeof counts]++
    }
  })
  
  return counts
})

const roles = computed(() => [
  { value: 'agent', label: 'Agente', count: `${roleCounts.value.agent} respostas` },
  { value: 'manager', label: 'Manager', count: `${roleCounts.value.manager} respostas` },
  { value: 'supervisor', label: 'Supervisor', count: `${roleCounts.value.supervisor} respostas` }
])

const scoreCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (let i = 1; i <= 10; i++) {
    counts[i] = 0
  }
  
  feedbackStore.feedbackData.forEach(item => {
    if (item.score >= 1 && item.score <= 10) {
      counts[item.score]++
    }
  })
  
  return counts
})

const scores = computed(() => 
  Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: (i + 1).toString(),
    count: `${scoreCounts.value[i + 1]} respostas`
  }))
)

const togglePeriod = () => {
  isPeriodOpen.value = !isPeriodOpen.value
  if (isPeriodOpen.value) {
    isRolesOpen.value = false
    isScoresOpen.value = false
  }
}

const toggleRoles = () => {
  isRolesOpen.value = !isRolesOpen.value
  if (isRolesOpen.value) {
    isPeriodOpen.value = false
    isScoresOpen.value = false
  }
}

const toggleScores = () => {
  isScoresOpen.value = !isScoresOpen.value
  if (isScoresOpen.value) {
    isPeriodOpen.value = false
    isRolesOpen.value = false
  }
}

const handlePeriodSelect = (period: string) => {
  selectedPeriod.value = period
  if (period === 'custom') {
    showDatePicker.value = true
  }
  isPeriodOpen.value = false
}

const handleDateSelection = () => {
  if (startDate.value && endDate.value) {
    showDatePicker.value = false
    isPeriodOpen.value = false
  }
}

const handleScoreToggle = (score: number) => {
  const index = selectedScores.value.indexOf(score)
  if (index === -1) {
    selectedScores.value.push(score)
  } else {
    selectedScores.value.splice(index, 1)
  }
}

const handleRoleToggle = (role: string) => {
  const index = selectedRoles.value.indexOf(role)
  if (index === -1) {
    selectedRoles.value.push(role)
  } else {
    selectedRoles.value.splice(index, 1)
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-container')) {
    isPeriodOpen.value = false
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

const handleSearch = () => {
  feedbackStore.filterFeedback(selectedPeriod.value, selectedRoles.value, selectedScores.value, startDate.value, endDate.value)
  showTable.value = true
}
</script>

<template>
  <header class="bg-white border-b border-gray-200" @click="handleClickOutside">
    <div class="px-6 py-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-800">
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
      
      <div class="flex items-end gap-4">
        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <div 
            @click="togglePeriod"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
          >
            <span class="text-gray-700">{{ selectedPeriodLabel }}</span>
            <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isPeriodOpen }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <div v-if="isPeriodOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  v-for="period in periods"
                  :key="period.value"
                  @click="handlePeriodSelect(period.value)"
                  class="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                >
                  {{ period.label }}
                </div>
              </div>
            </div>
          </div>

          <!-- Date Picker Modal -->
          <div v-if="showDatePicker" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium">Selecione o período</h3>
                <button @click="showDatePicker = false" class="text-gray-500 hover:text-gray-700">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Data de início</label>
                  <input 
                    type="date" 
                    v-model="startDate"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Data de término</label>
                  <input 
                    type="date" 
                    v-model="endDate"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                </div>
              </div>
              
              <div class="mt-6 flex justify-end space-x-3">
                <button 
                  @click="showDatePicker = false"
                  class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
                >
                  Cancelar
                </button>
                <button 
                  @click="handleDateSelection"
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Funções</label>
          <div 
            @click="toggleRoles"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
          >
            <span class="text-gray-700">{{ selectedRoles.length ? `${selectedRoles.length} selecionados` : 'Selecione' }}</span>
            <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isRolesOpen }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <div v-if="isRolesOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  v-for="role in roles"
                  :key="role.value"
                  @click="handleRoleToggle(role.value)"
                  class="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="selectedRoles.includes(role.value)"
                    class="h-4 w-4 text-blue-600 rounded border-gray-300"
                    @click.stop
                  >
                  <span class="ml-2 flex-1">{{ role.label }}</span>
                  <span class="text-sm text-gray-500">{{ role.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-[180px] dropdown-container relative">
          <label class="block text-sm font-medium text-gray-700 mb-2">Notas</label>
          <div 
            @click="toggleScores"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer flex justify-between items-center"
          >
            <span class="text-gray-700">{{ selectedScores.length ? `${selectedScores.length} selecionados` : 'Selecione' }}</span>
            <svg class="w-5 h-5 text-gray-400" :class="{ 'transform rotate-180': isScoresOpen }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <div v-if="isScoresOpen" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div class="p-2">
              <div class="space-y-1">
                <div
                  v-for="score in scores"
                  :key="score.value"
                  @click="handleScoreToggle(score.value)"
                  class="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="selectedScores.includes(score.value)"
                    class="h-4 w-4 text-blue-600 rounded border-gray-300"
                    @click.stop
                  >
                  <span class="ml-2 flex-1">{{ score.label }}</span>
                  <span class="text-sm text-gray-500">{{ score.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          @click="handleSearch"
          class="btn btn-secondary h-[42px] min-w-[100px]"
        >
          Buscar
        </button>
      </div>

      <!-- Tabela de Resultados -->
      <div v-if="showTable && feedbackStore.filteredData.length > 0" class="mt-6">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Função</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in feedbackStore.filteredData" :key="item.user_id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.user_id }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.score }}</td>
                <td class="px-6 py-4 text-sm text-gray-900">{{ item.reason }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ new Date(item.created_at).toLocaleDateString() }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.company_id }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.role }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="showTable" class="mt-6 p-4 text-center text-gray-500">
        Nenhum resultado encontrado para os filtros selecionados.
      </div>
    </div>
  </header>
</template>

<style scoped>
.dropdown-container {
  position: relative;
}
</style>