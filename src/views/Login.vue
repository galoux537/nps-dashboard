<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const credentials = ref({
  user: '',
  password: '',
  company_domain: ''
})

const twoFactorCode = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const result = await authStore.login(credentials.value)
    
    if (result.requires2FA) {
      // Aguardar código 2FA
      return
    }
    
    if (result.success) {
      router.push('/dashboard')
    } else {
      error.value = result.error || 'Erro ao fazer login'
    }
  } finally {
    loading.value = false
  }
}

const handle2FAVerification = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const result = await authStore.verify2FA(twoFactorCode.value)
    if (result.success) {
      router.push('/dashboard')
    } else {
      error.value = result.error || 'Código 2FA inválido'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sua jornada começa aqui
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Um único login para todos os produtos da 3C Plus
        </p>
      </div>

      <!-- Form de Login -->
      <form v-if="!authStore.requires2FA" class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <input
              v-model="credentials.user"
              type="email"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="E-mail"
            />
          </div>
          <div>
            <input
              v-model="credentials.password"
              type="password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Senha"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Entrar
          </button>
        </div>
      </form>

      <!-- Form 2FA -->
      <form v-else class="mt-8 space-y-6" @submit.prevent="handle2FAVerification">
        <div>
          <input
            v-model="twoFactorCode"
            type="text"
            required
            class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Código de verificação"
          />
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Verificar
          </button>
        </div>
      </form>

      <div v-if="error" class="mt-4 text-red-600 text-center">
        {{ error }}
      </div>
    </div>
  </div>
</template> 