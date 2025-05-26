<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  apiKey: string
  data: any
  isAnalyzing: boolean
}>()

const emit = defineEmits(['update:show', 'update:api-key', 'insights-generated'])

// Estrutura mais detalhada para análise empresarial
interface EmpresaAnalysis {
  diagnostico: string
  acoesPrioritarias: string[]
  metaNPS: number
  analiseDetalhada: {
    problemasPrincipais: string[]
    padraoReclamacoes: string
    impactoNegocio: string
    recomendacoesPorFuncao: {
      [key: string]: string[]
    }
  }
  maiorReclamacao?: string
  reclamacoesFrequentes?: string[]
  planoAcao?: {
    acoesImediatas: string[]
    acoesMedioPrazo: string[]
    metricas: string[]
  }
  gestor?: string
  supervisor?: {
    summary: string
    positives: string[]
    improvements: string[]
  }
  agente?: {
    summary: string
    positives: string[]
    improvements: string[]
  }
  justificativa?: string
  recommendations?: string[]
}

const insights = ref<EmpresaAnalysis | null>(null)

const error = ref<string>('')
const isLoading = ref(false)
const currentRole = ref<'gestor' | 'supervisor' | 'agente' | null>(null)

// Função otimizada para limpar comentários - mais eficiente
const cleanComments = (comments: any[]) => {
  return comments
    .filter(c => c.text?.trim().length > 5 && !/^(ok|sim|não|nao|teste|\.|\-)+$/i.test(c.text.trim()))
    .slice(0, 10) // Limita a 10 comentários mais recentes
    .map(c => ({
      text: c.text.trim().slice(0, 200), // Limita tamanho do texto
      score: c.score
    }))
}

// Função otimizada para análise
const analyzeRole = async (role: 'gestor' | 'supervisor' | 'agente') => {
  try {
    const validComments = cleanComments(props.data[role].comments)
    const npsScore = props.data[role].nps

    if (validComments.length === 0) {
      return {
        summary: `Sem dados suficientes para ${role}`,
        positives: [],
        improvements: []
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Usando modelo mais rápido
        temperature: 0.3, // Reduzindo variabilidade para respostas mais diretas
        max_tokens: 200, // Limitando tamanho da resposta
        messages: [{
          role: "system",
          content: "Analise rápida e direta do NPS. Seja extremamente conciso."
        }, {
          role: "user",
          content: `NPS: ${npsScore}%
            Comentários recentes:
            ${validComments.map(c => `[${c.score}] ${c.text}`).join('\n')}
            
            Forneça exatamente:
            1. Uma frase resumo
            2. Um ponto positivo
            3. Um ponto a melhorar`
        }]
      })
    })

    const data = await response.json()
    const analysis = data.choices[0].message.content.split('\n')

    return {
      summary: analysis[0]?.replace(/^1\.[\s-]*/, '') || '',
      positives: [analysis[1]?.replace(/^2\.[\s-]*/, '') || ''],
      improvements: [analysis[2]?.replace(/^3\.[\s-]*/, '') || '']
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    return {
      summary: `Erro na análise de ${role}: ${errorMessage}`,
      positives: [],
      improvements: []
    }
  }
}

// Função principal otimizada
const analyzeData = async () => {
  if (!props.apiKey) {
    error.value = 'Chave da API necessária'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Análise paralela otimizada
    const [gestorAnalysis, supervisorAnalysis, agenteAnalysis] = await Promise.all([
      analyzeRole('gestor'),
      analyzeRole('supervisor'),
      analyzeRole('agente')
    ])

    insights.value = {
      // Propriedades obrigatórias da interface EmpresaAnalysis
      diagnostico: 'Análise geral do período',
      acoesPrioritarias: [
        'Melhorar estabilidade do sistema',
        'Investir em treinamento da equipe',
        'Aprimorar comunicação entre áreas'
      ],
      metaNPS: 75,
      analiseDetalhada: {
        problemasPrincipais: [
          'Instabilidade do sistema',
          'Tempo de resposta',
          'Comunicação entre equipes'
        ],
        padraoReclamacoes: 'Padrão identificado nas reclamações',
        impactoNegocio: 'Impacto significativo na satisfação dos usuários',
        recomendacoesPorFuncao: {
          gestor: ['Melhorar processos', 'Implementar métricas'],
          supervisor: ['Acompanhamento mais próximo', 'Treinamento da equipe'],
          agente: ['Capacitação contínua', 'Melhor documentação']
        }
      },
      
      // Propriedades opcionais
      maiorReclamacao: 'Instabilidade do sistema',
      reclamacoesFrequentes: ['Sistema lento', 'Falta de comunicação', 'Problemas técnicos'],
      planoAcao: {
        acoesImediatas: ['Otimizar sistema', 'Treinar equipe'],
        acoesMedioPrazo: ['Implementar novo processo', 'Desenvolver documentação'],
        metricas: ['Tempo de resposta', 'Satisfação do usuário']
      },
      gestor: JSON.stringify(gestorAnalysis),
      supervisor: supervisorAnalysis,
      agente: agenteAnalysis,
      recommendations: [
        'Melhorar estabilidade do sistema',
        'Investir em treinamento da equipe',
        'Aprimorar comunicação entre áreas'
      ]
    }

    // Emitir resultados e fechar
    emit('insights-generated', JSON.parse(JSON.stringify(insights.value)))
    emit('update:show', false)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = 'Erro na análise: ' + errorMessage
    console.error('Erro na análise:', { 
      error: errorMessage, 
      context: currentRole.value 
    })
  } finally {
    isLoading.value = false
  }
}

// Função melhorada para análise empresarial
const analyzeEmpresaData = async () => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.4,
        max_tokens: 500,
        messages: [{
          role: "system",
          content: `Você é um especialista em análise de NPS e satisfação do cliente.
            Analise os dados fornecidos e forneça insights acionáveis focados em:
            1. Diagnóstico preciso do problema
            2. Ações práticas específicas para cada função
            3. Metas realistas baseadas no contexto
            4. Padrões de reclamações e seus impactos`
        }, {
          role: "user",
          content: generateDetailedPrompt(props.data)
        }]
      })
    })

    const data = await response.json()
    
    // Processa e estrutura a resposta
    const analysis = parseAIResponse(data.choices[0].message.content)
    insights.value = analysis
    
    emit('insights-generated', analysis)
  } catch (err: unknown) {
    console.error('Erro na análise:', err)
    error.value = 'Falha ao gerar análise detalhada'
  }
}

// Função para gerar prompt mais específico e detalhado
const generateDetailedPrompt = (data: any) => `
Analise detalhada da empresa ${data.nome} nos últimos 4 meses:

Métricas Gerais:
- NPS Atual: ${data.nps}%
- Total Avaliações: ${data.totalAvaliacoes}
- Reclamações mais frequentes (top 5):
${data.detalhes.avaliacoesNegativas
  .slice(0, 5)
  .map((r: { texto: string; count: number; score: number; role: string }) => 
    `- "${r.texto}" (${r.count} ocorrências, Nota ${r.score}, ${r.role})`)
  .join('\n')}

Análise por Função:
${Object.entries(data.detalhes.roleBreakdown)
  .map(([role, info]: [string, any]) => 
    `${role}: NPS ${info.nps}% (${info.total} avaliações)
     Principais reclamações: ${info.reclamacoes.slice(0, 3).join(', ')}`)
  .join('\n')}

Forneça uma análise estruturada com:
1. Resumo da maior reclamação (uma frase curta e direta)
2. Top 3 reclamações mais frequentes com contexto
3. Plano de ação detalhado:
   - Ações imediatas (próximos 30 dias)
   - Ações de médio prazo (90 dias)
   - Métricas de acompanhamento
4. Meta realista de NPS para 3 meses com justificativa
`

// Função melhorada para processar resposta da IA
const parseAIResponse = (response: string): EmpresaAnalysis => {
  const sections = response.split('\n\n')
  
  return {
    // Propriedades obrigatórias
    diagnostico: sections[0]?.replace(/^Diagnóstico:?\s*/i, '').trim() || 'Sem diagnóstico disponível',
    acoesPrioritarias: sections[1]?.split('\n')
      .filter(line => line.startsWith('-'))
      .map(line => line.replace(/^-\s*/, '')) || [],
    metaNPS: parseInt(sections[3]?.match(/\d+/)?.[0] || '0', 10),
    analiseDetalhada: {
      problemasPrincipais: sections[2]?.split('\n')
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '')) || [],
      padraoReclamacoes: sections[2]?.replace(/^Padrões:?\s*/i, '').trim() || 'Sem padrões identificados',
      impactoNegocio: sections[2]?.replace(/^Impacto:?\s*/i, '').trim() || 'Impacto não avaliado',
      recomendacoesPorFuncao: {}
    },
    
    // Propriedades opcionais
    maiorReclamacao: sections[0]?.replace(/^Maior reclamação:?\s*/i, '').trim() || 'N/A',
    reclamacoesFrequentes: sections[1]?.split('\n')
      .filter(line => line.startsWith('-'))
      .map(line => line.replace(/^-\s*/, '')) || [],
    planoAcao: {
      acoesImediatas: ['Ação 1', 'Ação 2'],
      acoesMedioPrazo: ['Ação 3', 'Ação 4'],
      metricas: ['Métrica 1', 'Métrica 2']
    },
    justificativa: sections[3]?.replace(/.*justificativa:?\s*/i, '').trim() || '',
    gestor: sections[4]?.replace(/^Gestor:?\s*/i, '').trim() || 'N/A'
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-gray-600 bg-opacity-50"></div>
    
    <!-- Modal -->
    <div class="relative z-50 flex items-center justify-center min-h-screen p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div class="p-6">
          <h2 class="text-xl font-semibold mb-4">Configurar Análise</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Chave da API OpenAI
              </label>
              <input
                type="password"
                :value="apiKey"
                @input="$emit('update:api-key', ($event.target as HTMLInputElement).value)"
                class="w-full border-gray-300 rounded-md shadow-sm"
                placeholder="sk-..."
                :disabled="isLoading"
              />
            </div>
            
            <div class="flex justify-end gap-3">
              <button
                @click="$emit('update:show', false)"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                :disabled="isLoading"
              >
                Cancelar
              </button>
              <button
                @click="analyzeData"
                :disabled="isLoading || !apiKey"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {{ isLoading ? 'Analisando...' : 'Analisar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="isLoading" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <div class="flex items-center space-x-3">
          <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-700">
            Analisando dados {{ currentRole ? `do ${currentRole}` : '' }}...
          </p>
        </div>
      </div>
    </div>
  </div>
</template> 