import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { useAuth } from './auth'

const STORAGE_KEY = 'duoran-activity-log-v1'
const MAX_LOCAL_EVENTS = 40

const fromRow = (row) => ({
  id: row.id,
  profileId: row.profile_id,
  type: row.event_type,
  recordDate: row.record_date,
  calories: Number(row.calories) || 0,
  message: row.message,
  createdAt: row.created_at,
})

export function useActivity() {
  const { session } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      try { setActivities(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch { setActivities([]) }
      setLoading(false)
      return undefined
    }
    if (!session?.user) {
      setActivities([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_LOCAL_EVENTS)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setActivities((data || []).map(fromRow))
        setLoading(false)
      })

    const channel = supabase
      .channel('activity-log-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, ({ new: row }) => {
        const activity = fromRow(row)
        setActivities((current) => [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, MAX_LOCAL_EVENTS))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(activities.slice(0, MAX_LOCAL_EVENTS)))
  }, [activities])

  const logActivity = useCallback(async ({ profileId, type, recordDate = null, calories = null, message }) => {
    const item = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      profileId,
      type,
      recordDate,
      calories: Number(calories) || 0,
      message,
      createdAt: new Date().toISOString(),
    }

    if (!isSupabaseConfigured) {
      setActivities((current) => [item, ...current].slice(0, MAX_LOCAL_EVENTS))
      return { error: null }
    }

    const { error } = await supabase.from('activity_log').insert({
      id: item.id,
      profile_id: item.profileId,
      event_type: item.type,
      record_date: item.recordDate,
      calories: item.calories,
      message: item.message,
    })
    if (!error) setActivities((current) => [item, ...current].slice(0, MAX_LOCAL_EVENTS))
    return { error }
  }, [])

  const clearLocalActivities = useCallback(() => {
    if (isSupabaseConfigured) return false
    setActivities([])
    localStorage.removeItem(STORAGE_KEY)
    return true
  }, [])

  return { activities, loading, logActivity, clearLocalActivities }
}
