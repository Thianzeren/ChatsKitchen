import { PlayerStats } from '../state/types'
import { BOT_NAMES } from '../data/recipes'

// Set VITE_SUBMIT_SESSION_URL in .env.local to your Supabase Edge Function URL
// e.g. VITE_SUBMIT_SESSION_URL=https://<project-ref>.supabase.co/functions/v1/submit-session
const SUBMIT_SESSION_URL: string = import.meta.env.VITE_SUBMIT_SESSION_URL ?? ''

const BOT_NAMES_LOWER = new Set(BOT_NAMES.map(n => n.toLowerCase()))

export async function submitGameStats(
  channelName: string,
  finalStats: { money: number; served: number; lost: number },
  playerStats: Record<string, PlayerStats>,
  onRateLimit?: () => void
): Promise<void> {
  if (!SUBMIT_SESSION_URL) {
    console.debug('[submitGameStats] VITE_SUBMIT_SESSION_URL is not set — skipping submission.')
    return
  }

  const players = Object.entries(playerStats)
    .filter(([username]) => !BOT_NAMES_LOWER.has(username.toLowerCase()))
    .map(([username, stats]) => ({
      username,
      cooked: stats.cooked,
      served: stats.served,
      money_earned: stats.moneyEarned,
      extinguished: stats.extinguished,
      fires_caused: stats.firesCaused,
    }))

  const payload = {
    channel_name: channelName,
    money_earned: finalStats.money,
    served: finalStats.served,
    lost: finalStats.lost,
    players,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(SUBMIT_SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.status === 429) {
      onRateLimit?.()
    } else if (!response.ok) {
      console.error('[submitGameStats] Non-200 response:', response.status, response.statusText)
    }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[submitGameStats]', err)
  }
}
