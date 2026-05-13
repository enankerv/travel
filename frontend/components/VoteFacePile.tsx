'use client'

export type Voter = { user_id: string; first_name?: string; avatar_url?: string }

export function voterLabel(v: Voter) {
  return (v.first_name && v.first_name.trim()) || v.user_id.slice(0, 8)
}

function VoteFaceAvatar({ voter }: { voter: Voter }) {
  const label = voterLabel(voter)
  return (
    <span className="vote-cell__face">
      {voter.avatar_url ? (
        <img
          src={voter.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="vote-cell__face-img"
        />
      ) : (
        <span className="vote-cell__face-fallback" aria-hidden>
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

function VoteFace({ voter }: { voter: Voter }) {
  const label = voterLabel(voter)
  return (
    <span className="vote-cell__face-wrap" aria-label={label}>
      <VoteFaceAvatar voter={voter} />
    </span>
  )
}

export default function VoteFacePile({ voters }: { voters: Voter[] }) {
  if (voters.length === 0) return null
  const names = voters.map(voterLabel).join(', ')
  return (
    <div className="vote-cell__face-pile" aria-label={`Voted by ${names}`}>
      <div className="vote-cell__face-pile-inner">
        {voters.map((v) => (
          <VoteFace key={v.user_id} voter={v} />
        ))}
      </div>
    </div>
  )
}
