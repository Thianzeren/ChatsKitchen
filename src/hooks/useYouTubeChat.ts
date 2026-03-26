import { useEffect, useRef, useState } from 'react'

export type YouTubeStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface UseYouTubeChatResult {
  status: YouTubeStatus
  error: string | undefined
}

interface YTMessageItem {
  snippet?: { displayMessage?: string }
  authorDetails?: { displayName?: string }
}

interface YTMessagesResponse {
  pollingIntervalMillis?: number
  nextPageToken?: string
  items?: YTMessageItem[]
}

interface YTVideoResponse {
  items?: Array<{
    liveStreamingDetails?: { activeLiveChatId?: string }
  }>
}

export function extractVideoId(input: string): string {
  try {
    const url = new URL(input)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0]
    const v = url.searchParams.get('v')
    if (v) return v
  } catch {
    // Not a URL — treat as raw video ID
  }
  return input.trim()
}

export function useYouTubeChat(
  videoInput: string | null,
  onMessage: (user: string, text: string) => void
): UseYouTubeChatResult {
  const [status, setStatus] = useState<YouTubeStatus>('disconnected')
  const [error, setError] = useState<string>()
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!videoInput) {
      setStatus('disconnected')
      setError(undefined)
      return
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
    if (!apiKey) {
      setStatus('error')
      setError('YouTube API key not configured (VITE_YOUTUBE_API_KEY missing)')
      return
    }

    const videoId = extractVideoId(videoInput)
    const abort = new AbortController()
    let timeoutId = 0

    setStatus('connecting')
    setError(undefined)

    async function fetchLiveChatId(): Promise<string> {
      const params = new URLSearchParams({ part: 'liveStreamingDetails', id: videoId, key: apiKey })
      const resp = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${params}`,
        { signal: abort.signal }
      )
      if (!resp.ok) throw new Error(`YouTube API error ${resp.status}`)
      const data = (await resp.json()) as YTVideoResponse
      const chatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId
      if (!chatId) throw new Error('No active live chat found — is the stream live?')
      return chatId
    }

    async function pollMessages(liveChatId: string, pageToken: string | undefined, isFirst: boolean): Promise<void> {
      const params = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails', key: apiKey })
      if (pageToken) params.set('pageToken', pageToken)

      const resp = await fetch(
        `https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`,
        { signal: abort.signal }
      )
      if (!resp.ok) throw new Error(`YouTube API error ${resp.status}`)
      const data = (await resp.json()) as YTMessagesResponse
      const interval = Math.max(3000, data.pollingIntervalMillis ?? 5000)
      const nextToken = data.nextPageToken

      // Skip the initial batch — those are messages from before we connected
      if (!isFirst) {
        for (const item of data.items ?? []) {
          const text = item.snippet?.displayMessage ?? ''
          const user = item.authorDetails?.displayName ?? 'anonymous'
          if (text) onMessageRef.current(user, text)
        }
      }

      timeoutId = window.setTimeout(() => {
        pollMessages(liveChatId, nextToken, false).catch(handleError)
      }, interval)
    }

    function handleError(err: unknown): void {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }

    fetchLiveChatId()
      .then(liveChatId => {
        setStatus('connected')
        pollMessages(liveChatId, undefined, true).catch(handleError)
      })
      .catch(handleError)

    return () => {
      abort.abort()
      clearTimeout(timeoutId)
    }
  }, [videoInput])

  return { status, error }
}
