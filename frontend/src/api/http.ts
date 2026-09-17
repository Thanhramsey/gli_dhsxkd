import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 15_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})
