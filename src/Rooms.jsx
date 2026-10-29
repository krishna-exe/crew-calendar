import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Rooms({ me }) {
  const [rooms, setRooms] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('room_members').select('role, joined_at, rooms(id, name)')
      .eq('user_id', me).order('joined_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('Couldn’t load your rooms. Refresh to try again.')
        else setRooms(data.filter(r => r.rooms))
      })
  }, [me])

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
        <ul className="room-list">
          {rooms?.map(r => (
            <li key={r.rooms.id}>
              <a href={`#/room/${r.rooms.id}`}>
                <span className="room-name">{r.rooms.name}</span>
                <span className="chip">{r.role === 'owner' ? 'Owner' : 'Member'}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <form onSubmit={create} className="stack">
          <h3>New room</h3>
          <label htmlFor="room-name">Name it after the habit</label>
          <input id="room-name" maxLength={60} placeholder="e.g. Gym, 10k steps, Read 20 pages"
            value={name} onChange={e => setName(e.target.value)} />
          <button className="big" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create room'}</button>
          <p className="muted small">You’ll get an invite link to send your friends.</p>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </div>
  )
}
