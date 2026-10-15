import { useState } from 'react'
import { ArrowRight, Flame, Loader2, LogIn, Mail, UserRound } from 'lucide-react'
import { useAuth } from './auth'
import { PROFILES } from './data'
import './auth.css'

export function FullScreenLoader({ label = '正在连接…' }) {
  return (
    <div className="auth-screen">
      <div className="auth-card auth-loading">
        <span className="auth-brand"><Flame size={19} fill="currentColor" /></span>
        <Loader2 size={22} className="spin" />
        <p className="auth-sub">{label}</p>
      </div>
    </div>
  )
}

export function LoginScreen() {
  const { signInWithPassword, signInWithOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = mode === 'password'
      ? await signInWithPassword(email, password)
      : await signInWithOtp(email)
    setBusy(false)

    if (error) {
      setMessage(
        mode === 'password'
          ? '登录失败：邮箱或密码不正确'
          : `发送失败：${error.message}`,
      )
      return
    }
    if (mode === 'magic') setMessage('登录链接已发送，请查收邮件并点击。')
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-brand"><Flame size={19} fill="currentColor" /></span>
        <h1>双燃 · 双人健康打卡</h1>
        <p className="auth-sub">两个人的共享空间，登录后即可同步彼此的打卡记录。</p>

        <div className="auth-tabs">
          <button type="button" className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>密码登录</button>
          <button type="button" className={mode === 'magic' ? 'active' : ''} onClick={() => setMode('magic')}>邮箱链接</button>
        </div>

        <label className="auth-field">
          <span><Mail size={15} /> 邮箱</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>

        {mode === 'password' && (
          <label className="auth-field">
            <span><UserRound size={15} /> 密码</span>
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
        )}

        {message && <p className="auth-message">{message}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <Loader2 size={17} className="spin" /> : <LogIn size={17} />}
          {mode === 'password' ? '登录' : '发送登录链接'}
        </button>

        <p className="auth-hint">首次使用：任意一个账号登录后，选择你的档案即可。</p>
      </form>
    </div>
  )
}

export function ClaimScreen() {
  const { claimProfile, signOut } = useAuth()
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')

  const claim = async (profileId) => {
    setBusyId(profileId)
    setMessage('')
    const { error } = await claimProfile(profileId)
    setBusyId(null)
    if (error) setMessage(`绑定失败：该档案可能已被认领（${error.message}）`)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <span className="auth-brand"><Flame size={19} fill="currentColor" /></span>
        <h1>你是哪一位？</h1>
        <p className="auth-sub">选择你的档案，之后的打卡都会记录到对应的人名下。</p>

        <div className="claim-list">
          {PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="claim-person"
              disabled={busyId !== null}
              onClick={() => claim(profile.id)}
            >
              <span className="claim-avatar" style={{ background: profile.color }}>{profile.initials}</span>
              <span className="claim-name">{profile.name}</span>
              {busyId === profile.id ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />}
            </button>
          ))}
        </div>

        {message && <p className="auth-message error">{message}</p>}

        <button type="button" className="auth-link" onClick={() => signOut()}>退出并换一个账号</button>
      </div>
    </div>
  )
}
