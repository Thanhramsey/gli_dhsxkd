<script setup lang="ts">
import type { MenuItem } from '../../types/auth'
import { hasMenuTarget, resolveMenuPath } from '../../utils/menu-path'

defineProps<{ item: MenuItem }>()

function targetPath(item: MenuItem) {
  return resolveMenuPath(item) || '/'
}

function menuIcon(item: MenuItem) {
  if (item.icon?.startsWith('mdi-')) return item.icon
  return item.children.length ? 'mdi-folder-outline' : 'mdi-circle-small'
}
</script>

<template>
  <v-list-group v-if="item.children.length" :value="item.id">
    <template #activator="{ props }">
      <v-list-item v-bind="props" :title="item.title" :prepend-icon="menuIcon(item)" rounded="lg" />
    </template>
    <MenuTreeItem v-for="child in item.children" :key="child.id" :item="child" />
  </v-list-group>
  <v-list-item
    v-else-if="item.isHeading && !hasMenuTarget(item)"
    :title="item.title"
    :prepend-icon="menuIcon(item)"
    rounded="lg"
    disabled
  />
  <v-list-item
    v-else
    :to="targetPath(item)"
    :title="item.title"
    :prepend-icon="menuIcon(item)"
    rounded="lg"
  />
</template>

<style scoped>
:deep(.v-list-item){margin-block:3px;color:#cbd9e4}:deep(.v-list-item:hover){color:#fff;background:rgba(255,255,255,.08)}:deep(.v-list-item--active){color:#fff;background:linear-gradient(90deg,#0079bd,#059ed2)}:deep(.v-icon){color:#61c7eb}:deep(.v-list-item-title){font-size:12px;font-weight:500}
</style>
