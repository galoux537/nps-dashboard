import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { ref, watch } from 'vue'

export const TOKEN = 'PnT93H07RWGD2rzeONFt8rMXQsYBPFipLteI91xSBoYA5vypr2vU0zUZXcZB'

// Estado global para controlar a visibilidade do modal
export const showAuthModal = ref(false)

const api: AxiosInstance = axios.create({
  baseURL: 'https://app.3c.plus/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
  }
})

// Interceptor para configurar headers
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${TOKEN}`)
  }
  return config
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  response => {
    // Status 203 não é erro, é indicação de 2FA necessário
    if (response.status === 203) {
      return response
    }
    return response
  },
  async error => {
    console.error('Erro detalhado da API:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
      config: error.config
    })

    if (error.response?.status === 401) {
      console.error('Erro de autenticação:', error.response?.data)
      showAuthModal.value = true
      
      return new Promise((resolve, reject) => {
        const unwatch = watch(showAuthModal, async (newValue) => {
          if (!newValue) {
            unwatch()
            try {
              const response = await api.request(error.config)
              resolve(response)
            } catch (retryError) {
              console.error('Erro na retentativa:', retryError)
              reject(retryError)
            }
          }
        })
      })
    }
    return Promise.reject(error)
  }
)

export default api;
