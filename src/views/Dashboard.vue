<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ChartOptions } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const feedbackStore = useFeedbackStore()
const visibleDatasets = ref(['agent', 'manager', 'supervisor'])
const chartData = ref<{ labels: string[]; datasets: any[] } | null>(null)
const isTableExpanded = ref(true)

const useFilteredData = computed(() => 
  feedbackStore.filteredData.length > 0 ? feedbackStore.filteredData : feedbackStore.feedbackData
)

const promoters = computed(() => 
  useFilteredData.value.filter(f => f.score >= 9).length
)

const neutrals = computed(() => 
  useFilteredData.value.filter(f => f.score >= 7 && f.score <= 8).length
)

const detractors = computed(() => 
  useFilteredData.value.filter(f => f.score <= 6).length
)

const calculateNPSForRole = (data: any[], role: string | null = null) => {
  const filteredData = role ? data.filter(f => f.role === role) : data
  const total = filteredData.length
  if (total === 0) return 0
  const promoters = filteredData.filter(f => f.score >= 9).length
  const detractors = filteredData.filter(f => f.score <= 6).length
  const nps = ((promoters - detractors) / total * 100)
  return Math.round(nps)
}

const npsPerRole = computed(() => ({
  agent: calculateNPSForRole(useFilteredData.value, 'agent'),
  manager: calculateNPSForRole(useFilteredData.value, 'manager'),
  supervisor: calculateNPSForRole(useFilteredData.value, 'supervisor')
}))

const getNPSZone = (score: number) => {
  if (score >= 75) return { zone: 'Excelência', color: 'bg-emerald-100 text-emerald-800', textColor: 'text-emerald-800' }
  if (score >= 50) return { zone: 'Qualidade', color: 'bg-green-100 text-green-800', textColor: 'text-green-800' }
  if (score >= 0) return { zone: 'Melhoria', color: 'bg-yellow-100 text-yellow-800', textColor: 'text-yellow-800' }
  return { zone: 'Crítica', color: 'bg-red-100 text-red-800', textColor: 'text-red-800' }
}

const datasetConfigs = [
  {
    id: 'agent',
    label: 'Agente',
    role: 'agent',
    color: '#10B981'
  },
  {
    id: 'manager',
    label: 'Gestor',
    role: 'manager',
    color: '#F59E0B'
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    role: 'supervisor',
    color: '#6366F1'
  }
]

const updateChartData = () => {
  // Criar array com os últimos 12 meses
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (11 - i)) // Começa 11 meses atrás
    return format(date, 'MMM yyyy', { locale: ptBR })
  })

  // Inicializar dados para todos os meses
  const groupedData = last12Months.reduce((acc, month) => {
    acc[month] = {
      agent: { promoters: 0, detractors: 0, total: 0 },
      manager: { promoters: 0, detractors: 0, total: 0 },
      supervisor: { promoters: 0, detractors: 0, total: 0 }
    }
    return acc
  }, {} as Record<string, Record<string, { promoters: number, detractors: number, total: number }>>)

  // Agrupar dados por mês para cada função
  useFilteredData.value.forEach(item => {
    const date = format(parseISO(item.created_at), 'MMM yyyy', { locale: ptBR })
    if (groupedData[date]) { // Só processa se estiver dentro dos últimos 12 meses
      const score = item.score
      const role = item.role

      // Atualizar contadores para geral
      if (role === 'agent') {
        groupedData[date].agent.total++
        if (score >= 9) groupedData[date].agent.promoters++
        else if (score <= 6) groupedData[date].agent.detractors++
      } else if (role === 'manager') {
        groupedData[date].manager.total++
        if (score >= 9) groupedData[date].manager.promoters++
        else if (score <= 6) groupedData[date].manager.detractors++
      } else if (role === 'supervisor') {
        groupedData[date].supervisor.total++
        if (score >= 9) groupedData[date].supervisor.promoters++
        else if (score <= 6) groupedData[date].supervisor.detractors++
      }
    }
  })

  // Criar datasets
  const datasets: any[] = []
  datasetConfigs.forEach(config => {
    if (visibleDatasets.value.includes(config.id)) {
      const data = last12Months.map(month => {
        const stats = groupedData[month][config.id]
        if (stats.total === 0) return 0
        return Math.round(((stats.promoters - stats.detractors) / stats.total) * 100)
      })

      datasets.push({
        label: config.label,
        data: data,
        borderColor: config.color,
        backgroundColor: config.color,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      })
    }
  })

  return {
    labels: last12Months,
    datasets
  }
}

watch([useFilteredData, visibleDatasets], () => {
  chartData.value = updateChartData()
}, { immediate: true })

const chartOptions = ref<ChartOptions<'line'>>({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      align: 'center',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        boxWidth: 10,
        boxHeight: 10,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Mês'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'NPS'
      }
    }
  },
  interaction: {
    mode: 'index' as const
  }
})

const hasActiveFilters = computed(() => {
  return feedbackStore.filteredData.length > 0 && 
         feedbackStore.feedbackData.length !== feedbackStore.filteredData.length
})

const toggleTable = () => {
  isTableExpanded.value = !isTableExpanded.value
}
</script>

<template>
  <div class="flex-1 bg-[#F9FAFC] space-y-6">
    <!-- Cards principais -->
    <div class="grid grid-cols-2 gap-6">
      <!-- Card NPS -->
      <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
        <div class="px-6 pt-4">
          <h3 class="text-lg font-medium">NPS</h3>
        </div>
        <div class="border-b border-[#E1E9F4] mt-4"></div>
        <div class="px-6 pt-6 pb-6">
          <div class="grid grid-cols-3 gap-x-12">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-[#3057F2]">
                  <path d="M4.72266 12.4609C5.07422 12.3555 5.42578 12.25 5.8125 12.25C6.72656 12.25 7.5 13.0234 7.5 13.9375V18.4375C7.5 19.3867 6.72656 20.125 5.8125 20.125C4.23047 20.125 3 18.8945 3 17.3125V16.1875V15.0625V13.375C3 8.41797 7.00781 4.375 12 4.375C16.957 4.375 21 8.41797 21 13.375V15.0625V16.1875V17.3125C21 18.8945 19.7344 20.125 18.1875 20.125C17.2383 20.125 16.5 19.3867 16.5 18.4375V13.9375C16.5 13.0234 17.2383 12.25 18.1875 12.25C18.5391 12.25 18.9258 12.3555 19.2422 12.4609C18.7852 8.875 15.7266 6.0625 12 6.0625C8.23828 6.0625 5.17969 8.875 4.72266 12.4609ZM4.6875 15.0625V16.1875V17.3125C4.6875 17.9453 5.17969 18.4375 5.8125 18.4375V13.9375C5.17969 13.9375 4.6875 14.4648 4.6875 15.0625ZM19.3125 15.0625C19.3125 14.4648 18.7852 13.9375 18.1875 13.9375V18.4375C18.7852 18.4375 19.3125 17.9453 19.3125 17.3125V16.1875V15.0625Z" fill="currentColor"/>
                </svg>
                <p class="text-gray-600 text-lg">Agente</p>
              </div>
              <div class="flex items-center">
                <p :class="[getNPSZone(npsPerRole.agent).textColor, 'text-2xl font-medium']">{{ npsPerRole.agent }}%</p>
                <span :class="[getNPSZone(npsPerRole.agent).color, 'ml-2 text-xs font-medium px-2.5 py-0.5 rounded']">
                  {{ getNPSZone(npsPerRole.agent).zone }}
                </span>
              </div>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-[#3057F2]">
                  <path d="M15.0938 5.5H16.5C17.7305 5.5 18.75 6.51953 18.75 7.75V19C18.75 20.2656 17.7305 21.25 16.5 21.25H7.5C6.23438 21.25 5.25 20.2656 5.25 19V7.75C5.25 6.51953 6.23438 5.5 7.5 5.5H8.90625H9.22266C9.50391 4.23438 10.6289 3.25 12 3.25C13.3359 3.25 14.4961 4.23438 14.7422 5.5H15.0938ZM7.5 7.1875C7.18359 7.1875 6.9375 7.46875 6.9375 7.75V19C6.9375 19.3164 7.18359 19.5625 7.5 19.5625H16.5C16.7812 19.5625 17.0625 19.3164 17.0625 19V7.75C17.0625 7.46875 16.7812 7.1875 16.5 7.1875H15.9375V8.03125C15.9375 8.52344 15.5508 8.875 15.0938 8.875H12H8.90625C8.41406 8.875 8.0625 8.52344 8.0625 8.03125V7.1875H7.5ZM12 6.90625C12.457 6.90625 12.8438 6.55469 12.8438 6.0625C12.8438 5.60547 12.457 5.21875 12 5.21875C11.5078 5.21875 11.1562 5.60547 11.1562 6.0625C11.1562 6.55469 11.5078 6.90625 12 6.90625Z" fill="currentColor"/>
                </svg>
                <p class="text-gray-600 text-lg">Supervisor</p>
              </div>
              <div class="flex items-center">
                <p :class="[getNPSZone(npsPerRole.supervisor).textColor, 'text-2xl font-medium']">{{ npsPerRole.supervisor }}%</p>
                <span :class="[getNPSZone(npsPerRole.supervisor).color, 'ml-2 text-xs font-medium px-2.5 py-0.5 rounded']">
                  {{ getNPSZone(npsPerRole.supervisor).zone }}
                </span>
              </div>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-[#3057F2]">
                  <path d="M14.8125 8.3125V7.75C14.8125 7.36328 14.707 6.97656 14.5664 6.625H14.5312C13.793 6.625 13.1602 6.30859 12.7383 5.78125C12.2461 6.625 11.332 7.1875 10.3125 7.1875H9.22266C9.1875 7.39844 9.1875 7.57422 9.1875 7.75V8.3125C9.1875 9.89453 10.418 11.125 12 11.125C13.5469 11.125 14.8125 9.89453 14.8125 8.3125ZM12 3.25C14.4609 3.25 16.5 5.28906 16.5 7.75V8.3125C16.5 10.8086 14.4609 12.8125 12 12.8125C9.50391 12.8125 7.5 10.8086 7.5 8.3125V7.75C7.5 5.28906 9.50391 3.25 12 3.25ZM13.0547 17.9805L14.6016 14.8867C14.707 14.6758 14.9531 14.5703 15.1641 14.6055C17.8359 15.0625 19.875 17.3828 19.875 20.1953C19.875 20.793 19.3828 21.25 18.7852 21.25H5.17969C4.58203 21.25 4.125 20.793 4.125 20.1953C4.125 17.3828 6.12891 15.0625 8.80078 14.6055C9.04688 14.5703 9.25781 14.6758 9.36328 14.8867L10.9102 17.9805L11.4727 15.9062L10.8047 14.8164C10.5938 14.4297 10.8398 13.9375 11.2969 13.9375H12H12.668C13.125 13.9375 13.3711 14.4297 13.1602 14.8164L12.4922 15.9062L13.0547 17.9805ZM8.27344 16.5039C7.00781 17.0312 6.05859 18.1914 5.84766 19.5625H9.82031L8.27344 16.5039ZM14.1445 19.5625H18.1172C17.9062 18.1914 16.957 17.0312 15.6914 16.5039L14.1445 19.5625Z" fill="currentColor"/>
                </svg>
                <p class="text-gray-600 text-lg">Gestor</p>
              </div>
              <div class="flex items-center">
                <p :class="[getNPSZone(npsPerRole.manager).textColor, 'text-2xl font-medium']">{{ npsPerRole.manager }}%</p>
                <span :class="[getNPSZone(npsPerRole.manager).color, 'ml-2 text-xs font-medium px-2.5 py-0.5 rounded']">
                  {{ getNPSZone(npsPerRole.manager).zone }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card Tipos de usuários -->
      <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
        <div class="px-6 pt-4">
          <h3 class="text-lg font-medium">Tipos de usuários</h3>
        </div>
        <div class="border-b border-[#E1E9F4] mt-4"></div>
        <div class="px-6 pt-6 pb-6">
          <div class="grid grid-cols-3 gap-x-12">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">😀</span>
                <p class="text-gray-600 text-lg">Promotores</p>
              </div>
              <p class="text-2xl font-medium text-emerald-500">{{ promoters }}</p>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">😐</span>
                <p class="text-gray-600 text-lg">Neutros</p>
              </div>
              <p class="text-2xl font-medium text-yellow-500">{{ neutrals }}</p>
            </div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">😡</span>
                <p class="text-gray-600 text-lg">Detratores</p>
              </div>
              <p class="text-2xl font-medium text-red-500">{{ detractors }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Gráfico Evolução do NPS -->
    <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(23,18,63,0.03)]">
      <div class="px-6 pt-4">
        <h3 class="text-lg font-medium">Evolução do NPS</h3>
      </div>
      <div class="h-px bg-gray-200 mt-4 mb-6"></div>
      <div class="px-6">
        <div class="h-[400px] relative">
          <Line 
            v-if="chartData" 
            :data="chartData" 
            :options="chartOptions"
          />
        </div>
        <div class="h-4"></div>
      </div>
    </div>
  </div>
</template>