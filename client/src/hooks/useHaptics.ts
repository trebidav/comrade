export function useHaptics() {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern) } catch { /* ignore */ }
    }
  }
  return {
    light: () => vibrate(8),
    medium: () => vibrate(18),
    heavy: () => vibrate([12, 40, 12]),
    success: () => vibrate([8, 60, 8]),
    error: () => vibrate([30, 60, 30]),
  }
}
