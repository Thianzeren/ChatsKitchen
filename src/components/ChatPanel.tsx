import { useRef, useEffect, useState } from 'react'
import { ChatMessage } from '../state/types'
import { NAME_COLORS } from '../data/recipes'
import styles from './ChatPanel.module.css'

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
}

export default function ChatPanel({ messages, onSend, onClose }: Props) {
  const [input, setInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, historyOpen])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <aside className={`${styles.panel} ${historyOpen ? styles.panelExpanded : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} /> CHAT
        </div>
        <button className={styles.closeBtn} onClick={onClose}>{'\u{2715}'}</button>
      </div>
      <div className={styles.messages}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${styles[msg.type] || ''}`}>
            {msg.type === 'system' ? (
              <span className={styles.text}>{msg.text}</span>
            ) : (
              <>
                <span
                  className={styles.username}
                  style={{ color: NAME_COLORS[Math.abs(hashStr(msg.username)) % NAME_COLORS.length] }}
                >
                  {msg.username}:
                </span>
                <span className={styles.text}>{msg.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className={styles.inputArea}>
        <button
          className={styles.historyToggle}
          onClick={() => setHistoryOpen(o => !o)}
          aria-label={historyOpen ? 'Collapse chat history' : 'Expand chat history'}
        >
          {historyOpen ? '▼' : '▲'}
        </button>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type !command here..."
        />
        <button className={styles.sendBtn} onClick={handleSend}>Send</button>
      </div>
    </aside>
  )
}
