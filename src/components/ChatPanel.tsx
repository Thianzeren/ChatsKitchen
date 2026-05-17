import { useRef, useEffect, useState } from 'react'
import { ChatMessage } from '../state/types'
import { NAME_COLORS, hashStr } from '../data/recipes'
import styles from './ChatPanel.module.css'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  teams?: Record<string, 'red' | 'blue'>
  className?: string
}

export default function ChatPanel({ messages, onSend, onClose, teams, className }: Props) {
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
    <aside className={`${styles.panel} ${historyOpen ? styles.panelExpanded : ''} ${className ?? ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} /> CHAT
        </div>
        <button className={styles.closeBtn} onClick={onClose}>{'\u{2715}'}</button>
      </div>
      <div className={styles.messages}>
        {messages.map(msg => {
          const usernameColor = teams?.[msg.username] === 'red' ? '#e74c3c'
            : teams?.[msg.username] === 'blue' ? '#3498db'
            : NAME_COLORS[Math.abs(hashStr(msg.username)) % NAME_COLORS.length]
          return (
            <div key={msg.id} className={`${styles.msg} ${styles[msg.type] || ''}`}>
              {msg.type === 'system' ? (
                <span className={styles.text}>{msg.text}</span>
              ) : (
                <>
                  <span
                    className={styles.username}
                    style={{ color: usernameColor }}
                  >
                    {msg.username}:
                  </span>
                  <span className={styles.text}>{msg.text}</span>
                </>
              )}
            </div>
          )
        })}
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
