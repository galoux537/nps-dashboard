<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import { subDays, format } from 'date-fns'
import type { FeedbackData } from '../stores/feedback'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Estender o tipo jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const feedbackStore = useFeedbackStore()
const isTableMounted = ref(true) // Alterado para sempre true
const searchQuery = ref('') // Novo estado para o campo de busca

// Estado para controle da ordenação
const sortField = ref<keyof FeedbackData>('user_id')
const sortDirection = ref('desc')

// Adicionar estado para controlar o filtro de comentários
const showOnlyWithComments = ref(false)

// Watch para dados do feedbackStore
watch(() => feedbackStore.feedbackData, (newData) => {
  if (newData.length > 0) {
    // Quando novos dados são carregados, filtra automaticamente para 30 dias
    const today = new Date()
    const thirtyDaysAgo = subDays(today, 30)
    feedbackStore.filterFeedback('month', [], [], null, null)
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
  if (sortField.value === field) {
    // Se já está ordenando por este campo, inverte a direção
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Se é um novo campo, define ele como padrão e direção descendente
    sortField.value = field as keyof FeedbackData
    sortDirection.value = 'desc'
  }
}

// Filtragem baseada na pesquisa
const filteredBySearch = computed(() => {
  if (!searchQuery.value.trim()) return tableData.value
  
  const query = searchQuery.value.toLowerCase().trim()
  return tableData.value.filter(item => {
    return (
      String(item.user_id).toLowerCase().includes(query) ||
      String(item.score).toLowerCase().includes(query) ||
      (item.reason && item.reason.toLowerCase().includes(query)) ||
      String(item.created_at).toLowerCase().includes(query) ||
      String(item.company_id).toLowerCase().includes(query) ||
      (item.role && item.role.toLowerCase().includes(query))
    )
  })
})

// Modificar sortedData para aplicar filtro de comentários e pesquisa
const sortedData = computed(() => {
  // Primeiro aplicamos a filtragem por pesquisa
  let result = [...filteredBySearch.value]
  
  // Depois ordenamos
  result = result.sort((a, b) => {
    const aValue = Number(a[sortField.value as keyof FeedbackData])
    const bValue = Number(b[sortField.value as keyof FeedbackData])
    
    if (sortField.value === 'score') {
      return sortDirection.value === 'asc' 
        ? aValue - bValue 
        : bValue - aValue
    }
    
    if (sortField.value === 'created_at') {
      return sortDirection.value === 'asc'
        ? new Date(aValue).getTime() - new Date(bValue).getTime()
        : new Date(bValue).getTime() - new Date(aValue).getTime()
    }
    
    return 0
  })
  
  // Por fim aplicamos o filtro de comentários, se ativado
  if (showOnlyWithComments.value) {
    result = result.filter(item => item.reason && item.reason.trim().length > 0)
  }
  
  return result
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

// Função aprimorada para exportação CSV com melhor formatação
const exportToCSV = () => {
  event?.stopPropagation();
  isExportMenuOpen.value = false;
  
  try {
    // Usar ponto e vírgula como separador (padrão mais comum no Brasil)
    const separator = ";";
    
    // Preparar dados para exportação com formatação melhorada
    const headers = ['ID', 'Nota', 'Status', 'Comentário', 'Data', 'Empresa', 'Função'];
    
    // Mapear dados com formatação consistente
    const dataToExport = sortedData.value.map(item => {
      // Obter o status do NPS
      const npsZone = getNPSZone(item.score).zone;
      
      // Formatar a data no padrão brasileiro
      const formattedDate = format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss');
      
      // Sanitizar o comentário - remover quebras de linha e aspas duplicadas
      const sanitizedComment = item.reason 
        ? item.reason.replace(/"/g, '""').replace(/\n/g, ' ') 
        : '';
      
      return [
        item.user_id,                  // ID
        item.score,                    // Nota
        npsZone,                       // Status
        sanitizedComment,              // Comentário
        formattedDate,                 // Data
        item.company_id,               // Empresa
        item.role                      // Função
      ];
    });
    
    // Adicionar cabeçalho com formatação
    const formattedHeaders = headers.map(header => `"${header}"`);
    
    // Montar as linhas com formatação consistente
    const formattedRows = dataToExport.map(row => 
      row.map((cell, index) => {
        // Garantir que todos os campos de texto tenham aspas
        if (typeof cell === 'string') {
          return `"${cell}"`;
        }
        // Números podem ficar sem aspas
        return cell;
      }).join(separator)
    );
    
    // Montar o conteúdo CSV
    const csvContent = [
      formattedHeaders.join(separator),
      ...formattedRows
    ].join('\n');
    
    // Adicionar BOM para garantir compatibilidade com caracteres especiais no Excel
    const BOM = '\uFEFF';
    const finalContent = BOM + csvContent;
    
    // Configurar o arquivo para download
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Nome do arquivo com a data
    const fileName = `relatorio-nps-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    
    // Configurar e executar o download
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Download de CSV concluído');
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    alert('Erro ao gerar o arquivo CSV.');
  }
};

// Função aprimorada para exportar PDF com tabela formatada
const exportToPDF = () => {
  event?.stopPropagation();
  isExportMenuOpen.value = false;
  
  try {
    // Criar novo documento PDF
    const doc = new jsPDF();
    
    // Configurações de página
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    
    // Adicionar título na primeira página
    doc.setFontSize(18);
    doc.text('Relatório NPS', margin, margin + 12);
    
    // Informações do relatório
    doc.setFontSize(11);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, margin, margin + 20);
    doc.text(`Total de registros: ${sortedData.value.length}`, margin, margin + 26);
    
    // Depois, adicionar tipagem para os callbacks
    interface AutoTableData {
      section: string;
      column: { index: number };
      cell: { text: string };
      [key: string]: any;
    }

    // Na função que usa autoTable
    doc.autoTable({
      startY: margin + 35,
      head: [['ID', 'Nota', 'Status', 'Comentário', 'Data', 'Empresa', 'Função']],
      body: sortedData.value.map(item => [
        item.user_id,
        item.score,
        getNPSZone(item.score).zone,
        item.reason || '',
        format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss'),
        item.company_id,
        item.role
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 20 }, // ID
        1: { cellWidth: 15 }, // Nota
        2: { cellWidth: 25 }, // Status
        3: { cellWidth: 'auto' }, // Comentário
        4: { cellWidth: 35 }, // Data
        5: { cellWidth: 20 }, // Empresa
        6: { cellWidth: 20 }, // Função
      },
      theme: 'grid', // Adiciona linhas de grade à tabela
      margin: { top: margin, right: margin, bottom: margin, left: margin },
      // Adicionar tipo para o parâmetro data
      didDrawPage: (data: any) => {
        // Adicionar número da página no rodapé
        doc.setFontSize(8);
        doc.text(
          `Página ${doc.getNumberOfPages()}`,
          data.settings.margin.left,
          pageHeight - 10
        );
      },
      // Adicionar tipo para o parâmetro data
      willDrawCell: (data: AutoTableData) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.text.length > 50) {
          data.cell.text = data.cell.text.substring(0, 47) + '...';
        }
      }
    });
    
    // Salvar o PDF
    doc.save(`relatorio-nps-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    alert('Erro ao gerar o arquivo PDF. Detalhes: ' + error);
  }
};

// Versão simplificada para teste
const exportToCSVSimples = () => {
  const dados = "coluna1,coluna2,coluna3\nvalor1,valor2,valor3";
  const blob = new Blob([dados], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = "teste.csv";
  link.click();
};

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
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th 
                  @click="toggleSort('score')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sortable"
                >
                  <div class="flex items-center">
                    NOTA
                    <span class="sort-icon ml-1">
                      <span v-if="sortField !== 'score'">⇵</span>
                      <span v-else>{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
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
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.user_id }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm" :class="getNPSZone(item.score).textColor">{{ item.score }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="[getNPSZone(item.score).color, 'text-xs font-medium px-2.5 py-0.5 rounded-full']">
                    {{ getNPSZone(item.score).zone }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">{{ item.reason }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.created_at }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.company_id }}</td>
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