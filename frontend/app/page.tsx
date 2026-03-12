'use client'

import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { getLists, createList, checkAccess, getMyProfile } from '@/lib/api'
import { TERMS_UPDATED_AT } from '@/lib/constants'
import ListsView, { type ListItem } from '@/components/ListsView'
import ListDetailView from '@/components/ListDetailView'
import TermsConsentModal from '@/components/TermsConsentModal'

function HomeContent() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const listParam = searchParams.get('list')
  const [lists, setLists] = useState<ListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState('')
  const [allowlistDenied, setAllowlistDenied] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsIsReAccept, setTermsIsReAccept] = useState(false)
  const [termsRequiresAge, setTermsRequiresAge] = useState(false)
  const [underAgeDenied, setUnderAgeDenied] = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !allowlistDenied && !underAgeDenied) {
      router.push('/auth/login')
      return
    }

    if (user && !allowlistDenied) {
      checkAccess()
        .then(() => getMyProfile())
        .then(async (profile) => {
          const acceptedAt = profile?.terms_accepted_at ? new Date(profile.terms_accepted_at).getTime() : 0
          const termsUpdatedAt = new Date(TERMS_UPDATED_AT).getTime()
          const needsAcceptance = !profile?.terms_accepted_at || acceptedAt < termsUpdatedAt
          const needsAge = !profile?.age_verified_at

          if (!needsAcceptance) {
            loadLists()
            return
          }
          // Consent + age in localStorage from login/signup? Use if recent.
          const consentAt = typeof window !== 'undefined' ? localStorage.getItem('terms_consent_at') : null
          const consentAge = typeof window !== 'undefined' ? localStorage.getItem('terms_consent_age') : null
          if (consentAt) {
            const consentTime = new Date(consentAt).getTime()
            const age = Date.now() - consentTime
            if (age < 10 * 60 * 1000 && consentTime >= termsUpdatedAt) {
              const ageNum = consentAge ? parseInt(consentAge, 10) : undefined
              if (needsAge && ageNum !== undefined && !isNaN(ageNum) && ageNum >= 16) {
                const { acceptTerms } = await import('@/lib/api')
                await acceptTerms(ageNum)
                localStorage.removeItem('terms_consent_at')
                localStorage.removeItem('terms_consent_age')
                loadLists()
                return
              }
              if (!needsAge) {
                const { acceptTerms } = await import('@/lib/api')
                await acceptTerms()
                localStorage.removeItem('terms_consent_at')
                localStorage.removeItem('terms_consent_age')
                loadLists()
                return
              }
            }
          }
          setTermsIsReAccept(!!profile?.terms_accepted_at)
          setTermsRequiresAge(needsAge)
          setShowTermsModal(true)
        })
        .finally(() => setIsLoading(false))
        .catch((err: Error & { code?: string }) => {
          if (err.code === 'NOT_ON_ALLOWLIST') {
            setAllowlistDenied(true)
            signOut()
          } else {
            setError('Failed to load')
          }
          setIsLoading(false)
        })
    }
  }, [user, authLoading, router, allowlistDenied, underAgeDenied])

  async function loadLists(applyListFromUrl = true) {
    try {
      const data = await getLists()
      setLists(data || [])
      if (applyListFromUrl && listParam && data?.some((l: ListItem) => l.id === listParam)) {
        setSelectedListId(listParam)
        // Keep URL as ?list=id so refresh reopens this list
      } else if (listParam) {
        // Invalid or deleted list id in URL – clear it
        router.replace('/', { scroll: false })
      }
    } catch (err) {
      console.error('Failed to load lists:', err)
      setError('Failed to load lists')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectList(id: string | null) {
    setSelectedListId(id)
    if (id) {
      router.replace('/?list=' + encodeURIComponent(id), { scroll: false })
    } else {
      router.replace('/', { scroll: false })
    }
  }

  async function handleCreateList() {
    if (!newListName.trim()) return

    setCreateLoading(true)
    try {
      const list = await createList(newListName, newListDescription)
      setLists([...lists, list])
      setNewListName('')
      setNewListDescription('')
      setCreateModalOpen(false)
    } catch (err: any) {
      setError(err.message || 'Failed to create list')
    } finally {
      setCreateLoading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="app">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (allowlistDenied) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
        <h2 style={{ margin: 0, color: 'var(--light)' }}>You&apos;re not on the invite list yet</h2>
        <p style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>
          This app is currently invite-only. Ask the owner to add your email.
        </p>
        <button
          onClick={() => router.push('/auth/login')}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Login
        </button>
      </div>
    )
  }

  if (!user) return null

  if (underAgeDenied) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
        <h2 style={{ margin: 0, color: 'var(--light)' }}>You must be 16+ to use GetawayGather</h2>
        <p style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>
          GetawayGather requires users to be at least 16 years old.
        </p>
        <button
          onClick={() => {
            signOut()
            setUnderAgeDenied(false)
            router.push('/auth/login')
          }}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Login
        </button>
      </div>
    )
  }

  if (showTermsModal) {
    return (
      <TermsConsentModal
        isReAccept={termsIsReAccept}
        requiresAge={termsRequiresAge}
        onAccepted={() => {
          setShowTermsModal(false)
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

      {/* Create List Modal */}
      <div className={`modal-overlay ${createModalOpen ? 'open' : ''}`}>
        <div className="modal" style={{ width: '400px' }}>
          <h2>Create New List</h2>
          <p>Create a collaborative list for tracking getaways</p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--light)' }}>
              List Name
            </label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g., Italy Trip 2024"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '0.6rem',
                color: 'var(--light)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--light)' }}>
              Description (optional)
            </label>
            <textarea
              value={newListDescription}
              onChange={(e) => setNewListDescription(e.target.value)}
              placeholder="Add notes about this list..."
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                padding: '0.6rem',
                color: 'var(--light)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => {
                setCreateModalOpen(false)
                setNewListName('')
                setNewListDescription('')
              }}
              disabled={createLoading}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateList}
              disabled={createLoading || !newListName.trim()}
            >
              {createLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="app">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
