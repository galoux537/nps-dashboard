<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  message?: string
  progress?: number
}>()

const loadingSteps = ref([
  { text: 'Inicializando conexão...', done: false },
  { text: 'Buscando dados do NPS...', done: false },
  { text: 'Processando métricas...', done: false },
  { text: 'Gerando visualizações...', done: false }
])

// Observar mudanças no progresso para sincronizar os steps
watch(() => props.progress, (newProgress) => {
  if (newProgress) {
    // Para os primeiros 3 steps, manter a lógica atual
    const stepsToComplete = Math.floor((newProgress / 100) * (loadingSteps.value.length - 1))
    loadingSteps.value.forEach((step, index) => {
      if (index < loadingSteps.value.length - 1) {
        step.done = index < stepsToComplete
      } else {
        // Último step só é marcado como concluído quando atingir 100%
        step.done = newProgress >= 100
      }
    })
  }
}, { immediate: true })

onMounted(() => {
  // animateLoading() // removido
})

// Função mantida mas não será chamada automaticamente
const animateLoading = async () => {
  const stepDuration = 800
  for (let i = 0; i < loadingSteps.value.length; i++) {
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    loadingSteps.value[i].done = true
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-50 flex items-center justify-center">
    <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
      <div class="space-y-6">
        <!-- Logo ou ícone animado -->
        <div class="flex justify-center">
          <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
            <svg class="w-10 h-10 text-blue-500 animate-spin" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          </div>
        </div>

        <!-- Mensagem principal -->
        <div class="text-center">
          <h3 class="text-xl font-semibold text-gray-900">
            {{ message || 'Carregando dados do NPS' }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            Isso pode demorar alguns minutos na primeira vez...
          </p>
        </div>

        <!-- Barra de progresso -->
        <div class="relative">
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 transition-all duration-300 ease-in-out"
              :style="{ width: `${progress || 0}%` }"
            ></div>
          </div>
          <span class="absolute right-0 -top-6 text-sm text-gray-500">
            {{ Math.round(progress || 0) }}%
          </span>
        </div>

        <!-- Steps de loading -->
        <div class="space-y-3">
          <div
            v-for="(step, index) in loadingSteps"
            :key="index"
            class="flex items-center space-x-3 p-2 rounded-lg transition-colors duration-300"
            :class="step.done ? 'bg-green-50' : 'bg-gray-50'"
          >
            <div 
              :class="[
                'transition-all duration-300 flex-shrink-0',
                step.done ? 'text-green-500' : 'text-gray-400'
              ]"
            >
              <svg
                v-if="step.done"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
                class="w-5 h-5 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            </div>
            <span 
              class="text-sm flex-1"
              :class="step.done ? 'text-gray-900' : 'text-gray-500'"
            >
              {{ step.text }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.transform {
  animation: slideIn 0.3s ease-out;
}
</style> 