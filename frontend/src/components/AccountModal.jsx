import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { api } from '../api/client';
import { User, Lock, X, Check, AlertCircle } from 'lucide-react';

export default function AccountModal({ isOpen, onClose }) {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'password'
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('info');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await api.changePassword(oldPassword, newPassword);
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Switch back to info or stay? Let's stay for feedback, then close
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h3 className="text-base font-semibold text-slate-800">Tài khoản cá nhân</h3>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/30">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'info' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" /> Thông tin
            </span>
            {activeTab === 'info' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'password' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Đổi mật khẩu
            </span>
            {activeTab === 'password' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 min-h-[350px] flex flex-col justify-start overflow-hidden">
          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'info' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium text-slate-500">Tên người dùng</span>
                  <span className="col-span-2 text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
                    {user?.username}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium text-slate-500">Vai trò</span>
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Administrator
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium text-slate-500">Truy cập</span>
                  <span className="col-span-2 text-sm text-slate-600 italic">
                    Mạng nội bộ (Local Network)
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm font-medium text-slate-500">Mật khẩu cũ</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="col-span-2 h-10 px-3 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm font-medium text-slate-500">Mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="col-span-2 h-10 px-3 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm font-medium text-slate-500">Xác nhận</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="col-span-2 h-10 px-3 text-sm bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md text-sm border border-green-100">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Đổi mật khẩu thành công!</span>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className="h-10 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading || success}
                    className={`h-10 px-6 bg-blue-600 text-white text-sm font-semibold rounded shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Đổi mật khẩu'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer info (Optional) */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          <span>Vui lòng giữ mật khẩu của bạn an toàn. Bạn có thể thay đổi nó bất cứ lúc nào.</span>
        </div>
      </div>
    </div>
  );
}
