/* SVG icon components — no emoji, no text symbols */

interface IconProps {
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

const defaults = { size: 22, color: 'currentColor' }

export function IconTasks({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <polyline points="3,5 5,7 8,4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="12" y1="4" x2="20.5" y2="4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="11" x2="20.5" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="1.5" y="13.5" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <line x1="12" y1="17" x2="18" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconChat({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <path d="M2 2h18a1 1 0 011 1v12a1 1 0 01-1 1H6.5L2 20V3a1 1 0 011-1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7" cy="10" r="1.2" fill={color} />
      <circle cx="11" cy="10" r="1.2" fill={color} />
      <circle cx="15" cy="10" r="1.2" fill={color} />
    </svg>
  )
}

export function IconPerson({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <circle cx="11" cy="7.5" r="3.8" stroke={color} strokeWidth="1.8" />
      <path d="M2.5 20c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconFriends({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <circle cx="7.5" cy="7" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M1 19c0-3.6 2.9-6.5 6.5-6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15" cy="7" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M10 19c0-3.6 2.9-6.5 6.5-6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrophy({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <path d="M6 2h10l-1 8a5 5 0 01-8 0L6 2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3.5 3H6M19 3h-3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 16v4M8 20h6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3.5 3c0 3 1 5.5 3 7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18.5 3c0 3-1 5.5-3 7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconSettings({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <circle cx="11" cy="11" r="3.2" stroke={color} strokeWidth="1.7" />
      <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.6 4.6l1.4 1.4M16 16l1.4 1.4M4.6 17.4l1.4-1.4M16 6l1.4-1.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconLogout({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <path d="M9 3H4a1 1 0 00-1 1v14a1 1 0 001 1h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <polyline points="15,8 19,11 15,14" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="11" x2="19" y2="11" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconCamera({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <path d="M7.5 3.5L6 5.5H2.5a1 1 0 00-1 1v11a1 1 0 001 1h17a1 1 0 001-1v-11a1 1 0 00-1-1H16l-1.5-2h-7z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="11" cy="12" r="3.2" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

export function IconMap({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <path d="M11 2C7.1 2 4 5.1 4 9c0 5.5 7 13 7 13s7-7.5 7-13c0-3.9-3.1-7-7-7z" stroke={color} strokeWidth="1.8" />
      <circle cx="11" cy="9" r="2.5" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

export function IconStar({ size = defaults.size, color = defaults.color, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={style}>
      <polygon points="11,2 13.9,8.6 21,9.3 15.9,14 17.6,21 11,17.3 4.4,21 6.1,14 1,9.3 8.1,8.6" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function IconChatEmpty({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M5 5h38a2 2 0 012 2v24a2 2 0 01-2 2H12L5 43V7a2 2 0 012-2z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="19" r="2.5" fill={color} />
      <circle cx="24" cy="19" r="2.5" fill={color} />
      <circle cx="32" cy="19" r="2.5" fill={color} />
    </svg>
  )
}

export function IconTasksEmpty({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="8" width="36" height="36" rx="3" stroke={color} strokeWidth="2.2" />
      <rect x="16" y="4" width="8" height="8" rx="2" stroke={color} strokeWidth="2.2" />
      <rect x="26" y="4" width="8" height="8" rx="2" stroke={color} strokeWidth="2.2" />
      <line x1="14" y1="24" x2="34" y2="24" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="14" y1="32" x2="26" y2="32" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconBoltEmpty({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <polygon points="28,4 12,26 22,26 20,44 36,22 26,22" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  )
}

export function IconAchievement({ color = '#FBBC05' }: { color?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <polygon points="14,3 16.9,10.6 25,11.4 19,16.5 21,24 14,19.8 7,24 9,16.5 3,11.4 11.1,10.6" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
    </svg>
  )
}

export function IconCenterOnMe({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.4" strokeDasharray="2 2" />
      <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlus({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
