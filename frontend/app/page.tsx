'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { getLists, createList } from '@/lib/api'
import ListsView, { type ListItem } from '@/components/ListsView'
import ListDetailView from '@/components/ListDetailView'
import TermsConsentModal from '@/components/TermsConsentModal'
import CreateListModal from '@/components/CreateListModal'
import AuthDeniedView from '@/components/AuthDeniedView'
import LoadingView from '@/components/LoadingView'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

function HomeContent() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const listParam = searchParams.get('list')
  const [lists, setLists] = useState<ListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [allowlistDenied, setAllowlistDenied] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsIsReAccept, setTermsIsReAccept] = useState(false)
  const [termsRequiresAge, setTermsRequiresAge] = useState(false)
  const [underAgeDenied, setUnderAgeDenied] = useState(false)

  const loadLists = useCallback(
    async (applyListFromUrl = true) => {
      try {
        const data = await getLists()
        setLists(data || [])
        if (applyListFromUrl && listParam && data?.some((l: ListItem) => l.id === listParam)) {
          setSelectedListId(listParam)
        } else if (listParam) {
          router.replace('/', { scroll: false })
        }
      } catch (err) {
        console.error('Failed to load lists:', err)
        setError('Failed to load lists')
      } finally {
        setIsLoading(false)
      }
    },
    [listParam, router]
  )

  const onTermsNeeded = useCallback(
    ({ isReAccept, requiresAge }: { isReAccept: boolean; requiresAge: boolean }) => {
      setTermsIsReAccept(isReAccept)
      setTermsRequiresAge(requiresAge)
      setShowTermsModal(true)
    },
    []
  )

  useAuthBootstrap({
    user,
    authLoading,
    signOut,
    allowlistDenied,
    underAgeDenied,
    onReady: loadLists,
    onTermsNeeded,
    onAllowlistDenied: () => setAllowlistDenied(true),
    onUnderAgeDenied: () => setUnderAgeDenied(true),
    onError: setError,
    onLoadingChange: setIsLoading,
  })

  useEffect(() => {
    if (!authLoading && !user && !allowlistDenied && !underAgeDenied) {
      router.push('/auth/login')
    }
  }, [authLoading, user, allowlistDenied, underAgeDenied, router])

  function handleSelectList(id: string | null) {
    setSelectedListId(id)
    if (id) {
      router.replace('/?list=' + encodeURIComponent(id), { scroll: false })
    } else {
      router.replace('/', { scroll: false })
    }
  }

  async function handleCreateList(name: string, description: string) {
    const list = await createList(name, description)
    setLists((prev) => [...prev, list])
  }

  if (authLoading || isLoading) {
    return (
      <LoadingView message={authLoading ? 'Checking session…' : 'Loading your lists…'} />
    )
  }

  if (allowlistDenied) {
    return (
      <AuthDeniedView
        title="You're not on the invite list yet"
        message="This app is currently invite-only. Ask the owner to add your email."
        onAction={() => router.push('/auth/login')}
      />
    )
  }

  if (underAgeDenied) {
    return (
      <AuthDeniedView
        title="You must be 16+ to use GetawayGather"
        message="GetawayGather requires users to be at least 16 years old."
        onAction={() => {
          signOut()
          setUnderAgeDenied(false)
          router.push('/auth/login')
        }}
      />
    )
  }

  if (!user) return null

  if (showTermsModal) {
    return (
      <TermsConsentModal
        isReAccept={termsIsReAccept}
        requiresAge={termsRequiresAge}
        onAccepted={() => {
          setShowTermsModal(false)
          setIsLoading(true)
          loadLists()
        }}
        onUnderAge={() => {
          setShowTermsModal(false)
          setUnderAgeDenied(true)
          signOut()
        }}
      />
    )
  }

  const selectedList = lists.find(l => l.id === selectedListId)

  return (
    <div className="app" style={{ overflow: 'hidden', height: '100vh' }}>
      {/* Fade between views */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: selectedListId ? 0 : 1,
          pointerEvents: selectedListId ? 'none' : 'auto',
          transition: 'opacity 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Lists View */}
        <ListsView
          lists={lists}
          onSelectList={handleSelectList}
          onCreateList={() => setCreateModalOpen(true)}
          onSignOut={signOut}
          user={user}
          error={error}
          isLoading={isLoading}
        />
      </div>

      {/* Detail View */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: selectedListId ? 1 : 0,
          pointerEvents: selectedListId ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {selectedList && (
          <ListDetailView
            list={selectedList}
            onBack={() => {
              handleSelectList(null)
              loadLists(false)
            }}
            onUpdate={() => loadLists()}
          />
        )}
      </div>

      <CreateListModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateList}
      />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingView />}>
      <HomeContent />
    </Suspense>
  )
}
