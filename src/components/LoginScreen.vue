<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const credentials = ref({
  user: '',
  password: ''
})
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  const result = await authStore.login(credentials.value)
  
  if (!result.success) {
    error.value = result.error
    credentials.value.password = '' // Limpar apenas a senha
  }
  
  loading.value = false
}
</script>

<template>
  <div class="fixed inset-0 bg-gray-900 flex items-center justify-center">
    <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold text-center mb-6">
        Login Admin 3C+
      </h2>
      
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            v-model="credentials.user"
            type="email"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Digite seu e-mail"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Senha
          </label>
          <input
            v-model="credentials.password"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Digite sua senha"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>

        <div 
          v-if="error" 
          class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md"
        >
          <p class="text-red-600 text-center text-sm">
            {{ error }}
          </p>
        </div>
      </form>
    </div>
  </div>
</template> 