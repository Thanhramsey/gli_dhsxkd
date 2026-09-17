<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { adminApi } from '../api/admin.api'
import { getAuthErrorMessage } from '../api/auth.api'
import { useAuthStore } from '../stores/auth.store'
import type { AdminGroup, AdminUser, EmployeeOption, MenuInput, MenuItem, UserInput } from '../types/admin'

type Tab = 'users' | 'groups' | 'menus'
interface FlatMenu extends MenuItem { level: number }

const auth = useAuthStore()
const activeTab = ref<Tab>('users')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const users = ref<AdminUser[]>([])
const groups = ref<AdminGroup[]>([])
const menus = ref<MenuItem[]>([])
const employees = ref<EmployeeOption[]>([])

const userDialog = ref(false)
const editingUser = ref<AdminUser | null>(null)
const userForm = reactive<UserInput>({ account: '', employeeId: '', status: 1, groupIds: [] })

const groupDialog = ref(false)
const editingGroup = ref<AdminGroup | null>(null)
const groupName = ref('')
const selectedGroupId = ref('')
const permissionIds = ref<string[]>([])

const menuDialog = ref(false)
const editingMenu = ref<FlatMenu | null>(null)
const menuForm = reactive<MenuInput>({ name: '', url: '', parentId: '', orderIndex: 0, icon: '', isHeading: false })

function flatten(items: MenuItem[], level = 0): FlatMenu[] {
  return items.flatMap((item) => [{ ...item, level }, ...flatten(item.children, level + 1)])
}

const flatMenus = computed(() => flatten(menus.value))
const selectedGroup = computed(() => groups.value.find((group) => group.id === selectedGroupId.value) ?? null)
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

async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[users.value, groups.value, menus.value, employees.value] = await Promise.all([
      adminApi.users(), adminApi.groups(), adminApi.menus(), adminApi.employees(),
    ])
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
  Object.assign(userForm, user ? {
    account: user.account,
    employeeId: user.employeeId,
    status: user.status,
    groupIds: [...user.groupIds],
  } : { account: '', employeeId: '', status: 1, groupIds: [] })
  userDialog.value = true
}

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

async function deleteUser(user: AdminUser) {
  if (!window.confirm(`Xóa tài khoản ${user.account}?`)) return
  try {
    await adminApi.deleteUser(user.id)
    notify('Đã xóa người dùng')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
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

async function deleteGroup(group: AdminGroup) {
  if (!window.confirm(`Xóa nhóm “${group.name}”? Các liên kết người dùng và menu của nhóm cũng sẽ bị xóa.`)) return
  try {
    await adminApi.deleteGroup(group.id)
    notify('Đã xóa nhóm người dùng')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
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

async function deleteMenu(menu: FlatMenu) {
  if (!window.confirm(`Xóa menu “${menu.name}”?`)) return
  try {
    await adminApi.deleteMenu(menu.id)
    notify('Đã xóa menu')
    await load()
  } catch (reason) { error.value = getAuthErrorMessage(reason) }
}

onMounted(load)
</script>

<template>
  <main class="admin-page">
    <header class="page-head">
      <div><p>QUẢN TRỊ HỆ THỐNG</p><h1>Người dùng & phân quyền</h1><span>Quản lý tập trung người dùng, nhóm quyền và cây menu ứng dụng.</span></div>
      <button class="btn btn--light" type="button" :disabled="loading" @click="load">↻ Tải lại</button>
    </header>

    <div v-if="error" class="notice notice--error"><span>{{ error }}</span><button @click="error = ''">×</button></div>
    <div v-if="success" class="notice notice--success">{{ success }}</div>

    <nav class="tabs">
      <button :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'; search = ''"><span>ND</span>Người dùng <b>{{ users.length }}</b></button>
      <button :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'; search = ''"><span>NQ</span>Nhóm người dùng <b>{{ groups.length }}</b></button>
      <button :class="{ active: activeTab === 'menus' }" @click="activeTab = 'menus'; search = ''"><span>MN</span>Quản lý menu <b>{{ flatMenus.length }}</b></button>
    </nav>

    <section v-if="activeTab === 'users'" class="panel">
      <header class="panel-head"><div><h2>Danh sách người dùng</h2><p>Dữ liệu tài khoản từ V_NGUOIDUNG_DIABAN, nhóm quyền từ V_NGUOIDUNG_NHOMND.</p></div><div class="toolbar"><input v-model="search" placeholder="Tìm tài khoản, họ tên, đơn vị..." /><button class="btn btn--primary" @click="openUser()">+ Thêm người dùng</button></div></header>
      <div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Nhân viên</th><th>Đơn vị</th><th>Nhóm quyền</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        <tr v-for="user in filteredUsers" :key="user.id"><td><strong>{{ user.account }}</strong><small>{{ user.displayName }}</small></td><td>{{ user.employeeName || '—' }}<small>{{ user.employeeCode || user.employeeId }}</small></td><td>{{ user.unitName || '—' }}</td><td><div class="chips"><span v-for="name in user.groupNames" :key="name">{{ name }}</span><em v-if="!user.groupNames.length">Chưa gán nhóm</em></div></td><td><span class="status" :class="{ off: user.status === 0 }">{{ user.status === 0 ? 'Ngừng hoạt động' : 'Đang hoạt động' }}</span></td><td><div class="actions"><button title="Sửa và phân quyền" @click="openUser(user)">Sửa</button><button class="danger" :disabled="user.account === auth.user?.account" @click="deleteUser(user)">Xóa</button></div></td></tr>
        <tr v-if="!filteredUsers.length"><td colspan="6" class="empty">Không có người dùng phù hợp</td></tr>
      </tbody></table></div>
    </section>

    <section v-else-if="activeTab === 'groups'" class="group-layout">
      <article class="panel group-list"><header class="panel-head"><div><h2>Nhóm người dùng</h2><p>Chọn nhóm để cấu hình quyền.</p></div><button class="btn btn--primary" @click="openGroup()">+ Thêm nhóm</button></header><div class="group-items">
        <button v-for="group in groups" :key="group.id" :class="{ active: selectedGroupId === group.id }" @click="selectGroup(group)"><span><strong>{{ group.name }}</strong><small>{{ group.userCount }} người dùng · {{ group.menuIds.length }} menu</small></span><i>›</i></button>
        <div v-if="!groups.length" class="empty">Chưa có nhóm người dùng</div>
      </div></article>
      <article class="panel permissions"><header class="panel-head"><div><h2>{{ selectedGroup?.name || 'Quyền menu' }}</h2><p>Menu được chọn sẽ áp dụng cho tất cả người dùng thuộc nhóm.</p></div><div v-if="selectedGroup" class="actions"><button @click="openGroup(selectedGroup)">Đổi tên</button><button class="danger" :disabled="selectedGroup.id === '1'" @click="deleteGroup(selectedGroup)">Xóa nhóm</button></div></header>
        <div v-if="selectedGroup" class="permission-list"><label v-for="menu in flatMenus" :key="menu.id" :style="{ paddingLeft: `${18 + menu.level * 24}px` }"><input v-model="permissionIds" type="checkbox" :value="menu.id" /><span><strong>{{ menu.name }}</strong><small>ID {{ menu.id }} · {{ menu.isHeading ? 'Tiêu đề' : (menu.path || 'Chưa có URL') }}</small></span></label></div>
        <div v-else class="empty">Chọn một nhóm để gán quyền</div>
        <footer v-if="selectedGroup" class="panel-footer"><span>Đã chọn {{ permissionIds.length }}/{{ flatMenus.length }} menu</span><button class="btn btn--primary" :disabled="saving" @click="savePermissions">Lưu phân quyền</button></footer>
      </article>
    </section>

    <section v-else class="panel">
      <header class="panel-head"><div><h2>Cây menu hệ thống</h2><p>Dữ liệu từ GLI_MENU, menu có con phải được xử lý trước khi xóa.</p></div><div class="toolbar"><input v-model="search" placeholder="Tìm tên, ID hoặc URL..." /><button class="btn btn--primary" @click="openMenu()">+ Thêm menu</button></div></header>
      <div class="table-wrap"><table><thead><tr><th>Tên menu</th><th>ID</th><th>URL</th><th>Icon</th><th>Thứ tự</th><th>Loại</th><th></th></tr></thead><tbody>
        <tr v-for="menu in filteredMenus" :key="menu.id"><td><strong class="tree-name" :style="{ paddingLeft: `${menu.level * 22}px` }"><i v-if="menu.level">↳</i>{{ menu.name }}</strong></td><td><code>{{ menu.id }}</code></td><td>{{ menu.path || '—' }}</td><td>{{ menu.icon || '—' }}</td><td>{{ menu.orderNo }}</td><td><span class="type-chip">{{ menu.isHeading ? 'Tiêu đề' : 'Chức năng' }}</span></td><td><div class="actions"><button @click="openMenu(menu)">Sửa</button><button class="danger" @click="deleteMenu(menu)">Xóa</button></div></td></tr>
        <tr v-if="!filteredMenus.length"><td colspan="7" class="empty">Chưa có menu</td></tr>
      </tbody></table></div>
    </section>

    <div v-if="loading" class="loading"><span></span>Đang tải dữ liệu...</div>

    <div v-if="userDialog" class="modal" @mousedown.self="userDialog = false"><form class="dialog" @submit.prevent="saveUser"><header><div><small>NGƯỜI DÙNG</small><h3>{{ editingUser ? 'Cập nhật người dùng' : 'Thêm người dùng' }}</h3></div><button type="button" @click="userDialog = false">×</button></header><div class="form-grid">
      <label><span>Mã người dùng (MA_ND) *</span><input v-model.trim="userForm.account" required maxlength="100" :disabled="!!editingUser" /></label>
      <label class="wide"><span>Nhân viên *</span><select v-model="userForm.employeeId" required><option value="" disabled>Chọn nhân viên</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }} — {{ employee.code }}{{ employee.unitName ? ` · ${employee.unitName}` : '' }}</option></select></label>
      <label><span>Trạng thái</span><select v-model.number="userForm.status"><option :value="1">Đang hoạt động</option><option :value="0">Ngừng hoạt động</option></select></label>
      <fieldset class="wide"><legend>Nhóm người dùng</legend><label v-for="group in groups" :key="group.id" class="check"><input v-model="userForm.groupIds" type="checkbox" :value="group.id" /><span>{{ group.name }}</span></label><p v-if="!groups.length">Chưa có nhóm để gán.</p></fieldset>
    </div><footer><button type="button" class="btn btn--light" @click="userDialog = false">Hủy</button><button class="btn btn--primary" :disabled="saving">{{ saving ? 'Đang lưu...' : 'Lưu người dùng' }}</button></footer></form></div>

    <div v-if="groupDialog" class="modal" @mousedown.self="groupDialog = false"><form class="dialog dialog--small" @submit.prevent="saveGroup"><header><div><small>NHÓM QUYỀN</small><h3>{{ editingGroup ? 'Đổi tên nhóm' : 'Thêm nhóm người dùng' }}</h3></div><button type="button" @click="groupDialog = false">×</button></header><div class="form-grid"><label class="wide"><span>Tên nhóm *</span><input v-model.trim="groupName" required maxlength="100" autofocus /></label></div><footer><button type="button" class="btn btn--light" @click="groupDialog = false">Hủy</button><button class="btn btn--primary" :disabled="saving">Lưu nhóm</button></footer></form></div>

    <div v-if="menuDialog" class="modal" @mousedown.self="menuDialog = false"><form class="dialog" @submit.prevent="saveMenu"><header><div><small>MENU HỆ THỐNG</small><h3>{{ editingMenu ? 'Cập nhật menu' : 'Thêm menu' }}</h3></div><button type="button" @click="menuDialog = false">×</button></header><div class="form-grid">
      <label class="wide"><span>Tên menu *</span><input v-model.trim="menuForm.name" required maxlength="100" /></label>
      <label><span>Menu cha</span><select v-model="menuForm.parentId"><option value="">Không có menu cha</option><option v-for="menu in flatMenus.filter((item) => item.id !== editingMenu?.id)" :key="menu.id" :value="menu.id">{{ '— '.repeat(menu.level) }}{{ menu.name }}</option></select></label>
      <label><span>Thứ tự</span><input v-model.number="menuForm.orderIndex" type="number" min="0" /></label>
      <label class="wide"><span>Đường dẫn URL</span><input v-model.trim="menuForm.url" maxlength="255" placeholder="Ví dụ: /bao-cao/doanh-thu" /></label>
      <label><span>Icon</span><input v-model.trim="menuForm.icon" maxlength="50" placeholder="Tên icon" /></label>
      <label class="switch"><input v-model="menuForm.isHeading" type="checkbox" /><span>Là tiêu đề/nhóm menu</span></label>
    </div><footer><button type="button" class="btn btn--light" @click="menuDialog = false">Hủy</button><button class="btn btn--primary" :disabled="saving">{{ saving ? 'Đang lưu...' : 'Lưu menu' }}</button></footer></form></div>
  </main>
</template>

<style scoped>
.admin-page{width:min(1440px,calc(100% - 40px));margin:0 auto;padding:28px 0 60px;color:#294253}.page-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:22px}.page-head p{margin:0 0 5px;color:#0088bd;font-size:11px;font-weight:800;letter-spacing:1.3px}.page-head h1{margin:0;color:#193b51;font-size:29px}.page-head span{display:block;margin-top:6px;color:#7d8e99;font-size:14px}.btn{min-height:42px;padding:0 18px;cursor:pointer;border:0;border-radius:6px;font-family:inherit;font-size:13px;font-weight:700}.btn:disabled{opacity:.55;cursor:not-allowed}.btn--primary{color:#fff;background:#0078bd;box-shadow:0 4px 10px rgba(0,120,189,.18)}.btn--primary:hover{background:#006aa8}.btn--light{color:#426174;background:#fff;border:1px solid #d7e2e9}.notice{display:flex;justify-content:space-between;margin-bottom:14px;padding:13px 16px;border-radius:6px;font-size:14px}.notice button{background:none;border:0;font-size:20px}.notice--error{color:#9f2e2e;background:#fff0f0;border:1px solid #f1caca}.notice--success{color:#156841;background:#eaf8f1;border:1px solid #bfe8d2}.tabs{display:flex;gap:5px;margin-bottom:14px;padding:5px;background:#e8eff4;border-radius:8px}.tabs button{display:flex;align-items:center;gap:9px;min-height:48px;padding:0 18px;color:#607785;cursor:pointer;background:transparent;border:0;border-radius:6px;font-family:inherit;font-size:13px;font-weight:600}.tabs button span{display:grid;place-items:center;width:29px;height:29px;color:#087ba9;background:#d9edf6;border-radius:5px;font-size:10px}.tabs button b{padding:3px 7px;background:#d9e4ea;border-radius:9px;font-size:10px}.tabs button.active{color:#fff;background:#147da9;box-shadow:0 3px 8px rgba(25,93,123,.18)}.tabs button.active span,.tabs button.active b{color:#fff;background:rgba(255,255,255,.16)}.panel{overflow:hidden;background:#fff;border:1px solid #dbe5eb;border-radius:8px;box-shadow:0 3px 12px rgba(29,61,83,.04)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:82px;padding:16px 20px;border-bottom:1px solid #e5ecef}.panel-head h2{margin:0;color:#25475b;font-size:19px}.panel-head p{margin:5px 0 0;color:#8798a2;font-size:12px}.toolbar,.actions{display:flex;align-items:center;gap:8px}.toolbar>input{width:300px;height:42px;padding:0 13px;border:1px solid #d4e0e7;border-radius:6px;outline:none;font-family:inherit;font-size:13px}.toolbar>input:focus{border-color:#1599c5;box-shadow:0 0 0 3px rgba(21,153,197,.1)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:13px 15px;color:#657b89;background:#f3f7f9;text-align:left;white-space:nowrap;font-size:11px;text-transform:uppercase;letter-spacing:.5px}td{padding:15px;border-top:1px solid #e8eef1;vertical-align:middle}td strong,td small{display:block}td strong{color:#294b5e;font-weight:650}td small{margin-top:4px;color:#91a0a9;font-size:11px}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips span,.type-chip{padding:5px 8px;color:#08769c;background:#e7f5fa;border-radius:4px;font-size:11px}.chips em{color:#9aa6ad;font-style:normal}.status{display:inline-block;padding:5px 8px;color:#16724c;background:#e8f7ef;border-radius:10px;font-size:11px}.status.off{color:#a44b40;background:#faecea}.actions button{padding:7px 10px;color:#17749b;cursor:pointer;background:#edf7fa;border:0;border-radius:4px;font-family:inherit;font-size:11px;font-weight:700}.actions button.danger{color:#b53f36;background:#fff0ef}.actions button:disabled{opacity:.4;cursor:not-allowed}.empty{padding:42px!important;color:#8d9ba3!important;text-align:center}.tree-name{white-space:nowrap}.tree-name i{margin-right:7px;color:#22a0c6;font-style:normal}code{padding:4px 6px;color:#126f91;background:#eaf5f8;border-radius:3px;font-size:12px}.group-layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:14px}.group-list,.permissions{min-height:600px}.group-items{padding:8px}.group-items>button{width:100%;display:flex;align-items:center;justify-content:space-between;padding:15px;color:#46606e;cursor:pointer;background:transparent;border:0;border-radius:6px;font-family:inherit;text-align:left}.group-items>button:hover{background:#f2f7f9}.group-items>button.active{color:#086f99;background:#e7f5fa}.group-items strong,.group-items small{display:block}.group-items strong{font-size:13px}.group-items small{margin-top:5px;color:#8a9ba5;font-size:11px}.group-items i{font-size:22px;font-style:normal}.permission-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:8px 10px 80px}.permission-list label{display:flex;align-items:center;gap:11px;min-height:56px;border-bottom:1px solid #edf1f3;cursor:pointer}.permission-list input,.check input,.switch input{accent-color:#007fba}.permission-list strong,.permission-list small{display:block}.permission-list strong{font-size:13px}.permission-list small{margin-top:4px;color:#91a0a8;font-size:11px}.panel-footer{position:absolute;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:space-between;padding:13px 20px;background:#fff;border-top:1px solid #dfe8ec}.permissions{position:relative}.panel-footer span{color:#7a8e99;font-size:12px}.loading{position:fixed;z-index:80;right:22px;bottom:20px;display:flex;align-items:center;gap:9px;padding:12px 16px;color:#fff;background:#244b61;border-radius:6px;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.2)}.loading span{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.modal{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:20px;background:rgba(12,31,43,.55);backdrop-filter:blur(2px)}.dialog{width:min(680px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:9px;box-shadow:0 18px 50px rgba(0,0,0,.25)}.dialog--small{width:min(460px,100%)}.dialog>header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #e4eaee}.dialog>header small{color:#0085b5;font-size:11px;font-weight:800;letter-spacing:1px}.dialog h3{margin:5px 0 0;color:#24465a;font-size:20px}.dialog>header>button{color:#78909d;background:none;border:0;font-size:25px;cursor:pointer}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px;padding:22px}.form-grid label>span,.form-grid legend{display:block;margin-bottom:7px;color:#526b7a;font-size:12px;font-weight:650}.form-grid input:not([type=checkbox]),.form-grid select{width:100%;height:44px;padding:0 12px;color:#294757;background:#fff;border:1px solid #d5e0e6;border-radius:5px;outline:none;font-family:inherit;font-size:13px}.form-grid input:focus,.form-grid select:focus{border-color:#1599c5;box-shadow:0 0 0 3px rgba(21,153,197,.09)}.form-grid input:disabled{color:#8496a0;background:#f2f5f7}.wide{grid-column:1/-1}.form-grid fieldset{margin:0;padding:14px;border:1px solid #dbe5ea;border-radius:6px}.form-grid fieldset legend{padding:0 5px}.form-grid .check{display:inline-flex;align-items:center;gap:8px;margin:5px 16px 5px 0}.form-grid .check span{margin:0;font-size:13px}.switch{display:flex;align-items:center;gap:8px;padding-top:26px}.switch span{margin:0!important}.dialog>footer{display:flex;justify-content:flex-end;gap:9px;padding:15px 22px;background:#f7f9fa;border-top:1px solid #e4eaed}
@media(max-width:900px){.admin-page{width:min(100% - 24px,1440px)}.page-head,.panel-head{align-items:stretch;flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.toolbar>input{width:100%}.group-layout{grid-template-columns:1fr}.group-list,.permissions{min-height:auto}.permission-list{grid-template-columns:1fr}.panel-footer{position:static}.tabs{overflow:auto}.tabs button{white-space:nowrap}}
@media(max-width:560px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.page-head h1{font-size:23px}}
</style>
