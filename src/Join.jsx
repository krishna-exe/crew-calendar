import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Join({ code }) {
  const [room, setRoom] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('room_preview', { code }).then(({ data, error }) => {
      if (error) { setError(error.message); setRoom(null); return }
      const r = data?.[0] ?? null
      if (r?.already_member) window.location.hash = `#/room/${r.id}`
      else setRoom(r)
    })
  }, [code])

  async function join() {
    setBusy(true)
    const { data, error } = await supabase.rpc('join_room', { code })
    setBusy(false)
    if (error) setError(error.message)
    else window.location.hash = `#/room/${data}`
  }

  return (
    <div className="narrow">
      <section className="panel">
        {room === undefined && <p className="muted">Checking your invite…</p>}
        {room === null && (
          <>
            <h3>This invite doesn’t work</h3>
            <p>The link may be mistyped, or the room owner reset it. Ask them for a new one.</p>
            <a href="#/">Go to your rooms</a>
          </>
        )}
        {room && (
          <div className="stack">
            <div className="eyebrow">You’re invited</div>
            <h1 className="join-title">{room.name}</h1>
            <p>{room.member_count} {room.member_count === 1 ? 'person is' : 'people are'} tracking this together.</p>
            <button className="big" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join room'}</button>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
