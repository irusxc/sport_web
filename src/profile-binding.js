const PROFILE_IDS = ['lin', 'zhou']

async function readProfiles(client) {
  const { data, error } = await client.from('profiles').select('id, name, user_id').in('id', PROFILE_IDS)
  if (error) throw error
  return data || []
}

export async function bindProfile(client, userId, profileId) {
  const { data, error } = await client.from('profiles')
    .update({ user_id: userId }).eq('id', profileId).is('user_id', null)
    .select('id, name').maybeSingle()
  if (error || !data) {
    // Another tab may have bound this account while the request was pending.
    const ownProfile = (await readProfiles(client)).find((item) => item.user_id === userId)
    if (ownProfile) return ownProfile
    throw error || new Error('该身份已被绑定，请重试以刷新身份状态。')
  }
  return data
}

export async function resolveProfile(client, userId, isCurrent = () => true) {
  const profiles = await readProfiles(client)
  const ownProfile = profiles.find((item) => item.user_id === userId)
  if (ownProfile) return { profile: ownProfile, choices: [] }
  const choices = profiles.filter((item) => !item.user_id)
  if (profiles.length === 2 && choices.length === 1) {
    if (!isCurrent()) return null
    return { profile: await bindProfile(client, userId, choices[0].id), choices: [] }
  }
  if (profiles.length !== 2) throw new Error('身份档案不完整，请检查双人档案配置后重试。')
  if (!choices.length) throw new Error('两个身份均已绑定，请使用原来绑定的账号登录。')
  return { profile: null, choices }
}
