import { useState } from 'react'
import { supabase } from '../supabase'
import Avatar from '../Avatar'

export default function Members({ room, members, me, isOwner, name, announce, reload, onError }) {
  const [confirm, setConfirm] = useState(null)

  // Dangerous actions take two taps.
  async function act(key, fn) {
    if (confirm !== key) { setConfirm(key); return }
    setConfirm(null)
    await fn()
  }
  const remove = id => act(`rm:${id}`, async () => {
    const { error } = await supabase.from('room_members').delete().match({ room_id: room.id, user_id: id })
    if (error) return onError('Couldn’t remove them. Try again.')
    announce('members'); reload()
  })
  const leave = () => act('leave', async () => {
    const { error } = await supabase.from('room_members').delete().match({ room_id: room.id, user_id: me })
    if (error) return onError('Couldn’t leave the room. Try again.')
    announce('members'); window.location.hash = '#/'
  })
  const destroy = () => act('delete', async () => {
    const { error } = await supabase.from('rooms').delete().eq('id', room.id)
    if (error) return onError('Couldn’t delete the room. Try again.')
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
