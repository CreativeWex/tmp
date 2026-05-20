import type { User } from './types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

function apiOrigin(): string {
  try {
    return new URL(API_BASE).origin
  } catch {
    return 'http://localhost:8000'
  }
}

export function absoluteFileUrl(path: string): string {
  if (path.startsWith('http')) return path
  return apiOrigin() + path
}

function getToken(): string | null {
  return localStorage.getItem('bt_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('bt_token', token)
  else localStorage.removeItem('bt_token')
}

function formatError(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((e) => (typeof e === 'object' && e && 'msg' in e ? String((e as { msg: string }).msg) : JSON.stringify(e))).join('; ')
  }
  if (detail && typeof detail === 'object' && 'detail' in detail) return formatError((detail as { detail: unknown }).detail)
  return 'Ошибка запроса'
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const body = init.body
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(formatError(j.detail ?? j))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function login(email: string, password: string) {
  return apiJson<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function fetchMe(): Promise<User> {
  return apiJson<User>('/auth/me')
}
