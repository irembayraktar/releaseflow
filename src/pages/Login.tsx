import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

// Supabase auth hatalarını kullanıcının anlayacağı dile çevirir.
function authError(message: string): string {
  if (message.includes('Invalid login credentials'))
    return 'E-posta veya şifre hatalı. Her hesabın kendi şifresi olduğunu unutma; bu adres için belirlediğin şifreyi kullan.'
  if (message.includes('Email not confirmed'))
    return 'Bu hesap henüz onaylanmamış. Yöneticiye başvur veya kayıt ayarlarını kontrol et.'
  if (message.toLowerCase().includes('rate limit'))
    return 'Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar dene.'
  if (message.includes('already registered'))
    return 'Bu e-posta zaten kayıtlı. "Giriş yap" sekmesinden şifrenle girebilirsin.'
  if (message.includes('Password should be'))
    return 'Şifre en az 8 karakter olmalı.'
  return message
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // Boşluk ve büyük harf farkları giriş sorunlarına yol açmasın.
    const cleanEmail = email.trim().toLowerCase()

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        : await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { name: name.trim() } },
          })

    setSubmitting(false)

    if (result.error) {
      setError(authError(result.error.message))
      return
    }

    navigate('/')
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-violet-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <Logo size={56} />
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">ReleaseFlow</h1>
          <p className="mt-1 text-sm text-gray-500">
            İş talebi, test ve canlıya alma takibi
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 bg-white/90 backdrop-blur rounded-2xl border border-indigo-100 p-6 space-y-4 shadow-lg shadow-indigo-100"
        >
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Ad Soyad
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              İş e-postası
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="ornek@sirket.com"
            />
            <p className="mt-1 text-xs text-gray-400">
              Daha önce giriş yaptığın adresleri tarayıcın önerir.
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Şifre
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 mt-1 px-3 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? 'Gizle' : 'Göster'}
              </button>
            </div>
            {mode === 'register' && (
              <p className="mt-1 text-xs text-gray-400">En az 8 karakter.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Gönderiliyor…' : mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
            className="w-full text-sm text-indigo-600 hover:underline"
          >
            {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
