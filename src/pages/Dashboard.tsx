import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_ACCENT_CLASSES,
  PRIORITY_LABELS,
} from '../lib/types'
import type { Project } from '../lib/types'

export default function Dashboard() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjects(null)
    let query = supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (!showArchived) {
      query = query.is('archived_at', null)
    }
    query.then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setProjects(data)
    })
  }, [showArchived])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">İşlerim</h1>
          {profile && <p className="text-sm text-gray-500">Hoş geldin, {profile.name}</p>}
        </div>
        <Link
          to="/yeni-talep"
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-200 transition-opacity hover:opacity-90"
        >
          + Yeni talep
        </Link>
      </div>

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Arşivlenenleri de göster
      </label>

      {error && (
        <p role="alert" className="mt-6 text-sm text-rose-600">
          Liste yüklenemedi: {error}
        </p>
      )}

      {!projects && !error && (
        <ul className="mt-6 space-y-3" aria-label="Yükleniyor">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </ul>
      )}

      {projects && projects.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-indigo-200 bg-white/60 p-10 text-center backdrop-blur">
          <svg
            viewBox="0 0 120 90"
            className="mx-auto h-24 w-32"
            aria-hidden="true"
          >
            <rect x="14" y="26" width="72" height="48" rx="8" fill="#e0e7ff" />
            <rect x="26" y="14" width="72" height="48" rx="8" fill="#ffffff" stroke="#c7d2fe" strokeWidth="2" />
            <rect x="36" y="26" width="34" height="6" rx="3" fill="#a5b4fc" />
            <rect x="36" y="38" width="52" height="5" rx="2.5" fill="#e0e7ff" />
            <rect x="36" y="48" width="44" height="5" rx="2.5" fill="#e0e7ff" />
            <circle cx="100" cy="66" r="14" fill="url(#empty-g)" />
            <path d="M100 60v12M94 66h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="empty-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#6366f1" />
                <stop offset="1" stopColor="#c026d3" />
              </linearGradient>
            </defs>
          </svg>
          <p className="mt-4 text-gray-600">Henüz dahil olduğun bir iş yok.</p>
          <Link
            to="/yeni-talep"
            className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            İlk iş talebini oluştur
          </Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <ul className="mt-6 space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/is/${p.id}`}
                className={`flex items-center justify-between rounded-xl border border-gray-200 border-l-4 bg-white/90 px-4 py-3 backdrop-blur transition-shadow hover:shadow-lg hover:shadow-indigo-100 ${STATUS_ACCENT_CLASSES[p.status]}`}
              >
                <div>
                  <p className="font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    Öncelik: {PRIORITY_LABELS[p.priority]} ·{' '}
                    {new Date(p.updated_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  {p.archived_at && (
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                      Arşivde
                    </span>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[p.status]}`}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
