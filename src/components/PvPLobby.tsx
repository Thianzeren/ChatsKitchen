import { useState } from 'react'
import styles from './PvPLobby.module.css'

interface Props {
  red: string[]
  blue: string[]
  unassigned: string[]
  onMovePlayer: (username: string, team: 'red' | 'blue') => void
  onKick: (username: string) => void
  onBalance: () => void
  onClear: () => void
  onBack: () => void
  onNext: () => void
}

export default function PvPLobby({ red, blue, unassigned, onMovePlayer, onKick, onBalance, onClear, onBack, onNext }: Props) {
  const [dragUser, setDragUser] = useState<string | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<'red' | 'blue' | null>(null)

  const handleDragStart = (username: string) => {
    setDragUser(username)
  }

  const handleDragEnd = () => {
    setDragUser(null)
    setDragOverTeam(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (team: 'red' | 'blue') => {
    setDragOverTeam(team)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTeam(null)
    }
  }

  const handleDrop = (e: React.DragEvent, team: 'red' | 'blue') => {
    e.preventDefault()
    if (dragUser) onMovePlayer(dragUser, team)
    setDragUser(null)
    setDragOverTeam(null)
  }

  const renderTeam = (team: 'red' | 'blue', members: string[]) => {
    const isDragOver = dragOverTeam === team
    const cardBase = styles.teamCard
    const cardColor = team === 'red' ? styles.teamCardRed : styles.teamCardBlue
    const cardDragOver = team === 'red' ? styles.teamCardRedDragOver : styles.teamCardBlueDragOver
    const headerColor = team === 'red' ? styles.teamHeaderRed : styles.teamHeaderBlue
    const memberColor = team === 'red' ? styles.memberRed : styles.memberBlue
    const label = team === 'red' ? '🔴 Red Team' : '🔵 Blue Team'

    return (
      <div
        className={`${cardBase} ${cardColor} ${isDragOver ? cardDragOver : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={() => handleDragEnter(team)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, team)}
      >
        <div className={`${styles.teamHeader} ${headerColor}`}>{label}</div>
        <div className={styles.memberList}>
          {members.length === 0
            ? <div className={styles.empty}>No players yet</div>
            : members.map(p => (
              <div
                key={p}
                draggable
                className={`${styles.member} ${memberColor} ${dragUser === p ? styles.memberDragging : ''}`}
                onDragStart={() => handleDragStart(p)}
                onDragEnd={handleDragEnd}
              >
                <span>{p}</span>
                <button
                  className={styles.kickBtn}
                  onClick={e => { e.stopPropagation(); onKick(p) }}
                  title={`Kick ${p}`}
                >✕</button>
              </div>
            ))
          }
        </div>
        <div className={styles.count}>{members.length} player{members.length !== 1 ? 's' : ''}</div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>

      {/* ── LEFT PANEL ── */}
      <div className={styles.leftCol}>

        <div className={styles.topRow}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
        </div>

        <div className={styles.leftColScroll}>
          <div className={styles.title}>⚔️ PvP Lobby</div>
          <div className={styles.hint}>
            Phones can pick a team, or drag players below onto a team
          </div>

          <div className={styles.divider} />

          <div className={styles.actionRow}>
            <button className={styles.actionBtn} onClick={onBalance}>⚖️ Balance Teams</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnClear}`} onClick={onClear}>✕ Clear Teams</button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Chat Commands</div>
            <div className={styles.modHints}>
              <div className={styles.modHintRow}>
                <span className={styles.modCmd}>!red</span>
                <span className={styles.modCmd}>!blue</span>
                <span className={styles.modCmd}>!join</span>
                <span>join a team</span>
              </div>
              <div className={styles.modHintRow}>
                <span className={styles.modCmd}>!leave</span>
                <span>unjoin your team</span>
              </div>
              <div className={styles.modHintRow}>
                <span className={styles.modCmd}>!move red @name</span>
                <span>mod: move player</span>
              </div>
              <div className={styles.modHintRow}>
                <span className={styles.modCmd}>!kick @name</span>
                <span>mod: remove player</span>
              </div>
            </div>
          </div>
        </div>

        <button className={styles.startBtn} onClick={onNext}>
          Configure &amp; Start →
        </button>

      </div>

      {/* ── RIGHT PANEL ── */}
      <div className={styles.rightCol}>
        {unassigned.length > 0 && (
          <div className={styles.pool}>
            <div className={styles.poolLabel}>Unassigned ({unassigned.length}) — drag onto a team</div>
            <div className={styles.poolList}>
              {unassigned.map(p => (
                <div
                  key={p}
                  draggable
                  className={`${styles.poolMember} ${dragUser === p ? styles.memberDragging : ''}`}
                  onDragStart={() => handleDragStart(p)}
                  onDragEnd={handleDragEnd}
                >{p}</div>
              ))}
            </div>
          </div>
        )}
        <div className={styles.rosters}>
          {renderTeam('red', red)}
          <div className={styles.vs}>VS</div>
          {renderTeam('blue', blue)}
        </div>
      </div>

    </div>
  )
}
