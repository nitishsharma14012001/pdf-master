/**
 * PDF Master — Analytics Module
 *
 * Single source of truth for all tracking. Nothing fires until the user
 * accepts cookies. Scripts are lazy-loaded (injected into the DOM) only
 * after consent, so the cold-page bundle ships zero analytics bytes.
 *
 * Providers:
 *   • Google Analytics 4  (via react-ga4 / gtag)
 *   • Microsoft Clarity   (script-injected)
 *
 * All public helpers are safe to call at any time — they silently no-op
 * when consent has not been granted or when IDs are not configured.
 *
 * Usage:
 *   import { track } from '@/analytics'
 *   track.toolOpened({ toolId: 'merge-pdf', toolName: 'Merge PDF' })
 */

import ReactGA from 'react-ga4'

// ─── Environment IDs ──────────────────────────────────────────────────────────

const GA4_ID      = import.meta.env.VITE_GA4_MEASUREMENT_ID   // G-XXXXXXXXXX
const CLARITY_ID  = import.meta.env.VITE_CLARITY_PROJECT_ID   // 10-char string
const DEBUG_MODE  = import.meta.env.VITE_ANALYTICS_DEBUG === 'true'

// ─── Internal state ───────────────────────────────────────────────────────────

let _ga4Ready     = false
let _clarityReady = false

// ─── GA4 bootstrap ───────────────────────────────────────────────────────────

/**
 * Initialise GA4. Called once by the consent system after the user accepts.
 * Safe to call multiple times — guards against double-init.
 */
function initGA4() {
  if (_ga4Ready || !GA4_ID) return

  ReactGA.initialize(GA4_ID, {
    gaOptions: {
      send_page_view: false,   // We send page views manually for SPA accuracy
    },
    gtagOptions: {
      anonymize_ip: true,      // GDPR: mask the last octet of the IP address
      cookie_flags: 'SameSite=None;Secure',
    },
    testMode: DEBUG_MODE,
  })

  _ga4Ready = true

  if (DEBUG_MODE) {
    console.debug('[Analytics] GA4 initialised', { id: GA4_ID })
  }
}

// ─── Microsoft Clarity bootstrap ─────────────────────────────────────────────

/**
 * Lazy-inject the Clarity snippet into the document head.
 * Using script injection (rather than a hard <script> tag in index.html)
 * ensures Clarity loads zero bytes unless the user consents.
 */
function initClarity() {
  if (_clarityReady || !CLARITY_ID) return
  if (document.getElementById('ms-clarity')) return   // already injected

  const script = document.createElement('script')
  script.id    = 'ms-clarity'
  script.type  = 'text/javascript'
  script.async = true
  script.innerHTML = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window,document,"clarity","script","${CLARITY_ID}");
  `
  document.head.appendChild(script)
  _clarityReady = true

  if (DEBUG_MODE) {
    console.debug('[Analytics] Clarity injected', { id: CLARITY_ID })
  }
}

// ─── Public bootstrap — called by ConsentContext after user accepts ───────────

/**
 * Initialise all analytics providers and fire the first page view.
 * Called once from ConsentContext when consent is granted.
 *
 * @param {string} initialPath  - The current URL path at consent time
 */
export function initAnalytics(initialPath = window.location.pathname) {
  initGA4()
  initClarity()
  // Immediately record the page the user was on when they accepted
  sendPageView(initialPath)
}

// ─── Page views ───────────────────────────────────────────────────────────────

/**
 * Send a page view hit. Called by the router watcher in App.jsx on every
 * navigation (only fires when GA4 is ready).
 *
 * @param {string} path   - e.g. '/tools/merge-pdf'
 * @param {string} [title] - Optional document title override
 */
export function sendPageView(path, title) {
  if (!_ga4Ready) return

  ReactGA.send({
    hitType:  'pageview',
    page:     path,
    title:    title || document.title,
  })

  if (DEBUG_MODE) {
    console.debug('[Analytics] pageview', { path, title: title || document.title })
  }
}

// ─── Generic event helper ─────────────────────────────────────────────────────

/**
 * Send a custom GA4 event. All other helpers delegate here.
 *
 * GA4 naming convention: snake_case action, Title Case category.
 *
 * @param {string} action     - Event name (snake_case)
 * @param {Object} [params]   - Extra event parameters
 */
function event(action, params = {}) {
  if (!_ga4Ready) return

  ReactGA.event(action, params)

  if (DEBUG_MODE) {
    console.debug('[Analytics] event', { action, ...params })
  }
}

// ─── Typed event catalogue ────────────────────────────────────────────────────
//
// Every event the product fires lives here as a named function.
// This makes events discoverable, refactorable, and easy to audit.

export const track = {

  // ── Page ───────────────────────────────────────────────────────────────────

  /**
   * Manual page view — use in pages that need custom titles.
   * App.jsx covers route-level page views automatically.
   */
  pageView({ path, title } = {}) {
    sendPageView(path || window.location.pathname, title)
  },

  /** Track when the 404 page is displayed */
  notFound({ path } = {}) {
    event('page_not_found', {
      page_path:    path || window.location.pathname,
      event_category: 'Navigation',
    })
  },

  // ── Tool lifecycle ─────────────────────────────────────────────────────────

  /**
   * User navigated to a tool page.
   * @param {{ toolId: string, toolName: string }} params
   */
  toolOpened({ toolId, toolName }) {
    event('tool_opened', {
      tool_id:        toolId,
      tool_name:      toolName,
      event_category: 'Tool',
    })
  },

  // ── File upload ────────────────────────────────────────────────────────────

  /**
   * User selected files (before upload begins).
   * @param {{ toolId: string, fileCount: number, totalBytes: number }} params
   */
  fileUploadStarted({ toolId, fileCount, totalBytes }) {
    event('file_upload_started', {
      tool_id:        toolId,
      file_count:     fileCount,
      total_bytes:    totalBytes,
      event_category: 'Upload',
    })
  },

  /**
   * All files successfully transferred to the server.
   * @param {{ toolId: string, fileCount: number, totalBytes: number }} params
   */
  fileUploadCompleted({ toolId, fileCount, totalBytes }) {
    event('file_upload_completed', {
      tool_id:        toolId,
      file_count:     fileCount,
      total_bytes:    totalBytes,
      event_category: 'Upload',
    })
  },

  // ── Processing ─────────────────────────────────────────────────────────────

  /**
   * Server returned a processed file successfully.
   * @param {{ toolId: string, durationMs?: number }} params
   */
  processingSuccess({ toolId, durationMs }) {
    event('file_processing_success', {
      tool_id:        toolId,
      duration_ms:    durationMs,
      event_category: 'Processing',
    })
  },

  /**
   * Server returned an error during processing.
   * @param {{ toolId: string, errorMessage?: string, statusCode?: number }} params
   */
  processingFailed({ toolId, errorMessage, statusCode }) {
    event('file_processing_failed', {
      tool_id:        toolId,
      error_message:  errorMessage,
      status_code:    statusCode,
      event_category: 'Processing',
    })
  },

  // ── Download ───────────────────────────────────────────────────────────────

  /**
   * User clicked the download button and received the processed file.
   * @param {{ toolId: string, fileName?: string, fileSizeBytes?: number }} params
   */
  downloadCompleted({ toolId, fileName, fileSizeBytes }) {
    event('download_completed', {
      tool_id:        toolId,
      file_name:      fileName,
      file_size:      fileSizeBytes,
      event_category: 'Download',
    })
  },

  // ── Button clicks ──────────────────────────────────────────────────────────

  /** "Select Files" button in the Hero */
  selectFiles({ location = 'hero' } = {}) {
    event('click_select_files', {
      location,
      event_category: 'Engagement',
    })
  },

  /** "Explore Tools" button in the Hero */
  exploreTools({ location = 'hero' } = {}) {
    event('click_explore_tools', {
      location,
      event_category: 'Engagement',
    })
  },

  /** Any "Login" / "Sign in" button */
  login({ location = 'navbar' } = {}) {
    event('click_login', {
      location,
      event_category: 'Auth',
    })
  },

  // ── Cookie consent ─────────────────────────────────────────────────────────

  /** User accepted cookies */
  consentAccepted() {
    event('cookie_consent_accepted', { event_category: 'Consent' })
  },

  /** User declined cookies */
  consentDeclined() {
    // Note: GA4 is NOT initialised when declined, so this event is never
    // actually sent — that is the correct behaviour. We keep the call site
    // for symmetry / future first-party logging.
    event('cookie_consent_declined', { event_category: 'Consent' })
  },
}
