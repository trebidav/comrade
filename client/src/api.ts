import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Token ${token}`
  return config
})

export default api

export const TUTORIAL_ID_OFFSET = 100000
export function realTaskId(task: { id: number; is_tutorial: boolean }): number {
  return task.is_tutorial ? task.id - TUTORIAL_ID_OFFSET : task.id
}

export interface Task {
  id: number
  name: string
  description: string
  lat: number | null
  lon: number | null
  is_tutorial: boolean
  // Tutorial-only
  in_progress?: boolean
  // Regular task fields
  state?: number
  criticality?: number
  minutes?: number
  coins?: number | null
  xp?: number | null
  assignee?: number | null
  assignee_name?: string | null
  owner?: number | null
  skill_execute_names: string[]
  skill_read_names?: string[]
  skill_write_names?: string[]
  photo?: string | null
  require_photo?: boolean
  require_comment?: boolean
  datetime_start?: string | null
  datetime_finish?: string | null
  datetime_paused?: string | null
  datetime_respawn?: string | null
  time_spent_minutes?: number | null
  pending_review?: {
    id: number
    comment: string
    photo: string | null
    status: 'pending' | 'accepted' | 'declined'
    created_at: string
  } | null
}

export interface TutorialAnswer {
  id: number
  text: string
  order: number
}

export interface TutorialQuestion {
  id: number
  text: string
  order: number
  answers: TutorialAnswer[]
}

export interface TutorialPart {
  id: number
  type: 'text' | 'video' | 'quiz' | 'password' | 'file_upload'
  title: string
  order: number
  text_content: string
  video_url: string
  questions: TutorialQuestion[]
  completed: boolean
}

export interface TutorialData {
  id: number
  reward_skill_name: string
  parts: TutorialPart[]
}

export interface User {
  id: number
  username: string
  email: string
  latitude: number
  longitude: number
  skills: string[]
  is_superuser: boolean
  is_staff: boolean
  coins: number
  xp: number
  total_coins_earned: number
  total_xp_earned: number
  task_streak: number
  level: number
  level_progress: { level: number; current_xp: number; required_xp: number }
}

export interface Achievement {
  id: number
  name: string
  description: string
  icon: string
  is_secret: boolean
  earned: boolean
  datetime_earned: string | null
  progress: number | null
  threshold: number
  reward_coins: number
  reward_xp: number
  reward_skill: string | null
}

export interface NewAchievement {
  id: number
  name: string
  icon: string
  description: string
}

export interface Friend {
  id: number
  username: string
  email: string
  latitude: number
  longitude: number
  skills: string[]
}

export interface Skill {
  id: number
  name: string
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

export function formatCountdown(isoDatetime: string): string {
  const diffMs = new Date(isoDatetime).getTime() - Date.now()
  if (diffMs <= 0) return 'soon'
  const totalSeconds = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export const STATE_LABELS: Record<number, string> = {
  0: 'Unavailable',
  1: 'Open',
  2: 'In Progress',
  3: 'Waiting',
  4: 'In Review',
  5: 'Done',
}

export const CRITICALITY_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}
