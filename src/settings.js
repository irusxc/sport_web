import { useCallback, useEffect, useState } from 'react'
import { PROFILES } from './data'
import { isSupabaseConfigured, supabase } from './supabase'
import { useAuth } from './auth'

const STORAGE_KEY = 'duoran-profile-settings-v1'
const SETTING_COLUMNS = 'id, target_calories, target_weight, start_weight, height, weekly_goal'

function defaultSettings() {
  return Object.fromEntries(PROFILES.map((profile) => [profile.id, {
    targetCalories: profile.targetCalories,
    targetWeight: profile.targetWeight,
    startWeight: profile.startWeight,
    height: profile.height,
    weeklyGoal: profile.weeklyGoal,
  }]))
}

function fromRow(row) {
  return {
    targetCalories: Number(row.target_calories),
    targetWeight: Number(row.target_weight),
    startWeight: Number(row.start_weight),
    height: Number(row.height),
    weeklyGoal: Number(row.weekly_goal),
  }
}

export function useProfileSettings() {
  const { session } = useAuth()
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        setSettings({ ...defaultSettings(), ...saved })
      } catch {
        setSettings(defaultSettings())
      }
      setLoading(false)
      return undefined
    }

    if (!session?.user) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    supabase.from('profiles').select(SETTING_COLUMNS).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) {
        const next = { ...defaultSettings() }
        data.forEach((row) => { next[row.id] = fromRow(row) })
        setSettings(next)
      }
      setLoading(false)
    })

    const channel = supabase
      .channel('profile-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload.new
        if (!row?.id) return
        setSettings((current) => ({ ...current, [row.id]: fromRow(row) }))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const saveSettings = useCallback(async (profileId, values) => {
    if (!isSupabaseConfigured) {
      setSettings((current) => ({ ...current, [profileId]: values }))
      return { error: null }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        target_calories: values.targetCalories,
        target_weight: values.targetWeight,
        start_weight: values.startWeight,
        height: values.height,
        weekly_goal: values.weeklyGoal,
      })
      .eq('id', profileId)
      .select('id')
      .maybeSingle()

    if (error) return { error }
    if (!data) return { error: new Error('当前账号无权修改该成员设置') }
    setSettings((current) => ({ ...current, [profileId]: values }))
    return { error: null }
  }, [])

  return { settings, loading, saveSettings }
}
