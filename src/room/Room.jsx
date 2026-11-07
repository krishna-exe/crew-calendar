import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { keyOf, restChecker, streaks, todayKey } from '../dates'
import { addReaction, clearReactions, reactionsOn, removeReaction } from './reactions'
import { useRoomData } from './useRoomData'
import Calendar from './Calendar'
import DayPanel from './DayPanel'
import Invite from './Invite'
import Members from './Members'
import RoomSettings from './RoomSettings'
import RoomTitle from './RoomTitle'
import Standings from './Standings'

const MILESTONES = [7, 14, 30, 50, 100, 200, 365]
const TOAST_MS = 5000

export default function Room({ roomId, me }) {
  const [view, setView] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [sel, setSel] = useState(todayKey)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const saving = useRef(false)
  const { room, members, days, reactions, setEntry, setReactions, loadRoom, loadMembers, announce } = useRoomData(roomId, setError)

  useEffect(() => {
    if (!error && !notice) return
    const t = setTimeout(() => { setError(''); setNotice('') }, TOAST_MS)
    return () => clearTimeout(t)
  }, [error, notice])

  // Move on to the new day if the page was left open overnight.
  useEffect(() => {
    let lastToday = todayKey()
    const onVisible = () => {
      const now = todayKey()
      if (document.visibilityState !== 'visible' || now === lastToday) return
      const was = lastToday
      lastToday = now
      setSel(s => (s === was ? now : s))
      setView(v => (keyOf(v).slice(0, 7) === was.slice(0, 7) ? new Date(`${now.slice(0, 7)}-01T00:00`) : v))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (room === undefined) return <p className="muted">Loading room…</p>
  if (room === null) return (
    <section className="panel narrow">
      <h3>Room not found</h3>
      <p>It may have been deleted, or you’re no longer a member.</p>
      <a href="#/">Back to your rooms</a>
    </section>
  )

  const isOwner = room.created_by === me
  const ids = members.map(m => m.user_id)
  const joined = Object.fromEntries(members.map(m => [m.user_id, keyOf(new Date(m.joined_at))]))
  const name = id => id === me ? 'You' : (members.find(m => m.user_id === id)?.profiles?.display_name || 'Someone')
  const did = (id, k) => days[id]?.[k] !== undefined
  const doneOn = k => ids.filter(id => did(id, k))
  const isRest = restChecker(room.rest_days)
  // A day is "full" when everyone who had joined by then checked in.
  const isFull = k => {
    const eligible = ids.filter(id => joined[id] <= k)
    return eligible.length >= 2 && eligible.every(id => did(id, k))
  }

  async function toggleCheckin() {
    if (saving.current) return
    saving.current = true
    const had = did(me, sel)
    const prevNote = days[me]?.[sel]
    setEntry(me, sel, had ? undefined : '')
    const { error } = had
      ? await supabase.from('checkins').delete().match({ room_id: roomId, user_id: me, day: sel })
      : await supabase.from('checkins').insert({ room_id: roomId, user_id: me, day: sel })
    saving.current = false
    if (error) {
      setEntry(me, sel, prevNote)
      setError('Couldn’t save that check-in. Try again.')
      return
    }
    setError('')
    if (had) {
      setReactions(s => clearReactions(s, me, sel))
      announce('uncheck', { user_id: me, day: sel })
    } else if (sel === todayKey()) {
      const n = streaks(k => k === sel || did(me, k), isRest)
      if (MILESTONES.includes(n)) setNotice(`🔥 ${n}-day streak. Nice work!`)
    }
  }

  async function saveNote(note) {
    const prev = days[me]?.[sel]
    if (prev === undefined || prev === note) return true
    setEntry(me, sel, note)
    const { error } = await supabase.from('checkins').update({ note }).match({ room_id: roomId, user_id: me, day: sel })
    if (error) { setEntry(me, sel, prev); setError('Couldn’t save your note.'); return false }
    return true
  }

  async function toggleReaction(checkinUser, emoji) {
    const row = { checkin_user_id: checkinUser, day: sel, user_id: me, emoji }
    const had = reactionsOn(reactions, checkinUser, sel)[emoji]?.includes(me)
    setReactions(s => (had ? removeReaction(s, row) : addReaction(s, row)))
    const { error } = had
      ? await supabase.from('reactions').delete().match({ room_id: roomId, ...row })
      : await supabase.from('reactions').insert({ room_id: roomId, ...row })
    if (error) {
      setReactions(s => (had ? addReaction(s, row) : removeReaction(s, row)))
      setError('Couldn’t save your reaction. Try again.')
    } else if (had) announce('unreact', row)
  }

  return (
    <>
      <header className="room-head">
        <div>
          <a href="#/" className="eyebrow back">← All rooms</a>
          <RoomTitle room={room} canEdit={isOwner} onSaved={loadRoom} onError={setError} />
        </div>
      </header>
      {(error || notice) && <p className="toast" role={error ? 'alert' : 'status'}>{error || notice}</p>}

      <div className="main">
        <Calendar view={view} setView={setView} sel={sel} setSel={setSel} doneOn={doneOn}
          isFull={isFull} isRest={isRest} mine={k => did(me, k)} name={name} hasRestDays={room.rest_days.length > 0} />

        <div className="side">
          <DayPanel sel={sel} ids={ids} joined={joined} me={me} days={days} did={did} name={name} room={room}
            isRest={isRest} reactions={reactions} onToggle={toggleCheckin} onSaveNote={saveNote}
            onReact={toggleReaction} onNotice={setNotice} onError={setError} />
          <Standings ids={ids} days={days} view={view} name={name} isFull={isFull} isRest={isRest} />
        </div>

        <div className="extras">
          <Invite room={room} isOwner={isOwner} onReset={loadRoom} onError={setError} />
          {isOwner && <RoomSettings room={room} onSaved={loadRoom} onError={setError} />}
          <Members room={room} members={members} me={me} isOwner={isOwner} name={name}
            announce={announce} reload={loadMembers} onError={setError} />
        </div>
      </div>
    </>
  )
}
