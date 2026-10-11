import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { updateFavicon } from '../utils/favicon';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

interface MenuSection {
  section: string;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    section: '概览',
    items: [
      {
        to: '/admin',
        end: true,
        label: '数据概览',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    section: '内容管理',
    items: [
      {
        to: '/admin/posts',
        label: '文章管理',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        to: '/admin/categories',
        label: '分类管理',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        to: '/admin/tags',
        label: '标签管理',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        ),
      },
      {
        to: '/admin/oss-images',
        label: '图片库',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        ),
      },
    ],
  },
  {
    section: '系统',
    items: [
      {
        to: '/admin/settings',
        label: '系统设置',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
        ),
      },
      {
        to: '/admin/ai-settings',
        label: 'AI 设置',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L13 14h-2l.25-4.07A4.002 4.002 0 0 1 12 2z" />
            <circle cx="12" cy="18" r="2" />
            <path d="M6 10H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 10h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
          </svg>
        ),
      },
      {
        to: '/admin/backups',
        label: '备份中心',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
      },
      {
        to: '/admin/password',
        label: '修改密码',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
      },
    ],
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('blog_token');
    return !token;
  });
  const [blogTitle, setBlogTitle] = useState(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.website_title || 'AeroNote';
      }
    } catch { }
    return 'AeroNote';
  });
  const [avatar, setAvatar] = useState(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.website_avatar || '';
      }
    } catch { }
    return '';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const token = localStorage.getItem('blog_token');
    if (!token) {
      navigate('/login');
    } else {
      setLoading(false);
      api.getConfig().then(data => {
        if (data) {
          if (data.website_title) setBlogTitle(data.website_title);
          if (data.website_avatar) setAvatar(data.website_avatar);
          if (data.website_icon) updateFavicon(data.website_icon);
        }
      }).catch(console.error);
    }
  }, [navigate]);

  useEffect(() => {
    const path = location.pathname;
    let pageTitle = '后台管理';
    if (path === '/admin') pageTitle = '数据概览';
    else if (path === '/admin/posts') pageTitle = '文章管理';
    else if (path === '/admin/posts/new') pageTitle = '新建文章';
    else if (path.startsWith('/admin/posts/edit/')) pageTitle = '编辑文章';
    else if (path === '/admin/categories') pageTitle = '分类管理';
    else if (path === '/admin/tags') pageTitle = '标签管理';
    else if (path === '/admin/oss-images') pageTitle = '图片库管理';
    else if (path === '/admin/settings') pageTitle = '系统设置';
    else if (path === '/admin/ai-settings') pageTitle = 'AI 设置';
    else if (path === '/admin/password') pageTitle = '修改密码';
    document.title = `${pageTitle} - 后台管理`;
  }, [location.pathname]);

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="admin-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="admin-loading">
          <div className="admin-loading-dots">
            <span className="admin-loading-dot" />
            <span className="admin-loading-dot" />
            <span className="admin-loading-dot" />
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--admin-text-2)' }}>验证身份中...</p>
        </div>
      </div>
    );
  }

  const username = localStorage.getItem('blog_username') || 'Admin';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="admin-wrapper">
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          {/* Brand */}
          <div className="admin-brand">
            <div className="admin-brand-logo">
              <div className="admin-brand-icon">⚙️</div>
              <div className="admin-brand-title">管理控制台</div>
            </div>
            <div className="admin-brand-user">
              <div className="admin-brand-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                {avatar ? (
                  <img
                    src={avatar}
                    alt={username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  initial
                )}
              </div>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {username}
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderRadius: '20px' }}>
                管理员
              </span>
            </div>
          </div>

          {/* Menu */}
          <ul className="admin-menu">
            {menuItems.map((section) => (
              <React.Fragment key={section.section}>
                <div className="admin-menu-section-label">{section.section}</div>
                {section.items.map((item) => (
                  <li key={item.to} className="admin-menu-item">
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => isActive ? 'active' : ''}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </React.Fragment>
            ))}
          </ul>

          {/* Footer */}
          <div className="admin-sidebar-footer">
            <button
              type="button"
              onClick={toggleTheme}
              className="admin-sidebar-footer-btn"
              title="切换后台色彩模式"
            >
              <span className="menu-icon">
                {theme === 'light' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </span>
              {theme === 'light' ? '切换为暗色' : '切换为浅色'}
            </button>
            <Link to="/" className="admin-sidebar-footer-btn">
              <span className="menu-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              返回主页
            </Link>
            <button onClick={handleLogout} className="admin-sidebar-footer-btn">
              <span className="menu-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              退出登录
            </button>
            <div className="admin-sidebar-copyright">
              © 2005-2026 {blogTitle}
              <div style={{ marginTop: '0.25rem' }}>v1.1.0 · Build 20260714</div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
};
