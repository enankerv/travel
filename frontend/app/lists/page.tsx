'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { getLists } from '@/lib/api'
import Link from 'next/link'

export default function ListsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [lists, setLists] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      loadLists()
    }
  }, [user, loading, router])

  async function loadLists() {
    try {
      const data = await getLists()
      setLists(data || [])
    } catch (error) {
      console.error('Failed to load lists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Your Lists</h1>
          <Link
            href="/lists/create"
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded"
          >
            + New List
          </Link>
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No lists yet</p>
            <Link href="/lists/create" className="text-orange-500 hover:underline">
              Create your first list
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list: any) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <div className="bg-slate-800 p-6 rounded-lg hover:bg-slate-700 transition cursor-pointer border border-slate-700">
                  <h2 className="text-xl font-semibold text-white mb-2">{list.name}</h2>
                  <p className="text-gray-400 text-sm mb-4">{list.description || 'No description'}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{list.list_members?.length || 0} members</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
