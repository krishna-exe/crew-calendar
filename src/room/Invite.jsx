import { useRef, useState } from 'react'
import { supabase } from '../supabase'

const CONFIRM_MS = 2000

export default function Invite({ room, isOwner, onReset, onError }) {
  const link = `${window.location.origin}${window.location.pathname}#/join/${room.invite_code}`
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const input = useRef(null)

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), CONFIRM_MS) }
    catch { input.current?.select() }
  }
  async function reset() {
    if (!confirmReset) { setConfirmReset(true); return }
    setConfirmReset(false)
    const { error } = await supabase.rpc('reset_invite', { r: room.id })
    if (error) onError('Couldn’t reset the invite link. Try again.')
    else onReset()
  }
  async function share() {
    try { await navigator.share({ title: room.name, text: `Join “${room.name}” on Crew Calendar`, url: link }) }
    catch (e) { if (e.name !== 'AbortError') copy() }
  }

  return (
    <section className="panel">
      <div className="eyebrow">Invite friends</div>
      <h3>Send this link</h3>
      <p className="muted small">Anyone with the link can sign in and join this room.</p>
      <div className="note-row">
        <input id="invite-link" ref={input} readOnly value={link} onFocus={e => e.target.select()} />
        <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        {navigator.share && <button onClick={share}>Share</button>}
      </div>
      {isOwner && (
        <button className="link small" onClick={reset} onBlur={() => setConfirmReset(false)}>
          {confirmReset ? 'Tap again: the old link will stop working' : 'Reset invite link'}
        </button>
      )}
    </section>
  )
}
