import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface PlayerPayload {
  username: string
  cooked: number
  served: number
  money_earned: number
  extinguished: number
  fires_caused: number
}

interface SessionPayload {
  channel_name: string
  money_earned: number
  served: number
  lost: number
  players: PlayerPayload[]
}

function isNonNegativeInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0
}

function validatePayload(
  body: unknown,
): { ok: true; data: SessionPayload } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object' }
  }

  const b = body as Record<string, unknown>

  // channel_name: required, non-empty string, max 25 chars
  if (typeof b.channel_name !== 'string' || b.channel_name.trim() === '') {
    return { ok: false, error: 'channel_name must be a non-empty string' }
  }
  if (b.channel_name.trim().length > 25) {
    return { ok: false, error: 'channel_name must be at most 25 characters' }
  }

  // money_earned: 0..99_999
  if (!isNonNegativeInteger(b.money_earned) || (b.money_earned as number) > 99_999) {
    return { ok: false, error: 'money_earned must be an integer between 0 and 99999' }
  }

  // served: 0..200
  if (!isNonNegativeInteger(b.served) || (b.served as number) > 200) {
    return { ok: false, error: 'served must be an integer between 0 and 200' }
  }

  // lost: 0..200
  if (!isNonNegativeInteger(b.lost) || (b.lost as number) > 200) {
    return { ok: false, error: 'lost must be an integer between 0 and 200' }
  }

  // players: array, length <= 500
  if (!Array.isArray(b.players)) {
    return { ok: false, error: 'players must be an array' }
  }
  if ((b.players as unknown[]).length > 500) {
    return { ok: false, error: 'players array must have at most 500 entries' }
  }

  for (let i = 0; i < (b.players as unknown[]).length; i++) {
    const p = (b.players as unknown[])[i]
    if (typeof p !== 'object' || p === null) {
      return { ok: false, error: `players[${i}] must be an object` }
    }
    const player = p as Record<string, unknown>

    if (typeof player.username !== 'string' || player.username.trim() === '') {
      return { ok: false, error: `players[${i}].username must be a non-empty string` }
    }
    if (player.username.trim().length > 25) {
      return { ok: false, error: `players[${i}].username must be at most 25 characters` }
    }
    for (const field of ['cooked', 'served', 'money_earned', 'extinguished', 'fires_caused'] as const) {
      if (!isNonNegativeInteger(player[field])) {
        return { ok: false, error: `players[${i}].${field} must be a non-negative integer` }
      }
    }
  }

  return {
    ok: true,
    data: {
      channel_name: b.channel_name.trim().toLowerCase(),
      money_earned: b.money_earned as number,
      served: b.served as number,
      lost: b.lost as number,
      players: (b.players as Record<string, unknown>[]).map((p) => ({
        username: (p.username as string).trim().toLowerCase(),
        cooked: p.cooked as number,
        served: p.served as number,
        money_earned: p.money_earned as number,
        extinguished: p.extinguished as number,
        fires_caused: p.fires_caused as number,
      })),
    },
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RATE_LIMIT_WINDOW_MS = 3 * 60 * 1000 // 3 minutes in ms

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Parse body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // Validate payload
  const validation = validatePayload(rawBody)
  if (!validation.ok) {
    return json({ error: validation.error }, 400)
  }

  const { channel_name, money_earned, served, lost, players } = validation.data

  // -------------------------------------------------------------------------
  // Atomic rate-limit claim — single DB round-trip, no race window.
  // try_claim_rate_limit() does INSERT ... ON CONFLICT DO UPDATE ... WHERE
  // so the check and the timestamp write happen in one statement.
  // Returns true if the slot was claimed, false if the window hasn't expired.
  // -------------------------------------------------------------------------
  const { data: claimed, error: claimErr } = await supabase
    .rpc('try_claim_rate_limit', {
      p_channel: channel_name,
      p_window_ms: RATE_LIMIT_WINDOW_MS,
    })

  if (claimErr) {
    console.error('try_claim_rate_limit error:', claimErr)
    return json({ error: 'Internal error' }, 500)
  }

  if (!claimed) {
    return json({ error: 'Rate limit: 1 submission per channel per 3 minutes' }, 429)
  }

  // -------------------------------------------------------------------------
  // Get active season (include `number` so rollover can compute next number)
  // -------------------------------------------------------------------------
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, number, money_goal, total_money_earned')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (seasonErr) {
    console.error('seasons select error:', seasonErr)
    return json({ error: 'Internal error' }, 500)
  }

  if (!season) {
    console.error('No active season found — database may be in an inconsistent state')
    return json({ error: 'Service temporarily unavailable' }, 503)
  }

  // -------------------------------------------------------------------------
  // Insert session
  // -------------------------------------------------------------------------
  const { data: sessionRow, error: sessionInsertErr } = await supabase
    .from('sessions')
    .insert({
      channel_name,
      money_earned,
      served,
      lost,
      season_id: season.id,
    })
    .select('id')
    .single()

  if (sessionInsertErr) {
    console.error('sessions insert error:', sessionInsertErr)
    return json({ error: 'Internal error' }, 500)
  }

  // -------------------------------------------------------------------------
  // Deduplicate players by username, summing stats for duplicates
  // -------------------------------------------------------------------------
  const playerMap = new Map<string, typeof players[0]>()
  for (const p of players) {
    const existing = playerMap.get(p.username)
    if (existing) {
      playerMap.set(p.username, {
        username: p.username,
        cooked: existing.cooked + p.cooked,
        served: existing.served + p.served,
        money_earned: existing.money_earned + p.money_earned,
        extinguished: existing.extinguished + p.extinguished,
        fires_caused: existing.fires_caused + p.fires_caused,
      })
    } else {
      playerMap.set(p.username, p)
    }
  }
  const uniquePlayers = Array.from(playerMap.values())

  // -------------------------------------------------------------------------
  // Bulk insert player contributions (skip if empty)
  // -------------------------------------------------------------------------
  if (uniquePlayers.length > 0) {
    const contributions = uniquePlayers.map((p) => ({
      session_id: sessionRow.id,
      season_id: season.id,
      channel_name,
      twitch_username: p.username,
      cooked: p.cooked,
      served: p.served,
      money_earned: p.money_earned,
      extinguished: p.extinguished,
      fires_caused: p.fires_caused,
    }))

    const { error: contribErr } = await supabase
      .from('player_contributions')
      .insert(contributions)

    if (contribErr) {
      console.error('player_contributions insert error:', contribErr)
      return json({ error: 'Internal error' }, 500)
    }
  }

  // -------------------------------------------------------------------------
  // Update season total_money_earned atomically (SQL-side addition)
  // Using a raw SQL UPDATE via PostgREST's rpc approach keeps it race-safe.
  // The function `increment_season_money(p_season_id, p_amount)` must exist;
  // see the migration that created it. It returns the new total_money_earned.
  // -------------------------------------------------------------------------
  const { data: newTotal, error: incrementErr } = await supabase
    .rpc('increment_season_money', {
      p_season_id: season.id,
      p_amount: money_earned,
    })

  if (incrementErr || newTotal === null || newTotal === undefined) {
    console.error('increment_season_money error:', incrementErr)
    return json({ error: 'Internal error' }, 500)
  }

  const updatedTotal: number = newTotal as number

  // -------------------------------------------------------------------------
  // Season rollover: if goal reached, end current season and start next.
  // Both operations are idempotent: only the request that actually transitions
  // the season from active→ended will create the new season.
  // -------------------------------------------------------------------------
  let seasonEnded = false

  if (updatedTotal >= season.money_goal) {
    // Only end the season if it's still active (idempotent guard)
    const { data: endedSeason, error: endError } = await supabase
      .from('seasons')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', season.id)
      .eq('status', 'active')  // Only update if still active — prevents double-fire
      .select('id')
      .maybeSingle()

    if (endError) { console.error('Failed to end season:', endError) /* continue, don't 500 */ }

    // Only insert new season if we were the one to end it
    if (endedSeason) {
      const { error: newSeasonError } = await supabase
        .from('seasons')
        .insert({
          number: season.number + 1,
          status: 'active',
          money_goal: season.money_goal,
          total_money_earned: 0,
          started_at: new Date().toISOString(),
        })
      if (newSeasonError) { console.error('Failed to create new season:', newSeasonError) }
      seasonEnded = true
    }
  }

  return json({ ok: true, season_ended: seasonEnded })
})
