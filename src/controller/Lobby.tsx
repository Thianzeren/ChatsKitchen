import type { SharedSnapshot } from '../shared/protocol'
interface Props { nickname: string; stage: string; snapshot: SharedSnapshot | null; send: (cmd: string) => void; connected: boolean }
export default function Lobby({ nickname, stage }: Props) {
  return <div style={{ padding: 20 }}>Lobby stub ({stage}) — Task 9 will replace this<br />Playing as {nickname}</div>
}
