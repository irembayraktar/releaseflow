import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function ProtectedLayout() {
  const { session, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Yükleniyor…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/giris" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-gray-900">ReleaseFlow</span>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Çıkış yap
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            {/* Sıradaki ekranlar: /yeni-talep ve /is/:id */}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
