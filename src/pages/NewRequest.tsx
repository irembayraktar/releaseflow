import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PRIORITY_LABELS, ROLE_LABELS } from '../lib/types'
import type { Profile, ProjectPriority, MemberRole } from '../lib/types'
import PersonPicker from '../components/PersonPicker'

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
  const [memberId, setMemberId] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('testci')
  const [teamMembers, setTeamMembers] = useState<{ userId: string; role: MemberRole }[]>([])
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

  const addTeamMember = () => {
    if (!memberId) {
      setError('Eklenecek kişiyi seç.')
      return
    }
    if (teamMembers.some((m) => m.userId === memberId)) {
      setError('Bu kişi zaten ekipte.')
      return
    }
    setTeamMembers((prev) => [...prev, { userId: memberId, role: memberRole }])
    setMemberId('')
    setError(null)
  }

  const removeTeamMember = (userId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.userId !== userId))
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

    if (!developerId) {
      setError('Bir geliştirici seçmelisin.')
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

    // Geliştirici/yönetici üyelikleri trigger ile eklendi; ek ekip üyeleri burada eklenir.
    if (teamMembers.length > 0) {
      const { error: memberError } = await supabase.from('project_members').upsert(
        teamMembers.map((m) => ({
          project_id: project.id,
          user_id: m.userId,
          member_role: m.role,
        })),
        { onConflict: 'project_id,user_id', ignoreDuplicates: true },
      )
      if (memberError) {
        setSubmitting(false)
        setError(`Talep oluştu ama ekip üyeleri eklenemedi: ${memberError.message}`)
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
            <PersonPicker
              inputId="developer"
              people={people}
              value={developerId}
              onChange={setDeveloperId}
            />
          </div>

          <div>
            <label htmlFor="manager" className="block text-sm font-medium text-gray-700">
              Yönetici
            </label>
            <PersonPicker
              inputId="manager"
              people={people}
              value={managerId}
              onChange={setManagerId}
              placeholder="İsteğe bağlı — isim/e-posta yaz…"
            />
          </div>
        </div>

        <fieldset className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Ekip üyeleri (kayıtlı kullanıcılar)
          </legend>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <PersonPicker
                people={people}
                value={memberId}
                onChange={setMemberId}
                excludeIds={teamMembers.map((m) => m.userId)}
              />
            </div>
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as MemberRole)}
              className="mt-1 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Kişinin rolü"
            >
              <option value="testci">{ROLE_LABELS.testci}</option>
              <option value="gelistirici">{ROLE_LABELS.gelistirici}</option>
              <option value="yonetici">{ROLE_LABELS.yonetici}</option>
            </select>
            <button
              type="button"
              onClick={addTeamMember}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Ekle
            </button>
          </div>

          {teamMembers.length > 0 && (
            <ul className="mt-3 space-y-1">
              {teamMembers.map((m) => {
                const person = people.find((p) => p.id === m.userId)
                return (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-gray-700">
                      {person?.name ?? 'Bilinmeyen kişi'}
                      <span className="ml-2 text-xs text-gray-400">
                        {ROLE_LABELS[m.role]}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTeamMember(m.userId)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Kaldır
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Yukarıda seçtiğin geliştirici ve yönetici otomatik eklenir; buradan testçi
            veya ek geliştirici/yönetici ekleyebilirsin.
          </p>
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
