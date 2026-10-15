import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 只有同时配好 URL 和 anon key 才启用 Supabase；
// 否则应用进入"本地模式"（数据仍存本机浏览器），方便未配置时预览。
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null
