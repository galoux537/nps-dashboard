<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import NpsTable from './nps-module/components/NpsTable.vue'
import ProgressModal from './components/ProgressModal.vue'
import { initializeFeedback } from './plugins/feedbackInit'
import { useFeedbackStore } from './stores/feedback'
import LoadingOverlay from './components/LoadingOverlay.vue'
import { useLoadingStore } from './stores/loading'
import AuthModal from './components/AuthModal.vue'
import { showAuthModal } from './nps-module/plugins/axios'
import { useAuthStore } from './stores/auth'
import LoginScreen from './components/LoginScreen.vue'

const isSidebarOpen = ref(false)
const feedbackStore = useFeedbackStore()
const loadingStore = useLoadingStore()
const authStore = useAuthStore()

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Inicializar dados assim que o app montar
onMounted(async () => {
  try {
    await initializeFeedback()
  } catch (error) {
    console.error('Erro ao inicializar:', error)
  }
})

const handleAuthenticated = () => {
  showAuthModal.value = false
}
</script>

<template>
  <LoginScreen v-if="!authStore.isAuthenticated" />
  
  <template v-else>
    <LoadingOverlay 
      v-if="loadingStore.isLoading"
      :progress="loadingStore.progress"
    />
    <div class="flex h-screen bg-[#F9FAFC] relative">
      <!-- Mobile sidebar backdrop -->
      <div 
        v-if="isSidebarOpen" 
        class="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden" 
        @click="toggleSidebar"
      ></div>

      <!-- Sidebar -->
      <div 
        :class="[
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'fixed inset-y-0 z-40 lg:relative lg:translate-x-0 lg:flex transition-transform duration-300 ease-in-out'
        ]"
      >
        <Sidebar @close="toggleSidebar" />
      </div>

      <!-- Main content -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header @toggle-sidebar="toggleSidebar" />
        <main class="flex-1 p-4 md:p-6 overflow-auto">
          <RouterView />
        </main>
      </div>
      <ProgressModal />
      <AuthModal 
        v-if="showAuthModal"
        @close="showAuthModal = false"
        @authenticated="handleAuthenticated"
      />
    </div>
  </template>
</template>