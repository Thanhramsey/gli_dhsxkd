import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'https://api-dhsxkd.vnptgialai.vn'),
  timeout: 15_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})
