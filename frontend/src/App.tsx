import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/Layout/AppLayout'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import Login from './pages/Login'
import Chat from './pages/Chat'
import DataSources from './pages/DataSources'
import History from './pages/History'
import Tools from './pages/Tools'
import Admin from './pages/Admin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-apple-gray-200 border-t-apple-black rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-apple-gray-200 border-t-apple-black rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Chat />} />
        <Route path="/data-sources" element={<DataSources />} />
        <Route path="/history" element={<History />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <PWAInstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
