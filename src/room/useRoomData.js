import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { addReaction, clearReactions, removeReaction } from './reactions'

const PAGE_SIZE = 1000

async function fetchAll(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// Loads a room and keeps it live. Inserts and updates arrive through Postgres changes.
// Supabase can't filter delete events by room, so deletes are announced on the room's
// broadcast channel instead.
export function useRoomData(roomId, onLoadError) {
  const [room, setRoom] = useState(undefined)
  const [members, setMembers] = useState([])
  const [days, setDays] = useState({}) // userId -> { 'YYYY-MM-DD': note }
  const [reactions, setReactions] = useState({})
  const channel = useRef(null)

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms')
      .select('id, name, invite_code, created_by, checkin_label, rest_days')
      .eq('id', roomId).maybeSingle()
    setRoom(data ?? null)
  }, [roomId])

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from('room_members')
      .select('user_id, role, joined_at, profiles(display_name)')
      .eq('room_id', roomId).order('joined_at')
    if (data) setMembers(data)
  }, [roomId])

  const loadActivity = useCallback(async () => {
    try {
      const [checkins, reactionRows] = await Promise.all([
        fetchAll(() => supabase.from('checkins').select('user_id, day, note').eq('room_id', roomId).order('day')),
        fetchAll(() => supabase.from('reactions').select('checkin_user_id, day, user_id, emoji').eq('room_id', roomId).order('day')),
      ])
      const byUser = {}
      for (const c of checkins) (byUser[c.user_id] ??= {})[c.day] = c.note
      setDays(byUser)
      setReactions(reactionRows.reduce(addReaction, {}))
    } catch {
      onLoadError('Couldn’t load check-ins. Refresh to try again.')
    }
  }, [roomId, onLoadError])

  const setEntry = useCallback((userId, day, note) => {
    setDays(prev => {
      const mine = { ...(prev[userId] || {}) }
      if (note === undefined) delete mine[day]
      else mine[day] = note
      return { ...prev, [userId]: mine }
    })
  }, [])

  useEffect(() => {
    const loadEverything = () => { loadRoom(); loadMembers(); loadActivity() }
    loadEverything()

    const onCheckin = ({ new: c }) => setEntry(c.user_id, c.day, c.note)
    const table = (name, column = 'room_id') => ({ schema: 'public', table: name, filter: `${column}=eq.${roomId}` })
    const ch = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', ...table('checkins') }, onCheckin)
      .on('postgres_changes', { event: 'UPDATE', ...table('checkins') }, onCheckin)
      .on('postgres_changes', { event: 'INSERT', ...table('reactions') }, ({ new: r }) => setReactions(s => addReaction(s, r)))
      .on('postgres_changes', { event: 'INSERT', ...table('room_members') }, () => loadMembers())
      .on('postgres_changes', { event: 'UPDATE', ...table('rooms', 'id') }, () => loadRoom())
      .on('broadcast', { event: 'uncheck' }, ({ payload }) => {
        setEntry(payload.user_id, payload.day, undefined)
        setReactions(s => clearReactions(s, payload.user_id, payload.day))
      })
      .on('broadcast', { event: 'unreact' }, ({ payload }) => setReactions(s => removeReaction(s, payload)))
      .on('broadcast', { event: 'members' }, loadEverything)
      .subscribe()
    channel.current = ch

    // Phones drop the live connection while asleep, so catch up on return.
    const onVisible = () => { if (document.visibilityState === 'visible') loadEverything() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(ch)
    }
  }, [roomId, loadRoom, loadMembers, loadActivity, setEntry])

  const announce = useCallback((event, payload = {}) => {
    channel.current?.send({ type: 'broadcast', event, payload })
  }, [])

  return { room, members, days, reactions, setEntry, setReactions, loadRoom, loadMembers, announce }
}
