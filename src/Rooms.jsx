import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { restChecker, todayKey } from './dates'
import Reminders from './Reminders'

export default function Rooms({ me }) {
  const [rooms, setRooms] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [today, setToday] = useState(null) // room id -> { total, done, mine }

  const load = useCallback(() => {
    supabase.from('room_members').select('role, joined_at, rooms(id, name, rest_days)')
      .eq('user_id', me).order('joined_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('Couldn’t load your rooms. Refresh to try again.')
        else setRooms(data.filter(r => r.rooms))
      })
    // Progress on the room cards is a bonus: if it fails, the list still works.
    Promise.all([
      supabase.from('room_members').select('room_id'),
      supabase.from('checkins').select('room_id, user_id').eq('day', todayKey()),
    ]).then(([members, checkins]) => {
      if (members.error || checkins.error) return
      const out = {}
      for (const m of members.data) (out[m.room_id] ??= { total: 0, done: 0, mine: false }).total++
      for (const c of checkins.data) {
        const room = out[c.room_id]
        if (!room) continue
        room.done++
        if (c.user_id === me) room.mine = true
      }
      setToday(out)
    })
  }, [me])

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  async function checkIn(roomId) {
    const mark = (done, mine) => setToday(prev => ({ ...prev, [roomId]: { ...prev[roomId], done: prev[roomId].done + done, mine } }))
    mark(1, true)
    const { error } = await supabase.from('checkins').insert({ room_id: roomId, user_id: me, day: todayKey() })
    // 23505: already checked in from another device, so the card is right.
    if (error && error.code !== '23505') { mark(-1, false); setError('Couldn’t save that check-in. Try again.') }
  }

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('create_room', { room_name: name.trim() })
    setBusy(false)
    if (error) setError(error.message)
    else window.location.hash = `#/room/${data}`
  }

  return (
    <div className="home">
      <section>
        <div className="eyebrow">Your rooms</div>
        <h1>What are you tracking?</h1>
        {rooms === null && !error && <p className="muted">Loading…</p>}
        {rooms?.length === 0 && (
          <p className="muted">You’re not in any rooms yet. Create one, or open an invite link a friend sent you.</p>
        )}
        {error && <p className="error">{error}</p>}
        <ul className="room-list">
          {rooms?.map(r => {
            const t = today?.[r.rooms.id]
            return (
              <li key={r.rooms.id}>
                <a href={`#/room/${r.rooms.id}`}>
                  <span className="room-name">{r.rooms.name}</span>
                  {t && (
                    <span className="muted small">
                      {restChecker(r.rooms.rest_days)(todayKey()) && 'Rest day · '}{t.done} of {t.total} checked in today
                    </span>
                  )}
                </a>
                {t && (t.mine
                  ? <span className="status">✓ Done</span>
                  : <button className="status go" onClick={() => checkIn(r.rooms.id)}
                      aria-label={`Check in to ${r.rooms.name}`}>Check in</button>)}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="home-side">
        <section className="panel">
          <form onSubmit={create} className="stack">
            <h3>New room</h3>
            <label htmlFor="room-name">Name it after the habit</label>
            <input id="room-name" maxLength={60} placeholder="e.g. Gym, 10k steps, Read 20 pages"
              value={name} onChange={e => setName(e.target.value)} />
            <button className="big" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create room'}</button>
            <p className="muted small">You’ll get an invite link to send your friends.</p>
          </form>
        </section>
        <Reminders />
      </div>
    </div>
  )
}
