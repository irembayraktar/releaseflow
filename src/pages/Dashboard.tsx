import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_BADGE_CLASSES, PRIORITY_LABELS } from '../lib/types'
import type { Project } from '../lib/types'

export default function Dashboard() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setProjects(data)
      })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">İşlerim</h1>
          {profile && <p className="text-sm text-gray-500">Hoş geldin, {profile.name}</p>}
        </div>
        <Link
          to="/yeni-talep"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Yeni talep
        </Link>
      </div>

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
        <div className="mt-12 rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-600">Henüz dahil olduğun bir iş yok.</p>
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
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    Öncelik: {PRIORITY_LABELS[p.priority]} ·{' '}
                    {new Date(p.updated_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[p.status]}`}
                >
                  {STATUS_LABELS[p.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
