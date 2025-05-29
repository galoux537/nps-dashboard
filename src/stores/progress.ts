import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProgressStore = defineStore('progress', () => {
  const isLoading = ref(false)
  const progress = ref(0)
  const message = ref('')

  const startLoading = (initialMessage = 'Carregando...') => {
    isLoading.value = true
    progress.value = 0
    message.value = initialMessage
  }

  const updateProgress = (value: number, newMessage?: string) => {
    progress.value = value
    if (newMessage) {
      message.value = newMessage
    }
  }

  const finishLoading = () => {
    progress.value = 100
    setTimeout(() => {
      isLoading.value = false
      progress.value = 0
      message.value = ''
    }, 500)
  }

  return {
    isLoading,
    progress,
    message,
    startLoading,
    updateProgress,
    finishLoading
  }
}) 