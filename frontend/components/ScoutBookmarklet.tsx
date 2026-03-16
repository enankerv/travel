"use client";

import { useState, useMemo, useEffect } from "react";

const FALLBACK_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * Build the paste bookmarklet.
 * Copies page HTML (with images) and text to clipboard, navigates to app with paste modal and source URL.
 * Uses location.href (not window.open) so mobile browsers don't block it.
 * Does not include list ID - app uses stored default or shows list picker.
 */
function buildPasteBookmarklet(appUrl: string): string {
  const base = appUrl || FALLBACK_APP_URL || "https://getawaygather.com";
  const script = [
    "(function(){",
    "var base='" + base.replace(/'/g, "\\'") + "';",
    "var params='paste=1';",
    "var src=encodeURIComponent(window.location.href);",
    "if(src){params+='&url='+src;}",
    "var url=base+'/?'+params;",
    "var go=function(){window.location.href=url;};",
    "var html=(document.body&&document.body.innerHTML)||(document.documentElement&&document.documentElement.outerHTML)||'';",
    "var txt=(document.body&&document.body.innerText)||'';",
    "var n=document.getElementById('__NEXT_DATA__');",
    "if(!html&&n&&n.textContent){html=n.textContent;txt=html;}",
    "if(html&&navigator.clipboard){",
    "var done=function(){alert('Page copied! Paste in the app.');go();};",
    "var fail=function(){go();};",
    "try{",
    "if(navigator.clipboard.write&&typeof ClipboardItem!='undefined'){",
    "navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([txt||html],{type:'text/plain'})})]).then(done).catch(function(){navigator.clipboard.writeText(html).then(done).catch(fail);});",
    "}else{navigator.clipboard.writeText(html).then(done).catch(fail);}",
    "}catch(e){fail();}",
    "}else{go();}",
    "})();",
  ].join("");
  return "javascript:" + script;
}

export default function ScoutBookmarklet() {
  const [appUrl, setAppUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAppUrl(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const pasteHref = useMemo(() => buildPasteBookmarklet(appUrl), [appUrl]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="scout-bookmarklet">
      <button
        type="button"
        className="scout-bookmarklet__toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        Add listing from another tab
      </button>
      {expanded && (
        <div className="scout-bookmarklet__content">
          <p className="scout-bookmarklet__intro">
            Drag this to your bookmarks bar. When you&apos;re on a listing page, click it to copy the page
            and add to a list. Uses your last list by default; pick another from the dropdown if needed.
          </p>

          <div className="scout-bookmarklet__row">
            <a
              href={pasteHref}
              className="scout-bookmarklet__link"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/uri-list", pasteHref);
                e.dataTransfer.setData("text/plain", pasteHref);
              }}
            >
              Add to List
            </a>
            <button
              type="button"
              className="scout-bookmarklet__copy"
              onClick={() => copyToClipboard(pasteHref)}
              title="Copy bookmarklet code"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="scout-bookmarklet__hint">
            Copies page content and opens the app. Click &quot;Paste from clipboard&quot; in the modal.
          </p>
        </div>
      )}
    </div>
  );
}
