<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuthErrorMessage } from '../api/auth.api'
import { useAuthStore } from '../stores/auth.store'

const account = ref('')
const error = ref<string | null>(null)
const accountError = ref<string | null>(null)
const submitting = ref(false)
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

async function submit() {
  if (submitting.value) return
  account.value = account.value.trim()
  accountError.value = account.value ? null : 'Vui lòng nhập mã người dùng MA_ND'
  if (accountError.value) return
  error.value = null
  submitting.value = true
  try {
    await auth.login(account.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (reason) {
    error.value = getAuthErrorMessage(reason)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual" aria-label="Giới thiệu hệ thống">
      <div class="login-visual__grid" />
      <div class="login-visual__content">
        <div class="login-brand"><span>◢</span> VNPT Gia Lai</div>
        <p class="login-kicker">DỮ LIỆU • ĐIỀU HÀNH • HIỆU QUẢ</p>
        <h1>Hệ thống Dashboard<br />điều hành sản xuất kinh doanh</h1>
        <p>Tổng hợp thông tin quản trị, phân quyền theo nhóm người dùng và sẵn sàng tích hợp SSO VNPT.</p>
        <div class="visual-bars"><i /><i /><i /><i /><i /></div>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <h2>Đăng nhập hệ thống</h2>
        <p class="login-card__intro">Sử dụng mã người dùng được cấp trên hệ thống để đăng nhập.</p>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-5">{{ error }}</v-alert>
        <form class="login-form" @submit.prevent="submit">
          <label for="account">Mã người dùng <strong>(MA_ND)</strong></label>
          <div class="account-input" :class="{ 'account-input--error': accountError }">
            <span aria-hidden="true">ID</span>
            <input
              id="account"
              v-model="account"
              name="account"
              type="text"
              placeholder="Nhập MA_ND, ví dụ: tungdq.ham"
              autocomplete="username"
              maxlength="100"
              autofocus
              @input="accountError = null"
            />
          </div>
          <p v-if="accountError" class="field-error">{{ accountError }}</p>
          <p v-else class="field-hint">Nhập đúng giá trị tại cột MA_ND trong dữ liệu người dùng.</p>
          <button
            class="login-submit"
            type="button"
            :disabled="submitting || auth.loading"
            @click="submit"
          >
            <span v-if="submitting || auth.loading" class="login-submit__spinner" />
            <span>{{ submitting || auth.loading ? 'Đang đăng nhập...' : 'Đăng nhập' }}</span>
            <span v-if="!submitting && !auth.loading" class="login-submit__arrow">→</span>
          </button>
          <p v-if="submitting" class="submit-status" role="status">Đang xác thực tài khoản...</p>
        </form>
        <p class="login-card__note">Giai đoạn hiện tại không yêu cầu mật khẩu. Khi tích hợp SSO, màn hình này sẽ được thay bằng luồng xác thực tập trung.</p>
      </div>
      <p class="login-footer">© {{ new Date().getFullYear() }} VNPT Gia Lai</p>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(420px, 1.15fr) minmax(420px, .85fr); background: #f6f8fa; }
.login-visual { position: relative; overflow: hidden; display: flex; align-items: center; padding: 8vw; color: #fff; background: linear-gradient(145deg, #102e43 0%, #0c5f79 58%, #15a7c8 100%); }
.login-visual::after { content: ''; position: absolute; right: -180px; bottom: -220px; width: 560px; height: 560px; border: 80px solid rgba(255,255,255,.07); border-radius: 50%; }
.login-visual__grid { position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px); background-size: 44px 44px; }
.login-visual__content { position: relative; z-index: 1; max-width: 650px; }
.login-brand { margin-bottom: 90px; font-size: 20px; font-weight: 800; }.login-brand span { margin-right: 8px; color: #55d3f0; font-size: 30px; }
.login-kicker { color: #8ce2f4; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
.login-visual h1 { margin: 14px 0 22px; font-family: 'Be Vietnam Pro', Tahoma, sans-serif; font-size: clamp(38px, 4vw, 62px); font-weight: 700; line-height: 1.12; letter-spacing: -.02em; }
.login-visual p:not(.login-kicker) { max-width: 570px; color: #d3e8ef; font-size: 17px; line-height: 1.7; }
.visual-bars { display: flex; align-items: end; gap: 10px; height: 72px; margin-top: 45px; }.visual-bars i { width: 28px; background: rgba(95,215,240,.8); border-radius: 3px 3px 0 0; }.visual-bars i:nth-child(1){height:35%}.visual-bars i:nth-child(2){height:65%}.visual-bars i:nth-child(3){height:48%}.visual-bars i:nth-child(4){height:85%}.visual-bars i:nth-child(5){height:100%}
.login-panel { display: grid; place-items: center; align-content: center; padding: 48px; }
.login-card { width: min(430px, 100%); }.login-card__mark { display: inline-block; margin-bottom: 34px; padding: 8px 13px; color: #0e7181; border: 1px solid #a9d5dc; border-radius: 7px; font-size: 12px; font-weight: 900; letter-spacing: 1.5px; }
.login-card h2 { margin: 0; color: #15344a; font-family: 'Be Vietnam Pro', Tahoma, sans-serif; font-size: 32px; font-weight: 700; }.login-card__intro { margin: 10px 0 30px; color: #71808a; }
.login-card label { display: block; margin-bottom: 8px; color: #344e5e; font-size: 13px; font-weight: 800; }
.account-input { display: flex; align-items: center; height: 52px; overflow: hidden; background: #fff; border: 1px solid #9bacb5; border-radius: 5px; transition: border-color .15s, box-shadow .15s; }
.account-input:focus-within { border-color: #087e9d; box-shadow: 0 0 0 3px rgba(8,126,157,.13); }
.account-input--error { border-color: #b42318; }
.account-input > span { display: grid; place-items: center; align-self: stretch; width: 50px; color: #176f86; background: #edf5f7; border-right: 1px solid #cfdbdf; font-size: 11px; font-weight: 900; }
.account-input input { min-width: 0; flex: 1; height: 100%; padding: 0 15px; color: #18394c; background: transparent; border: 0; outline: 0; font-family: 'Be Vietnam Pro', Tahoma, Arial, sans-serif; font-size: 14px; }
.account-input input::placeholder { color: #91a0a8; }
.field-hint, .field-error { min-height: 18px; margin: 7px 0 15px; font-size: 11px; }
.field-hint { color: #7a8992; }.field-error { color: #b42318; }
.submit-status { margin: 10px 0 0; color: #176f86; font-size: 12px; font-weight: 600; text-align: center; }
.login-submit { width: 100%; height: 54px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 20px; color: #fff; cursor: pointer; background: linear-gradient(100deg, #005ba9 0%, #007ac3 58%, #00a9e8 100%); border: 0; border-radius: 7px; box-shadow: 0 8px 20px rgba(0, 104, 181, .25); font-family: 'Be Vietnam Pro', sans-serif; font-size: 15px; font-weight: 700; transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
.login-submit:hover:not(:disabled) { transform: translateY(-2px); filter: saturate(1.08); box-shadow: 0 12px 26px rgba(0, 104, 181, .34); }
.login-submit:active:not(:disabled) { transform: translateY(0); box-shadow: 0 5px 14px rgba(0, 104, 181, .24); }
.login-submit:disabled { cursor: wait; opacity: .78; }
.login-submit__arrow { margin-left: auto; font-size: 22px; font-weight: 400; }
.login-submit__spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: login-spin .7s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }
.login-card__note { margin-top: 24px; padding-top: 20px; color: #7a8992; border-top: 1px solid #e0e6e9; font-size: 12px; line-height: 1.6; }
.login-footer { margin-top: 55px; color: #9aa7ae; font-size: 11px; }
@media (max-width: 900px) { .login-page { grid-template-columns: 1fr; }.login-visual { display: none; }.login-panel { min-height: 100vh; padding: 28px; } }
</style>
