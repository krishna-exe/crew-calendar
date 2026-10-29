import { useEffect, useState } from 'react'
import { supabase, configured } from './supabase'
import Rooms from './Rooms'
import Join from './Join'
import Room from './Room'

const PENDING_JOIN = 'crew-calendar:pending-join'

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function parseRoute(hash) {
  const [, kind, arg] = hash.replace(/^#/, '').split('/')
  if (kind === 'room' && arg) return { page: 'room', id: arg }
  if (kind === 'join' && arg) return { page: 'join', code: arg }
  return { page: 'home' }
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const route = parseRoute(useHash())

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Remember an invite across the sign-in email round trip.
  useEffect(() => {
    if (route.page === 'join' && session === null) localStorage.setItem(PENDING_JOIN, route.code)
    if (session) {
      const code = localStorage.getItem(PENDING_JOIN)
      if (code) {
        localStorage.removeItem(PENDING_JOIN)
        if (route.page !== 'join') window.location.hash = `#/join/${code}`
      }
    }
  }, [session, route.page, route.code])

  if (!configured) return <Setup />
  if (session === undefined) return <div className="wrap"><p className="muted">Loading…</p></div>
  if (!session) return <SignIn joining={route.page === 'join'} />

  const me = session.user.id
  return (
    <div className="wrap">
      <TopBar me={me} />
      {route.page === 'room' && <Room key={route.id} roomId={route.id} me={me} />}
      {route.page === 'join' && <Join key={route.code} code={route.code} />}
      {route.page === 'home' && <Rooms me={me} />}
    </div>
  )
}

function TopBar({ me }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('display_name').eq('id', me).single()
      .then(({ data }) => data && setName(data.display_name))
  }, [me])

  async function save(e) {
    e.preventDefault()
    const v = draft.trim()
    setEditing(false)
    if (!v || v === name) return
    const { error } = await supabase.from('profiles').update({ display_name: v }).eq('id', me)
    if (!error) setName(v)
  }

  return (
    <nav className="topbar">
      <a href="#/" className="brand">Crew Calendar</a>
      <div className="topbar-right">
        {editing ? (
          <form onSubmit={save} className="inline-form">
            <input id="display-name" autoFocus maxLength={40} value={draft} aria-label="Your name"
              onChange={e => setDraft(e.target.value)} onBlur={save} />
          </form>
        ) : (
          <button className="link" title="Change the name your friends see"
            onClick={() => { setDraft(name); setEditing(true) }}>
            {name || 'Set your name'}
          </button>
        )}
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </nav>
  )
}

function SignIn({ joining }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="wrap narrow">
      <div className="hero">
        <div className="eyebrow">Shared daily tracker</div>
        <h1>Crew Calendar</h1>
        <p className="lede">Make a room, invite your friends, and check in every day you do the thing. Keep your streak, and try to turn the whole calendar yellow together.</p>
      </div>
      <section className="panel">
        {sent ? (
          <>
            <h3>Check your inbox</h3>
            <p>We sent a sign-in link to <b>{email}</b>. Open it on this device to continue{joining ? ' and join the room' : ''}.</p>
            <button className="link" onClick={() => setSent(false)}>Use a different email</button>
          </>
        ) : (
          <form onSubmit={submit} className="stack">
            <h3>{joining ? 'Sign in to join the room' : 'Sign in'}</h3>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <button className="big" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
            <p className="muted small">No password needed. New here? This creates your account.</p>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </section>
    </div>
  )
}

function Setup() {
  return (
    <div className="wrap narrow">
      <section className="panel">
        <h3>Almost there</h3>
        <p>Add your Supabase project URL and anon key to <code>.env.local</code>, then restart the dev server. The README has the steps.</p>
      </section>
    </div>
  )
}
