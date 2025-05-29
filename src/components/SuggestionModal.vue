<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const suggestion = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

const sendSuggestion = async () => {
  if (!suggestion.value.trim()) {
    error.value = 'Por favor, escreva sua sugestão'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Pegar o email do usuário logado
    const userEmail = authStore.credentials?.user || 'Usuário não identificado'

    await fetch('https://formsubmit.co/ajax/gabriel.ida@grupo-3c.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message: suggestion.value,
        _subject: 'Sugestão de Melhoria - Dashboard NPS',
        _template: 'table',
        name: userEmail, // Incluir o email do usuário que enviou
        from: userEmail // Também incluir como remetente
      })
    })
    
    success.value = true
    suggestion.value = ''
    
    setTimeout(() => {
      emit('close')
      success.value = false
    }, 1500)
  } catch (e) {
    error.value = 'Erro ao enviar sugestão. Tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          Sugestão de Melhoria
        </h3>
        <button 
          @click="emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <span class="sr-only">Fechar</span>
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="success" class="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
        Sugestão enviada com sucesso!
      </div>

      <form @submit.prevent="sendSuggestion" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Sua sugestão:
          </label>
          <textarea
            v-model="suggestion"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
            placeholder="Descreva sua sugestão de melhoria..."
          ></textarea>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            {{ loading ? 'Enviando...' : 'Enviar Sugestão' }}
          </button>
        </div>

        <p v-if="error" class="text-red-600 text-sm text-center">
          {{ error }}
        </p>
      </form>
    </div>
  </div>
</template> 