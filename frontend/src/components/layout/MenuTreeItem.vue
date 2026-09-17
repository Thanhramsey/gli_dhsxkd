<script setup lang="ts">
import { ref } from 'vue'
import type { MenuItem } from '../../types/auth'

defineProps<{ item: MenuItem; depth?: number; collapsed?: boolean }>()
const open = ref(false)

function targetPath(item: MenuItem) {
  return item.path || item.redirect || '/'
}
</script>

<template>
  <div class="menu-node">
    <button
      v-if="item.children.length || item.isHeading"
      class="menu-link"
      :class="{ 'menu-link--collapsed': collapsed }"
      :style="{ '--depth': depth || 0 }"
      type="button"
      :title="collapsed ? item.title : undefined"
      @click="open = !open"
    >
      <span class="menu-link__icon">{{ item.icon ? '◆' : '▦' }}</span>
      <span v-if="!collapsed" class="menu-link__text">{{ item.title }}</span>
      <span v-if="!collapsed" class="menu-link__chevron" :class="{ 'menu-link__chevron--open': open }">›</span>
    </button>
    <router-link
      v-else
      class="menu-link"
      :class="{ 'menu-link--collapsed': collapsed }"
      :style="{ '--depth': depth || 0 }"
      :to="targetPath(item)"
      :title="collapsed ? item.title : undefined"
    >
      <span class="menu-link__icon">{{ item.icon ? '◆' : '•' }}</span>
      <span v-if="!collapsed" class="menu-link__text">{{ item.title }}</span>
    </router-link>

    <div v-if="item.children.length && open && !collapsed" class="menu-children">
      <MenuTreeItem
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :depth="(depth || 0) + 1"
        :collapsed="collapsed"
      />
    </div>
  </div>
</template>

<style scoped>
.menu-link { width: calc(100% - 16px); min-height: 42px; display: flex; align-items: center; gap: 11px; margin: 3px 8px; padding: 8px 11px 8px calc(11px + var(--depth, 0) * 12px); color: #cbd9e4; cursor: pointer; text-decoration: none; background: transparent; border: 0; border-radius: 6px; font-family: inherit; text-align: left; transition: color .15s, background .15s; }
.menu-link:hover { color: #fff; background: rgba(255,255,255,.08); }
.menu-link.router-link-active { color: #fff; background: linear-gradient(90deg, #0079bd, #059ed2); box-shadow: 0 4px 12px rgba(0, 111, 177, .2); }
.menu-link--collapsed { width: 46px; justify-content: center; margin-inline: auto; padding: 8px; }
.menu-link__icon { display: grid; place-items: center; flex: 0 0 22px; color: #61c7eb; font-size: 12px; }
.router-link-active .menu-link__icon { color: #fff; }
.menu-link__text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
.menu-link__chevron { color: #8fa5b5; font-size: 20px; transform: rotate(0); transition: transform .16s; }.menu-link__chevron--open { transform: rotate(90deg); }
.menu-children { margin-left: 5px; }
</style>
