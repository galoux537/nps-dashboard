<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const emit = defineEmits(['close', 'authenticated'])
const checking = ref(false)

// Função para verificar o token no maxlogin
const checkToken = () => {
  console.log('Verificando token no maxlogin...')
  
  if (authStore.updateToken()) {
    console.log('Token encontrado, autenticando...')
    emit('authenticated')
    return true
  }
  return false
}

// Verificar token quando o modal abrir
onMounted(() => {
  if (checkToken()) return
})

const openAdminPanel = () => {
  checking.value = true
  
  // Abrir o painel admin
  window.open('https://app.3c.plus/admin', '_blank')
  
  // Verificar o token a cada 1 segundo
  const interval = setInterval(() => {
    if (checkToken()) {
      clearInterval(interval)
      checking.value = false
    }
  }, 1000)

  // Parar após 30 segundos
  setTimeout(() => {
    clearInterval(interval)
    checking.value = false
  }, 30000)
}
</script>

<template>
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="text-center mb-6">
        <h3 class="text-lg font-medium text-gray-900">
          Autenticação Necessária
        </h3>
        <p class="text-sm text-gray-500 mt-1">
          {{ checking ? 'Verificando autenticação...' : 'Clique abaixo para acessar o painel administrativo:' }}
        </p>
        <button
          @click="openAdminPanel"
          :disabled="checking"
          class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ checking ? 'Verificando...' : 'Acessar Painel 3C' }}
        </button>
      </div>
    </div>
  </div>
</template> 