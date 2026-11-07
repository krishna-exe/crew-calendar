import { useState } from 'react'
import { supabase } from '../supabase'

export default function RoomTitle({ room, canEdit, onSaved, onError }) {
  const [draft, setDraft] = useState(null)

  async function save() {
    const v = draft?.trim()
    setDraft(null)
    if (!v || v === room.name) return
    const { error } = await supabase.from('rooms').update({ name: v }).eq('id', room.id)
    if (error) onError('Couldn’t rename the room. Try again.')
    else onSaved()
  }

  if (draft !== null) return (
    <input id="room-title" className="title-input" autoFocus maxLength={60} value={draft}
      aria-label="Room name" onChange={e => setDraft(e.target.value)} onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setDraft(null) }} />
  )
  return canEdit
    ? <button className="title-btn" title="Rename room" onClick={() => setDraft(room.name)}><h1>{room.name}<span className="pencil" aria-hidden="true">✎</span></h1></button>
    : <h1>{room.name}</h1>
}
