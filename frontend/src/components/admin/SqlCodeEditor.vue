<script setup lang="ts">
import { PLSQL, sql } from '@codemirror/lang-sql'
import { Codemirror } from 'vue-codemirror'

defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const extensions = [sql({ dialect: PLSQL })]
</script>

<template>
  <div class="sql-editor" :class="{ 'sql-editor--disabled': disabled }">
    <div class="sql-editor__label">
      <span>STRING_SQL</span>
      <small>Oracle SQL / PL/SQL</small>
    </div>
    <Codemirror
      :model-value="modelValue"
      :disabled="disabled"
      :extensions="extensions"
      :style="{ height: '320px' }"
      placeholder="Nhập câu lệnh SQL gọi trực tiếp dữ liệu..."
      :tab-size="2"
      indent-with-tab
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.sql-editor {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
}
.sql-editor:focus-within { border-color: rgb(var(--v-theme-primary)); box-shadow: 0 0 0 1px rgb(var(--v-theme-primary)); }
.sql-editor__label { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; color: rgba(var(--v-theme-on-surface), .7); border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); font-size: 12px; font-weight: 600; }
.sql-editor__label small { color: rgba(var(--v-theme-on-surface), .48); font-size: 10px; font-weight: 500; }
.sql-editor :deep(.cm-editor) { height: 100%; color: rgb(var(--v-theme-on-surface)); background: rgb(var(--v-theme-surface)); font-family: Consolas, 'Courier New', monospace; font-size: 13px; }
.sql-editor :deep(.cm-scroller) { overflow: auto; }
.sql-editor :deep(.cm-gutters) { color: rgba(var(--v-theme-on-surface), .46); background: rgba(var(--v-theme-primary), .04); border-right-color: rgba(var(--v-border-color), var(--v-border-opacity)); }
.sql-editor--disabled { opacity: .6; }
</style>
