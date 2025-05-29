import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoadingStore = defineStore('loading', () => {
  const isLoading = ref(false)
  const progress = ref(0)

  const startLoading = () => {
    isLoading.value = true
    progress.value = 0
  }

  const updateProgress = (value: number) => {
    progress.value = value
  }

  const finishLoading = () => {
    progress.value = 100
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }

  return {
    isLoading,
    progress,
    startLoading,
    updateProgress,
    finishLoading
  }
}) 