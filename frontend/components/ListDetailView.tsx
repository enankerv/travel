'use client'

import { useState, useEffect } from 'react'
import { getVillas, scoutUrl, scoutPaste, deleteVilla, updateVilla, createInvite, getListMembers } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import DropZone from './DropZone'
import VillaTable from './VillaTable'
import PasteModal from './PasteModal'
import ImageGallery from './ImageGallery'

export default function ListDetailView({ list, onBack }: any) {
  const [activeTab, setActiveTab] = useState<'places' | 'members'>('places')
  const [villas, setVillas] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)

  // Lazy load data only when component mounts (view is active)
  useEffect(() => {
    if (!dataLoaded) {
      loadData()
    }
  }, [])

  // Subscribe to realtime villa updates
  useEffect(() => {
    if (!dataLoaded) return

    const subscription = supabase
      .channel(`villas:list_id=eq.${list.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'villas',
          filter: `list_id=eq.${list.id}`,
        },
        (payload) => {
          console.log('Villa update received:', payload)
          // Reload villas when any change occurs
          loadData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [list.id, dataLoaded])

  async function loadData() {
    setIsLoading(true)
    try {
      const [villasData, membersData] = await Promise.all([
        getVillas(list.id),
        getListMembers(list.id),
      ])
      setVillas(villasData || [])
      setMembers(membersData?.members || [])
      setDataLoaded(true)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleScoutUrl(url: string) {
    setError('')
    try {
      const result = await scoutUrl(url, list.id)
      if (result.ok) {
        if (Notification.permission === 'granted') {
          new Notification('Scouting...', {
            body: 'Processing listing...',
            icon: '⏳',
          })
        }
      } else {
        if (Notification.permission === 'granted') {
          new Notification('Scouting Failed', {
            body: result.error || 'Failed to scout villa',
            icon: '✕',
          })
        }
        setError(result.error || 'Failed to scout villa')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scout villa')
      if (Notification.permission === 'granted') {
        new Notification('Error', {
          body: err.message || 'Failed to scout villa',
          icon: '✕',
        })
      }
    }
  }

  async function handleScoutPaste(text: string) {
    setError('')
    setShowPasteModal(false)
    try {
      const result = await scoutPaste(text, list.id)
      if (result.ok) {
        if (Notification.permission === 'granted') {
          new Notification('Processing Paste...', {
            body: 'Extracting villa details...',
            icon: '⏳',
          })
        }
      } else {
        setError(result.error || 'Failed to process paste')
        if (Notification.permission === 'granted') {
          new Notification('Error', {
            body: result.error || 'Failed to process paste',
            icon: '✕',
          })
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process paste')
      if (Notification.permission === 'granted') {
        new Notification('Error', {
          body: err.message || 'Failed to process paste',
          icon: '✕',
        })
      }
    }
  }

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  async function handleDeleteVilla(villaId: string) {
    if (!confirm('Delete this villa?')) return

    try {
      const villa = villas.find((v: any) => v.id === villaId)
      if (villa) {
        await deleteVilla(list.id, villa?.slug)
        setVillas(villas.filter((v: any) => v.id !== villaId))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete villa')
    }
  }

  async function handleUpdateVilla(villaId: string, updatedData: any) {
    try {
      const villa = villas.find((v: any) => v.id === villaId)
      if (villa) {
        await updateVilla(list.id, villa.slug, updatedData)
        await loadData()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update villa')
    }
  }

  async function handleCreateInvite() {
    try {
      const invite = await createInvite(list.id, 'editor')
      setInviteLink(`${window.location.origin}/join/${invite.token}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create invite')
    }
  }

  function handleImageClick(images: string[], index: number) {
    setGalleryImages(images)
    setGalleryIndex(index)
  }

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '1.5rem 2rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0 }}>{list.name}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 2rem',
        }}
      >
        <button
          onClick={() => setActiveTab('places')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeTab === 'places' ? 'var(--accent)' : 'var(--muted)',
            padding: '1rem 1.5rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'places' ? '2px solid var(--accent)' : 'none',
            transition: 'color 0.2s',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}
        >
          Places
        </button>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeTab === 'members' ? 'var(--accent)' : 'var(--muted)',
            padding: '1rem 1.5rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'members' ? '2px solid var(--accent)' : 'none',
            transition: 'color 0.2s',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}
        >
          Members ({members.length + 1})
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'places' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', flexShrink: 0 }}>
              <DropZone onUrlSubmit={handleScoutUrl} isLoading={false} />
            </div>

            {error && (
              <div
                style={{
                  margin: '0 2rem 1rem',
                  padding: '1rem',
                  background: 'var(--red-soft)',
                  border: '1px solid var(--red)',
                  borderRadius: '8px',
                  color: 'var(--red)',
                  flexShrink: 0,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ flex: 1, padding: '0 2rem 1.5rem', overflow: 'hidden' }}>
              <VillaTable
                villas={villas}
                isLoading={isLoading}
                onDelete={handleDeleteVilla}
                onUpdate={handleUpdateVilla}
                onImageClick={handleImageClick}
              />
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
            {/* Share Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--light)' }}>Share This List</h3>
              {inviteLink ? (
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--green-soft)',
                    border: '1px solid var(--green)',
                    borderRadius: '8px',
                    color: 'var(--green)',
                  }}
                >
                  <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Share this link:</p>
                  <code
                    style={{
                      fontSize: '0.8rem',
                      wordBreak: 'break-all',
                      display: 'block',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {inviteLink}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink)
                      setInviteLink('')
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--green)',
                      color: 'var(--green)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Copied!
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCreateInvite}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Generate Invite Link
                </button>
              )}
            </div>

            {/* Members List */}
            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--light)' }}>Members ({members.length + 1})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {members.map((member: any) => (
                  <div
                    key={member.user_id}
                    style={{
                      padding: '0.75rem',
                      background: 'var(--surface)',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, color: 'var(--light)', fontSize: '0.9rem', fontWeight: '600' }}>
                        {member.user_id}
                      </p>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8rem' }}>
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      style={{
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                      }}
                    >
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Gallery */}
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryImages(null)}
        />
      )}

      {/* Paste Modal */}
      <PasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onSubmit={handleScoutPaste}
        isLoading={false}
      />
    </>
  )
}
