// Reactions in state: { 'userId|day': { emoji: [reactor ids] } }, keyed by the check-in.
export const EMOJIS = ['🔥', '👏', '💪', '🎉']

const keyFor = (checkinUser, day) => `${checkinUser}|${day}`

export const reactionsOn = (state, checkinUser, day) => state[keyFor(checkinUser, day)] ?? {}

export function addReaction(state, { checkin_user_id, day, user_id, emoji }) {
  const key = keyFor(checkin_user_id, day)
  const current = state[key]?.[emoji] ?? []
  if (current.includes(user_id)) return state
  return { ...state, [key]: { ...state[key], [emoji]: [...current, user_id] } }
}

export function removeReaction(state, { checkin_user_id, day, user_id, emoji }) {
  const key = keyFor(checkin_user_id, day)
  const left = (state[key]?.[emoji] ?? []).filter(id => id !== user_id)
  return { ...state, [key]: { ...state[key], [emoji]: left } }
}

export function clearReactions(state, checkinUser, day) {
  const next = { ...state }
  delete next[keyFor(checkinUser, day)]
  return next
}
