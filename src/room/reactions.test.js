import { describe, expect, it } from 'vitest'
import { addReaction, clearReactions, reactionsOn, removeReaction } from './reactions'

const r = (user_id, emoji = '🔥') => ({ checkin_user_id: 'a', day: '2026-11-07', user_id, emoji })

describe('reactions state', () => {
  it('adds and reads back', () => {
    expect(reactionsOn(addReaction({}, r('b')), 'a', '2026-11-07')).toEqual({ '🔥': ['b'] })
  })
  it('ignores a duplicate, such as our own arriving over realtime', () => {
    const once = addReaction({}, r('b'))
    expect(addReaction(once, r('b'))).toBe(once)
  })
  it('keeps other people and emoji when removing', () => {
    const state = [r('b'), r('c'), r('b', '👏')].reduce(addReaction, {})
    expect(reactionsOn(removeReaction(state, r('b')), 'a', '2026-11-07')).toEqual({ '🔥': ['c'], '👏': ['b'] })
  })
  it('clears a whole check-in', () => {
    expect(reactionsOn(clearReactions(addReaction({}, r('b')), 'a', '2026-11-07'), 'a', '2026-11-07')).toEqual({})
  })
  it('reads an unknown check-in as empty', () => expect(reactionsOn({}, 'x', 'y')).toEqual({}))
})
