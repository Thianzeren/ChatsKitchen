// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChoiceVote, type VoteConfig, type VoteResolution } from './useChoiceVote'

function setup(cfg: Partial<VoteConfig> = {}) {
  const onResolve = vi.fn<[VoteResolution], void>()
  const config: VoteConfig = { numOptions: 3, durationMs: null, ...cfg }
  const hook = renderHook(() => useChoiceVote(config, onResolve))
  const vote = (user: string, text: string) => {
    let consumed = false
    act(() => { consumed = hook.result.current.registerVote(user, text) })
    return consumed
  }
  return { hook, onResolve, vote }
}

describe('useChoiceVote', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('tallies !1..!N votes and ignores out-of-range or non-vote text', () => {
    const { hook, vote } = setup()
    expect(vote('a', '!1')).toBe(true)
    expect(vote('b', '!3')).toBe(true)
    expect(vote('c', '!4')).toBe(false)
    expect(vote('d', 'hello')).toBe(false)
    expect(vote('e', '!chop lettuce')).toBe(false)
    expect(hook.result.current.state.tallies).toEqual([1, 0, 1])
  })

  it('moves a user’s vote instead of double-counting it', () => {
    const { hook, vote } = setup()
    vote('a', '!1')
    vote('a', '!2')
    vote('a', '!2')
    expect(hook.result.current.state.tallies).toEqual([0, 1, 0])
    expect(hook.result.current.state.voters).toEqual({ a: 1 })
  })

  it('resolves to the plurality winner when the timer expires', () => {
    const { vote, onResolve } = setup({ durationMs: 1000 })
    vote('a', '!2')
    vote('b', '!2')
    vote('c', '!3')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve.mock.calls[0][0]).toMatchObject({ winnerIdx: 1, reason: 'timer' })
  })

  it('breaks ties toward the leftmost option', () => {
    const { hook, vote, onResolve } = setup()
    vote('a', '!3')
    vote('b', '!2')
    act(() => { hook.result.current.forceResolve() })
    expect(onResolve.mock.calls[0][0]).toMatchObject({ winnerIdx: 1, reason: 'force' })
  })

  it('halts the countdown while paused', () => {
    const { hook, onResolve } = setup({ durationMs: 500 })
    act(() => { hook.result.current.togglePause() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onResolve).not.toHaveBeenCalled()
    expect(hook.result.current.state.timeLeftMs).toBe(500)
    act(() => { hook.result.current.togglePause() })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  it('accepts !skip only when allowDoneCommand is set', () => {
    const off = setup()
    expect(off.vote('a', '!skip')).toBe(false)

    const on = setup({ allowDoneCommand: true })
    on.vote('a', '!3')
    expect(on.vote('b', '!skip')).toBe(true)
    expect(on.onResolve).toHaveBeenCalledTimes(1)
    expect(on.onResolve.mock.calls[0][0]).toMatchObject({ winnerIdx: 2, reason: 'done_command' })
  })

  it('fires onResolve exactly once and rejects votes afterwards', () => {
    const { hook, vote, onResolve } = setup()
    vote('a', '!1')
    act(() => { hook.result.current.forceResolve() })
    act(() => { hook.result.current.forceResolve() })
    expect(vote('b', '!2')).toBe(false)
    expect(onResolve).toHaveBeenCalledTimes(1)
  })
})
