import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, bestStreak, keyOf, restChecker, streaks } from './dates'

// Saturday 7 November 2026.
const TODAY = new Date(2026, 10, 7, 12)
const ago = n => keyOf(addDays(TODAY, -n))
const doneOn = (...daysAgo) => {
  const set = new Set(daysAgo.map(ago))
  return k => set.has(k)
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => vi.useRealTimers())

describe('restChecker', () => {
  it('matches the given weekdays', () => {
    const isRest = restChecker([0])
    expect(isRest('2026-11-08')).toBe(true) // Sunday
    expect(isRest('2026-11-09')).toBe(false)
  })
  it('treats no rest days as none', () => expect(restChecker()('2026-11-08')).toBe(false))
  it('ignores a room where every day is a rest day', () => {
    expect(restChecker([0, 1, 2, 3, 4, 5, 6])('2026-11-08')).toBe(false)
  })
})

describe('streaks', () => {
  it('is zero with nothing done', () => expect(streaks(() => false)).toBe(0))
  it('counts back from today', () => expect(streaks(doneOn(0, 1, 2))).toBe(3))
  it('still counts when today is not done yet', () => expect(streaks(doneOn(1, 2))).toBe(2))
  it('stops at a missed day', () => expect(streaks(doneOn(0, 1, 3))).toBe(2))
  it('is zero when yesterday and today were missed', () => expect(streaks(doneOn(2, 3))).toBe(0))

  describe('with rest days', () => {
    const sundays = restChecker([0]) // 1 November was the last Sunday: 6 days ago
    it('skips a rest day that was not done', () => expect(streaks(doneOn(0, 5, 7), sundays)).toBe(1))
    it('carries across the rest day', () => expect(streaks(doneOn(0, 1, 2, 3, 4, 5, 7), sundays)).toBe(7))
    it('counts a rest day that was done', () => expect(streaks(doneOn(0, 1, 2, 3, 4, 5, 6), sundays)).toBe(7))
    it('does not break when today is a rest day', () => {
      expect(streaks(doneOn(1, 2), restChecker([6]))).toBe(2)
    })
    it('still stops at a missed active day', () => expect(streaks(doneOn(0, 1, 2, 3, 4, 7), sundays)).toBe(5))
    it('is zero with only rest days behind it', () => expect(streaks(() => false, sundays)).toBe(0))
    it('always ends, even with six rest days', () => {
      expect(streaks(() => false, restChecker([0, 1, 2, 3, 4, 5]))).toBe(0)
    })
  })
})

describe('bestStreak', () => {
  it('is zero with no days', () => expect(bestStreak([])).toBe(0))
  it('finds the longest run in any order', () => {
    expect(bestStreak(['2026-11-05', '2026-11-01', '2026-11-02', '2026-11-03'])).toBe(3)
  })
  it('crosses a month boundary', () => expect(bestStreak(['2026-10-31', '2026-11-01'])).toBe(2))
  it('breaks on a gap without rest days', () => expect(bestStreak(['2026-10-31', '2026-11-02'])).toBe(1))
  it('carries over a rest day', () => {
    expect(bestStreak(['2026-10-31', '2026-11-02'], restChecker([0]))).toBe(2)
  })
  it('counts a rest day that was done', () => {
    expect(bestStreak(['2026-10-31', '2026-11-01', '2026-11-02'], restChecker([0]))).toBe(3)
  })
  it('breaks when an active day is also in the gap', () => {
    expect(bestStreak(['2026-10-30', '2026-11-02'], restChecker([0]))).toBe(1)
  })
})
