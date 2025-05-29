import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'
import type { LoginCredentials, TwoFactorAuth, AuthResponse } from '../types/auth'
import api from '../nps-module/plugins/axios'

// Importar o token inicial
import { TOKEN } from '../nps-module/plugins/axios'

// Função para pegar o token da 3C
const get3CToken = (): string | null => {
  try {
    // Verificar todas as requisições na network tab
    const requests = performance.getEntriesByType('resource')
      .filter(entry => entry.name.includes('app.3c.plus'))
    
    // Se houver requisições para a 3C, pegar o token do header
    if (requests.length > 0) {
      const headers = document.cookie.split(';')
      for (const header of headers) {
        if (header.includes('Bearer ')) {
          const token = header.split('Bearer ')[1].trim()
          console.log('Token encontrado:', token.substring(0, 30) + '...')
          return token
        }
      }
    }

    // Tentar pegar do sessionStorage também
    const sessionToken = sessionStorage.getItem('3c_auth_token')
    if (sessionToken) {
      return sessionToken
    }

    return null
  } catch (error) {
    console.error('Erro ao buscar token:', error)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const requires2FA = ref(false)
  const currentCredentials = ref<LoginCredentials | null>(null)
  const credentials = ref<{ user: string; password: string } | null>(null)
  let tokenCheckInterval: number | null = null

  // Função para pegar o token do header Authorization da requisição totalmaxlogin
  const updateToken = () => {
    try {
      // Pegar todas as requisições da network tab
      const entries = performance.getEntriesByType('resource')
      
      // Procurar a requisição totalmaxlogin
      const maxLoginRequest = entries.find(entry => 
        entry.name.includes('totalmaxlogin') || 
        entry.name.includes('maxlogin')
      )

      if (maxLoginRequest) {
        // Pegar o header Authorization
        const headers = document.querySelector('.headers-container')
        const authHeader = headers?.textContent?.match(/Bearer\s+([^\s]+)/)
        
        if (authHeader?.[1]) {
          const bearerToken = authHeader[1]
          console.log('Token encontrado no maxlogin:', bearerToken.substring(0, 20) + '...')
          
          token.value = bearerToken
          api.defaults.headers.common['Authorization'] = `Bearer ${bearerToken}`
          isAuthenticated.value = true
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Erro ao pegar token:', error)
      return false
    }
  }

  // Função para verificar e atualizar autenticação
  const checkAuth = async () => {
    const maxLoginToken = await getMaxLoginToken()
    if (maxLoginToken) {
      token.value = maxLoginToken
      api.defaults.headers.common['Authorization'] = `Bearer ${maxLoginToken}`
      isAuthenticated.value = true
      return true
    }
    return false
  }

  // Função para verificar e atualizar o token
  const checkAndUpdateToken = async () => {
    try {
      // Tentar pegar o token do localStorage da 3C
      const token3C = localStorage.getItem('token') || 
                     localStorage.getItem('access_token') ||
                     localStorage.getItem('3c_token')

      if (token3C && token3C !== token.value) {
        console.log('Token encontrado, validando...')
        
        // Configurar e testar o token
        api.defaults.headers.common['Authorization'] = `Bearer ${token3C}`
        
        // Testar o token com uma requisição
        await api.get('/nps')
        
        // Se chegou aqui, o token é válido
        token.value = token3C
        isAuthenticated.value = true
        return true
      }
    } catch (error) {
      console.error('Erro ao validar token:', error)
      delete api.defaults.headers.common['Authorization']
    }
    return false
  }

  // Iniciar verificação do token
  const startTokenCheck = () => {
    stopTokenCheck() // Limpar intervalo anterior
    console.log('Iniciando verificação de token...')
    
    // Verificar imediatamente
    checkAndUpdateToken()
    
    // E continuar verificando a cada 1 segundo
    tokenCheckInterval = window.setInterval(async () => {
      const success = await checkAndUpdateToken()
      if (success) {
        console.log('Token válido encontrado, parando verificação')
        stopTokenCheck()
      }
    }, 1000)
  }

  const stopTokenCheck = () => {
    if (tokenCheckInterval) {
      clearInterval(tokenCheckInterval)
      tokenCheckInterval = null
    }
  }

  // Função para ser chamada quando o modal é aberto
  const handleAuthModal = () => {
    startTokenCheck() // Começar a verificar o token
  }

  // Cleanup
  onUnmounted(() => {
    stopTokenCheck()
  })

  // Função simplificada de login que apenas verifica credenciais admin
  const login = async (userCredentials: { user: string; password: string }) => {
    try {
      const response = await api.post('/authenticate', {
        user: userCredentials.user,
        password: userCredentials.password,
        token_type: 'jwt'
      })

      if (response.status === 203) {
        isAuthenticated.value = true
        credentials.value = { user: userCredentials.user, password: '' } // Guardar apenas o email
        return { success: true }
      }

      return { success: false, error: 'E-mail ou senha inválidos' }
    } catch (error) {
      return { 
        success: false,
        error: 'E-mail ou senha inválidos'
      }
    }
  }

  // Passo 2: Verificação do código 2FA
  const verify2FA = async (otpCode: string) => {
    if (!currentCredentials.value) {
      return { error: 'Sessão expirada, faça login novamente' }
    }

    try {
      // Formato exato que a API espera
      const twoFactorData = {
        user: currentCredentials.value.user,
        password: currentCredentials.value.password,
        token_type: 'jwt',
        location_identifier: "0000-0000-0000",
        otp_code: otpCode
      }

      console.log('Enviando 2FA:', {
        user: twoFactorData.user,
        otp_code: twoFactorData.otp_code,
        location_identifier: twoFactorData.location_identifier
      })

      const response = await api.post('/two-factor/callback', twoFactorData)
      
      if (response.data?.access_token) {
        handleAuthSuccess(response.data)
        return { success: true }
      }

      return { error: 'Código 2FA inválido' }
    } catch (error: any) {
      // Log mais detalhado para debug
      console.error('Erro 2FA:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors,
        data: error.response?.data
      })
      
      return { 
        error: error.response?.data?.message || 'Código 2FA inválido'
      }
    }
  }

  const handleAuthSuccess = (data: AuthResponse) => {
    if (!data.access_token) {
      console.error('Token não encontrado na resposta:', data)
      return
    }

    token.value = data.access_token
    isAuthenticated.value = true
    requires2FA.value = false
    currentCredentials.value = null

    // Configurar token para todas as requisições futuras
    api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
  }

  const logout = () => {
    token.value = null
    isAuthenticated.value = false
    requires2FA.value = false
    currentCredentials.value = null
    delete api.defaults.headers.common['Authorization']
  }

  return {
    token,
    isAuthenticated,
    requires2FA,
    credentials,
    login,
    verify2FA,
    logout,
    checkAuth,
    handleAuthModal,
    startTokenCheck,
    stopTokenCheck,
    updateToken
  }
}) 