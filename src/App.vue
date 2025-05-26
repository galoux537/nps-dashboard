<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
</script>

<template>
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
  </div>
</template>