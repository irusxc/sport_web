import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_LIBRARY, calculateExerciseCalories } from '../src/data.js'
import { EXERCISE_GROUPS, getQuickExercises } from '../src/exercises.js'

test('all active exercises belong to exactly one category', () => {
  const ids = EXERCISE_GROUPS.flatMap((group) => group.ids)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...ids].sort(), EXERCISE_LIBRARY.filter((item) => item.id !== 'rest').map((item) => item.id).sort())
})

test('shortcuts use only the current profile, newest first, and support old records', () => {
  const records = [
    { profileId: 'lin', date: '2026-10-20', exerciseId: 'swimming' },
    { profileId: 'lin', date: '2026-10-22', exercise: '羽毛球' },
    { profileId: 'zhou', date: '2026-10-23', exerciseId: 'hiit' },
    { profileId: 'lin', date: '2026-10-23', exerciseId: 'rest' },
    { profileId: 'lin', date: '2026-10-21', exerciseId: 'swimming' },
    { profileId: 'lin', date: '2026-10-24', exerciseId: 'unknown' },
  ]
  const original = structuredClone(records)
  const ids = getQuickExercises(records, 'lin').map((item) => item.id)
  assert.deepEqual(ids.slice(0, 2), ['badminton', 'swimming'])
  assert.equal(ids.length, 6)
  assert.equal(new Set(ids).size, 6)
  assert.ok(!ids.includes('rest') && !ids.includes('hiit'))
  assert.deepEqual(records, original)
  assert.equal(getQuickExercises([], 'new-user').length, 6)
})

test('rest has no calories and treadmill estimates react to speed, incline and time', () => {
  assert.equal(calculateExerciseCalories('rest', 60, 40), 0)
  const flat = calculateExerciseCalories('treadmill', 60, 30, { speed: 5, incline: 0 })
  assert.ok(calculateExerciseCalories('treadmill', 60, 30, { speed: 5, incline: 5 }) > flat)
  assert.ok(calculateExerciseCalories('treadmill', 60, 30, { speed: 8, incline: 0 }) > flat)
  assert.ok(Math.abs(calculateExerciseCalories('treadmill', 60, 60, { speed: 5, incline: 0 }) - 2 * flat) <= 1)
})
