import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
interface Props { snapshot: SharedSnapshot; you: PartialPlayerView; send: (cmd: string) => void; connected: boolean }
export default function Controller({ snapshot }: Props) {
  return <div style={{ padding: 20 }}>Controller stub — Task 8 will replace this<br />Phase: {snapshot.phase}, Money: ${snapshot.money}</div>
}
