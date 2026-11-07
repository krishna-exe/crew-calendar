import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const CONFIRM_MS = 2000
// Shown Monday first. Values match Date.getDay(): 0 is Sunday.
const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]
const MAX_REST_DAYS = 6

export default function RoomSettings({ room, onSaved, onError }) {
  const [label, setLabel] = useState(room.checkin_label)
  const [saved, setSaved] = useState(false)
  const [rest, setRest] = useState(room.rest_days)
  useEffect(() => setLabel(room.checkin_label), [room.checkin_label])

  // Taps can outrun the network, so only one save runs at a time, always sending the
  // newest selection. Server updates wait until it finishes, or they'd undo newer taps.
  const latestRest = useRef(room.rest_days)
  const savingRest = useRef(false)
  useEffect(() => {
    if (savingRest.current) return
    latestRest.current = room.rest_days
    setRest(room.rest_days)
  }, [room.rest_days])

  async function saveLabel(e) {
    e.preventDefault()
    const v = label.trim()
    if (v === room.checkin_label) return
    const { error } = await supabase.from('rooms').update({ checkin_label: v }).eq('id', room.id)
    if (error) { onError('Couldn’t save the button text. Try again.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), CONFIRM_MS)
    onSaved()
  }

  async function saveRest() {
    if (savingRest.current) return
    savingRest.current = true
    let sent
    do {
      sent = latestRest.current
      const { error } = await supabase.from('rooms').update({ rest_days: sent }).eq('id', room.id)
      if (error) {
        latestRest.current = room.rest_days
        setRest(room.rest_days)
        onError('Couldn’t save the rest days. Try again.')
        break
      }
    } while (latestRest.current !== sent)
    savingRest.current = false
    onSaved()
  }

  function toggleRest(day) {
    const current = latestRest.current
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day]
    latestRest.current = next
    setRest(next)
    saveRest()
  }

  return (
    <section className="panel">
      <div className="eyebrow">Room settings</div>
      <h3>Check-in button</h3>
      <p className="muted small">What everyone taps each day. Leave it empty for “Check in”.</p>
      <form className="note-row" onSubmit={saveLabel}>
        <input id="checkin-label" maxLength={40} placeholder="e.g. Stayed strong, Hit the gym"
          value={label} onChange={e => setLabel(e.target.value)} />
        <button>{saved ? 'Saved' : 'Save'}</button>
      </form>

      <h3 className="settings-gap">Rest days</h3>
      <p className="muted small">Skipping these days won’t break anyone’s streak. Changes also apply to past days.</p>
      <div className="weekday-picks" role="group" aria-label="Rest days">
        {WEEKDAYS.map(([day, label]) => {
          const on = rest.includes(day)
          return (
            <button key={day} className={on ? 'on' : ''} aria-pressed={on}
              disabled={!on && rest.length >= MAX_REST_DAYS} onClick={() => toggleRest(day)}>
              {label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
