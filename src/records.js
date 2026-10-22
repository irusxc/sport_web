import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { useAuth } from './auth'
import { createSeedRecords } from './data'

const STORAGE_KEY = 'duoran-health-records-v1'

// JS 字段(camelCase) <-> 数据库列(snake_case)
const toDb = (record) => ({
  id: record.id,
  profile_id: record.profileId,
  date: record.date,
  time: record.time,
  calories: record.calories,
  weight: record.weight,
  exercise: record.exercise,
  exercise_id: record.exerciseId,
  duration: record.duration,
  burned: record.burned,
  speed: record.speed ?? null,
  incline: record.incline ?? null,
  water: record.water,
  mood: record.mood,
  meals: record.meals,
})

const fromDb = (row) => ({
  id: row.id,
  profileId: row.profile_id,
  date: row.date,
  time: row.time,
  calories: row.calories,
  weight: row.weight,
  exercise: row.exercise,
  exerciseId: row.exercise_id,
  duration: row.duration,
  burned: row.burned,
  speed: row.speed ?? null,
  incline: row.incline ?? null,
  water: row.water,
  mood: row.mood,
  meals: row.meals || [],
})

export function useRecords() {
  const { session } = useAuth()

  const [records, setRecords] = useState(() => {
    // 本地模式：从浏览器读取，首次给示例数据
    if (isSupabaseConfigured) return []
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : createSeedRecords(new Date())
    } catch {
      return createSeedRecords(new Date())
    }
  })
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  // 云端模式：登录后拉取全部记录，并订阅实时变更
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    if (!session?.user) {
      setRecords([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('records')
      .select('*')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) setError(fetchError.message)
        else setRecords((data || []).map(fromDb))
        setLoading(false)
      })

    const channel = supabase
      .channel('records-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'records' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = fromDb(payload.new)
            setRecords((current) => [...current.filter((item) => item.id !== row.id), row])
          } else if (payload.eventType === 'UPDATE') {
            const row = fromDb(payload.new)
            setRecords((current) => current.map((item) => (item.id === row.id ? row : item)))
          } else if (payload.eventType === 'DELETE') {
            setRecords((current) => current.filter((item) => item.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  // 本地模式：把数据写回浏览器
  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  const saveRecord = async (record) => {
    if (!isSupabaseConfigured) {
      setRecords((current) => [
        ...current.filter(
          (item) => !(item.profileId === record.profileId && item.date === record.date),
        ),
        record,
      ])
      return { error: null }
    }

    const { error } = await supabase
      .from('records')
      .upsert(toDb(record), { onConflict: 'profile_id,date' })

    return { error }
  }

  const resetRecords = async (profileId) => {
    if (!isSupabaseConfigured) {
      setRecords([])
      return { error: null }
    }

    const { error } = await supabase.from('records').delete().eq('profile_id', profileId)
    return { error }
  }

  return {
    records,
    loading,
    error,
    isConnected: isSupabaseConfigured,
    saveRecord,
    resetRecords,
  }
}
