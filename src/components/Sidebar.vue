<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  HomeIcon,
  ChartBarIcon,
  EnvelopeIcon,
  XMarkIcon,
  BuildingOfficeIcon
} from '@heroicons/vue/24/outline'

const emit = defineEmits(['close'])
const route = useRoute()

const navigation = [
  { name: 'Dashboard', icon: HomeIcon, route: '/' },
  { name: 'Reports', icon: ChartBarIcon, route: '/reports' },
  { name: 'Engagement', icon: EnvelopeIcon, route: '/engagement' },
  { name: 'Empresas', icon: BuildingOfficeIcon, route: '/empresas' }
]

function isCurrentRoute(itemRoute: string): boolean {
  return route.path === itemRoute;
}
</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
    <div class="p-6 flex items-center justify-between">
      <h1 class="text-2xl font-medium text-gray-900">NPS</h1>
      <!-- Close button for mobile -->
      <button 
        class="lg:hidden text-gray-500 hover:text-gray-700"
        @click="emit('close')"
      >
        <XMarkIcon class="h-6 w-6" />
      </button>
    </div>
    <nav class="flex-1 space-y-1 px-3 overflow-y-auto">
      <RouterLink
        v-for="item in navigation"
        :key="item.name"
        :to="item.route"
        class="flex items-center px-3 py-2 text-sm font-medium rounded-md"
        :class="[
          isCurrentRoute(item.route)
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-600 hover:bg-gray-50'
        ]"
        @click="emit('close')"
      >
        <component
          :is="item.icon"
          class="mr-3 h-6 w-6"
          :class="[
            isCurrentRoute(item.route)
              ? 'text-blue-600'
              : 'text-gray-400'
          ]"
        />
        {{ item.name }}
      </RouterLink>
    </nav>
  </aside>
</template>