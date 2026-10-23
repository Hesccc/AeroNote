import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { IconFeather, IconArrowLeft } from '../components/Icons';
import { updateFavicon } from '../utils/favicon';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteTitle, setSiteTitle] = useState('AeroNote');
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcButtonText, setOidcButtonText] = useState('使用 OIDC 单点登录');
  const [oidcLoading, setOidcLoading] = useState(false);

  useEffect(() => {
    document.title = '控制台登录 - AeroNote';
    if (localStorage.getItem('blog_token')) {
      navigate('/admin');
    }
    api.getConfig().then(cfg => {
      if (cfg) {
        if (cfg.website_title) setSiteTitle(cfg.website_title);
        if (cfg.website_icon) updateFavicon(cfg.website_icon);
      }
    }).catch(console.error);

    // 查询 OIDC 登录开启状态
    api.getOidcStatus().then(status => {
      if (status && status.enabled) {
        setOidcEnabled(true);
        if (status.button_text) setOidcButtonText(status.button_text);
      }
    }).catch(console.error);
  }, [navigate]);

  const handleOidcLogin = async () => {
    setOidcLoading(true);
    setError('');
    try {
      const callbackUri = `${window.location.origin}/login/callback`;
      const res = await api.getOidcAuthUrl(callbackUri);
      if (res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        throw new Error('未获取到有效的 OIDC 授权地址');
      }
    } catch (err: unknown) {
      setError((err as Error).message || '发起 OIDC 登录失败，请检查服务配置');
      setOidcLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('请输入管理员用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await api.login(username.trim(), password);
      navigate('/admin');
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败，请检查用户名或密码');
      setLoading(false);
    }
  };

  return (
    <div className="login-modern-viewport">
      {/* Dynamic ambient gradient glow in dark */}
      <div className="login-ambient-glow" />

      <div className="login-panel-card">
        {/* Header with geometric brand icon */}
        <div className="login-panel-header">
          <div className="login-brand-badge">
            <IconFeather size={22} />
          </div>
          <h1 className="login-title">控制台鉴权</h1>
          <p className="login-subtitle">
            {siteTitle} · 个人数字空间运维与创作后台
          </p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <label className="login-field-label">账号名</label>
            <div className="login-input-wrapper">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-prefix-icon">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="login-input"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-field-label">密码</label>
            <div className="login-input-wrapper">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-prefix-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入登录凭证"
                className="login-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || oidcLoading}
            className="login-submit-btn"
          >
            {loading ? (
              <>
                <span className="login-spin" />
                <span>正在验证凭证...</span>
              </>
            ) : (
              <span>登 录 控 制 台</span>
            )}
          </button>
        </form>

        {oidcEnabled && (
          <div style={{ marginTop: '0.25rem' }}>
            <div className="login-divider">
              <span>或通过单点登录认证</span>
            </div>
            <button
              type="button"
              onClick={handleOidcLogin}
              disabled={loading || oidcLoading}
              className="login-oidc-btn"
            >
              {oidcLoading ? (
                <>
                  <span className="login-spin" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--text-color)' }} />
                  <span>正在跳转到身份中心...</span>
                </>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <circle cx="12" cy="11" r="3" />
                  </svg>
                  <span>{oidcButtonText}</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="login-footer-nav">
          <Link to="/" className="login-back-link">
            <IconArrowLeft size={14} />
            <span>返回前台主页</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
