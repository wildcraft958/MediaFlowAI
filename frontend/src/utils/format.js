/** Shared formatting helpers — null-safe string transforms */

/** Replace underscores with spaces, null-safe */
export const humanize = (v) => (v ?? '').replace(/_/g, ' ')

/** Strip 'WS-' prefix, null-safe */
export const stripWs = (v) => (v ?? '').replace('WS-', '')
