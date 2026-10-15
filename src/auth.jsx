import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  // 启动时读取会话 + 监听登录状态变化
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // 登录后加载该账号绑定的档案（lin / zhou）
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) {
      setProfile(null)
      return undefined
    }

    let cancelled = false
    supabase
      .from('profiles')
      .select('id, name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const claimProfile = async (profileId) => {
    if (!isSupabaseConfigured || !session?.user) {
      return { error: new Error('尚未登录') }
    }

    // 只能认领尚未被绑定的档案；已被他人绑定则更新 0 行，返回 null
    const { data, error } = await supabase
      .from('profiles')
      .update({ user_id: session.user.id })
      .eq('id', profileId)
      .is('user_id', null)
      .select('id, name')
      .maybeSingle()

    if (error) return { error }
    if (!data) return { error: new Error('该档案已被他人认领') }

    setProfile(data)
    return { error: null }
  }

  const value = {
    configured: isSupabaseConfigured,
    session,
    profile,
    loading,
    signInWithPassword: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signInWithOtp: (email) => supabase.auth.signInWithOtp({ email }),
    signOut: () => supabase.auth.signOut(),
    claimProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
