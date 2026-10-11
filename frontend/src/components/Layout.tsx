import React, { useEffect, useState, useRef, useTransition } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import type { Post } from '../utils/api';
import { updateFavicon } from '../utils/favicon';
import {
  IconHome,
  IconArchive,
  IconFolder,
  IconTag,
  IconUser,
  IconSearch,
  IconSun,
  IconMoon,
  IconFeather,
  IconClose,
  IconMenu,
  IconArrowRight,
  IconCalendar,
  IconBookOpen,
} from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  hero?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, hero }) => {
  const [config, setConfig] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  // Search Modal States
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getConfig().then(data => {
      setConfig(data);
      if (data.homepage_bg) {
        document.documentElement.style.setProperty('--hero-bg-image', `url("${data.homepage_bg}")`);
      }
    }).catch(console.error);

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 快捷键 Cmd+K / Ctrl+K 开启全局搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 动态 favicon 更新
  useEffect(() => {
    if (config.website_icon) {
      updateFavicon(config.website_icon);
    }
  }, [config.website_icon]);

  // 动态 SEO 搜索引擎元标签注入（支持后台一键开关禁止爬虫收录）
  useEffect(() => {
    // 检查 SEO 检索总开关：默认允许，若显式设为 'false' 或 '0' 则彻底禁止抓取
    const isSeoDisallowed = config.seo_enabled === 'false' || config.seo_enabled === '0';

    // 1. 处理 robots meta 标签
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }

    if (isSeoDisallowed) {
      // 彻底阻断收录：不允许索引页面、不允许跟踪链接、不建立快照
      robotsMeta.content = 'noindex, nofollow, noarchive, nosnippet';
    } else {
      robotsMeta.content = 'index, follow';
    }

    // 2. 处理 keywords meta 标签
    let keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
    if (!keywordsMeta) {
      keywordsMeta = document.createElement('meta');
      keywordsMeta.name = 'keywords';
      document.head.appendChild(keywordsMeta);
    }
    keywordsMeta.content = isSeoDisallowed ? '' : (config.website_keywords || '');

    // 3. 处理 description meta 标签
    let descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.name = 'description';
      document.head.appendChild(descMeta);
    }
    descMeta.content = isSeoDisallowed ? '' : (config.website_desc || '');
  }, [config.seo_enabled, config.website_keywords, config.website_desc]);

  // 全局动态网页标题更新
  useEffect(() => {
    const updateTitle = () => {
      const baseTitle = config.website_title || 'AeroNote';
      const currentTitle = document.title;
      if (currentTitle.endsWith(' - 后台管理') || currentTitle === '登录 - 后台管理') {
        return;
      }
      if (currentTitle.includes(' - ')) {
        const parts = currentTitle.split(' - ');
        const prefix = parts[0];
        const newTitle = `${prefix} - ${baseTitle}`;
        if (document.title !== newTitle) {
          document.title = newTitle;
        }
      } else {
        const newTitle = `${currentTitle} - ${baseTitle}`;
        if (document.title !== newTitle) {
          document.title = newTitle;
        }
      }
    };

    updateTitle();
    const timer = setTimeout(updateTitle, 60);
    return () => clearTimeout(timer);
  }, [config.website_title, children]);

  // Fetch all posts once when search is opened
  const handleOpenSearch = () => {
    setMobileMenuOpen(false);
    setShowSearch(true);
    setSearchQuery('');
    setSearchResults([]);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);

    if (allPosts.length === 0) {
      setLoadingSearch(true);
      api.getPosts({ per_page: 9999 })
        .then(data => {
          setAllPosts(data.posts);
          setLoadingSearch(false);
        })
        .catch(err => {
          console.error('Failed to load posts for search', err);
          setLoadingSearch(false);
        });
    }
  };

  // Handle Search Input Change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    startTransition(() => {
      const filtered = allPosts.filter(post =>
        post.title.toLowerCase().includes(query) ||
        (post.content && post.content.toLowerCase().includes(query)) ||
        (post.tags && post.tags.some(t => t.name.toLowerCase().includes(query))) ||
        (post.categories && post.categories.some(c => c.name.toLowerCase().includes(query)))
      );
      setSearchResults(filtered.slice(0, 10));
    });
  }, [searchQuery, allPosts]);

  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 路由变化时自动关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // 打开移动端抽屉时禁止背景滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Handle Close Search or Mobile Menu on Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        setMobileMenuOpen(false);
      }
    };
    if (showSearch || mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, mobileMenuOpen]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const siteTitle = config.website_title || '';
  const siteICP = config.website_icp || '';

  return (
    <div className="site-wrapper">
      {/* Modern Fixed Navbar */}
      <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <span className="brand-logo-wrap">
              {config.website_avatar ? (
                <img
                  src={config.website_avatar}
                  alt={siteTitle}
                  style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.brand-logo-fallback') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <span className="brand-logo-fallback" style={{ display: config.website_avatar ? 'none' : 'flex' }}>
                <IconFeather size={17} />
              </span>
            </span>
            <span className="brand-title">{siteTitle}</span>
          </Link>

          <div className="nav-right-group">
            <ul className="nav-links">
              <li>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <IconHome size={16} />
                  <span>首页</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/archives" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <IconArchive size={16} />
                  <span>归档</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <IconFolder size={16} />
                  <span>分类</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/tags" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <IconTag size={16} />
                  <span>标签</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <IconUser size={16} />
                  <span>关于</span>
                </NavLink>
              </li>
            </ul>

            <div className="nav-actions">
              {/* Search Trigger Button */}
              <button
                type="button"
                onClick={handleOpenSearch}
                className="nav-action-btn search-trigger-btn"
                title="搜索文章 (Ctrl + K / ⌘K)"
              >
                <IconSearch size={16} />
                <span className="search-shortcut">⌘K</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="nav-action-btn theme-toggle-btn"
                title={`切换为${theme === 'light' ? '暗色' : '浅色'}主题`}
              >
                {theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
              </button>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="nav-action-btn mobile-menu-btn"
                aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                title={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
              >
                {mobileMenuOpen ? <IconClose size={17} /> : <IconMenu size={17} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)} />
        <div className="mobile-nav-content">
          <div className="mobile-nav-header">
            <span className="mobile-nav-title">快速导航</span>
            <button
              type="button"
              className="mobile-nav-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="关闭"
            >
              <IconClose size={18} />
            </button>
          </div>
          <ul className="mobile-nav-list">
            <li>
              <NavLink to="/" end className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <span className="mobile-nav-icon"><IconHome size={18} /></span>
                <span className="mobile-nav-text">首页</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/archives" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <span className="mobile-nav-icon"><IconArchive size={18} /></span>
                <span className="mobile-nav-text">文章归档</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/categories" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <span className="mobile-nav-icon"><IconFolder size={18} /></span>
                <span className="mobile-nav-text">专题分类</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/tags" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <span className="mobile-nav-icon"><IconTag size={18} /></span>
                <span className="mobile-nav-text">标签聚合</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/about" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => setMobileMenuOpen(false)}>
                <span className="mobile-nav-icon"><IconUser size={18} /></span>
                <span className="mobile-nav-text">关于作者</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </div>

      {/* Hero Section if available */}
      {hero}

      {/* Page Body Container */}
      <main className={`page-body ${hero ? 'body-with-hero' : 'body-no-hero'}`}>
        {children}
      </main>

      {/* Modern Minimalist Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-logo">
                <IconFeather size={16} />
              </span>
              <span className="footer-site-name">{siteTitle}</span>
              <span className="footer-dot">·</span>
              <span className="footer-slogan">记录沉淀，散漫前行</span>
            </div>
            <div className="footer-links">
              <Link to="/archives">归档</Link>
              <Link to="/about">关于本站</Link>
              <Link to="/admin" className="footer-admin-link">控制台</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">
              © {new Date().getFullYear()} {siteTitle}. All rights reserved.
            </p>
            {siteICP && (
              <p className="footer-icp">
                <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
                  {siteICP}
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>

      {/* Spotlight Search Modal */}
      {showSearch && (
        <div className="spotlight-overlay" onClick={() => setShowSearch(false)}>
          <div className="spotlight-container" onClick={e => e.stopPropagation()}>
            <div className="spotlight-input-bar">
              <span className="spotlight-icon">
                <IconSearch size={18} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="键入关键词搜索文章内容、标签或分类..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="spotlight-input"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="spotlight-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="清空"
                >
                  <IconClose size={15} />
                </button>
              ) : (
                <kbd className="spotlight-kbd">ESC</kbd>
              )}
            </div>

            <div className="spotlight-body">
              {loadingSearch ? (
                <div className="spotlight-empty">正在加载全文索引...</div>
              ) : searchQuery.trim() ? (
                searchResults.length > 0 ? (
                  <ul className="spotlight-results">
                    {searchResults.map(post => (
                      <li key={post.id} className="spotlight-item">
                        <Link to={`/posts/${post.id}`} onClick={() => setShowSearch(false)}>
                          <div className="spotlight-item-header">
                            <h4 className="spotlight-item-title">{post.title}</h4>
                            <span className="spotlight-item-arrow">
                              <IconArrowRight size={14} />
                            </span>
                          </div>
                          {(post.summary || post.meta_description) && (
                            <p className="spotlight-item-desc">{post.summary || post.meta_description}</p>
                          )}
                          <div className="spotlight-item-meta">
                            <span className="spotlight-meta-date">
                              <IconCalendar size={13} />
                              {new Date(post.create_time).toLocaleDateString('zh-CN')}
                            </span>
                            {post.categories && post.categories.length > 0 && (
                              <span className="spotlight-meta-cat">
                                <IconFolder size={13} />
                                {post.categories[0].name}
                              </span>
                            )}
                            <span className="spotlight-meta-read">
                              <IconBookOpen size={13} />
                              约 {Math.max(1, Math.ceil((post.content?.length || 0) / 600))} 分钟
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="spotlight-empty">未搜索到与 “{searchQuery}” 匹配的内容</div>
                )
              ) : (
                <div className="spotlight-tip">
                  支持按文章标题、正文内容、标签分类快速检索
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
