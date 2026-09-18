<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminApi } from '../api/admin.api'
import { getAuthErrorMessage } from '../api/auth.api'
import SqlCodeEditor from '../components/admin/SqlCodeEditor.vue'
import type { ReportDefinition, ReportGroup, ReportInput } from '../types/admin'

type Tab = 'groups' | 'reports'
type DeleteTarget =
  | { type: 'group'; item: ReportGroup }
  | { type: 'report'; item: ReportDefinition }

const route = useRoute()
const router = useRouter()
const activeTab = ref<Tab>(route.name === 'reports' ? 'reports' : 'groups')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const groupFilter = ref<string | null>(null)
const groups = ref<ReportGroup[]>([])
const reports = ref<ReportDefinition[]>([])

const groupDialog = ref(false)
const editingGroup = ref<ReportGroup | null>(null)
const groupForm = reactive({ name: '', note: '' })

const reportDialog = ref(false)
const editingReport = ref<ReportDefinition | null>(null)
const reportForm = reactive<Required<ReportInput>>({
  name: '', sql: '', tm1: '', tm2: '', tm3: '', tm4: '', tm5: '', tm6: '', tm7: '',
  reportView: '', reportExport: '', groupId: '', procedurePackage: '',
})

const deleteDialog = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)

const groupHeaders = [
  { title: 'ID', key: 'id', width: 90 },
  { title: 'Tên nhóm báo cáo', key: 'name' },
  { title: 'Ghi chú', key: 'note' },
  { title: 'Số báo cáo', key: 'reportCount', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 110 },
]
const reportHeaders = [
  { title: 'ID', key: 'id', width: 90 },
  { title: 'Tên báo cáo', key: 'name' },
  { title: 'Nhóm báo cáo', key: 'groupName' },
  { title: 'Kiểu thực thi', key: 'execution', sortable: false },
  { title: 'View / Export', key: 'output', sortable: false },
  { title: '', key: 'actions', sortable: false, width: 110 },
]
const reportParameterKeys = ['tm1', 'tm2', 'tm3', 'tm4', 'tm5', 'tm6', 'tm7'] as const

const groupOptions = computed(() => groups.value.map((group) => ({
  title: group.name,
  value: group.id,
})))
const filteredGroups = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase('vi')
  if (!keyword) return groups.value
  return groups.value.filter((group) => [group.id, group.name, group.note]
    .some((value) => value?.toLocaleLowerCase('vi').includes(keyword)))
})
const filteredReports = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase('vi')
  return reports.value.filter((report) => {
    const matchesGroup = !groupFilter.value || report.groupId === groupFilter.value
    const matchesKeyword = !keyword || [report.id, report.name, report.groupName, report.procedurePackage]
      .some((value) => value?.toLocaleLowerCase('vi').includes(keyword))
    return matchesGroup && matchesKeyword
  })
})
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (deleteTarget.value.type === 'group') {
    return `Xóa nhóm báo cáo “${deleteTarget.value.item.name}”?`
  }
  return `Xóa báo cáo “${deleteTarget.value.item.name}”?`
})

watch(() => route.name, (name) => {
  activeTab.value = name === 'reports' ? 'reports' : 'groups'
  search.value = ''
})

function changeTab(tab: unknown) {
  const value: Tab = tab === 'reports' ? 'reports' : 'groups'
  void router.replace({ name: value === 'reports' ? 'reports' : 'report-groups' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[groups.value, reports.value] = await Promise.all([
      adminApi.reportGroups(),
      adminApi.reports(),
    ])
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

function notify(message: string) {
  success.value = message
}

function openGroup(group?: ReportGroup) {
  editingGroup.value = group ?? null
  groupForm.name = group?.name ?? ''
  groupForm.note = group?.note ?? ''
  groupDialog.value = true
}

async function saveGroup() {
  if (!groupForm.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const input = { name: groupForm.name.trim(), note: groupForm.note.trim() }
    if (editingGroup.value) await adminApi.updateReportGroup(editingGroup.value.id, input)
    else await adminApi.createReportGroup(input)
    groupDialog.value = false
    notify(editingGroup.value ? 'Đã cập nhật nhóm báo cáo' : 'Đã thêm nhóm báo cáo')
    await load()
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    saving.value = false
  }
}

function openReport(report?: ReportDefinition) {
  editingReport.value = report ?? null
  const parameters = report?.parameters ?? []
  Object.assign(reportForm, report ? {
    name: report.name,
    sql: report.sql ?? '',
    tm1: parameters[0] ?? '', tm2: parameters[1] ?? '', tm3: parameters[2] ?? '',
    tm4: parameters[3] ?? '', tm5: parameters[4] ?? '', tm6: parameters[5] ?? '',
    tm7: parameters[6] ?? '',
    reportView: report.reportView ?? '',
    reportExport: report.reportExport ?? '',
    groupId: report.groupId ?? '',
    procedurePackage: report.procedurePackage ?? '',
  } : {
    name: '', sql: '', tm1: '', tm2: '', tm3: '', tm4: '', tm5: '', tm6: '', tm7: '',
    reportView: '', reportExport: '', groupId: '', procedurePackage: '',
  })
  reportDialog.value = true
}

async function saveReport() {
  if (!reportForm.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const input = Object.fromEntries(
      Object.entries(reportForm).map(([key, value]) => [key, value.trim()]),
    ) as unknown as ReportInput
    if (editingReport.value) await adminApi.updateReport(editingReport.value.id, input)
    else await adminApi.createReport(input)
    reportDialog.value = false
    notify(editingReport.value ? 'Đã cập nhật báo cáo' : 'Đã thêm báo cáo')
    await load()
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    saving.value = false
  }
}

function requestDelete(target: DeleteTarget) {
  deleteTarget.value = target
  deleteDialog.value = true
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  saving.value = true
  error.value = ''
  try {
    if (target.type === 'group') {
      await adminApi.deleteReportGroup(target.item.id)
      notify('Đã xóa nhóm báo cáo')
    } else {
      await adminApi.deleteReport(target.item.id)
      notify('Đã xóa báo cáo')
    }
    deleteDialog.value = false
    deleteTarget.value = null
    await load()
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container class="report-config" fluid>
    <header class="page-head">
      <div>
        <p>CẤU HÌNH BÁO CÁO</p>
        <h1>Danh mục và nguồn dữ liệu báo cáo</h1>
        <span>Quản lý nhóm báo cáo, câu lệnh SQL, thủ tục và mẫu xuất báo cáo.</span>
      </div>
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="load">Tải lại</v-btn>
    </header>

    <v-alert v-if="error" class="mb-4" type="error" variant="tonal" closable @click:close="error = ''">{{ error }}</v-alert>

    <v-tabs v-model="activeTab" class="report-tabs mb-4" color="primary" bg-color="surface" grow @update:model-value="changeTab">
      <v-tab value="groups" prepend-icon="mdi-folder-table-outline">Nhóm báo cáo <v-chip class="ml-2" size="x-small">{{ groups.length }}</v-chip></v-tab>
      <v-tab value="reports" prepend-icon="mdi-file-chart-outline">Báo cáo <v-chip class="ml-2" size="x-small">{{ reports.length }}</v-chip></v-tab>
    </v-tabs>

    <v-card v-if="activeTab === 'groups'" class="report-panel" elevation="0">
      <v-card-title class="panel-head">
        <div><strong>Nhóm báo cáo</strong><small>Dữ liệu từ ONEBSS_NHOMBC_GLI</small></div>
        <div class="toolbar">
          <v-text-field v-model="search" width="320" density="compact" variant="outlined" hide-details clearable prepend-inner-icon="mdi-magnify" placeholder="Tìm nhóm báo cáo..." />
          <v-btn color="primary" prepend-icon="mdi-folder-plus-outline" @click="openGroup()">Thêm nhóm</v-btn>
        </div>
      </v-card-title>
      <v-data-table class="report-table" :headers="groupHeaders" :items="filteredGroups" :items-per-page="15" item-value="id" no-data-text="Chưa có nhóm báo cáo">
        <template #item.id="{ item }"><v-chip size="x-small" color="primary" variant="tonal">{{ item.id }}</v-chip></template>
        <template #item.note="{ item }">{{ item.note || '—' }}</template>
        <template #item.reportCount="{ item }"><v-chip size="small" color="info" variant="tonal">{{ item.reportCount }} báo cáo</v-chip></template>
        <template #item.actions="{ item }"><div class="actions"><v-btn icon="mdi-pencil-outline" size="small" variant="text" color="primary" title="Sửa" @click="openGroup(item)" /><v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" title="Xóa" :disabled="item.reportCount > 0" @click="requestDelete({ type: 'group', item })" /></div></template>
      </v-data-table>
    </v-card>

    <v-card v-else class="report-panel" elevation="0">
      <v-card-title class="panel-head">
        <div><strong>Báo cáo</strong><small>Dữ liệu từ ONEBSS_BAOCAO_GLI</small></div>
        <div class="toolbar">
          <v-select v-model="groupFilter" :items="groupOptions" width="230" density="compact" variant="outlined" hide-details clearable label="Lọc theo nhóm" />
          <v-text-field v-model="search" width="300" density="compact" variant="outlined" hide-details clearable prepend-inner-icon="mdi-magnify" placeholder="Tìm báo cáo..." />
          <v-btn color="primary" prepend-icon="mdi-file-plus-outline" @click="openReport()">Thêm báo cáo</v-btn>
        </div>
      </v-card-title>
      <v-data-table class="report-table" :headers="reportHeaders" :items="filteredReports" :items-per-page="20" item-value="id" no-data-text="Chưa có báo cáo">
        <template #item.id="{ item }"><v-chip size="x-small" color="primary" variant="tonal">{{ item.id }}</v-chip></template>
        <template #item.name="{ item }"><strong>{{ item.name }}</strong><small class="record-meta">{{ item.procedurePackage || (item.sql ? 'Có cấu hình SQL' : 'Chưa cấu hình nguồn dữ liệu') }}</small></template>
        <template #item.groupName="{ item }">{{ item.groupName || 'Chưa phân nhóm' }}</template>
        <template #item.execution="{ item }"><div class="chips"><v-chip v-if="item.sql" size="x-small" color="success" variant="tonal">SQL</v-chip><v-chip v-if="item.procedurePackage" size="x-small" color="secondary" variant="tonal">PROC_PK</v-chip><span v-if="!item.sql && !item.procedurePackage">—</span></div></template>
        <template #item.output="{ item }"><small>{{ item.reportView || '—' }}</small><small class="record-meta">{{ item.reportExport || '' }}</small></template>
        <template #item.actions="{ item }"><div class="actions"><v-btn icon="mdi-pencil-outline" size="small" variant="text" color="primary" title="Sửa" @click="openReport(item)" /><v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" title="Xóa" @click="requestDelete({ type: 'report', item })" /></div></template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="groupDialog" max-width="620">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between"><span>{{ editingGroup ? 'Cập nhật nhóm báo cáo' : 'Thêm nhóm báo cáo' }}</span><v-btn icon="mdi-close" variant="text" @click="groupDialog = false" /></v-card-title>
        <v-divider />
        <v-form @submit.prevent="saveGroup"><v-card-text><v-text-field v-model.trim="groupForm.name" label="Tên nhóm báo cáo *" variant="outlined" maxlength="200" autofocus /><v-textarea v-model.trim="groupForm.note" label="Ghi chú" variant="outlined" maxlength="1000" counter rows="3" /></v-card-text><v-divider /><v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="groupDialog = false">Hủy</v-btn><v-btn type="submit" color="primary" prepend-icon="mdi-content-save-outline" :loading="saving" :disabled="!groupForm.name.trim()">Lưu nhóm</v-btn></v-card-actions></v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="reportDialog" max-width="1120" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between"><span>{{ editingReport ? 'Cập nhật báo cáo' : 'Thêm báo cáo' }}</span><v-btn icon="mdi-close" variant="text" @click="reportDialog = false" /></v-card-title>
        <v-divider />
        <v-form @submit.prevent="saveReport">
          <v-card-text class="report-form"><v-row>
            <v-col cols="12" md="8"><v-text-field v-model.trim="reportForm.name" label="Tên báo cáo *" variant="outlined" maxlength="500" /></v-col>
            <v-col cols="12" md="4"><v-select v-model="reportForm.groupId" :items="groupOptions" label="Nhóm báo cáo" variant="outlined" clearable /></v-col>
            <v-col cols="12"><SqlCodeEditor v-model="reportForm.sql" /></v-col>
            <v-col cols="12" md="4"><v-text-field v-model.trim="reportForm.procedurePackage" label="PROC_PK" variant="outlined" maxlength="500" hint="Package/procedure nếu không gọi SQL trực tiếp" persistent-hint /></v-col>
            <v-col cols="12" md="4"><v-text-field v-model.trim="reportForm.reportView" label="RPT_VIEW" variant="outlined" maxlength="500" /></v-col>
            <v-col cols="12" md="4"><v-text-field v-model.trim="reportForm.reportExport" label="RPT_EXPORT" variant="outlined" maxlength="500" /></v-col>
            <v-col cols="12"><v-expansion-panels variant="accordion"><v-expansion-panel title="Tham số báo cáo (TM1 – TM7)"><v-expansion-panel-text><v-row><v-col v-for="(key, index) in reportParameterKeys" :key="key" cols="12" sm="6" md="4"><v-text-field v-model.trim="reportForm[key]" :label="`TM${index + 1}`" variant="outlined" density="comfortable" maxlength="500" /></v-col></v-row></v-expansion-panel-text></v-expansion-panel></v-expansion-panels></v-col>
          </v-row></v-card-text>
          <v-divider />
          <v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="reportDialog = false">Hủy</v-btn><v-btn type="submit" color="primary" prepend-icon="mdi-content-save-outline" :loading="saving" :disabled="!reportForm.name.trim()">Lưu báo cáo</v-btn></v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="460">
      <v-card><v-card-title class="d-flex align-center ga-2"><v-icon icon="mdi-alert-circle-outline" color="error" />Xác nhận xóa</v-card-title><v-card-text>{{ deleteMessage }}</v-card-text><v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="deleteDialog = false">Hủy</v-btn><v-btn color="error" prepend-icon="mdi-delete-outline" :loading="saving" @click="confirmDelete">Xóa</v-btn></v-card-actions></v-card>
    </v-dialog>

    <v-overlay v-model="loading" class="align-center justify-center" persistent><v-progress-circular color="primary" indeterminate size="48" /></v-overlay>
    <v-snackbar :model-value="!!success" color="success" location="top right" timeout="2500" @update:model-value="!$event && (success = '')">{{ success }}</v-snackbar>
  </v-container>
</template>

<style scoped>
.report-config { width: min(1440px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 60px; }
.page-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.page-head p { margin: 0 0 5px; color: rgb(var(--v-theme-primary)); font-size: 11px; font-weight: 800; letter-spacing: 1.3px; }
.page-head h1 { margin: 0; color: rgb(var(--v-theme-on-background)); font-size: 29px; }
.page-head span { display: block; margin-top: 6px; color: rgba(var(--v-theme-on-background), .62); font-size: 14px; }
.report-tabs { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px; }
.report-panel { overflow: hidden; border: 0; border-radius: 8px; box-shadow: 0 3px 12px rgba(29, 61, 83, .08)!important; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 82px; padding: 16px 20px; white-space: normal; }
.panel-head { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.panel-head strong,.panel-head small { display: block; }.panel-head strong { font-size: 18px; }.panel-head small { margin-top: 5px; color: rgba(var(--v-theme-on-surface), .58); font-size: 11px; font-weight: 400; }
.toolbar,.actions,.chips { display: flex; align-items: center; gap: 8px; }.actions { justify-content: flex-end; }
.record-meta { display: block; margin-top: 4px; color: rgba(var(--v-theme-on-surface), .56); font-size: 11px; }
.report-table :deep(.v-data-table__th) { height: 43px!important; color: rgba(var(--v-theme-on-surface), .66)!important; background: rgba(var(--v-theme-primary), .05)!important; font-size: 11px!important; text-transform: uppercase; letter-spacing: .5px; }
.report-table :deep(tbody tr) { transition: background-color .15s ease; }
.report-table :deep(tbody tr:hover) { background: rgba(var(--v-theme-primary), .045); }
.report-table :deep(.v-data-table-footer) { min-height: 64px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.report-form { min-height: 65vh; }
@media (max-width: 900px) { .report-config { width: min(100% - 24px, 1440px); }.page-head,.panel-head,.toolbar { align-items: stretch; flex-direction: column; }.toolbar :deep(.v-input) { width: 100%!important; } }
</style>
