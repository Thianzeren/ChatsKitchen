import { useState } from 'react'
import { GameState } from '../state/types'
import { getEnabledStations } from '../data/recipes'
import Station from './Station'
import PreparedItems from './PreparedItems'
import CommandsStrip from './CommandsStrip'
import { storage } from '../state/storage'
import styles from './Kitchen.module.css'

interface Props {
  state: GameState
  tutorialHighlight?: string | null
}

export default function Kitchen({ state, tutorialHighlight }: Props) {
  const stationIds = getEnabledStations(state.enabledRecipes)
  const [showCommands, setShowCommands] = useState(() =>
    storage.get('chatsKitchen_kitchenShowCommands') !== 'false'
  )

  const toggleCommands = () => setShowCommands(v => {
    const next = !v
    storage.set('chatsKitchen_kitchenShowCommands', String(next))
    return next
  })

  const pvpLargerTeamSize = (() => {
    if (!state.teams) return undefined
    let r = 0, b = 0
    for (const t of Object.values(state.teams)) { if (t === 'red') r++; else b++ }
    return Math.max(r, b)
  })()

  return (
    <div className={`${styles.kitchen} ${tutorialHighlight === 'kitchen' ? styles.highlighted : ''}`}>
      <PreparedItems
        items={state.preparedItems}
        enabledRecipes={state.enabledRecipes}
        isHighlighted={tutorialHighlight === 'prepared'}
        pvpMode={!!state.teams}
        redItems={state.redPreparedItems}
        blueItems={state.bluePreparedItems}
        redMoney={state.redMoney}
        blueMoney={state.blueMoney}
      />
      <div className={styles.stationsSection}>
        <div className={styles.stationsGrid}>
          {stationIds.map(id => (
            <Station
              key={id}
              station={state.stations[id]}
              playerCount={Object.keys(state.playerStats).length}
              isHighlighted={tutorialHighlight === id}
              pvpLargerTeamSize={pvpLargerTeamSize}
              isDisabled={state.disabledStations?.includes(id) ?? false}
            />
          ))}
        </div>
      </div>
      <div className={styles.commandsRow}>
        <div className={styles.commandsHeader}>
          <button
            className={styles.commandsToggle}
            onClick={toggleCommands}
          >
            {showCommands ? '▼ Hide Commands' : '▲ Show Commands'}
          </button>
        </div>
        {showCommands && <CommandsStrip stationIds={stationIds} enabledRecipes={state.enabledRecipes} />}
      </div>
    </div>
  )
}
