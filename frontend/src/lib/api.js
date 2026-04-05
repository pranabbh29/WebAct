import { supabase } from './supabase'

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const headers = { ...options.headers }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  headers['Authorization'] = `Bearer ${token}`

  return fetch(path, { ...options, headers })
}

export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}
