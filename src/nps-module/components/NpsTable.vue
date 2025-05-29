<template>
  <!-- Tabela completamente oculta mas funcional -->
  <div class="hidden">
    <div class="nps-table-container">
      <div class="flex items-center justify-between py-4 px-6 border-b border-[#E1E9F4]">
        <h2 class="text-lg font-semibold text-gray-900">Relatório NPS - Últimos 3 Meses</h2>
        
        <div v-if="isLoading" class="text-sm text-gray-500">
          Carregando...
        </div>
        <div v-else class="text-sm text-gray-500">
          Total de registros: {{ npsData.length }}
        </div>
      </div>

      <div v-if="error" class="p-4 text-red-600 bg-red-50">
        {{ error }}
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th>user_id</th>
              <th>score</th>
              <th>reason</th>
              <th>created_at</th>
              <th>company_id</th>
              <th>role</th>
              <th>User Name</th>
              <th>Company Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in npsData" :key="item.user_id">
              <td>{{ item.user_id }}</td>
              <td>{{ item.score }}</td>
              <td>{{ item.reason || '-' }}</td>
              <td>{{ formatDate(item.created_at) }}</td>
              <td>{{ item.company_id }}</td>
              <td>{{ item.role }}</td>
              <td>{{ item.user_name }}</td>
              <td>{{ item.company_name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, defineEmits } from 'vue'
import { useFeedbackStore } from '../../stores/feedback'
import api from '../plugins/axios'

const feedbackStore = useFeedbackStore()
const isLoading = ref(true)
const error = ref<string | null>(null)
const npsData = ref<any[]>([])

const emit = defineEmits(['loading-progress'])

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return new Date(date).toLocaleString('pt-BR')
  } catch {
    return dateString
  }
}

const fetchNpsData = async () => {
  try {
    isLoading.value = true
    
    // Se os dados já estiverem carregados, usar diretamente
    if (feedbackStore.isDataLoaded) {
      npsData.value = feedbackStore.feedbackData
      isLoading.value = false
      return
    }

    // Caso contrário, mostrar progresso do carregamento
    emit('loading-progress', 0)
    
    const updateProgress = (value: number) => {
      emit('loading-progress', value)
    }

    await feedbackStore.fetchData(updateProgress)
    npsData.value = feedbackStore.feedbackData

  } catch (err) {
    console.error('Erro ao buscar dados:', err)
    error.value = 'Erro ao carregar dados'
  } finally {
    isLoading.value = false
    emit('loading-progress', 100)
  }
}

onMounted(() => {
  fetchNpsData()
})
</script>

<style scoped>
.nps-table th,
.nps-table td {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-900;
}

.nps-table th {
  @apply bg-[#F0F4FA] text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}

.nps-table tr:hover {
  @apply bg-gray-50;
}
</style> 