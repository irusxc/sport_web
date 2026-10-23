import { EXERCISE_LIBRARY } from './data.js'

export const EXERCISE_GROUPS = [
  { id: 'cardio', name: '走跑与有氧', ids: ['walk', 'brisk_walk', 'jog', 'run', 'treadmill', 'cycling', 'swimming', 'jump_rope'] },
  { id: 'training', name: '力量与训练', ids: ['strength', 'hiit'] },
  { id: 'mobility', name: '舒展与舞蹈', ids: ['yoga', 'pilates', 'dance'] },
  { id: 'outdoor', name: '球类与户外', ids: ['badminton', 'basketball', 'hiking'] },
]

const DEFAULT_QUICK_IDS = ['brisk_walk', 'jog', 'treadmill', 'strength', 'yoga', 'cycling']

export function getQuickExercises(records, profileId) {
  const recentIds = [...records]
    .filter((record) => record.profileId === profileId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((record) => record.exerciseId || EXERCISE_LIBRARY.find((item) => item.name === record.exercise)?.id)
  return [...new Set([...recentIds, ...DEFAULT_QUICK_IDS])]
    .filter((id) => id !== 'rest' && EXERCISE_LIBRARY.some((item) => item.id === id))
    .slice(0, 6)
    .map((id) => EXERCISE_LIBRARY.find((item) => item.id === id))
}
