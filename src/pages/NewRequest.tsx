import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PRIORITY_LABELS, ROLE_LABELS } from '../lib/types'
import type { Profile, ProjectPriority, MemberRole } from '../lib/types'

export default function NewRequest() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [expectedOutcome, setExpectedOutcome] = useState('')
  const [priority, setPriority] = useState<ProjectPriority>('orta')
  const [developerId, setDeveloperId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [testerIds, setTesterIds] = useState<string[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('testci')
  const [invites, setInvites] = useState<{ email: string; role: MemberRole }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setPeople(data ?? []))
  }, [])

  const toggleTester = (id: string) => {
    setTesterIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const addInvite = () => {
    const cleanEmail = inviteEmail.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError('Geçerli bir e-posta adresi gir.')
      return
    }
    if (invites.some((i) => i.email === cleanEmail)) {
      setError('Bu e-posta zaten davet listesinde.')
      return
    }
    setInvites((prev) => [...prev, { email: cleanEmail, role: inviteRole }])
    setInviteEmail('')
    setError(null)
  }

  const removeInvite = (targetEmail: string) => {
    setInvites((prev) => prev.filter((i) => i.email !== targetEmail))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return
    setError(null)

    if (description.trim().length < 10) {
      setError('İş tanımı en az 10 karakter olmalı.')
      return
    }

    setSubmitting(true)

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        title: title.trim(),
        description: description.trim(),
        expected_outcome: expectedOutcome.trim() || null,
        priority,
        requester_id: session.user.id,
        developer_id: developerId || null,
        manager_id: managerId || null,
      })
      .select()
      .single()

    if (insertError || !project) {
      setSubmitting(false)
      setError(insertError?.message ?? 'Talep oluşturulamadı.')
      return
    }

    // Geliştirici/yönetici üyelikleri trigger ile eklendi; testçiler burada eklenir.
    if (testerIds.length > 0) {
      const { error: memberError } = await supabase.from('project_members').upsert(
        testerIds.map((userId) => ({
          project_id: project.id,
          user_id: userId,
          member_role: 'testci' as const,
        })),
        { onConflict: 'project_id,user_id', ignoreDuplicates: true },
      )
      if (memberError) {
        setSubmitting(false)
        setError(`Talep oluştu ama testçiler eklenemedi: ${memberError.message}`)
        return
      }
    }

    // Davetler: e-posta zaten kayıtlıysa doğrudan üye yapılır,
    // değilse davet kaydı açılır (kayıt olduğunda üyeliğe dönüşür).
    if (invites.length > 0) {
      const findProfile = (invEmail: string) =>
        people.find((p) => p.email.toLowerCase() === invEmail)

      const registered = invites.filter((i) => findProfile(i.email))
      const external = invites.filter((i) => !findProfile(i.email))

      if (registered.length > 0) {
        await supabase.from('project_members').upsert(
          registered.map((i) => ({
            project_id: project.id,
            user_id: findProfile(i.email)!.id,
            member_role: i.role,
          })),
          { onConflict: 'project_id,user_id', ignoreDuplicates: true },
        )
      }

      if (external.length > 0) {
        const { error: inviteError } = await supabase.from('invited_members').insert(
          external.map((i) => ({
            project_id: project.id,
            email: i.email,
            member_role: i.role,
            invited_by: session.user.id,
          })),
        )
        if (inviteError) {
          setSubmitting(false)
          setError(`Talep oluştu ama davetler kaydedilemedi: ${inviteError.message}`)
          return
        }
      }
    }

    navigate(`/is/${project.id}`)
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900">Yeni İş Talebi</h1>
      <p className="mt-1 text-sm text-gray-500">
        Talep oluşturduğunda atanan geliştiriciye bildirim gider.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Başlık *
          </label>
          <input
            id="title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Örn: Satış raporuna müşteri segmenti alanı eklensin"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            İş tanımı *
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Ne isteniyor, neden isteniyor? (en az 10 karakter)"
          />
        </div>

        <div>
          <label htmlFor="expected" className="block text-sm font-medium text-gray-700">
            Beklenen sonuç
          </label>
          <textarea
            id="expected"
            rows={2}
            value={expectedOutcome}
            onChange={(e) => setExpectedOutcome(e.target.value)}
            className={inputClass}
            placeholder="İş bittiğinde neyin çalışıyor olması bekleniyor?"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
              Öncelik
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority)}
              className={inputClass}
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="developer" className="block text-sm font-medium text-gray-700">
              Geliştirici *
            </label>
            <select
              id="developer"
              required
              value={developerId}
              onChange={(e) => setDeveloperId(e.target.value)}
              className={inputClass}
            >
              <option value="">Seç…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="manager" className="block text-sm font-medium text-gray-700">
              Yönetici
            </label>
            <select
              id="manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className={inputClass}
            >
              <option value="">Yok</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Test kullanıcıları</legend>
          {people.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">Kayıtlı kullanıcı bulunamadı.</p>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {people.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={testerIds.includes(p.id)}
                    onChange={() => toggleTester(p.id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {p.name}
                  <span className="text-xs text-gray-400">{p.email}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Kayıtlı olmayan kişiyi e-postayla davet et
          </legend>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kisi@firma.com"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Davet edilen kişinin rolü"
            >
              <option value="testci">{ROLE_LABELS.testci}</option>
              <option value="gelistirici">{ROLE_LABELS.gelistirici}</option>
              <option value="yonetici">{ROLE_LABELS.yonetici}</option>
            </select>
            <button
              type="button"
              onClick={addInvite}
              className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              Ekle
            </button>
          </div>

          {invites.length > 0 && (
            <ul className="mt-3 space-y-1">
              {invites.map((i) => (
                <li
                  key={i.email}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm"
                >
                  <span className="text-gray-700">
                    {i.email}
                    <span className="ml-2 text-xs text-gray-400">
                      {ROLE_LABELS[i.role]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeInvite(i.email)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Kaldır
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Bu kişiler aynı e-postayla kayıt olduklarında işe otomatik eklenir; e-posta
            zaten kayıtlıysa hemen üye yapılır.
          </p>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-200 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Oluşturuluyor…' : 'Talebi oluştur'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Vazgeç
          </button>
        </div>
      </form>
    </div>
  )
}
