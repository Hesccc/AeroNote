import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { IconFeather, IconArrowLeft } from '../components/Icons';

export const LoginCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在与身份中心完成安全校验...');
  const [subMessage, setSubMessage] = useState('请稍候，正在验证 State / Nonce 防护令牌并匹配管理员账号');
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    document.title = 'OIDC 鉴权处理中 - AeroNote';

    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // 1. 如果后端直接重定向返回了错误
    if (error) {
      setStatus('error');
      setMessage('OIDC 认证失败');
      setSubMessage(decodeURIComponent(error));
      return;
    }

    // 2. 如果后端 GET 回调已处理完成并重定向带回了 Token
    if (token) {
      localStorage.setItem('blog_token', token);
      setStatus('success');
      setMessage('登录成功！');
      setSubMessage('已完成管理员身份鉴权，正在进入控制台...');
      const timer = setTimeout(() => navigate('/admin'), 1000);
      return () => clearTimeout(timer);
    }

    // 3. 如果携带了授权码 code 和防篡改 state，向后端发起安全兑换
    if (code && state) {
      const redirectUri = `${window.location.origin}/login/callback`;
      api.oidcCallback({
        code,
        state,
        redirect_uri: redirectUri,
      })
        .then(res => {
          if (res.token) {
            localStorage.setItem('blog_token', res.token);
            setStatus('success');
            setMessage('登录成功！');
            setSubMessage(`已成功映射并登入管理员账号 [${res.username}]，正在进入控制台...`);
            setTimeout(() => navigate('/admin'), 1200);
          } else {
            throw new Error('未返回有效的系统访问令牌');
          }
        })
        .catch(err => {
          setStatus('error');
          setMessage('OIDC 鉴权未通过');
          setSubMessage((err as Error).message || 'State 校验失败、Token 兑换错误或该账号未与管理员绑定');
        });
      return;
    }

    // 4. 缺失必要参数
    setStatus('error');
    setMessage('参数缺失');
    setSubMessage('未在回调地址中检测到有效的授权码 (code) 或凭据');
  }, [searchParams, navigate]);

  return (
    <div className="login-modern-viewport">
      <div className="login-ambient-glow" />

      <div className="login-panel-card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div className="login-brand-badge" style={{ margin: '0 auto 1.25rem' }}>
          <IconFeather size={22} />
        </div>

        {status === 'loading' && (
          <div>
            <div
              className="login-spin"
              style={{
                width: 38,
                height: 38,
                borderWidth: 3,
                borderColor: 'var(--border-color)',
                borderTopColor: 'var(--color-primary, #10b981)',
                margin: '1.5rem auto 1.25rem',
              }}
            />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
              {message}
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {subMessage}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-primary, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1rem auto 1.25rem',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
              {message}
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {subMessage}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1rem auto 1.25rem',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem' }}>
              {message}
            </h2>
            <div
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-color)',
                lineHeight: 1.6,
                padding: '0.85rem 1rem',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                textAlign: 'left',
                margin: '1rem 0 1.5rem',
                wordBreak: 'break-word',
              }}
            >
              {subMessage}
            </div>

            <Link
              to="/login"
              className="admin-btn admin-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <IconArrowLeft size={15} />
              <span>返回登录页重试</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
