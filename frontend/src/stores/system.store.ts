import { defineStore } from 'pinia'
import { healthApi, getApiErrorMessage } from '../api/health.api'

interface ServiceState {
  connected: boolean
  error: string | null
}

export const useSystemStore = defineStore('system', {
  state: () => ({
    api: { connected: false, error: null } as ServiceState,
    oracle: { connected: false, error: null } as ServiceState,
    databaseTime: null as string | null,
    loading: false,
    lastCheckedAt: null as string | null,
  }),

  actions: {
    async checkServices() {
      this.loading = true
      this.api = { connected: false, error: null }
      this.oracle = { connected: false, error: null }

      const [apiResult, oracleResult] = await Promise.allSettled([
        healthApi.getApiHealth(),
        healthApi.getOracleHealth(),
      ])

      if (apiResult.status === 'fulfilled') {
        this.api.connected = apiResult.value.status === 'ok'
      } else {
        this.api.error = getApiErrorMessage(apiResult.reason)
      }

      if (oracleResult.status === 'fulfilled') {
        this.oracle.connected = oracleResult.value.status === 'connected'
        this.databaseTime = oracleResult.value.databaseTime
      } else {
        this.databaseTime = null
        this.oracle.error = getApiErrorMessage(oracleResult.reason)
      }

      this.lastCheckedAt = new Date().toISOString()
      this.loading = false
    },
  },
})