export type Theme = 'pipboy' | 'desert'
export type LayoutMode = 'mobile' | 'desktop'

export function getLayoutMode(): LayoutMode {
  return (localStorage.getItem('comrade_layout') as LayoutMode) || 'mobile'
}

export function applyLayoutMode(mode: LayoutMode) {
  document.documentElement.setAttribute('data-layout', mode)
  localStorage.setItem('comrade_layout', mode)
  window.dispatchEvent(new CustomEvent('comrade-layout-change'))
}

export function getTheme(): Theme {
  return (localStorage.getItem('comrade_theme') as Theme) || 'pipboy'
}

export function applyTheme(theme: Theme) {
  if (theme === 'desert') {
    document.documentElement.setAttribute('data-theme', 'desert')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  localStorage.setItem('comrade_theme', theme)
  window.dispatchEvent(new CustomEvent('comrade-theme-change'))
}

export interface TileConfig {
  url: string
  attribution: string
  filter: string | undefined
}

// Fallback tiles when Google Maps API key is unavailable
export const TILE_CONFIGS: Record<Theme, TileConfig> = {
  pipboy: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    filter: undefined,
  },
  desert: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    filter: undefined,
  },
}

// Google Maps "Dark" style JSON — with POIs reduced to landmarks only
const DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }, { visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
]

// Google Maps "Retro" style JSON
const RETRO_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b2a6' }] },
  { featureType: 'administrative.land_parcel', elementType: 'geometry.stroke', stylers: [{ color: '#dcd2be' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#ae9e90' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#a5b076' }, { visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#447530' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfcf8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#e98d58' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ color: '#db8555' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#806b63' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'transit.line', elementType: 'labels.text.fill', stylers: [{ color: '#8f7d77' }] },
  { featureType: 'transit.line', elementType: 'labels.text.stroke', stylers: [{ color: '#ebe3cd' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#92998d' }] },
]

const GOOGLE_STYLES: Record<Theme, object[]> = {
  pipboy: DARK_STYLES,
  desert: RETRO_STYLES,
}

const GOOGLE_ATTRIBUTION = '&copy; Google Maps'

// Session cache: theme → { url, expiresAt }
const sessionCache: Record<string, { url: string; expiresAt: number }> = {}
// In-flight request deduplication
const inflightRequests: Record<string, Promise<TileConfig | null>> = {}
// Backoff: don't retry Google until this time
let googleBackoffUntil = 0

/** Invalidate cached Google session with backoff to prevent retry storms. */
export function invalidateGoogleSession(theme: Theme) {
  delete sessionCache[theme]
  // Back off for 5 minutes before trying Google again
  googleBackoffUntil = Date.now() + 5 * 60 * 1000
}

/**
 * Create a Google Map Tiles API session and return the tile URL.
 * Returns null if the API key is missing or session creation fails.
 * Falls back to TILE_CONFIGS in that case.
 * Deduplicates concurrent requests and respects backoff after errors.
 */
export async function getGoogleTileUrl(theme: Theme): Promise<TileConfig | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  if (!apiKey) return null

  // Respect backoff period after tile errors
  if (Date.now() < googleBackoffUntil) return null

  const cached = sessionCache[theme]
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, attribution: GOOGLE_ATTRIBUTION, filter: undefined }
  }

  // Deduplicate: if a request for this theme is already in-flight, reuse it
  if (inflightRequests[theme]) return inflightRequests[theme]

  const request = (async (): Promise<TileConfig | null> => {
    try {
      const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapType: 'roadmap',
          language: 'en-US',
          region: 'US',
          styles: GOOGLE_STYLES[theme],
        }),
      })
      if (!res.ok) {
        // Back off on session creation failure (quota/rate limit)
        googleBackoffUntil = Date.now() + 5 * 60 * 1000
        return null
      }
      const data = await res.json()
      if (!data.session) return null

      const url = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${data.session}&key=${apiKey}`
      const expiry = data.expiry ? new Date(data.expiry).getTime() - 60000 : Date.now() + 23 * 3600000
      sessionCache[theme] = { url, expiresAt: expiry }

      return { url, attribution: GOOGLE_ATTRIBUTION, filter: undefined }
    } catch {
      return null
    } finally {
      delete inflightRequests[theme]
    }
  })()

  inflightRequests[theme] = request
  return request
}
