import { useCallback, useEffect, useRef, useState } from 'react'

export interface VoteConfig {
  numOptions: number
  durationMs: number | null      // null = no auto-resolve on timer
  allowDoneCommand?: boolean      // accept !done / !skip to commit early with current plurality
}

export interface VoteState {
  tallies: number[]                       // length = numOptions; one count per option
  voters: Record<string, number>          // user → option index they voted for
  doneVoters: string[]                    // users who typed !done
  timeLeftMs: number | null
  resolved: boolean
  paused: boolean                         // when true, the countdown halts but votes are still accepted
  // When set, a useEffect fires onResolve once and clears this. Keeps the resolve
  // side-effect out of the setState updater so we never trigger parent setState
  // during a child render.
  pendingResolution: { winnerIdx: number; reason: VoteResolution['reason'] } | null
}

export interface VoteResolution {
  winnerIdx: number               // -1 if no votes
  reason: 'timer' | 'force' | 'done_command'
  finalState: VoteState
}

const DONE_PATTERNS = ['done', 'skip', 'pass']

function parseVoteCommand(text: string, numOptions: number, allowDone: boolean): { idx: number } | { done: true } | null {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed.startsWith('!')) return null
  const body = trimmed.slice(1).trim()
  if (allowDone && DONE_PATTERNS.includes(body)) return { done: true }
  const num = Number(body)
  if (!Number.isInteger(num)) return null
  const idx = num - 1
  if (idx < 0 || idx >= numOptions) return null
  return { idx }
}

function pluralityWinner(tallies: number[]): number {
  // Leftmost wins on ties (deterministic)
  let best = 0
  for (let i = 1; i < tallies.length; i++) {
    if (tallies[i] > tallies[best]) best = i
  }
  return best
}

export function useChoiceVote(
  cfg: VoteConfig,
  onResolve: (res: VoteResolution) => void,
) {
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  const makeInitial = useCallback((): VoteState => ({
    tallies: new Array(cfgRef.current.numOptions).fill(0),
    voters: {},
    doneVoters: [],
    timeLeftMs: cfgRef.current.durationMs,
    resolved: false,
    paused: false,
    pendingResolution: null,
  }), [])

  const [state, setState] = useState<VoteState>(makeInitial)
  const stateRef = useRef(state)
  stateRef.current = state

  // Mark the vote as resolved with a pending side-effect; the effect below fires onResolve.
  const markResolved = useCallback((winnerIdx: number, reason: VoteResolution['reason']) => {
    setState(prev => {
      if (prev.resolved) return prev
      return {
        ...prev,
        resolved: true,
        timeLeftMs: 0,
        pendingResolution: { winnerIdx, reason },
      }
    })
  }, [])

  // Side-effect: fire onResolve once when a resolution is queued, then clear it.
  useEffect(() => {
    const pending = state.pendingResolution
    if (!pending) return
    // Snapshot the state to hand to onResolve before clearing.
    const finalState = state
    setState(prev => ({ ...prev, pendingResolution: null }))
    onResolveRef.current({ winnerIdx: pending.winnerIdx, reason: pending.reason, finalState })
  }, [state.pendingResolution, state])

  const forceResolve = useCallback((idx?: number) => {
    const cur = stateRef.current
    if (cur.resolved) return
    const winner = idx !== undefined ? idx : pluralityWinner(cur.tallies)
    markResolved(winner, 'force')
  }, [markResolved])

  const registerVote = useCallback((user: string, text: string): boolean => {
    if (stateRef.current.resolved) return false
    const parsed = parseVoteCommand(text, cfgRef.current.numOptions, cfgRef.current.allowDoneCommand ?? false)
    if (!parsed) return false

    if ('done' in parsed) {
      setState(prev => {
        if (prev.resolved) return prev
        if (prev.doneVoters.includes(user)) return prev
        const next: VoteState = {
          ...prev,
          doneVoters: [...prev.doneVoters, user],
          resolved: true,
          timeLeftMs: 0,
          pendingResolution: { winnerIdx: pluralityWinner(prev.tallies), reason: 'done_command' },
        }
        return next
      })
      return true
    }

    setState(prev => {
      if (prev.resolved) return prev
      const prevChoice = prev.voters[user]
      if (prevChoice === parsed.idx) return prev
      const tallies = [...prev.tallies]
      if (prevChoice !== undefined && prevChoice >= 0 && prevChoice < tallies.length) tallies[prevChoice]--
      tallies[parsed.idx]++
      return { ...prev, tallies, voters: { ...prev.voters, [user]: parsed.idx } }
    })
    return true
  }, [])

  const reset = useCallback(() => {
    setState(makeInitial())
  }, [makeInitial])

  const togglePause = useCallback(() => {
    setState(prev => prev.resolved ? prev : { ...prev, paused: !prev.paused })
  }, [])

  // Timer countdown — halts when paused.
  const timerExpired = state.timeLeftMs !== null && state.timeLeftMs <= 0
  useEffect(() => {
    if (cfg.durationMs === null) return
    if (state.resolved) return
    if (state.paused) return
    if (timerExpired) {
      markResolved(pluralityWinner(stateRef.current.tallies), 'timer')
      return
    }
    const interval = setInterval(() => {
      setState(prev => {
        if (prev.resolved) return prev
        if (prev.paused) return prev
        if (prev.timeLeftMs === null) return prev
        const next = Math.max(0, prev.timeLeftMs - 100)
        return { ...prev, timeLeftMs: next }
      })
    }, 100)
    return () => clearInterval(interval)
  }, [cfg.durationMs, state.resolved, state.paused, timerExpired, markResolved])

  return { state, registerVote, forceResolve, reset, togglePause }
}
