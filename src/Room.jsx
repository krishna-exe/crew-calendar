import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { MONTHS, keyOf, parseKey, addDays, todayKey, streaks, bestStreak } from './dates'
import Avatar from './Avatar'

export default function Room({ roomId, me }) {
  const [room, setRoom] = useState(undefined)
  const [members, setMembers] = useState([])
  const [days, setDays] = useState({}) // userId -> { 'YYYY-MM-DD': note }
  const [view, setView] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [sel, setSel] = useState(todayKey)
  const [error, setError] = useState('')
  const channel = useRef(null)

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('id, name, invite_code, created_by').eq('id', roomId).maybeSingle()
    setRoom(data ?? null)
  }, [roomId])

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from('room_members')
      .select('user_id, role, joined_at, profiles(display_name)')
      .eq('room_id', roomId).order('joined_at')
    if (data) setMembers(data)
  }, [roomId])

  const loadCheckins = useCallback(async () => {
    const out = {}
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('checkins').select('user_id, day, note')
        .eq('room_id', roomId).order('day').range(from, from + 999)
      if (error) { setError('Couldn’t load check-ins. Refresh to try again.'); return }
      for (const c of data) (out[c.user_id] ??= {})[c.day] = c.note
      if (data.length < 1000) break
    }
    setDays(out)
  }, [roomId])

  const setEntry = useCallback((userId, day, note) => {
    setDays(prev => {
      const mine = { ...(prev[userId] || {}) }
      if (note === undefined) delete mine[day]
      else mine[day] = note
      return { ...prev, [userId]: mine }
    })
  }, [])

  useEffect(() => {
    loadRoom(); loadMembers(); loadCheckins()
    // Inserts and updates arrive through Postgres changes (filtered by RLS).
    // Supabase can't filter delete events by room, so un-checks and member
    // removals are announced on the room's broadcast channel instead.
    const ch = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkins', filter: `room_id=eq.${roomId}` },
        ({ new: c }) => setEntry(c.user_id, c.day, c.note))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkins', filter: `room_id=eq.${roomId}` },
        ({ new: c }) => setEntry(c.user_id, c.day, c.note))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => loadMembers())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => loadRoom())
      .on('broadcast', { event: 'uncheck' }, ({ payload }) => setEntry(payload.user_id, payload.day, undefined))
      .on('broadcast', { event: 'members' }, () => { loadRoom(); loadMembers(); loadCheckins() })
      .subscribe()
    channel.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [roomId, loadRoom, loadMembers, loadCheckins, setEntry])

  const announce = (event, payload = {}) => channel.current?.send({ type: 'broadcast', event, payload })

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
  // A day is "full" when everyone who had joined by then checked in.
  const isFull = k => {
    const eligible = ids.filter(id => joined[id] <= k)
    return eligible.length >= 2 && eligible.every(id => did(id, k))
  }

  async function toggle() {
    const had = did(me, sel)
    const prevNote = days[me]?.[sel]
    setEntry(me, sel, had ? undefined : '')
    const { error } = had
      ? await supabase.from('checkins').delete().match({ room_id: roomId, user_id: me, day: sel })
      : await supabase.from('checkins').insert({ room_id: roomId, user_id: me, day: sel })
    if (error) { setEntry(me, sel, prevNote); setError('Couldn’t save that check-in. Try again.') }
    else { setError(''); if (had) announce('uncheck', { user_id: me, day: sel }) }
  }

  async function saveNote(note) {
    const prev = days[me]?.[sel]
    if (prev === undefined || prev === note) return
    setEntry(me, sel, note)
    const { error } = await supabase.from('checkins').update({ note }).match({ room_id: roomId, user_id: me, day: sel })
    if (error) { setEntry(me, sel, prev); setError('Couldn’t save your note.') }
  }

  return (
    <>
      <header className="room-head">
        <div>
          <a href="#/" className="eyebrow back">← All rooms</a>
          <RoomTitle room={room} canEdit={isOwner} onSaved={loadRoom} />
        </div>
        {error && <p className="error">{error}</p>}
      </header>

      <div className="main">
        <Calendar view={view} setView={setView} sel={sel} setSel={setSel}
          doneOn={doneOn} isFull={isFull} mine={k => did(me, k)} name={name} />

        <div className="side">
          <DayPanel sel={sel} ids={ids} joined={joined} me={me} days={days} did={did}
            name={name} onToggle={toggle} onSaveNote={saveNote} />
          <Standings ids={ids} days={days} view={view} name={name} isFull={isFull} />
          <Invite room={room} isOwner={isOwner} onReset={loadRoom} />
          <Members room={room} members={members} me={me} isOwner={isOwner} name={name}
            announce={announce} reload={loadMembers} />
        </div>
      </div>
    </>
  )
}

function RoomTitle({ room, canEdit, onSaved }) {
  const [draft, setDraft] = useState(null)

  async function save() {
    const v = draft?.trim()
    setDraft(null)
    if (!v || v === room.name) return
    await supabase.from('rooms').update({ name: v }).eq('id', room.id)
    onSaved()
  }

  if (draft !== null) return (
    <input id="room-title" className="title-input" autoFocus maxLength={60} value={draft}
      aria-label="Room name" onChange={e => setDraft(e.target.value)} onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setDraft(null) }} />
  )
  return canEdit
    ? <button className="title-btn" title="Rename room" onClick={() => setDraft(room.name)}><h1>{room.name}</h1></button>
    : <h1>{room.name}</h1>
}

function Calendar({ view, setView, sel, setSel, doneOn, isFull, mine, name }) {
  const y = view.getFullYear(), m = view.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const len = new Date(y, m + 1, 0).getDate()
  const tk = todayKey()
  const shift = n => setView(new Date(y, m + n, 1))
  const goToday = () => { const t = new Date(); setView(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(keyOf(t)) }

  return (
    <section className="cal" aria-label="Calendar">
      <div className="cal-head">
        <h2>{MONTHS[m]} {y}</h2>
        <div className="nav">
          <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button onClick={goToday}>Today</button>
          <button onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="dow">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}</div>
      <div className="grid">
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className="day blank" />)}
        {Array.from({ length: len }, (_, i) => {
          const k = keyOf(new Date(y, m, i + 1))
          const who = doneOn(k)
          const cls = ['day',
            k > tk && 'future', k === tk && 'today', k === sel && 'sel',
            isFull(k) && 'full', mine(k) && 'mine'].filter(Boolean).join(' ')
          return (
            <button key={k} className={cls} disabled={k > tk} onClick={() => setSel(k)}
              aria-label={`${MONTHS[m]} ${i + 1}: ${who.length} checked in`}>
              <span className="n">{i + 1}</span>
              <span className="faces">
                {who.slice(0, 4).map(id => <Avatar key={id} id={id} name={name(id)} size={18} />)}
                {who.length > 4 && <span className="more">+{who.length - 4}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="sw sw-full" />Whole crew did it</span>
        <span><i className="sw sw-mine" />You did it</span>
      </div>
    </section>
  )
}

function DayPanel({ sel, ids, joined, me, days, did, name, onToggle, onSaveNote }) {
  const d = parseKey(sel)
  const tk = todayKey()
  const mine = did(me, sel)
  const stored = days[me]?.[sel] ?? ''
  const [note, setNote] = useState(stored)
  useEffect(() => setNote(stored), [stored, sel])

  const label = sel === tk ? 'Today'
    : sel === keyOf(addDays(new Date(), -1)) ? 'Yesterday'
    : d.toLocaleDateString(undefined, { weekday: 'long' })
  const done = ids.filter(id => did(id, sel))
  const waiting = ids.filter(id => !did(id, sel) && joined[id] <= sel)

  return (
    <section className="panel" aria-live="polite">
      <div className="eyebrow">{label}</div>
      <h3>{d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
      <button className={`big ${mine ? 'done' : ''}`} onClick={onToggle}>
        {mine ? 'Done ✓ (tap to undo)' : sel === tk ? 'I did it today' : 'I did it this day'}
      </button>
      {mine && (
        <form className="note-row" onSubmit={e => { e.preventDefault(); onSaveNote(note.trim()) }}>
          <input id="note" maxLength={140} placeholder="Add a note (optional)" value={note}
            onChange={e => setNote(e.target.value)} />
          <button>Save</button>
        </form>
      )}
      {done.length === 0 && <p className="muted small">Nobody has checked in for this day yet.</p>}
      <ul className="who">
        {done.map(id => (
          <li key={id}>
            <Avatar id={id} name={name(id)} />
            <div><div className="nm">{name(id)}</div><div className="nt">{days[id][sel] || 'Checked in'}</div></div>
          </li>
        ))}
        {waiting.map(id => (
          <li key={id} className="missing">
            <Avatar id={id} name={name(id)} />
            <div><div className="nm">{name(id)}</div><div className="nt">Not yet</div></div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Standings({ ids, days, view, name, isFull }) {
  const prefix = keyOf(view).slice(0, 8)
  const rows = ids.map(id => {
    const mine = days[id] || {}
    const keys = Object.keys(mine)
    return {
      id,
      cur: streaks(k => mine[k] !== undefined),
      best: bestStreak(keys),
      month: keys.filter(k => k.startsWith(prefix)).length,
    }
  }).sort((a, b) => b.cur - a.cur || b.month - a.month)
  const crew = ids.length >= 2 ? streaks(isFull) : 0

  return (
    <section className="panel">
      <div className="eyebrow">Standings</div>
      <h3>The crew</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Person</th><th>Streak</th><th>Best</th><th>{MONTHS[view.getMonth()].slice(0, 3)}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><span className="p"><Avatar id={r.id} name={name(r.id)} /><span>{name(r.id)}</span></span></td>
                <td>{r.cur ? `${r.cur}🔥` : 0}</td><td>{r.best}</td><td>{r.month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {crew > 0 && <div className="squad">Whole-crew streak: <b>{crew}</b> day{crew === 1 ? '' : 's'} in a row</div>}
    </section>
  )
}

function Invite({ room, isOwner, onReset }) {
  const link = `${window.location.origin}${window.location.pathname}#/join/${room.invite_code}`
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const input = useRef(null)

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { input.current?.select() }
  }
  async function reset() {
    if (!confirmReset) { setConfirmReset(true); return }
    setConfirmReset(false)
    await supabase.rpc('reset_invite', { r: room.id })
    onReset()
  }

  return (
    <section className="panel">
      <div className="eyebrow">Invite friends</div>
      <h3>Send this link</h3>
      <p className="muted small">Anyone with the link can sign in and join this room.</p>
      <div className="note-row">
        <input id="invite-link" ref={input} readOnly value={link} onFocus={e => e.target.select()} />
        <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {isOwner && (
        <button className="link small" onClick={reset} onBlur={() => setConfirmReset(false)}>
          {confirmReset ? 'Tap again: the old link will stop working' : 'Reset invite link'}
        </button>
      )}
    </section>
  )
}

function Members({ room, members, me, isOwner, name, announce, reload }) {
  const [confirm, setConfirm] = useState(null)

  async function act(key, fn) {
    if (confirm !== key) { setConfirm(key); return }
    setConfirm(null)
    await fn()
  }
  const remove = id => act(`rm:${id}`, async () => {
    await supabase.from('room_members').delete().match({ room_id: room.id, user_id: id })
    announce('members'); reload()
  })
  const leave = () => act('leave', async () => {
    await supabase.from('room_members').delete().match({ room_id: room.id, user_id: me })
    announce('members'); window.location.hash = '#/'
  })
  const destroy = () => act('delete', async () => {
    await supabase.from('rooms').delete().eq('id', room.id)
    announce('members'); window.location.hash = '#/'
  })

  return (
    <section className="panel">
      <div className="eyebrow">Members · {members.length}</div>
      <ul className="who">
        {members.map(m => (
          <li key={m.user_id} className="member">
            <Avatar id={m.user_id} name={name(m.user_id)} />
            <div className="nm">{name(m.user_id)}{m.role === 'owner' && <span className="chip">Owner</span>}</div>
            {isOwner && m.user_id !== me && (
              <button className="link small danger" onClick={() => remove(m.user_id)} onBlur={() => setConfirm(null)}>
                {confirm === `rm:${m.user_id}` ? 'Confirm' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="danger-zone">
        {isOwner
          ? <button className="link small danger" onClick={destroy} onBlur={() => setConfirm(null)}>
              {confirm === 'delete' ? 'Tap again to delete the room and all check-ins' : 'Delete room'}
            </button>
          : <button className="link small danger" onClick={leave} onBlur={() => setConfirm(null)}>
              {confirm === 'leave' ? 'Tap again to leave (your check-ins are removed)' : 'Leave room'}
            </button>}
      </div>
    </section>
  )
}
