import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  PRIORITY_LABELS,
  ROLE_LABELS,
} from '../lib/types'
import type {
  Project,
  ProjectStatus,
  MemberRole,
  StatusTransition,
} from '../lib/types'

interface MemberWithProfile {
  user_id: string
  member_role: MemberRole
  profiles: { name: string; email: string }
}

interface CommentWithProfile {
  id: string
  body: string
  created_at: string
  profiles: { name: string }
}

interface HistoryWithProfile {
  id: string
  old_status: ProjectStatus | null
  new_status: ProjectStatus
  created_at: string
  profiles: { name: string }
}

interface FileRow {
  id: string
  file_name: string
  storage_path: string
  size_bytes: number
  created_at: string
}

// Trigger'ın fırlattığı hataları kullanıcı diline çevirir.
function friendlyError(message: string): string {
  if (message.includes('GECERSIZ_GECIS')) return 'Bu durum geçişi tanımlı değil.'
  if (message.includes('YETKISIZ_GECIS'))
    return 'Bu geçiş için projedeki rolün yetkili değil.'
  return message
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [history, setHistory] = useState<HistoryWithProfile[]>([])
  const [files, setFiles] = useState<FileRow[]>([])
  const [transitions, setTransitions] = useState<StatusTransition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [projectRes, membersRes, commentsRes, historyRes, filesRes, transitionsRes] =
      await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase
          .from('project_members')
          .select('user_id, member_role, profiles(name, email)')
          .eq('project_id', id),
        supabase
          .from('comments')
          .select('id, body, created_at, profiles:sender_id(name)')
          .eq('project_id', id)
          .order('created_at'),
        supabase
          .from('status_history')
          .select('id, old_status, new_status, created_at, profiles:changed_by(name)')
          .eq('project_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('files')
          .select('id, file_name, storage_path, size_bytes, created_at')
          .eq('project_id', id)
          .order('created_at'),
        supabase.from('status_transitions').select('*'),
      ])

    if (projectRes.error) {
      setLoadError(
        projectRes.error.code === 'PGRST116'
          ? 'İş bulunamadı veya bu işe erişim yetkin yok.'
          : projectRes.error.message,
      )
      setLoading(false)
      return
    }

    setProject(projectRes.data)
    setMembers((membersRes.data as unknown as MemberWithProfile[]) ?? [])
    setComments((commentsRes.data as unknown as CommentWithProfile[]) ?? [])
    setHistory((historyRes.data as unknown as HistoryWithProfile[]) ?? [])
    setFiles(filesRes.data ?? [])
    setTransitions(transitionsRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const myRoles = members
    .filter((m) => m.user_id === session?.user.id)
    .map((m) => m.member_role)

  // Kullanıcının bu durumdan yapabileceği geçişler: matris + rol kesişimi.
  const availableTransitions = project
    ? transitions.filter(
        (t) =>
          t.from_status === project.status &&
          t.allowed_roles.some((r) => myRoles.includes(r)),
      )
    : []

  const changeStatus = async (to: ProjectStatus) => {
    if (!project) return
    setActionError(null)
    setChangingStatus(true)

    const { error } = await supabase
      .from('projects')
      .update({ status: to })
      .eq('id', project.id)

    setChangingStatus(false)
    if (error) {
      setActionError(friendlyError(error.message))
      return
    }
    await load()
  }

  const sendComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!project || !session || !commentBody.trim()) return
    setActionError(null)
    setSendingComment(true)

    const { error } = await supabase.from('comments').insert({
      project_id: project.id,
      sender_id: session.user.id,
      body: commentBody.trim(),
    })

    setSendingComment(false)
    if (error) {
      setActionError(error.message)
      return
    }
    setCommentBody('')
    await load()
  }

  const uploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !project || !session) return
    setActionError(null)

    if (file.size > 10 * 1024 * 1024) {
      setActionError('Dosya 10MB sınırını aşıyor.')
      return
    }

    setUploading(true)
    // Storage anahtarında sorun çıkarmaması için dosya adı sadeleştirilir.
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${project.id}/${Date.now()}_${safeName}`

    const { error: storageError } = await supabase.storage
      .from('project-files')
      .upload(path, file)

    if (storageError) {
      setUploading(false)
      setActionError(`Dosya yüklenemedi: ${storageError.message}`)
      return
    }

    const { error: rowError } = await supabase.from('files').insert({
      project_id: project.id,
      uploaded_by: session.user.id,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
    })

    setUploading(false)
    if (rowError) {
      setActionError(`Dosya kaydı oluşturulamadı: ${rowError.message}`)
      return
    }
    await load()
  }

  const downloadFile = async (row: FileRow) => {
    setActionError(null)
    const { data, error } = await supabase.storage
      .from('project-files')
      .createSignedUrl(row.storage_path, 60)
    if (error || !data) {
      setActionError('Dosya bağlantısı oluşturulamadı.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8" aria-label="Yükleniyor">
        <div className="h-8 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p role="alert" className="text-gray-700">
          {loadError ?? 'İş bulunamadı.'}
        </p>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          İş listesine dön
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← İş listesi
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.title}</h1>
          <p className="mt-1 text-xs text-gray-500">
            Öncelik: {PRIORITY_LABELS[project.priority]} · Açılış:{' '}
            {new Date(project.created_at).toLocaleDateString('tr-TR')}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${STATUS_BADGE_CLASSES[project.status]}`}
        >
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      {/* Durum geçiş butonları: geçiş matrisi + kullanıcının rolünden türetilir */}
      {availableTransitions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {availableTransitions.map((t) => (
            <button
              key={t.to_status}
              onClick={() => changeStatus(t.to_status)}
              disabled={changingStatus}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              → {STATUS_LABELS[t.to_status]}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {actionError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">İş tanımı</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {project.description}
            </p>
            {project.expected_outcome && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-gray-900">Beklenen sonuç</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  {project.expected_outcome}
                </p>
              </>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Yorumlar</h2>
            {comments.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Henüz yorum yok.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium text-gray-900">
                      {c.profiles.name}
                      <span className="ml-2 font-normal text-gray-400">
                        {new Date(c.created_at).toLocaleString('tr-TR')}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={sendComment} className="mt-4 flex gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={4000}
                placeholder="Yorum yaz…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingComment || !commentBody.trim()}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                Gönder
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Dosyalar</h2>
              <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">
                {uploading ? 'Yükleniyor…' : '+ Dosya ekle'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt"
                  onChange={uploadFile}
                />
              </label>
            </div>
            {files.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Henüz dosya eklenmemiş.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => downloadFile(f)}
                      className="text-indigo-600 hover:underline"
                    >
                      {f.file_name}
                    </button>
                    <span className="text-xs text-gray-400">
                      {(f.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Kişiler</h2>
            <ul className="mt-3 space-y-2">
              {members.map((m) => (
                <li key={`${m.user_id}-${m.member_role}`} className="text-sm">
                  <p className="font-medium text-gray-900">{m.profiles.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_LABELS[m.member_role]}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Durum geçmişi</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Henüz durum değişikliği yok.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-gray-600">
                    <p>
                      {h.old_status ? STATUS_LABELS[h.old_status] : '—'} →{' '}
                      <span className="font-medium text-gray-900">
                        {STATUS_LABELS[h.new_status]}
                      </span>
                    </p>
                    <p className="text-gray-400">
                      {h.profiles.name} · {new Date(h.created_at).toLocaleString('tr-TR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
