<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuthErrorMessage } from '../api/auth.api'
import vnptLogo from '../assets/vnpt-logo.png'
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
        <div class="login-brand">
          <img :src="vnptLogo" alt="VNPT" />
          <strong>Gia Lai</strong>
        </div>
        <p class="login-kicker">DỮ LIỆU • ĐIỀU HÀNH • HIỆU QUẢ</p>
        <h1>Hệ thống Dashboard<br />điều hành sản xuất kinh doanh</h1>
        <p>Tổng hợp thông tin quản trị, phân quyền theo nhóm người dùng và sẵn sàng tích hợp SSO VNPT.</p>
        <div class="visual-bars"><i /><i /><i /><i /><i /></div>
      </div>
    </section>

    <v-sheet class="login-panel">
      <v-card class="login-card" elevation="0" color="transparent">
        <div class="login-card__brand">
          <img :src="vnptLogo" alt="VNPT" />
          <span>VNPT Gia Lai</span>
        </div>
        <h2>Đăng nhập hệ thống</h2>
        <p class="login-card__intro">Sử dụng mã người dùng được cấp trên hệ thống để đăng nhập.</p>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-5">{{ error }}</v-alert>
        <v-form class="login-form" @submit.prevent="submit">
          <v-text-field
            id="account"
            v-model="account"
            name="account"
            label="Mã người dùng"
            placeholder="Nhập MA_ND, ví dụ: habtt.bdh"
            prepend-inner-icon="mdi-account-outline"
            variant="outlined"
            color="primary"
            autocomplete="username"
            maxlength="100"
            autofocus
            :error-messages="accountError ? [accountError] : []"
            persistent-hint
            @update:model-value="accountError = null"
          />
          <v-btn
            class="login-submit mt-5"
            type="submit"
            color="primary"
            size="large"
            block
            :loading="submitting || auth.loading"
            :disabled="submitting || auth.loading"
            append-icon="mdi-arrow-right"
          >
            Đăng nhập
          </v-btn>
          <p v-if="submitting" class="submit-status" role="status">Đang xác thực tài khoản...</p>
        </v-form>
        <p class="login-card__note">Giai đoạn hiện tại không yêu cầu mật khẩu. Khi tích hợp SSO, màn hình này sẽ được thay bằng luồng xác thực tập trung.</p>
      </v-card>
      <p class="login-footer">© {{ new Date().getFullYear() }} VNPT Gia Lai</p>
    </v-sheet>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(420px, 1.15fr) minmax(420px, .85fr); background: #f6f8fa; }
.login-visual { position: relative; overflow: hidden; display: flex; align-items: center; padding: 8vw; color: #fff; background: linear-gradient(145deg, #102e43 0%, #0c5f79 58%, #15a7c8 100%); }
.login-visual::after { content: ''; position: absolute; right: -180px; bottom: -220px; width: 560px; height: 560px; border: 80px solid rgba(255,255,255,.07); border-radius: 50%; }
.login-visual__grid { position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px); background-size: 44px 44px; }
.login-visual__content { position: relative; z-index: 1; max-width: 650px; }
.login-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 90px; }.login-brand img { width: 150px; height: 48px; object-fit: contain; padding: 7px 11px; background: #fff; border-radius: 9px; box-shadow: 0 8px 24px rgba(3,35,57,.2); }.login-brand strong { padding-left: 14px; border-left: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 20px; font-weight: 700; }
.login-kicker { color: #8ce2f4; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
.login-visual h1 { margin: 14px 0 22px; font-family: 'Be Vietnam Pro', Tahoma, sans-serif; font-size: clamp(38px, 4vw, 62px); font-weight: 700; line-height: 1.12; letter-spacing: -.02em; }
.login-visual p:not(.login-kicker) { max-width: 570px; color: #d3e8ef; font-size: 17px; line-height: 1.7; }
.visual-bars { display: flex; align-items: end; gap: 10px; height: 72px; margin-top: 45px; }.visual-bars i { width: 28px; background: rgba(95,215,240,.8); border-radius: 3px 3px 0 0; }.visual-bars i:nth-child(1){height:35%}.visual-bars i:nth-child(2){height:65%}.visual-bars i:nth-child(3){height:48%}.visual-bars i:nth-child(4){height:85%}.visual-bars i:nth-child(5){height:100%}
.login-panel { display: grid; place-items: center; align-content: center; padding: 48px; }
.login-card { width: min(430px, 100%); }.login-card__brand { display: flex; align-items: center; gap: 13px; margin-bottom: 30px; }.login-card__brand img { width: 132px; height: 40px; object-fit: contain; }.login-card__brand span { padding-left: 13px; color: #527084; border-left: 1px solid #ccd8df; font-size: 13px; font-weight: 700; }
.login-card h2 { margin: 0; color: #15344a; font-family: 'Be Vietnam Pro', Tahoma, sans-serif; font-size: 32px; font-weight: 700; }.login-card__intro { margin: 10px 0 30px; color: #71808a; }
.submit-status { margin: 10px 0 0; color: #176f86; font-size: 12px; font-weight: 600; text-align: center; }
.login-submit { min-height: 54px; background: linear-gradient(100deg, #005ba9 0%, #007ac3 58%, #00a9e8 100%)!important; box-shadow: 0 8px 20px rgba(0,104,181,.25); font-weight: 700; text-transform: none; }
.login-card__note { margin-top: 24px; padding-top: 20px; color: #7a8992; border-top: 1px solid #e0e6e9; font-size: 12px; line-height: 1.6; }
.login-footer { margin-top: 55px; color: #9aa7ae; font-size: 11px; }
@media (max-width: 900px) { .login-page { grid-template-columns: 1fr; }.login-visual { display: none; }.login-panel { min-height: 100vh; padding: 28px; } }
</style>
