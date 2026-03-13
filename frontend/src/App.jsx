import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import SidebarLayout from './components/SidebarLayout';
import Library from './pages/Library';
import Events from './pages/Events';
import LiveView from './pages/LiveView';
import MobileScan from './pages/MobileScan';
import ScannerPage from './pages/ScannerPage';
import Dashboard from './pages/Dashboard';
import PresentationScreen from './pages/PresentationScreen';
import Login from './pages/Login';

// ✅ Định nghĩa NGOÀI App — reference ổn định, không bị unmount/remount khi App re-render
function ProtectedLayout({ children }) {
  const { logout } = useAuthContext();
  return <SidebarLayout onLogout={logout}>{children}</SidebarLayout>;
}

// ✅ Dùng useAuthContext — lấy state từ AuthProvider dùng chung, không tạo instance mới
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5', padding: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#666', fontSize: 'clamp(13px, 3vw, 15px)' }}>Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <Routes>
            {/* Public routes — không cần đăng nhập */}
            <Route path="/login" element={<Login />} />
            <Route path="/scan" element={<MobileScan />} />
            {/* BUG9 FIX: /scanner cần auth vì gọi api.getActiveSession() có token */}
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/" element={<Navigate to="/events" replace />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><ProtectedLayout><Dashboard /></ProtectedLayout></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><ProtectedLayout><Library /></ProtectedLayout></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><ProtectedLayout><Events /></ProtectedLayout></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><ProtectedLayout><LiveView /></ProtectedLayout></ProtectedRoute>} />
            <Route path="/presentation" element={<ProtectedRoute><ProtectedLayout><PresentationScreen /></ProtectedLayout></ProtectedRoute>} />
            <Route path="/reports" element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <div className="p-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Báo cáo</h1>
                    <p className="text-slate-500">Tính năng đang phát triển.</p>
                  </div>
                </ProtectedLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/events" replace />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;