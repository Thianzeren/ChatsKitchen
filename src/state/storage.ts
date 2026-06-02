// Thin localStorage wrapper that never throws. Storage can be unavailable
// (private mode, disabled, over quota), so reads fall back to a default and
// writes are best-effort — callers don't need their own try/catch.

export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* ignore */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },
  // Parse a JSON value, returning `fallback` if the key is missing or unparseable.
  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch { return fallback }
  },
  setJSON(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
  },
}
