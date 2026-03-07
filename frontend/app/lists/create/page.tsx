'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { createList } from '@/lib/api'
import Link from 'next/link'

export default function CreateListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('List name is required')
      return
    }

    setLoading(true)
    try {
      const list = await createList(name, description)
      router.push(`/lists/${list.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create list')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/lists" className="text-orange-500 hover:underline mb-4 inline-block">
          ← Back to Lists
        </Link>

        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-6">Create New List</h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">List Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Italy Trip 2024"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-orange-500"
                rows={4}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
            >
              {loading ? 'Creating...' : 'Create List'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
