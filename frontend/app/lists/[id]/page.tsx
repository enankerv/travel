'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { getList, getVillas, scoutUrl, createInvite } from '@/lib/api'
import Link from 'next/link'

export default function ListPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const listId = params.id as string

  const [list, setList] = useState<any>(null)
  const [villas, setVillas] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
      return
    }

    if (user && listId) {
      loadListData()
    }
  }, [user, loading, listId, router])

  async function loadListData() {
    try {
      const listData = await getList(listId)
      setList(listData)
      const villasData = await getVillas(listId)
      setVillas(villasData || [])
    } catch (err) {
      console.error('Failed to load list:', err)
      setError('Failed to load list')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleScoutUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setScouting(true)
    try {
      const result = await scoutUrl(url, listId)
      if (result.ok) {
        setUrl('')
        await loadListData()
      } else {
        setError(result.error || 'Failed to scout villa')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scout villa')
    } finally {
      setScouting(false)
    }
  }

  async function handleCreateInvite() {
    try {
      const invite = await createInvite(listId, 'editor')
      setInviteLink(`${window.location.origin}/join/${invite.token}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create invite')
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || !list) return null

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/lists" className="text-orange-500 hover:underline mb-4 inline-block">
          ← Back to Lists
        </Link>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{list.name}</h1>
              <p className="text-gray-400">{list.description}</p>
            </div>
            <button
              onClick={handleCreateInvite}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
            >
              Share
            </button>
          </div>

          {inviteLink && (
            <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded">
              <p className="text-sm mb-2">Share this link:</p>
              <code className="text-xs">{inviteLink}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                  setInviteLink('')
                }}
                className="ml-2 text-xs underline"
              >
                Copied!
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Scout New Villa</h2>
          <form onSubmit={handleScoutUrl} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste villa listing URL..."
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={scouting}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-6 py-2 rounded"
            >
              {scouting ? 'Scouting...' : 'Scout'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {villas.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No villas yet. Scout some listings!</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Villa Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Location</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Beds</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Price (USD)</th>
                </tr>
              </thead>
              <tbody>
                {villas.map((villa: any) => (
                  <tr key={villa.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                    <td className="px-6 py-4">{villa.villa_name || villa.title}</td>
                    <td className="px-6 py-4">{villa.location}</td>
                    <td className="px-6 py-4">{villa.bedrooms}</td>
                    <td className="px-6 py-4">${villa.price_weekly_usd || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
