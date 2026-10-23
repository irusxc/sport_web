import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindProfile, resolveProfile } from '../src/profile-binding.js'

function mockClient(rows, { readError, race } = {}) {
  const writes = []
  return {
    writes,
    from() {
      let id, userId
      const query = {
        select() { return query },
        in: async () => ({ data: rows, error: readError }),
        update(value) { userId = value.user_id; return query },
        eq(_column, value) { id = value; return query },
        is(column, value) { assert.equal(column, 'user_id'); assert.equal(value, null); return query },
        async maybeSingle() {
          writes.push({ id, userId })
          if (race) return race(rows, id, userId)
          const row = rows.find((item) => item.id === id && !item.user_id)
          if (row) row.user_id = userId
          return { data: row || null, error: null }
        },
      }
      return query
    },
  }
}
const pair = (lin = null, zhou = null) => [{ id: 'lin', name: '小林', user_id: lin }, { id: 'zhou', name: '小钟', user_id: zhou }]

test('returning accounts keep their identity without writes', async () => {
  const client = mockClient(pair('a', 'b'))
  assert.equal((await resolveProfile(client, 'a')).profile.id, 'lin')
  assert.equal((await resolveProfile(client, 'b')).profile.id, 'zhou')
  assert.equal(client.writes.length, 0)
})
test('first account chooses once; second account receives only the remaining identity', async () => {
  const client = mockClient(pair())
  assert.equal((await resolveProfile(client, 'a')).choices.length, 2)
  await bindProfile(client, 'a', 'zhou')
  assert.equal((await resolveProfile(client, 'b')).profile.id, 'lin')
  assert.equal((await resolveProfile(client, 'b')).profile.id, 'lin')
  assert.equal(client.writes.length, 2)
})
test('query errors and missing or occupied profiles do not become a chooser', async () => {
  await assert.rejects(resolveProfile(mockClient(pair(), { readError: new Error('offline') }), 'a'), /offline/)
  await assert.rejects(resolveProfile(mockClient(pair('a', 'b')), 'c'), /均已绑定/)
  const client = mockClient(pair().slice(0, 1))
  await assert.rejects(resolveProfile(client, 'a'), /不完整/)
  assert.equal(client.writes.length, 0)
})
test('cancelled account resolution cannot automatically bind an identity', async () => {
  const client = mockClient(pair('a'))
  assert.equal(await resolveProfile(client, 'b', () => false), null)
  assert.equal(client.writes.length, 0)
})
test('simultaneous binding from another tab resolves the existing binding', async () => {
  const client = mockClient(pair('a'), { race(rows, id, userId) {
    rows.find((row) => row.id === id).user_id = userId
    return { data: null, error: { code: '23505' } }
  } })
  assert.equal((await resolveProfile(client, 'b')).profile.id, 'zhou')
})
test('a lost claim race never replaces the other account', async () => {
  const rows = pair('a')
  const client = mockClient(rows, { race(rows, id) {
    rows.find((row) => row.id === id).user_id = 'c'
    return { data: null, error: null }
  } })
  await assert.rejects(resolveProfile(client, 'b'), /已被绑定/)
  assert.equal(rows[1].user_id, 'c')
})
