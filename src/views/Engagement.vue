<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import { startOfMonth, endOfMonth, parseISO, format, subMonths, eachMonthOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AIInsightsPanel from '../components/AIInsightsPanel.vue'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const feedbackStore = useFeedbackStore()

// Utilizar dados filtrados ao invés de últimos 4 meses
const filteredData = computed(() => feedbackStore.filteredData || [])

// Função para calcular estatísticas por papel
const getRoleStats = (data: any[], role: string) => {
  const roleData = data.filter(f => f.role === role)
  return {
    total: roleData.length,
    promoters: roleData.filter(f => f.score >= 9).length,
    neutrals: roleData.filter(f => f.score >= 7 && f.score <= 8).length,
    detractors: roleData.filter(f => f.score <= 6).length,
    nps: roleData.length ? Math.round(((roleData.filter(f => f.score >= 9).length - 
          roleData.filter(f => f.score <= 6).length) / roleData.length) * 100) : 0
  }
}

// Estatísticas baseadas nos dados filtrados
const currentStats = computed(() => ({
  gestor: getRoleStats(filteredData.value, 'manager'),
  supervisor: getRoleStats(filteredData.value, 'supervisor'),
  agente: getRoleStats(filteredData.value, 'agent')
}))

// Função para gerar dados para os mini gráficos
const generateTrendData = (role: string) => {
  // Agrupar os dados por mês
  const monthsData = new Map()
  
  filteredData.value
    .filter(item => item.role === role)
    .forEach(item => {
      const date = parseISO(item.created_at)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMM', { locale: ptBR })
      
      if (!monthsData.has(monthKey)) {
        monthsData.set(monthKey, {
          monthLabel,
          promoters: 0,
          detractors: 0,
          total: 0
        })
      }
      
      const monthData = monthsData.get(monthKey)
      monthData.total++
      
      if (item.score >= 9) {
        monthData.promoters++
      } else if (item.score <= 6) {
        monthData.detractors++
      }
    })
  
  // Ordenar por mês
  const sortedMonths = Array.from(monthsData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6) // Últimos 6 meses para não sobrecarregar o gráfico
  
  // Calcular NPS para cada mês
  const labels: string[] = []
  const npsData: number[] = []
  
  sortedMonths.forEach(([key, data]) => {
    labels.push(data.monthLabel)
    
    const monthlyNps = data.total 
      ? Math.round(((data.promoters - data.detractors) / data.total) * 100)
      : 0
      
    npsData.push(monthlyNps)
  })

  return {
    labels,
    datasets: [
      {
        label: 'NPS',
        data: npsData,
        borderColor: role === 'manager' ? '#4A6CF7' : role === 'supervisor' ? '#6FCF97' : '#FF9500',
        backgroundColor: role === 'manager' ? '#4A6CF7' : role === 'supervisor' ? '#6FCF97' : '#FF9500',
        tension: 0.4,
        pointStyle: 'circle',
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  }
}

// Dados para os mini gráficos
const gestorChartData = computed(() => generateTrendData('manager'))
const supervisorChartData = computed(() => generateTrendData('supervisor'))
const agenteChartData = computed(() => generateTrendData('agent'))

// Opções para os mini gráficos
const miniChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false
    }
  },
  scales: {
    x: {
      display: false,
      grid: {
        display: false
      }
    },
    y: {
      display: false,
      suggestedMin: 0,
      suggestedMax: 100,
      grid: {
        display: true,
        color: 'rgba(200, 200, 200, 0.5)',
        lineWidth: 1,
        drawBorder: false,
        drawOnChartArea: true,
        drawTicks: false,
        tickLength: 0
      }
    }
  },
  elements: {
    line: {
      borderWidth: 2
    },
    point: {
      radius: 2,
      hoverRadius: 5
    }
  }
}

// Função para calcular estatísticas por palavra-chave
const getKeywordStats = (keywords: string[]) => {
  const months = Array.from({ length: 4 }, (_, i) => {
    const date = subMonths(new Date(), i)
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const monthData = filteredData.value.filter(f => {
      const fDate = parseISO(f.created_at)
      return fDate >= start && fDate <= end && 
             keywords.some(keyword => f.reason?.toLowerCase().includes(keyword.toLowerCase()))
    })
    
    return {
      month: format(date, 'MMMM', { locale: ptBR }),
      count: monthData.length,
      comments: monthData.map(f => f.reason)
    }
  }).reverse()

  return months
}

// Adicionar estado para controlar o carrossel
const currentSlide = ref(0)
const activeFilter = ref('Suporte') // Para controlar qual filtro está ativo

// Função para obter estatísticas mensais com base no filtro
function getMonthlyStats(filterType: string) {
  // Obtém os dados filtrados do store
  const filteredData = feedbackStore.filteredData
  
  // Obtém o filtro de período atual
  const currentFilters = feedbackStore.getCurrentFilters()
  const today = new Date()
  
  // Definir data inicial para os últimos 11 meses 
  // (para evitar meses duplicados de anos diferentes)
  const startDate = subMonths(today, 11)
  
  // Gera todos os meses desde a data inicial até hoje
  const monthsInRange = eachMonthOfInterval({ start: startDate, end: today })
  
  // Para cada mês, gera as estatísticas
  return monthsInRange.map(monthDate => {
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    const monthLabel = format(monthDate, 'MMMM', { locale: ptBR })
    const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
    
    // Filtra dados para este mês que correspondam ao tipo de filtro
    const monthData = filteredData.filter(item => {
      const date = parseISO(item.created_at)
      const matchesFilter = filterType === 'Suporte' 
        ? item.reason?.toLowerCase().includes('suporte')
        : filterType === 'Instabilidade'
          ? item.reason?.toLowerCase().includes('instabilidade')
          : item.reason?.toLowerCase().includes('mailing')
      
      return date >= start && date <= end && matchesFilter
    })
    
    // Extrai os comentários para este mês
    const comments = monthData.map(item => item.reason).filter(Boolean)
    
    return {
      month: capitalizedMonth,
      count: monthData.length,
      comments,
      date: monthDate // Armazena a data para ordenação
    }
  })
}

// Estatísticas para cada tipo de filtro
const supportStats = computed(() => getMonthlyStats('Suporte'))
const instabilityStats = computed(() => getMonthlyStats('Instabilidade'))
const noCallStats = computed(() => getMonthlyStats('Problemas com mailing'))

// Total de estatísticas disponíveis
const totalStats = computed(() => {
  if (activeFilter.value === 'Suporte') {
    return supportStats.value.length
  } else if (activeFilter.value === 'Instabilidade') {
    return instabilityStats.value.length
  } else {
    return noCallStats.value.length
  }
})

// Número total de slides possíveis
const totalSlides = computed(() => {
  return Math.ceil(totalStats.value / 4)
})

// Iniciar sempre mostrando os meses mais recentes
// A lógica é reversa: slideOffset 0 mostra os 4 meses mais recentes
const slideOffset = ref(0)

// Função para pegar os meses mais recentes primeiro
const paginatedStats = computed(() => {
  let stats = []
  
  if (activeFilter.value === 'Suporte') {
    stats = [...supportStats.value]
  } else if (activeFilter.value === 'Instabilidade') {
    stats = [...instabilityStats.value]
  } else {
    stats = [...noCallStats.value]
  }
  
  // Calcular o índice inicial para exibir os meses mais recentes primeiro
  // slideOffset 0 mostra os últimos 4 meses (mais recentes)
  // slideOffset 1 mostra os 4 meses anteriores, etc.
  const totalItems = stats.length
  const itemsPerPage = 4
  
  if (totalItems <= itemsPerPage) {
    // Se tiver menos de 4 meses, mostra todos
    return stats
  }
  
  const startIndex = Math.max(0, totalItems - itemsPerPage - (slideOffset.value * itemsPerPage))
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
  
  return stats.slice(startIndex, endIndex)
})

// Verificar se devemos mostrar os controles de navegação
const hasMultipleSlides = computed(() => {
  return totalStats.value > 4
})

// Verificar se estamos no último slide (meses mais antigos)
const isOnOldestSlide = computed(() => {
  return slideOffset.value >= totalSlides.value - 1
})

// Verificar se estamos no primeiro slide (meses mais recentes)
const isOnNewestSlide = computed(() => {
  return slideOffset.value === 0
})

// Função para navegar para meses mais antigos
const goToPreviousMonths = () => {
  if (!isOnOldestSlide.value) {
    slideOffset.value++
  }
}

// Função para navegar para meses mais recentes
const goToRecentMonths = () => {
  if (!isOnNewestSlide.value) {
    slideOffset.value--
  }
}

// Reset do slideOffset quando o filtro muda
watch(activeFilter, () => {
  slideOffset.value = 0 // Voltar para os meses mais recentes
})

// Reset do slideOffset quando os filtros globais mudam
watch(() => feedbackStore.getCurrentFilters(), () => {
  slideOffset.value = 0 // Voltar para os meses mais recentes
}, { deep: true })

// Função para obter os dados do gráfico respeitando o filtro de período
const getChartData = computed(() => {
  const currentFilters = feedbackStore.getCurrentFilters()
  const today = new Date()
  let startDate = new Date(today)
  
  // Lógica para determinar startDate com base em currentFilters
  // (código existente)
  
  // Garantir que temos pelo menos 4 meses de dados para o gráfico
  if (startDate > subMonths(today, 3)) {
    startDate = subMonths(today, 3)
  }
  
  // Obter todos os meses no intervalo
  const monthsInRange = eachMonthOfInterval({ start: startDate, end: today })
  
  // Dados para cada categoria de reclamação
  const instabilityData: number[] = []
  const supportData: number[] = []
  const mailingData: number[] = []
  const labels: string[] = []
  
  // Para cada mês no intervalo, contar reclamações por categoria
  monthsInRange.forEach(monthDate => {
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    const monthLabel = format(monthDate, 'MMMM', { locale: ptBR })
    
    // Filtrar dados para o mês atual
    const monthData = feedbackStore.filteredData.filter(item => {
      const date = parseISO(item.created_at)
      return date >= start && date <= end
    })
    
    // Contar reclamações por categoria
    const instabilityCount = monthData.filter(item => 
      item.reason?.toLowerCase().includes('instabilidade')).length
    
    const supportCount = monthData.filter(item => 
      item.reason?.toLowerCase().includes('suporte')).length
    
    const mailingCount = monthData.filter(item => 
      item.reason?.toLowerCase().includes('mailing')).length
    
    // Adicionar dados às arrays
    labels.push(monthLabel)
    instabilityData.push(instabilityCount)
    supportData.push(supportCount)
    mailingData.push(mailingCount)
  })
  
  return {
    labels, // Agora com tipo explícito string[]
    instabilityData, // Agora com tipo explícito number[]
    supportData, // Agora com tipo explícito number[]
    mailingData // Agora com tipo explícito number[]
  }
})

// Atualizar chartData com os dados filtrados e estilo visual consistente
const chartData = computed(() => {
  const data = getChartData.value
  
  return {
    labels: data.labels,
    datasets: [
      {
        label: 'Reclamações de instabilidade',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgb(255, 99, 132)',
        data: data.instabilityData,
        tension: 0.3,
        pointBackgroundColor: 'rgb(255, 99, 132)', // Pontos sólidos
        pointRadius: 5,
        pointHoverRadius: 7
      },
      {
        label: 'Reclamações de suporte',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgb(54, 162, 235)',
        data: data.supportData,
        tension: 0.3,
        pointBackgroundColor: 'rgb(54, 162, 235)', // Pontos sólidos
        pointRadius: 5,
        pointHoverRadius: 7
      },
      {
        label: 'Problemas com mailing',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgb(255, 206, 86)',
        data: data.mailingData,
        tension: 0.3,
        pointBackgroundColor: 'rgb(255, 206, 86)', // Pontos sólidos
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  }
})

// Configurações do gráfico atualizadas para o novo estilo visual
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'NPS'
      },
      grid: {
        display: true,
        color: '#E5E7EB'
      }
    },
    x: {
      title: {
        display: true,
        text: 'Mês'
      },
      grid: {
        display: false
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: '#fff',
      titleColor: '#111',
      bodyColor: '#333',
      borderColor: '#e1e1e1',
      borderWidth: 1,
      padding: 10,
      displayColors: false
    }
  },
  elements: {
    line: {
      tension: 0.4
    },
    point: {
      radius: 5,
      hitRadius: 10,
      hoverRadius: 7
    }
  },
  interaction: {
    mode: 'index' as 'index',
    intersect: false
  }
}

// Definindo a propriedade insights
const insights = ref({ recommendations: [] })

// Função para capitalizar a primeira letra
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Observar mudanças nos filtros
watch(() => feedbackStore.filteredData, () => {
  console.log('Filtros alterados, atualizando dados')
  // Seu código de atualização aqui
}, { immediate: true, deep: true })

// Alternativamente, você pode observar os filtros diretamente
watch(() => feedbackStore.getCurrentFilters(), () => {
  console.log('Filtros alterados, atualizando dados')
  // Seu código de atualização aqui
}, { immediate: true, deep: true })

// Distribuição dos meses nas páginas do carrossel
const groupedMonths = computed(() => {
  const stats = activeFilter.value === 'Suporte' 
    ? supportStats.value 
    : activeFilter.value === 'Instabilidade' 
      ? instabilityStats.value 
      : noCallStats.value;
  
  // Se não há dados, retorna array vazio
  if (!stats || stats.length === 0) {
    return [[]];
  }
  
  // Ordenar os meses cronologicamente (mais antigo para mais recente)
  const sortedStats = [...stats].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Se temos 4 ou menos meses, retornamos apenas uma página com todos
  if (sortedStats.length <= 4) {
    return [sortedStats];
  }
  
  const result = [];
  const chunkSize = 4;
  
  // Primeiro, reservamos os 4 meses mais recentes para a última página
  const lastPageMonths = sortedStats.slice(-4);
  
  // Depois, distribuímos os meses restantes em páginas de 4
  const remainingMonths = sortedStats.slice(0, -4);
  const numRemainingPages = Math.ceil(remainingMonths.length / chunkSize);
  
  // Distribuímos os meses restantes em páginas
  for (let i = 0; i < numRemainingPages; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, remainingMonths.length);
    const page = remainingMonths.slice(start, end);
    
    if (page.length > 0) {
      result.push(page);
    }
  }
  
  // Adicionamos a última página com os 4 meses mais recentes
  result.push(lastPageMonths);
  
  return result;
});

// Número total de páginas
const totalPages = computed(() => groupedMonths.value.length);

// Inicializa o slide para a última página quando o componente é carregado
// ou quando os dados mudam
watch([totalPages, activeFilter], ([newTotalPages]) => {
  if (newTotalPages > 0) {
    // Ir para a última página automaticamente (meses mais recentes)
    currentSlide.value = newTotalPages - 1;
  } else {
    currentSlide.value = 0;
  }
}, { immediate: true });

// Navegação para meses anteriores (mais antigos)
const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--;
  }
};

// Navegação para meses mais recentes
const nextSlide = () => {
  if (currentSlide.value < totalPages.value - 1) {
    currentSlide.value++;
  }
};

const goToPage = (pageIndex: number) => {
  currentSlide.value = pageIndex;
};

// Reset quando os filtros globais mudam - mantendo no último slide
watch(() => feedbackStore.getCurrentFilters(), () => {
  // Definir para a última página quando os filtros mudarem
  nextTick(() => {
    if (totalPages.value > 0) {
      currentSlide.value = totalPages.value - 1;
    } else {
      currentSlide.value = 0;
    }
  });
}, { deep: true });
</script>

<template>
  <div class="space-y-6">
    <!-- Seção de Insights -->
    <div>
      <!-- Cards de Insights -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Card do Gestor -->
        <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(18,38,63,0.03)] px-6 py-6 card-padding">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-[#373753]">Gestor</h3>
            <span class="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
              {{ currentStats.gestor.nps }}% NPS
            </span>
          </div>

          <!-- Adicionando o divisor -->
          <hr class="border-t border-gray-200 mb-6 -mx-6">

          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😀</span>
                Promotores
              </span>
              <span class="font-medium">{{ currentStats.gestor.promoters }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😐</span>
                Neutros
              </span>
              <span class="font-medium">{{ currentStats.gestor.neutrals }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😡</span>
                Detratores
              </span>
              <span class="font-medium">{{ currentStats.gestor.detractors }}</span>
            </div>
            <div class="pt-6 border-t">
              <p class="text-sm text-gray-500 mb-2">Tendência do NPS</p>
              <div class="h-[60px] w-full chart-grid-bg">
                <Line :data="gestorChartData" :options="miniChartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Card do Supervisor -->
        <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(18,38,63,0.03)] px-6 py-6 card-padding">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-[#373753]">Supervisor</h3>
            <span class="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
              {{ currentStats.supervisor.nps }}% NPS
            </span>
          </div>

          <!-- Adicionando o divisor -->
          <hr class="border-t border-gray-200 mb-6 -mx-6">

          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😀</span>
                Promotores
              </span>
              <span class="font-medium">{{ currentStats.supervisor.promoters }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😐</span>
                Neutros
              </span>
              <span class="font-medium">{{ currentStats.supervisor.neutrals }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😡</span>
                Detratores
              </span>
              <span class="font-medium">{{ currentStats.supervisor.detractors }}</span>
            </div>
            <div class="pt-6 border-t">
              <p class="text-sm text-gray-500 mb-2">Tendência do NPS</p>
              <div class="h-[60px] w-full chart-grid-bg">
                <Line :data="supervisorChartData" :options="miniChartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Card do Agente -->
        <div class="bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(18,38,63,0.03)] px-6 py-6 card-padding">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-[#373753]">Agente</h3>
            <span class="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
              {{ currentStats.agente.nps }}% NPS
            </span>
          </div>

          <!-- Adicionando o divisor -->
          <hr class="border-t border-gray-200 mb-6 -mx-6">

          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😀</span>
                Promotores
              </span>
              <span class="font-medium">{{ currentStats.agente.promoters }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😐</span>
                Neutros
              </span>
              <span class="font-medium">{{ currentStats.agente.neutrals }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500 flex items-center gap-2">
                <span class="text-lg">😡</span>
                Detratores
              </span>
              <span class="font-medium">{{ currentStats.agente.detractors }}</span>
            </div>
            <div class="pt-6 border-t">
              <p class="text-sm text-gray-500 mb-2">Tendência do NPS</p>
              <div class="h-[60px] w-full chart-grid-bg">
                <Line :data="agenteChartData" :options="miniChartOptions" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recomendações gerais -->
      <div v-if="insights?.recommendations?.length" class="col-span-full mt-6 bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">Recomendações Gerais</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="(rec, i) in insights.recommendations" 
               :key="i" 
               class="bg-gray-50 p-4 rounded-lg">
            <p class="text-gray-700">{{ rec }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Espaçamento entre seções -->
    <!-- Removido o espaçamento adicional -->

    <!-- Gráfico de Comparação de Tópicos -->
    <div class="mt-6 bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(18,38,63,0.03)]">
      <div class="px-6 py-4 border-b border-[#E1E9F4]">
        <h3 class="text-lg font-medium text-[#373753]">
          Tópicos de reclamações
        </h3>
      </div>
      <div class="p-6 h-[400px]">
        <Line v-if="getChartData.labels.length > 0" :data="chartData" :options="chartOptions" />
        <div v-else class="flex items-center justify-center h-full text-gray-500">
          Nenhum dado disponível para o período selecionado
        </div>
      </div>
    </div>

    <!-- Seção de Análise de Reclamações -->
    <div class="mt-6 bg-white rounded-[10px] border border-[#E1E9F4] shadow-[0_12px_24px_0_rgba(18,38,63,0.03)]">
      <div class="px-6 py-4 border-b border-[#E1E9F4] flex justify-between items-center">
        <h3 class="text-lg font-medium text-[#373753]">Análise de Reclamações</h3>
        
        <!-- Tabs de filtro -->
        <div class="flex space-x-2">
          <button 
            @click="activeFilter = 'Suporte'" 
            class="px-4 py-1.5 rounded-full text-sm"
            :class="activeFilter === 'Suporte' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'"
          >
            Suporte
          </button>
          <button 
            @click="activeFilter = 'Instabilidade'" 
            class="px-4 py-1.5 rounded-full text-sm"
            :class="activeFilter === 'Instabilidade' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'"
          >
            Instabilidade
          </button>
          <button 
            @click="activeFilter = 'Problemas com mailing'" 
            class="px-4 py-1.5 rounded-full text-sm"
            :class="activeFilter === 'Problemas com mailing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'"
          >
            Problemas com mailing
          </button>
        </div>
      </div>
      
      <!-- Carrossel de cards com os meses -->
      <div class="relative p-6">
        <!-- Botão para navegar para meses mais antigos (retroceder) -->
        <button 
          v-if="hasMultipleSlides"
          @click="prevSlide" 
          :disabled="currentSlide === 0"
          class="absolute left-1 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md"
          :class="{ 'opacity-50 cursor-not-allowed': currentSlide === 0 }"
          title="Ver meses anteriores (mais antigos)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <!-- Container do carrossel com a transição -->
        <div class="relative overflow-hidden">
          <div 
            class="flex transition-all duration-500 ease-in-out" 
            :style="{ transform: `translateX(-${currentSlide * 100}%)` }"
          >
            <!-- Cada página do carrossel -->
            <div 
              v-for="(page, pageIndex) in groupedMonths" 
              :key="'page-' + pageIndex"
              class="w-full flex-shrink-0 grid grid-cols-4 gap-4"
            >
              <!-- Cards de meses dentro de cada página -->
              <div 
                v-for="(month, monthIndex) in page" 
                :key="month.month + '-' + monthIndex"
                class="bg-white rounded-lg border border-[#E1E9F4] shadow-sm"
              >
                <div class="p-4">
                  <div class="flex justify-between items-center">
                    <h4 class="font-medium text-[#373753]">{{ month.month }}</h4>
                    <div class="flex items-center">
                      <p class="text-base font-bold text-[#373753]">{{ month.count }}</p>
                      <span class="ml-2 text-sm text-[#677C92]">{{ month.count === 1 ? 'Relato' : 'Relatos' }}</span>
                    </div>
                  </div>
                </div>
                <hr class="border-t border-gray-200">
                <div class="p-4 mt-2 space-y-2 overflow-y-auto max-h-56 custom-scroll">
                  <div v-if="month.comments.length === 0" class="text-sm text-gray-400 text-center p-2">
                    Nenhum relato neste período
                  </div>
                  <div v-for="(comment, i) in month.comments" :key="i" class="text-sm text-gray-600 bg-red-50 p-2 rounded">
                    {{ comment }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Botão para navegar para meses mais recentes (avançar) -->
        <button 
          v-if="hasMultipleSlides"
          @click="nextSlide"
          :disabled="currentSlide >= totalPages - 1"
          class="absolute right-1 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md"
          :class="{ 'opacity-50 cursor-not-allowed': currentSlide >= totalPages - 1 }"
          title="Ver meses mais recentes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <!-- Indicadores de página (bolinhas) -->
        <div v-if="totalPages > 1" class="flex justify-center mt-6 space-x-3">
          <button 
            v-for="index in totalPages" 
            :key="index"
            @click="goToPage(index - 1)"
            aria-label="Página do carrossel"
            class="w-3 h-3 rounded-full transition-all duration-300 focus:outline-none"
            :class="currentSlide === index - 1 ? 'bg-blue-500' : 'bg-gray-300 hover:bg-gray-400'"
          ></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 0.375rem;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: background-color 0.3s;
}

.tab-button.active {
  background-color: #e2e8f0;
  border-color: #cbd5e0;
}

.tab-button:hover {
  background-color: #edf2f7;
}

.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.custom-scroll::-webkit-scrollbar {
  width: 6px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}

html, body {
  height: 100%;
  overflow-y: auto;
}

/* Ajustando espaçamentos globais */
.space-y-6 > * + * {
  margin-top: 24px;
}

.gap-6 {
  gap: 24px;
}

.mb-6 {
  margin-bottom: 24px;
}

.p-6 {
  padding: 24px;
}

.pt-6 {
  padding-top: 24px;
}

.mt-6 {
  margin-top: 24px;
}

.py-6 {
  padding-top: 24px;
  padding-bottom: 24px;
}

.px-6 {
  padding-left: 24px;
  padding-right: 24px;
}

/* Ajustes de espaçamento para os cards */
.card-padding {
  padding: 16px 24px 24px 24px; /* Top, Right, Bottom, Left */
}

.analysis-card {
  background-color: #fff;
  border: 1px solid #E1E9F4;
  border-radius: 10px;
  box-shadow: 0 12px 24px 0 rgba(18, 38, 63, 0.03);
  padding: 16px 24px 24px 24px; /* Top, Right, Bottom, Left */
  margin-bottom: 24px;
}

.filter-button {
  background-color: #E1E9F4;
  border: none;
  padding: 0 16px;
  margin-left: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  height: 28px;
  display: flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.filter-button:hover {
  background-color: #d1ddef;
}

.active-filter {
  background-color: #7E9CF7;
  color: white;
}

.active-filter:hover {
  background-color: #7E9CF7;
}

.analysis-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 0;
}

.title-divider {
  height: 1px;
  background-color: #E1E9F4;
  margin: 0 -24px 20px -24px;  /* Margens negativas para compensar o padding */
}

/* Adicionar fundo com grades para os mini gráficos */
.chart-grid-bg {
  background-image: 
    linear-gradient(to right, 
                    rgba(220, 220, 220, 0.3) 1px, 
                    transparent 1px),
    linear-gradient(to bottom, 
                    rgba(220, 220, 220, 0.3) 1px, 
                    transparent 1px);
  background-size: 20% 20px; /* Espaçamento horizontal e vertical */
  background-position: 0 0;
  border-right: 1px solid rgba(220, 220, 220, 0.3);
  border-bottom: 1px solid rgba(220, 220, 220, 0.3);
  position: relative;
}

.carousel-btn {
  @apply flex items-center justify-center w-10 h-10 rounded-full;
  opacity: 0.8;
  transition: opacity 0.2s, transform 0.2s;
}

.carousel-btn:hover:not(:disabled) {
  opacity: 1;
  transform: scale(1.1) translateY(-50%);
}

/* Transição suave para o carrossel */
.transition-transform {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Estilização dos indicadores de página */
button {
  transition: all 0.3s ease;
}

button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Estilo para transição suave do carrossel */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

/* Estilos específicos para as bolinhas de navegação */
.rounded-full {
  border-radius: 9999px;
}

.bg-blue-500 {
  background-color: #3b82f6;
}

.bg-gray-300 {
  background-color: #d1d5db;
}

.bg-gray-400 {
  background-color: #9ca3af;
}

.hover\:bg-gray-400:hover {
  background-color: #9ca3af;
}
</style>