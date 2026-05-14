interface JoinedRoom { code: string; playerId: string; nickname: string }
export default function JoinScreen({ onJoined }: { onJoined: (r: JoinedRoom) => void }) {
  return <div style={{ padding: 20 }}>JoinScreen stub — Task 6 will replace this<br /><button onClick={() => onJoined({ code: 'TEST', playerId: 'p1', nickname: 'player' })}>Test join</button></div>
}
