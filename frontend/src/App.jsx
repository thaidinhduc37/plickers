import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import SidebarLayout from './components/SidebarLayout';
import Library from './pages/Library';
import Events from './pages/Events';
import LiveView from './pages/LiveView';
import MobileScan from './pages/MobileScan';
import ScannerPage from './pages/ScannerPage';
import Dashboard from './pages/Dashboard';
import PresentationScreen from './pages/PresentationScreen';

function App() {
  return (
    <Router>
      <Routes>
        {/* Trang quét thẻ học sinh (mobile học sinh) — không cần AppContext */}
        <Route path="/scan" element={<MobileScan />} />

        {/* Trang scanner cho BTC quét thẻ Plickers vật lý — không cần AppContext */}
        <Route path="/scanner" element={<ScannerPage />} />

        {/* Toàn bộ app BTC cần AppContext */}
        <Route path="*" element={
          <AppProvider>
            <Routes>
              <Route element={<SidebarLayout />}>
                <Route path="/" element={<Navigate to="/events" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/library" element={<Library />} />
                <Route path="/events" element={<Events />} />
                <Route path="/live" element={<LiveView />} />
                <Route path="/presentation" element={<PresentationScreen />} />
                <Route path="/reports" element={
                  <div className="p-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Báo cáo</h1>
                    <p className="text-slate-500">Tính năng đang phát triển.</p>
                  </div>
                } />
              </Route>
            </Routes>
          </AppProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;
