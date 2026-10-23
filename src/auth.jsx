import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { bindProfile, resolveProfile } from './profile-binding'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured)
  const [sessionError, setSessionError] = useState(null)
  const [resolution, setResolution] = useState({ userId: null, status: 'loading' })
  const [retry, setRetry] = useState(0)
  const activeUser = useRef(null)
  const claimPending = useRef(false)
  const userId = session?.user?.id || null

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let cancelled = false
    let authEventReceived = false
    const applySession = (nextSession) => {
      if (cancelled) return
      activeUser.current = nextSession?.user?.id || null
      setSession(nextSession)
      setSessionError(null)
      setSessionLoading(false)
      if (!nextSession) setResolution({ userId: null, status: 'loading' })
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true
      applySession(nextSession)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled || authEventReceived) return
      if (error) throw error
      applySession(data.session)
    }).catch((error) => {
      if (cancelled || authEventReceived) return
      setSessionError(error)
      setSessionLoading(false)
    })
    return () => {
      cancelled = true
      activeUser.current = null
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return undefined
    let cancelled = false
    const isCurrent = () => !cancelled && activeUser.current === userId
    setResolution({ userId, status: 'loading' })
    resolveProfile(supabase, userId, isCurrent).then((result) => {
      if (isCurrent() && result) setResolution({ userId, status: 'ready', ...result })
    }).catch((error) => {
      if (isCurrent()) setResolution({ userId, status: 'error', error })
    })
    return () => { cancelled = true }
  }, [userId, retry])

  // A session is ready only after its own profile has been resolved.
  const current = resolution.userId === userId ? resolution : null
  const profile = current?.status === 'ready' ? current.profile : null
  const choices = current?.status === 'ready' ? current.choices : []

  useEffect(() => {
    if (!isSupabaseConfigured || !userId || current?.status !== 'ready' || profile) return undefined
    let cancelled = false
    const refresh = () => { if (!cancelled) setRetry((value) => value + 1) }
    const channel = supabase.channel('profile-binding-' + userId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.new?.user_id) refresh()
      }).subscribe()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [userId, current?.status, profile])

  const claimProfile = async (profileId) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('尚未登录') }
    if (profile) return { error: new Error('当前账号已经绑定身份，无需再次选择。') }
    if (claimPending.current || !choices.some((item) => item.id === profileId)) {
      return { error: new Error('身份状态已变化，请刷新后重试。') }
    }
    claimPending.current = true
    try {
      const data = await bindProfile(supabase, userId, profileId)
      if (activeUser.current === userId) setResolution({ userId, status: 'ready', profile: data, choices: [] })
      return { error: null }
    } catch (error) {
      if (activeUser.current === userId) setRetry((value) => value + 1)
      return { error }
    } finally {
      claimPending.current = false
    }
  }

  const value = {
    configured: isSupabaseConfigured,
    session,
    profile,
    availableProfiles: choices,
    loading: sessionLoading || Boolean(userId && (!current || current.status === 'loading')),
    error: sessionError || (current?.status === 'error' ? current.error : null),
    retryProfile: () => sessionError ? window.location.reload() : setRetry((value) => value + 1),
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithOtp: (email) => supabase.auth.signInWithOtp({ email }),
    signOut: () => supabase.auth.signOut(),
    claimProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
