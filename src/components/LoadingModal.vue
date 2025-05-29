<script setup lang="ts">
defineProps<{
  progress: number
}>()
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
      <div class="text-center">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Processando dados</h3>
        
        <!-- Barra de Progresso -->
        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        
        <!-- Porcentagem -->
        <p class="text-sm text-gray-600">
          {{ Math.round(progress) }}% concluído
        </p>
      </div>
    </div>
  </div>
</template> 