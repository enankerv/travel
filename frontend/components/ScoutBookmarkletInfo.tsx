'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

function buildPasteBookmarklet(appUrl: string, listId?: string): string {
  const base = appUrl || FALLBACK_APP_URL || 'https://getawaygather.com'
  const path = listId ? `/list/${listId}` : '/'
  const script = [
    '(function(){',
    "var base='" + base.replace(/'/g, "\\'") + "';",
    "var path='" + path.replace(/'/g, "\\'") + "';",
    "var params='paste=1';",
    'var src=encodeURIComponent(window.location.href);',
    "if(src){params+='&url='+src;}",
    "var url=base+path+'?'+params;",
    'var go=function(){window.location.href=url;};',
    "var html=(document.body&&document.body.innerHTML)||(document.documentElement&&document.documentElement.outerHTML)||'';",
    "var txt=(document.body&&document.body.innerText)||'';",
    "var n=document.getElementById('__NEXT_DATA__');",
    'if(!html&&n&&n.textContent){html=n.textContent;txt=html;}',
    'if(html&&navigator.clipboard){',
    "var done=function(){alert('Page copied! Paste in the app.');go();};",
    'var fail=function(){go();};',
    'try{',
    "if(navigator.clipboard.write&&typeof ClipboardItem!='undefined'){",
    "navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([txt||html],{type:'text/plain'})})]).then(done).catch(function(){navigator.clipboard.writeText(html).then(done).catch(fail);});",
    '}else{navigator.clipboard.writeText(html).then(done).catch(fail);}',
    '}catch(e){fail();}',
    '}else{go();}',
    '})();',
  ].join('')
  return 'javascript:' + script
}

export default function ScoutBookmarkletInfo({ listId }: { listId: string }) {
  const [appUrl, setAppUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAppUrl(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const pasteHref = useMemo(
    () => buildPasteBookmarklet(appUrl, listId),
    [appUrl, listId],
  )

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(pasteHref).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="scout-bookmarklet-info" ref={rootRef}>
      <button
        type="button"
        className="scout-bookmarklet-info__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="How to add a listing from another tab"
        title="Add listing from another tab"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            fill="currentColor"
            d="M11 10h2v7h-2zm0-4h2v2h-2z"
          />
        </svg>
      </button>

      {open && (
        <div className="scout-bookmarklet-info__popover" role="dialog" aria-label="Bookmarklet">
          <p className="scout-bookmarklet-info__intro">
            Drag this to your bookmarks bar. On a listing page, click it to copy the page and
            open this list.
          </p>
          <div className="scout-bookmarklet-info__row">
            <a
              href={pasteHref}
              className="scout-bookmarklet-info__link"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/uri-list', pasteHref)
                e.dataTransfer.setData('text/plain', pasteHref)
              }}
            >
              Add to List
            </a>
            <button
              type="button"
              className="scout-bookmarklet-info__copy"
              onClick={copyToClipboard}
              title="Copy bookmarklet code"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="scout-bookmarklet-info__hint">
            Copies page content and opens the paste modal here.
          </p>
        </div>
      )}
    </div>
  )
}
