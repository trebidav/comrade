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

export const TILE_CONFIGS: Record<Theme, TileConfig> = {
  pipboy: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    filter: 'sepia(1) hue-rotate(70deg) saturate(0.8)',
  },
  desert: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    filter: undefined,
  },
}
