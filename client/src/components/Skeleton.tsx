export function SkeletonLine({ width = '100%', height = '12px', style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} />
}

export function SkeletonBlock({ height = '60px', style }: { height?: string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: '100%', height, borderRadius: '6px', ...style }} />
}

export function TaskListSkeleton() {
  return (
    <div style={{ padding: '0' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(26,115,70,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
            <SkeletonLine width={`${55 + i * 7}%`} height="14px" />
            <SkeletonLine width="48px" height="14px" />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <SkeletonLine width="60px" height="18px" style={{ borderRadius: '10px' }} />
            <SkeletonLine width="45px" height="18px" style={{ borderRadius: '10px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
        <div className="skeleton" style={{ width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLine width="60%" height="16px" />
          <SkeletonLine width="80%" height="12px" />
        </div>
      </div>
      <SkeletonBlock height="8px" style={{ borderRadius: '4px', marginBottom: '16px' }} />
      <div style={{ display: 'flex', gap: '10px' }}>
        {[...Array(3)].map((_, i) => (
          <SkeletonBlock key={i} height="64px" style={{ borderRadius: '8px' }} />
        ))}
      </div>
    </div>
  )
}

export function AchievementSkeleton() {
  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', border: '1px solid rgba(26,115,70,0.18)', borderRadius: '6px' }}>
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonLine width={`${50 + i * 10}%`} height="14px" />
            <SkeletonLine width="90%" height="10px" />
          </div>
        </div>
      ))}
    </div>
  )
}
