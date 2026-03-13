import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, loading: authLoading, login } = useAuthContext();

    useEffect(() => {
        if (!authLoading && isAuthenticated)
            navigate(location.state?.from?.pathname || '/events', { replace: true });
    }, [isAuthenticated, authLoading]);

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try { await login(username, password); }
        catch (err) { setError(err.message || 'Thông tin đăng nhập không chính xác'); setLoading(false); }
    };

    return (
        <>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
            @keyframes spin { to { transform: rotate(360deg); } }

            body { margin: 0; }

            .rcv-page {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
                font-family: 'Be Vietnam Pro', sans-serif;
                background: linear-gradient(140deg, #004d44 0%, #006b5a 30%, #008c72 60%, #005f52 100%);
            }

            /* Hoa văn trống đồng — absolute center, rất to */
            .rcv-drum {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(180vw, 180vh);
                height: min(180vw, 180vh);
                object-fit: contain;
                opacity: 0.12;
                pointer-events: none;
                z-index: 0;
            }

            /* Dot pattern */
            .rcv-dots {
                position: absolute; inset: 0; z-index: 0; pointer-events: none;
                background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
                background-size: 28px 28px;
            }

            /* Glow top-left */
            .rcv-glow {
                position: absolute; top: -20%; left: 20%;
                width: 50vw; height: 50vw;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,200,140,0.2) 0%, transparent 60%);
                pointer-events: none; z-index: 0;
            }

            /* Content wrapper */
            .rcv-content {
                position: relative; z-index: 1;
                width: 100%; max-width: 1100px;
                margin: 0 auto;
                padding: 48px 40px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 60px;
            }

            /* LEFT */
            .rcv-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 0;
            }

            .rcv-seal {
                width: 120px;
                height: 120px;
                object-fit: contain;
                margin-bottom: 28px;
                filter: drop-shadow(0 4px 24px rgba(0,0,0,0.4));
            }

            .rcv-title-main {
                font-size: clamp(28px, 3vw, 44px);
                font-weight: 900;
                letter-spacing: 0.02em;
                text-transform: uppercase;
                color: #ffd700;
                text-shadow: 0 2px 16px rgba(255,210,0,0.5), 0 4px 32px rgba(0,0,0,0.5);
                line-height: 1.2;
                margin-bottom: 10px;
                white-space: nowrap;
            }

            .rcv-title-sub {
                font-size: clamp(13px, 1.3vw, 16px);
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: #ffd700;
                opacity: 0.75;
                margin-bottom: 24px;
            }

            .rcv-divider {
                width: 60%;
                height: 1px;
                background: rgba(255,255,255,0.2);
                margin-bottom: 20px;
            }

            .rcv-tagline {
                font-size: 15px;
                font-weight: 600;
                color: rgba(255,255,255,0.8);
                margin-bottom: 12px;
            }

            .rcv-desc {
                font-size: 13px;
                color: rgba(255,255,255,0.55);
                line-height: 1.7;
                max-width: 340px;
                text-align: center;
                margin-bottom: 28px;
            }

            .rcv-dots-row {
                display: flex; gap: 8px; align-items: center;
            }
            .rcv-dot-item {
                width: 8px; height: 8px; border-radius: 50%;
            }

            /* RIGHT — form */
            .rcv-form-wrap {
                width: 400px;
                flex-shrink: 0;
            }

            .rcv-card {
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 20px;
                padding: 40px 36px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            }

            .rcv-card-title {
                font-size: 26px; font-weight: 800; color: #fff;
                text-align: center; margin-bottom: 6px;
            }
            .rcv-card-sub {
                font-size: 13px; color: rgba(255,255,255,0.5);
                text-align: center; margin-bottom: 28px;
            }

            .rcv-error {
                margin-bottom: 16px;
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 13px; font-weight: 500;
                color: #fca5a5;
                background: rgba(220,38,38,0.2);
                border: 1px solid rgba(220,38,38,0.35);
            }

            .rcv-field { margin-bottom: 18px; }
            .rcv-label {
                display: block;
                font-size: 12px; font-weight: 600;
                color: rgba(255,255,255,0.7);
                margin-bottom: 8px;
                letter-spacing: 0.03em;
            }
            .rcv-input-wrap { position: relative; }
            .rcv-icon {
                position: absolute; left: 13px; top: 50%;
                transform: translateY(-50%);
                width: 16px; height: 16px;
                color: rgba(255,255,255,0.4);
                pointer-events: none;
            }
            .rcv-input {
                width: 100%;
                background: rgba(255,255,255,0.12);
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 10px;
                padding: 12px 16px 12px 42px;
                color: #fff;
                font-size: 14px;
                font-family: inherit;
                transition: all 0.18s;
            }
            .rcv-input:focus {
                outline: none;
                border-color: rgba(255,255,255,0.55);
                background: rgba(255,255,255,0.18);
                box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
            }
            .rcv-input::placeholder { color: rgba(255,255,255,0.35); }
            .rcv-input-pr { padding-right: 44px; }

            .rcv-eye-btn {
                position: absolute; right: 13px; top: 50%;
                transform: translateY(-50%);
                background: none; border: none; cursor: pointer; padding: 0;
                color: rgba(255,255,255,0.4); display: flex;
                transition: color 0.15s;
            }
            .rcv-eye-btn:hover { color: rgba(255,255,255,0.75); }

            .rcv-submit {
                width: 100%;
                margin-top: 8px;
                padding: 13px;
                border-radius: 10px;
                border: none;
                background: linear-gradient(135deg, #00c9a7 0%, #00a88c 100%);
                color: #fff;
                font-size: 15px; font-weight: 700;
                font-family: inherit;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                box-shadow: 0 6px 20px rgba(0,180,140,0.45);
                transition: all 0.18s;
            }
            .rcv-submit:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
            .rcv-submit:active:not(:disabled) { transform: translateY(0); }
            .rcv-submit:disabled { opacity: 0.6; cursor: not-allowed; }

            .rcv-spinner {
                width: 20px; height: 20px;
                border: 2.5px solid rgba(255,255,255,0.3);
                border-top-color: #fff; border-radius: 50%;
                animation: spin 0.75s linear infinite;
            }

            .rcv-dev {
                margin-top: 16px; padding: 10px 14px; border-radius: 10px;
                font-size: 12px; text-align: center; font-weight: 500;
                color: #ffd700;
                background: rgba(255,210,0,0.12);
                border: 1px solid rgba(255,210,0,0.3);
            }

            .rcv-copyright {
                text-align: center; margin-top: 16px;
                font-size: 12px; color: rgba(255,255,255,0.3);
            }

            @media (max-width: 768px) {
                .rcv-content {
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 32px 20px;
                    gap: 28px;
                    min-height: 100vh;
                }

                .rcv-left {
                    gap: 0;
                }

                .rcv-seal {
                    width: 72px;
                    height: 72px;
                    margin-bottom: 14px;
                }

                .rcv-title-main {
                    font-size: clamp(20px, 6vw, 28px);
                    white-space: normal;
                    text-align: center;
                }

                .rcv-title-sub {
                    font-size: 12px;
                    margin-bottom: 14px;
                }

                .rcv-divider {
                    margin-bottom: 12px;
                }

                .rcv-tagline {
                    font-size: 13px;
                    margin-bottom: 8px;
                }

                .rcv-desc {
                    font-size: 12px;
                    margin-bottom: 16px;
                    max-width: 300px;
                }

                .rcv-form-wrap {
                    width: 100%;
                    max-width: 420px;
                }

                .rcv-card {
                    padding: 28px 22px;
                }
            }

            @media (max-width: 400px) {
                .rcv-card {
                    padding: 24px 16px;
                    border-radius: 16px;
                }

                .rcv-card-title {
                    font-size: 22px;
                }
            }
        `}</style>

        <div className="rcv-page">
            {/* Hoa văn trống đồng chính giữa */}
            <img src="/images/trong-dong.png" alt="" className="rcv-drum" />

            {/* Texture */}
            <div className="rcv-dots" />
            <div className="rcv-glow" />

            <div className="rcv-content">

                {/* ── LEFT: Logo + tiêu đề vàng ── */}
                <div className="rcv-left">
                    <img src="/images/cong-an-hieu.png" alt="Huy hiệu Công An" className="rcv-seal" />

                    <div className="rcv-title-main">RUNG CHUÔNG VÀNG</div>
                    <div className="rcv-title-sub">Hệ thống thi trắc nghiệm</div>

                    <div className="rcv-divider" />

                    <div className="rcv-tagline">Công An Tỉnh Đắk Lắk</div>
                    <p className="rcv-desc">
                        Nền tảng thi trắc nghiệm tương tác thời gian thực, hỗ trợ đến 100 thí sinh với công nghệ quét thẻ quang học PCARD.
                    </p>

                    <div className="rcv-dots-row">
                        {[true, true, false, false, false].map((active, i) => (
                            <span key={i} className="rcv-dot-item"
                                style={{ background: active ? '#ffd700' : 'rgba(255,255,255,0.25)' }} />
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: Form glass ── */}
                <div className="rcv-form-wrap">
                    <div className="rcv-card">
                        <div className="rcv-card-title">Đăng nhập</div>
                        <div className="rcv-card-sub">Hệ thống Rung Chuông Vàng</div>

                        {error && <div className="rcv-error">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="rcv-field">
                                <label className="rcv-label">Tên đăng nhập</label>
                                <div className="rcv-input-wrap">
                                    <User className="rcv-icon" />
                                    <input className="rcv-input" type="text"
                                        value={username} onChange={e => setUsername(e.target.value)}
                                        placeholder="Nhập tên đăng nhập" required />
                                </div>
                            </div>

                            <div className="rcv-field">
                                <label className="rcv-label">Mật khẩu</label>
                                <div className="rcv-input-wrap">
                                    <Lock className="rcv-icon" />
                                    <input className="rcv-input rcv-input-pr"
                                        type={showPass ? 'text' : 'password'}
                                        value={password} onChange={e => setPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu" required />
                                    <button type="button" className="rcv-eye-btn" onClick={() => setShowPass(!showPass)}>
                                        {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="rcv-submit">
                                {loading ? <span className="rcv-spinner" /> : 'Đăng nhập'}
                            </button>
                        </form>

                        {import.meta.env.VITE_AUTO_LOGIN === 'true' && (
                            <div className="rcv-dev"><strong>Dev Mode:</strong> Auto-login is enabled.</div>
                        )}
                    </div>

                    <p className="rcv-copyright">© Phòng Tham mưu — Công an tỉnh Đắk Lắk</p>
                </div>
            </div>
        </div>
        </>
    );
}