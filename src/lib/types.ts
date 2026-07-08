export type ProjectStatus =
  | 'yeni_talep'
  | 'inceleniyor'
  | 'gelistirmede'
  | 'test_bekliyor'
  | 'revize_gerekli'
  | 'test_uygun'
  | 'canliya_alma_bekliyor'
  | 'canliya_alindi'
  | 'kapatildi'

export type MemberRole = 'talep_sahibi' | 'gelistirici' | 'yonetici' | 'testci'

export type ProjectPriority = 'dusuk' | 'orta' | 'yuksek' | 'kritik'

export type CommentKind = 'yorum' | 'test_bildirimi' | 'test_sonucu' | 'revize_talebi'

export interface Profile {
  id: string
  name: string
  email: string
  department: string | null
  created_at: string
}

export interface Project {
  id: string
  title: string
  description: string
  expected_outcome: string | null
  status: ProjectStatus
  priority: ProjectPriority
  requester_id: string
  developer_id: string | null
  manager_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  project_id: string
  user_id: string
  member_role: MemberRole
  created_at: string
}

export interface StatusTransition {
  from_status: ProjectStatus
  to_status: ProjectStatus
  allowed_roles: MemberRole[]
}

export interface StatusHistoryEntry {
  id: string
  project_id: string
  old_status: ProjectStatus | null
  new_status: ProjectStatus
  changed_by: string
  note: string | null
  created_at: string
}

export interface ProjectComment {
  id: string
  project_id: string
  sender_id: string
  body: string
  kind: CommentKind
  created_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  uploaded_by: string
  file_name: string
  storage_path: string
  size_bytes: number
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  project_id: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  yeni_talep: 'Yeni Talep',
  inceleniyor: 'İnceleniyor',
  gelistirmede: 'Geliştirme Aşamasında',
  test_bekliyor: 'Test Bekliyor',
  revize_gerekli: 'Revize Gerekli',
  test_uygun: 'Test Uygun',
  canliya_alma_bekliyor: 'Canlıya Alma Bekliyor',
  canliya_alindi: 'Canlıya Alındı',
  kapatildi: 'Tamamlandı',
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  talep_sahibi: 'Talep Sahibi',
  gelistirici: 'Geliştirici',
  yonetici: 'Yönetici',
  testci: 'Test Kullanıcısı',
}

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
}

export const STATUS_BADGE_CLASSES: Record<ProjectStatus, string> = {
  yeni_talep: 'bg-sky-100 text-sky-800',
  inceleniyor: 'bg-indigo-100 text-indigo-800',
  gelistirmede: 'bg-amber-100 text-amber-800',
  test_bekliyor: 'bg-purple-100 text-purple-800',
  revize_gerekli: 'bg-rose-100 text-rose-800',
  test_uygun: 'bg-emerald-100 text-emerald-800',
  canliya_alma_bekliyor: 'bg-teal-100 text-teal-800',
  canliya_alindi: 'bg-green-100 text-green-800',
  kapatildi: 'bg-gray-200 text-gray-600',
}
