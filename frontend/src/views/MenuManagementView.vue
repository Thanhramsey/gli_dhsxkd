<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { adminApi } from '../api/admin.api'
import { getAuthErrorMessage } from '../api/auth.api'
import { useAuthStore } from '../stores/auth.store'
import type { AdminGroup, AdminUser, EmployeeOption, MenuInput, MenuItem, UserInput } from '../types/admin'

type Tab = 'users' | 'groups' | 'menus'
interface FlatMenu extends MenuItem { level: number }
type DeleteTarget =
  | { type: 'user'; item: AdminUser }
  | { type: 'group'; item: AdminGroup }
  | { type: 'menu'; item: FlatMenu }

const auth = useAuthStore()
const activeTab = ref<Tab>('users')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const userPage = ref(1)
const users = ref<AdminUser[]>([])
const groups = ref<AdminGroup[]>([])
const menus = ref<MenuItem[]>([])
const employees = ref<EmployeeOption[]>([])
const employeeSearch = ref('')
const employeeLoading = ref(false)
const selectedEmployee = ref<EmployeeOption | null>(null)
let employeeSearchTimer: ReturnType<typeof window.setTimeout> | undefined
let employeeRequestId = 0

const userDialog = ref(false)
const editingUser = ref<AdminUser | null>(null)
const userForm = reactive<UserInput>({ account: '', employeeId: '', status: 1, groupIds: [] })

const groupDialog = ref(false)
const editingGroup = ref<AdminGroup | null>(null)
const groupName = ref('')
const selectedGroupId = ref('')
const permissionIds = ref<string[]>([])
const openedMenuIds = ref<string[]>([])

const menuDialog = ref(false)
const editingMenu = ref<FlatMenu | null>(null)
const deleteDialog = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)
const menuForm = reactive<MenuInput>({ name: '', url: '', parentId: '', orderIndex: 0, icon: '', isHeading: false })
const userHeaders = [
  { title: 'Tài khoản', key: 'account' },
  { title: 'Nhân viên', key: 'employeeName' },
  { title: 'Đơn vị', key: 'unitName' },
  { title: 'Nhóm quyền', key: 'groupNames', sortable: false },
  { title: 'Trạng thái', key: 'status' },
  { title: '', key: 'actions', sortable: false },
]
const menuHeaders = [
  { title: 'Tên menu', key: 'name' },
  { title: 'ID', key: 'id' },
  { title: 'URL', key: 'path' },
  { title: 'Icon', key: 'icon' },
  { title: 'Thứ tự', key: 'orderNo' },
  { title: 'Loại', key: 'isHeading' },
  { title: '', key: 'actions', sortable: false },
]
const statusOptions = [
  { title: 'Đang hoạt động', value: 1 },
  { title: 'Ngừng hoạt động', value: 0 },
]

function flatten(items: MenuItem[], level = 0): FlatMenu[] {
  return items.flatMap((item) => [{ ...item, level }, ...flatten(item.children, level + 1)])
}

const flatMenus = computed(() => flatten(menus.value))
const menuParentOptions = computed(() => [
  { title: 'Không có menu cha', value: '' },
  ...flatMenus.value
    .filter((item) => item.id !== editingMenu.value?.id)
    .map((item) => ({ title: `${'— '.repeat(item.level)}${item.name}`, value: item.id })),
])
const selectedGroup = computed(() => groups.value.find((group) => group.id === selectedGroupId.value) ?? null)
const selectedUserGroupId = computed<string | null>({
  get: () => userForm.groupIds[0] ?? null,
  set: (groupId) => { userForm.groupIds = groupId ? [groupId] : [] },
})
const employeeOptions = computed(() => {
  const options = [...employees.value]
  if (selectedEmployee.value && !options.some((employee) => employee.id === selectedEmployee.value?.id)) {
    options.unshift(selectedEmployee.value)
  }
  return options
})
const filteredUsers = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase('vi')
  if (!keyword) return users.value
  return users.value.filter((user) => [user.account, user.displayName, user.employeeName, user.unitName, ...user.groupNames]
    .some((value) => value?.toLocaleLowerCase('vi').includes(keyword)))
})
const filteredMenus = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase('vi')
  if (!keyword) return flatMenus.value
  return flatMenus.value.filter((menu) => [menu.id, menu.name, menu.path].some((value) => value?.toLocaleLowerCase('vi').includes(keyword)))
})

function menuDescription(menu: MenuItem): string {
  if (menu.children.length) return `${menu.children.length} menu con`
  return menu.path || 'Chưa cấu hình đường dẫn'
}

function branchIds(menu: MenuItem): string[] {
  return [menu.id, ...menu.children.flatMap(branchIds)]
}

function isMenuChecked(menu: MenuItem): boolean {
  return permissionIds.value.includes(menu.id)
}

function isMenuIndeterminate(menu: MenuItem): boolean {
  if (isMenuChecked(menu)) return false
  return menu.children
    .flatMap(branchIds)
    .some((id) => permissionIds.value.includes(id))
}

function toggleMenuPermission(menu: MenuItem, checked: boolean | null) {
  const selected = new Set(permissionIds.value)
  const ids = branchIds(menu)

  if (checked) {
    ids.forEach((id) => selected.add(id))
    const byId = new Map(flatMenus.value.map((item) => [item.id, item]))
    let parentId = menu.parentId
    while (parentId) {
      selected.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  } else {
    ids.forEach((id) => selected.delete(id))
    const byId = new Map(flatMenus.value.map((item) => [item.id, item]))
    let parentId = menu.parentId
    while (parentId) {
      const parent = byId.get(parentId)
      if (!parent) break
      const hasSelectedChild = parent.children
        .flatMap(branchIds)
        .some((id) => selected.has(id))
      if (!hasSelectedChild) selected.delete(parentId)
      parentId = parent.parentId
    }
  }

  permissionIds.value = [...selected]
}

function selectAllPermissions() {
  permissionIds.value = flatMenus.value.map((menu) => menu.id)
}

function clearPermissions() {
  permissionIds.value = []
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[users.value, groups.value, menus.value] = await Promise.all([
      adminApi.users(), adminApi.groups(), adminApi.menus(),
    ])
    openedMenuIds.value = flatMenus.value
      .filter((menu) => menu.children.length > 0)
      .map((menu) => menu.id)
    if (!groups.value.some((group) => group.id === selectedGroupId.value)) {
      selectGroup(groups.value[0])
    } else {
      selectGroup(groups.value.find((group) => group.id === selectedGroupId.value))
    }
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

function notify(message: string) {
  success.value = message
  window.setTimeout(() => { success.value = '' }, 2500)
}

function openUser(user?: AdminUser) {
  editingUser.value = user ?? null
  employeeSearch.value = ''
  employees.value = []
  selectedEmployee.value = user?.employeeId ? {
    id: user.employeeId,
    code: user.employeeCode || user.employeeId,
    name: user.employeeName || user.displayName || user.account,
    unitName: user.unitName,
  } : null
  Object.assign(userForm, user ? {
    account: user.account,
    employeeId: user.employeeId,
    status: user.status,
    groupIds: [...user.groupIds],
  } : { account: '', employeeId: '', status: 1, groupIds: [] })
  userDialog.value = true
}

function employeeTitle(employee: EmployeeOption) {
  return `${employee.name} — ${employee.code}${employee.unitName ? ` · ${employee.unitName}` : ''}`
}

function selectEmployee(employeeId: string | null) {
  selectedEmployee.value = employeeOptions.value.find((employee) => employee.id === employeeId) ?? null
}

watch(employeeSearch, (value) => {
  if (employeeSearchTimer) window.clearTimeout(employeeSearchTimer)
  const requestId = ++employeeRequestId
  const keyword = value.trim()
  if (keyword.length < 2) {
    employees.value = []
    employeeLoading.value = false
    return
  }

  employeeSearchTimer = window.setTimeout(async () => {
    employeeLoading.value = true
    try {
      const results = await adminApi.employees(keyword)
      if (requestId === employeeRequestId) employees.value = results
    } catch (reason) {
      if (requestId === employeeRequestId) error.value = getAuthErrorMessage(reason)
    } finally {
      if (requestId === employeeRequestId) employeeLoading.value = false
    }
  }, 300)
})

watch(search, () => { userPage.value = 1 })

async function saveUser() {
  saving.value = true
  error.value = ''
  try {
    if (editingUser.value) await adminApi.updateUser(editingUser.value.id, userForm)
    else await adminApi.createUser(userForm)
    userDialog.value = false
    notify(editingUser.value ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
  finally { saving.value = false }
}

function deleteUser(user: AdminUser) {
  deleteTarget.value = { type: 'user', item: user }
  deleteDialog.value = true
}

function openGroup(group?: AdminGroup) {
  editingGroup.value = group ?? null
  groupName.value = group?.name ?? ''
  groupDialog.value = true
}

async function saveGroup() {
  saving.value = true
  error.value = ''
  try {
    if (editingGroup.value) await adminApi.updateGroup(editingGroup.value.id, groupName.value)
    else await adminApi.createGroup(groupName.value)
    groupDialog.value = false
    notify(editingGroup.value ? 'Đã cập nhật nhóm' : 'Đã thêm nhóm')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
  finally { saving.value = false }
}

function deleteGroup(group: AdminGroup) {
  deleteTarget.value = { type: 'group', item: group }
  deleteDialog.value = true
}

function selectGroup(group?: AdminGroup) {
  selectedGroupId.value = group?.id ?? ''
  permissionIds.value = [...(group?.menuIds ?? [])]
}

async function savePermissions() {
  if (!selectedGroup.value) return
  saving.value = true
  try {
    await adminApi.assignGroupMenus(selectedGroup.value.id, permissionIds.value)
    notify('Đã cập nhật quyền menu của nhóm')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
  finally { saving.value = false }
}

function openMenu(menu?: FlatMenu) {
  editingMenu.value = menu ?? null
  Object.assign(menuForm, menu ? {
    name: menu.name,
    url: menu.path ?? '',
    parentId: menu.parentId ?? '',
    orderIndex: menu.orderNo,
    icon: menu.icon ?? '',
    isHeading: menu.isHeading,
  } : { name: '', url: '', parentId: '', orderIndex: 0, icon: '', isHeading: false })
  menuDialog.value = true
}

async function saveMenu() {
  saving.value = true
  error.value = ''
  try {
    if (editingMenu.value) await adminApi.updateMenu(editingMenu.value.id, menuForm)
    else await adminApi.createMenu(menuForm)
    menuDialog.value = false
    notify(editingMenu.value ? 'Đã cập nhật menu' : 'Đã thêm menu')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
  finally { saving.value = false }
}

function deleteMenu(menu: FlatMenu) {
  deleteTarget.value = { type: 'menu', item: menu }
  deleteDialog.value = true
}

const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (deleteTarget.value.type === 'user') return `Xóa tài khoản “${deleteTarget.value.item.account}”?`
  if (deleteTarget.value.type === 'group') return `Xóa nhóm “${deleteTarget.value.item.name}”? Các liên kết người dùng và menu của nhóm cũng sẽ bị xóa.`
  return `Xóa menu “${deleteTarget.value.item.name}”?`
})

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  saving.value = true
  try {
    if (target.type === 'user') {
      await adminApi.deleteUser(target.item.id)
      notify('Đã xóa người dùng')
    } else if (target.type === 'group') {
      await adminApi.deleteGroup(target.item.id)
      notify('Đã xóa nhóm người dùng')
    } else {
      await adminApi.deleteMenu(target.item.id)
      notify('Đã xóa menu')
    }
    deleteDialog.value = false
    deleteTarget.value = null
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
  finally { saving.value = false }
}

onMounted(load)
onBeforeUnmount(() => {
  if (employeeSearchTimer) window.clearTimeout(employeeSearchTimer)
})
</script>

<template>
  <main class="admin-page">
    <header class="page-head">
      <div><p>QUẢN TRỊ HỆ THỐNG</p><h1>Người dùng & phân quyền</h1><span>Quản lý tập trung người dùng, nhóm quyền và cây menu ứng dụng.</span></div>
      <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="load">Tải lại</v-btn>
    </header>

    <v-alert v-if="error" class="mb-4" type="error" variant="tonal" closable @click:close="error = ''">{{ error }}</v-alert>
    <v-alert v-if="success" class="mb-4" type="success" variant="tonal" closable @click:close="success = ''">{{ success }}</v-alert>

    <v-tabs v-model="activeTab" class="admin-tabs mb-4" color="primary" bg-color="surface" grow @update:model-value="search = ''">
      <v-tab value="users" prepend-icon="mdi-account-multiple-outline">Người dùng <v-chip class="ml-2" size="x-small">{{ users.length }}</v-chip></v-tab>
      <v-tab value="groups" prepend-icon="mdi-account-group-outline">Nhóm người dùng <v-chip class="ml-2" size="x-small">{{ groups.length }}</v-chip></v-tab>
      <v-tab value="menus" prepend-icon="mdi-menu">Quản lý menu <v-chip class="ml-2" size="x-small">{{ flatMenus.length }}</v-chip></v-tab>
    </v-tabs>

    <v-card v-if="activeTab === 'users'" class="panel" variant="outlined">
      <header class="panel-head"><div><h2>Danh sách người dùng</h2></div><div class="toolbar"><v-text-field v-model="search" width="320" density="compact" variant="outlined" hide-details clearable prepend-inner-icon="mdi-magnify" placeholder="Tìm tài khoản, họ tên, đơn vị..." /><v-btn color="primary" prepend-icon="mdi-account-plus-outline" @click="openUser()">Thêm người dùng</v-btn></div></header>
      <v-data-table v-model:page="userPage" class="user-table" :headers="userHeaders" :items="filteredUsers" :items-per-page="20" :items-per-page-options="[10, 20, 50]" item-value="id" items-per-page-text="Số dòng mỗi trang" no-data-text="Không có người dùng phù hợp">
        <template #item.account="{ item }"><strong>{{ item.account }}</strong><small>{{ item.displayName }}</small></template>
        <template #item.employeeName="{ item }">{{ item.employeeName || '—' }}<small>{{ item.employeeCode || item.employeeId }}</small></template>
        <template #item.unitName="{ item }">{{ item.unitName || '—' }}</template>
        <template #item.groupNames="{ item }"><div class="chips"><v-chip v-for="name in item.groupNames" :key="name" size="x-small" color="info" variant="tonal">{{ name }}</v-chip><em v-if="!item.groupNames.length">Chưa gán nhóm</em></div></template>
        <template #item.status="{ item }"><v-chip :color="item.status === 0 ? 'error' : 'success'" size="small" variant="tonal">{{ item.status === 0 ? 'Ngừng hoạt động' : 'Đang hoạt động' }}</v-chip></template>
        <template #item.actions="{ item }"><div class="actions"><v-btn size="small" variant="text" color="primary" icon="mdi-pencil-outline" title="Sửa và phân quyền" @click="openUser(item)" /><v-btn size="small" variant="text" color="error" icon="mdi-delete-outline" title="Xóa" :disabled="item.account === auth.user?.account" @click="deleteUser(item)" /></div></template>
      </v-data-table>
    </v-card>

    <section v-else-if="activeTab === 'groups'" class="group-layout">
      <v-card class="panel group-list" variant="outlined"><header class="panel-head"><div><h2>Nhóm người dùng</h2><p>Chọn nhóm để cấu hình quyền.</p></div><v-btn color="primary" prepend-icon="mdi-account-multiple-plus-outline" @click="openGroup()">Thêm nhóm</v-btn></header>
        <v-list v-if="groups.length" class="group-items" nav>
          <v-list-item v-for="group in groups" :key="group.id" :active="selectedGroupId === group.id" color="primary" rounded="lg" :title="group.name" :subtitle="`${group.userCount} người dùng · ${group.menuIds.length} menu`" append-icon="mdi-chevron-right" @click="selectGroup(group)" />
        </v-list>
        <div v-else class="empty">Chưa có nhóm người dùng</div>
      </v-card>
      <v-card class="panel permissions" variant="outlined"><header class="panel-head"><div><h2>{{ selectedGroup?.name || 'Quyền menu' }}</h2><p>Menu được chọn sẽ áp dụng cho tất cả người dùng thuộc nhóm.</p></div><div v-if="selectedGroup" class="actions"><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-pencil-outline" @click="openGroup(selectedGroup)">Đổi tên</v-btn><v-btn size="small" variant="tonal" color="error" prepend-icon="mdi-delete-outline" :disabled="selectedGroup.id === '0'" @click="deleteGroup(selectedGroup)">Xóa nhóm</v-btn></div></header>
        <div v-if="selectedGroup" class="permission-tree">
          <div class="permission-tree__toolbar">
            <div>
              <strong>Cây quyền chức năng</strong>
              <small>Chọn menu cha để cấp toàn bộ menu con; chọn menu con sẽ tự giữ quyền menu cha.</small>
            </div>
            <div class="permission-tree__actions">
              <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-checkbox-multiple-marked-outline" @click="selectAllPermissions">Chọn tất cả</v-btn>
              <v-btn size="small" variant="text" color="secondary" prepend-icon="mdi-checkbox-multiple-blank-outline" @click="clearPermissions">Bỏ chọn</v-btn>
            </div>
          </div>
          <v-treeview
            v-model:opened="openedMenuIds"
            class="menu-permission-tree"
            :items="menus"
            item-title="name"
            item-value="id"
            item-children="children"
            indent-lines
            density="comfortable"
            color="primary"
            expand-icon="mdi-chevron-down"
            collapse-icon="mdi-chevron-up"
            no-data-text="Chưa có menu hệ thống"
          >
            <template #prepend="{ item }">
              <v-checkbox-btn
                :model-value="isMenuChecked(item)"
                :indeterminate="isMenuIndeterminate(item)"
                color="primary"
                density="compact"
                :aria-label="`Phân quyền menu ${item.name}`"
                @click.stop
                @update:model-value="toggleMenuPermission(item, $event)"
              />
            </template>
            <template #title="{ item }">
              <div class="menu-node__title">
                <strong>{{ item.name }}</strong>
                <v-chip v-if="item.children.length" size="x-small" color="info" variant="tonal">Menu cha</v-chip>
                <v-chip v-else-if="item.isHeading" size="x-small" color="secondary" variant="tonal">Tiêu đề</v-chip>
                <v-chip v-else size="x-small" color="success" variant="tonal">Chức năng</v-chip>
              </div>
            </template>
            <template #subtitle="{ item }">
              <span class="menu-node__meta">ID {{ item.id }} · {{ menuDescription(item) }}</span>
            </template>
          </v-treeview>
        </div>
        <div v-else class="empty">Chọn một nhóm để gán quyền</div>
        <footer v-if="selectedGroup" class="panel-footer"><span>Đã chọn {{ permissionIds.length }}/{{ flatMenus.length }} menu</span><v-btn color="primary" :loading="saving" prepend-icon="mdi-content-save-outline" @click="savePermissions">Lưu phân quyền</v-btn></footer>
      </v-card>
    </section>

    <v-card v-else class="panel" variant="outlined">
      <header class="panel-head"><div><h2>Cây menu hệ thống</h2><p>Dữ liệu từ GLI_MENU, menu có con phải được xử lý trước khi xóa.</p></div><div class="toolbar"><v-text-field v-model="search" width="300" density="compact" variant="outlined" hide-details clearable prepend-inner-icon="mdi-magnify" placeholder="Tìm tên, ID hoặc URL..." /><v-btn color="primary" prepend-icon="mdi-menu-plus" @click="openMenu()">Thêm menu</v-btn></div></header>
      <v-data-table class="menu-table" :headers="menuHeaders" :items="filteredMenus" :items-per-page="20" :items-per-page-options="[10, 20, 50]" item-value="id" no-data-text="Chưa có menu">
        <template #item.name="{ item }"><strong class="tree-name" :style="{ paddingLeft: `${item.level * 22}px` }"><v-icon v-if="item.level" icon="mdi-subdirectory-arrow-right" size="16" />{{ item.name }}</strong></template>
        <template #item.id="{ item }"><v-chip size="x-small" color="primary" variant="tonal">{{ item.id }}</v-chip></template>
        <template #item.path="{ item }">{{ item.path || '—' }}</template>
        <template #item.icon="{ item }">{{ item.icon || '—' }}</template>
        <template #item.isHeading="{ item }"><v-chip size="small" :color="item.isHeading ? 'info' : 'success'" variant="tonal">{{ item.isHeading ? 'Tiêu đề' : 'Chức năng' }}</v-chip></template>
        <template #item.actions="{ item }"><div class="actions"><v-btn size="small" variant="text" color="primary" icon="mdi-pencil-outline" title="Sửa" @click="openMenu(item)" /><v-btn size="small" variant="text" color="error" icon="mdi-delete-outline" title="Xóa" @click="deleteMenu(item)" /></div></template>
      </v-data-table>
    </v-card>

    <v-overlay v-model="loading" class="align-center justify-center" persistent><v-progress-circular color="primary" indeterminate size="48" /></v-overlay>

    <v-dialog v-model="userDialog" max-width="720">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between"><span>{{ editingUser ? 'Cập nhật người dùng' : 'Thêm người dùng' }}</span><v-btn icon="mdi-close" variant="text" @click="userDialog = false" /></v-card-title>
        <v-divider />
        <v-form @submit.prevent="saveUser">
          <v-card-text><v-row>
            <v-col cols="12" md="6"><v-text-field v-model.trim="userForm.account" label="Mã người dùng (MA_ND) *" variant="outlined" maxlength="100" :disabled="!!editingUser" required /></v-col>
            <v-col cols="12"><v-autocomplete id="employee-select" v-model="userForm.employeeId" v-model:search="employeeSearch" :items="employeeOptions" :item-title="employeeTitle" item-value="id" :loading="employeeLoading" :no-data-text="employeeSearch.trim().length < 2 ? 'Nhập ít nhất 2 ký tự để tìm' : 'Không tìm thấy nhân viên'" label="Nhân viên *" placeholder="Tìm theo tên hoặc mã nhân viên" variant="outlined" no-filter required @update:model-value="selectEmployee" /></v-col>
            <v-col cols="12" md="6"><v-select v-model="userForm.status" :items="statusOptions" label="Trạng thái" variant="outlined" /></v-col>
            <v-col cols="12"><v-select v-model="selectedUserGroupId" :items="groups" item-title="name" item-value="id" label="Nhóm người dùng (LEVEL_ROLE)" variant="outlined" clearable hint="Mỗi tài khoản được gán một nhóm quyền" persistent-hint /></v-col>
          </v-row></v-card-text>
          <v-divider />
          <v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="userDialog = false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="saving" prepend-icon="mdi-content-save-outline">Lưu người dùng</v-btn></v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="groupDialog" max-width="480">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between"><span>{{ editingGroup ? 'Đổi tên nhóm' : 'Thêm nhóm người dùng' }}</span><v-btn icon="mdi-close" variant="text" @click="groupDialog = false" /></v-card-title>
        <v-divider />
        <v-form @submit.prevent="saveGroup"><v-card-text><v-text-field v-model.trim="groupName" label="Tên nhóm *" variant="outlined" maxlength="100" autofocus required /></v-card-text><v-divider /><v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="groupDialog = false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="saving" prepend-icon="mdi-content-save-outline">Lưu nhóm</v-btn></v-card-actions></v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="menuDialog" max-width="720">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between"><span>{{ editingMenu ? 'Cập nhật menu' : 'Thêm menu' }}</span><v-btn icon="mdi-close" variant="text" @click="menuDialog = false" /></v-card-title>
        <v-divider />
        <v-form @submit.prevent="saveMenu"><v-card-text><v-row>
          <v-col cols="12"><v-text-field v-model.trim="menuForm.name" label="Tên menu *" variant="outlined" maxlength="100" required /></v-col>
          <v-col cols="12" md="7"><v-select v-model="menuForm.parentId" :items="menuParentOptions" label="Menu cha" variant="outlined" /></v-col>
          <v-col cols="12" md="5"><v-text-field v-model.number="menuForm.orderIndex" label="Thứ tự" variant="outlined" type="number" min="0" /></v-col>
          <v-col cols="12"><v-text-field v-model.trim="menuForm.url" label="Đường dẫn URL" variant="outlined" maxlength="255" placeholder="Ví dụ: /bao-cao/doanh-thu" /></v-col>
          <v-col cols="12" md="7"><v-text-field v-model.trim="menuForm.icon" label="Icon" variant="outlined" maxlength="50" placeholder="Ví dụ: mdi-chart-box-outline" /></v-col>
          <v-col cols="12" md="5"><v-switch v-model="menuForm.isHeading" label="Là tiêu đề/nhóm menu" color="primary" inset /></v-col>
        </v-row></v-card-text><v-divider /><v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="menuDialog = false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="saving" prepend-icon="mdi-content-save-outline">Lưu menu</v-btn></v-card-actions></v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="460">
      <v-card>
        <v-card-title class="d-flex align-center ga-2"><v-icon icon="mdi-alert-circle-outline" color="error" />Xác nhận xóa</v-card-title>
        <v-card-text>{{ deleteMessage }}</v-card-text>
        <v-card-actions class="pa-4"><v-spacer /><v-btn variant="text" @click="deleteDialog = false">Hủy</v-btn><v-btn color="error" :loading="saving" prepend-icon="mdi-delete-outline" @click="confirmDelete">Xóa</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.admin-page{width:min(1440px,calc(100% - 40px));margin:0 auto;padding:28px 0 60px;color:#294253}.page-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:22px}.page-head p{margin:0 0 5px;color:#0088bd;font-size:11px;font-weight:800;letter-spacing:1.3px}.page-head h1{margin:0;color:#193b51;font-size:29px}.page-head span{display:block;margin-top:6px;color:#7d8e99;font-size:14px}.btn{min-height:42px;padding:0 18px;cursor:pointer;border:0;border-radius:6px;font-family:inherit;font-size:13px;font-weight:700}.btn:disabled{opacity:.55;cursor:not-allowed}.btn--primary{color:#fff;background:#0078bd;box-shadow:0 4px 10px rgba(0,120,189,.18)}.btn--primary:hover{background:#006aa8}.btn--light{color:#426174;background:#fff;border:1px solid #d7e2e9}.notice{display:flex;justify-content:space-between;margin-bottom:14px;padding:13px 16px;border-radius:6px;font-size:14px}.notice button{background:none;border:0;font-size:20px}.notice--error{color:#9f2e2e;background:#fff0f0;border:1px solid #f1caca}.notice--success{color:#156841;background:#eaf8f1;border:1px solid #bfe8d2}.tabs{display:flex;gap:5px;margin-bottom:14px;padding:5px;background:#e8eff4;border-radius:8px}.tabs button{display:flex;align-items:center;gap:9px;min-height:48px;padding:0 18px;color:#607785;cursor:pointer;background:transparent;border:0;border-radius:6px;font-family:inherit;font-size:13px;font-weight:600}.tabs button span{display:grid;place-items:center;width:29px;height:29px;color:#087ba9;background:#d9edf6;border-radius:5px;font-size:10px}.tabs button b{padding:3px 7px;background:#d9e4ea;border-radius:9px;font-size:10px}.tabs button.active{color:#fff;background:#147da9;box-shadow:0 3px 8px rgba(25,93,123,.18)}.tabs button.active span,.tabs button.active b{color:#fff;background:rgba(255,255,255,.16)}.panel{overflow:hidden;background:#fff;border:1px solid #dbe5eb;border-radius:8px;box-shadow:0 3px 12px rgba(29,61,83,.04)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:82px;padding:16px 20px;border-bottom:1px solid #e5ecef}.panel-head h2{margin:0;color:#25475b;font-size:19px}.panel-head p{margin:5px 0 0;color:#8798a2;font-size:12px}.toolbar,.actions{display:flex;align-items:center;gap:8px}.toolbar>input{width:300px;height:42px;padding:0 13px;border:1px solid #d4e0e7;border-radius:6px;outline:none;font-family:inherit;font-size:13px}.toolbar>input:focus{border-color:#1599c5;box-shadow:0 0 0 3px rgba(21,153,197,.1)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:13px 15px;color:#657b89;background:#f3f7f9;text-align:left;white-space:nowrap;font-size:11px;text-transform:uppercase;letter-spacing:.5px}td{padding:15px;border-top:1px solid #e8eef1;vertical-align:middle}td strong,td small{display:block}td strong{color:#294b5e;font-weight:650}td small{margin-top:4px;color:#91a0a9;font-size:11px}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips span,.type-chip{padding:5px 8px;color:#08769c;background:#e7f5fa;border-radius:4px;font-size:11px}.chips em{color:#9aa6ad;font-style:normal}.status{display:inline-block;padding:5px 8px;color:#16724c;background:#e8f7ef;border-radius:10px;font-size:11px}.status.off{color:#a44b40;background:#faecea}.actions button{padding:7px 10px;color:#17749b;cursor:pointer;background:#edf7fa;border:0;border-radius:4px;font-family:inherit;font-size:11px;font-weight:700}.actions button.danger{color:#b53f36;background:#fff0ef}.actions button:disabled{opacity:.4;cursor:not-allowed}.empty{padding:42px!important;color:#8d9ba3!important;text-align:center}.tree-name{white-space:nowrap}.tree-name i{margin-right:7px;color:#22a0c6;font-style:normal}code{padding:4px 6px;color:#126f91;background:#eaf5f8;border-radius:3px;font-size:12px}.group-layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:14px}.group-list,.permissions{min-height:600px}.group-items{padding:8px}.group-items>button{width:100%;display:flex;align-items:center;justify-content:space-between;padding:15px;color:#46606e;cursor:pointer;background:transparent;border:0;border-radius:6px;font-family:inherit;text-align:left}.group-items>button:hover{background:#f2f7f9}.group-items>button.active{color:#086f99;background:#e7f5fa}.group-items strong,.group-items small{display:block}.group-items strong{font-size:13px}.group-items small{margin-top:5px;color:#8a9ba5;font-size:11px}.group-items i{font-size:22px;font-style:normal}.permission-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:8px 10px 80px}.permission-list label{display:flex;align-items:center;gap:11px;min-height:56px;border-bottom:1px solid #edf1f3;cursor:pointer}.permission-list input,.check input,.switch input{accent-color:#007fba}.permission-list strong,.permission-list small{display:block}.permission-list strong{font-size:13px}.permission-list small{margin-top:4px;color:#91a0a8;font-size:11px}.panel-footer{position:absolute;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:space-between;padding:13px 20px;background:#fff;border-top:1px solid #dfe8ec}.permissions{position:relative}.panel-footer span{color:#7a8e99;font-size:12px}.loading{position:fixed;z-index:80;right:22px;bottom:20px;display:flex;align-items:center;gap:9px;padding:12px 16px;color:#fff;background:#244b61;border-radius:6px;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.2)}.loading span{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.modal{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:20px;background:rgba(12,31,43,.55);backdrop-filter:blur(2px)}.dialog{width:min(680px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:9px;box-shadow:0 18px 50px rgba(0,0,0,.25)}.dialog--small{width:min(460px,100%)}.dialog>header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #e4eaee}.dialog>header small{color:#0085b5;font-size:11px;font-weight:800;letter-spacing:1px}.dialog h3{margin:5px 0 0;color:#24465a;font-size:20px}.dialog>header>button{color:#78909d;background:none;border:0;font-size:25px;cursor:pointer}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px;padding:22px}.form-grid label>span,.form-grid legend{display:block;margin-bottom:7px;color:#526b7a;font-size:12px;font-weight:650}.form-grid input:not([type=checkbox]),.form-grid select{width:100%;height:44px;padding:0 12px;color:#294757;background:#fff;border:1px solid #d5e0e6;border-radius:5px;outline:none;font-family:inherit;font-size:13px}.form-grid input:focus,.form-grid select:focus{border-color:#1599c5;box-shadow:0 0 0 3px rgba(21,153,197,.09)}.form-grid input:disabled{color:#8496a0;background:#f2f5f7}.wide{grid-column:1/-1}.form-grid fieldset{margin:0;padding:14px;border:1px solid #dbe5ea;border-radius:6px}.form-grid fieldset legend{padding:0 5px}.form-grid .check{display:inline-flex;align-items:center;gap:8px;margin:5px 16px 5px 0}.form-grid .check span{margin:0;font-size:13px}.switch{display:flex;align-items:center;gap:8px;padding-top:26px}.switch span{margin:0!important}.dialog>footer{display:flex;justify-content:flex-end;gap:9px;padding:15px 22px;background:#f7f9fa;border-top:1px solid #e4eaed}
.user-table{font-size:13px}.user-table :deep(.v-data-table__th){height:43px!important;padding:0 15px!important;color:#657b89!important;background:#f3f7f9!important;font-size:11px!important;text-transform:uppercase;letter-spacing:.5px}.user-table :deep(.v-data-table__td){height:auto!important;padding:15px!important;border-color:#e8eef1!important}.user-table :deep(.v-data-table-footer){min-height:64px;border-top:1px solid #e5ecef}.user-table :deep(.v-data-table__td strong),.user-table :deep(.v-data-table__td small){display:block}.user-table :deep(.v-data-table__td strong){color:#294b5e;font-weight:650}.user-table :deep(.v-data-table__td small){margin-top:4px;color:#91a0a9;font-size:11px}
.form-field>label{display:block;margin-bottom:7px;color:#526b7a;font-size:12px;font-weight:650}.form-field :deep(.v-field){min-height:44px;color:#294757;background:#fff;border-radius:5px}.form-field :deep(.v-field__input){min-height:44px;padding-top:8px;padding-bottom:8px;font-size:13px}
@media(max-width:900px){.admin-page{width:min(100% - 24px,1440px)}.page-head,.panel-head{align-items:stretch;flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.toolbar>input{width:100%}.group-layout{grid-template-columns:1fr}.group-list,.permissions{min-height:auto}.permission-list{grid-template-columns:1fr}.panel-footer{position:static}.tabs{overflow:auto}.tabs button{white-space:nowrap}}
@media(max-width:560px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.page-head h1{font-size:23px}}
.permission-tree{padding-bottom:78px}.permission-tree__toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:13px 18px;background:#f7fafc;border-bottom:1px solid #e5ecef}.permission-tree__toolbar strong,.permission-tree__toolbar small{display:block}.permission-tree__toolbar strong{color:#315266;font-size:13px}.permission-tree__toolbar small{margin-top:4px;color:#8496a1;font-size:11px}.permission-tree__actions{display:flex;align-items:center;gap:4px;white-space:nowrap}.menu-permission-tree{padding:10px 12px 16px;background:transparent}.menu-permission-tree :deep(.v-list-item){min-height:58px;margin:2px 0;border:1px solid transparent;border-radius:7px}.menu-permission-tree :deep(.v-list-item:hover){background:#f4f9fb}.menu-permission-tree :deep(.v-list-group){border-left:2px solid #d8edf5}.menu-permission-tree :deep(.v-list-item-subtitle){opacity:1}.menu-node__title{display:flex;align-items:center;gap:9px}.menu-node__title strong{color:#294b5e;font-size:13px;font-weight:650}.menu-node__meta{color:#8a9ca7;font-size:11px}.panel-footer{padding:11px 20px}
@media(max-width:900px){.permission-tree__toolbar{align-items:stretch;flex-direction:column}.permission-tree{padding-bottom:0}}
.panel{background:rgb(var(--v-theme-surface));border-color:rgba(var(--v-border-color),var(--v-border-opacity))}.page-head h1,.panel-head h2{color:rgb(var(--v-theme-on-surface))}.page-head span,.panel-head p{color:rgba(var(--v-theme-on-surface),.62)}.admin-tabs{border:1px solid rgba(var(--v-border-color),var(--v-border-opacity));border-radius:8px}.toolbar :deep(.v-field){background:rgb(var(--v-theme-surface))}.actions .v-btn{padding:0;background:transparent}.group-items :deep(.v-list-item){margin:4px 0}.group-items :deep(.v-list-item--active){background:rgba(var(--v-theme-primary),.1)}.menu-table :deep(.v-data-table__th){background:rgba(var(--v-theme-primary),.05);font-size:11px;text-transform:uppercase}.menu-table :deep(.v-data-table__td){padding-block:12px}.tree-name{display:flex;align-items:center;gap:6px}.permission-tree__toolbar{background:rgba(var(--v-theme-primary),.04);border-color:rgba(var(--v-border-color),var(--v-border-opacity))}.permission-tree__toolbar strong,.menu-node__title strong{color:rgb(var(--v-theme-on-surface))}.permission-tree__toolbar small,.menu-node__meta,.panel-footer span{color:rgba(var(--v-theme-on-surface),.62)}.menu-permission-tree :deep(.v-list-item:hover){background:rgba(var(--v-theme-primary),.06)}.menu-permission-tree :deep(.v-list-group){border-color:rgba(var(--v-theme-primary),.2)}.panel-footer{background:rgb(var(--v-theme-surface));border-color:rgba(var(--v-border-color),var(--v-border-opacity))}
</style>
