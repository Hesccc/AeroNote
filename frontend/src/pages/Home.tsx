import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import type { Post, Category, Tag } from '../utils/api';
import { Layout } from '../components/Layout';
import { PostCard } from '../components/PostCard';
import { IconFolder, IconTag, IconClose, IconBookOpen } from '../components/Icons';
import { ScrollNav } from '../components/ScrollNav';

export const Home: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const tag = searchParams.get('tag') || '';
  const search = searchParams.get('search') || '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [siteTitle, setSiteTitle] = useState(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      if (cached) return JSON.parse(cached).website_title || '';
    } catch {}
    return '';
  });

  const [siteSubtitle, setSiteSubtitle] = useState(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      if (cached) return JSON.parse(cached).homepage_subtitle || '';
    } catch {}
    return '';
  });

  const [homepageBg, setHomepageBg] = useState(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      if (cached) return JSON.parse(cached).homepage_bg || '';
    } catch {}
    return '';
  });

  // 底部触发监听节点
  const observerTarget = useRef<HTMLDivElement>(null);

  // 初始化基础配置与分类
  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    api.getTags().then(setTags).catch(console.error);
    api.getConfig().then(cfg => {
      if (cfg.website_title) setSiteTitle(cfg.website_title);
      if (cfg.homepage_subtitle) setSiteSubtitle(cfg.homepage_subtitle);
      if (cfg.homepage_bg !== undefined) setHomepageBg(cfg.homepage_bg || '');
      localStorage.setItem('blog_config', JSON.stringify(cfg));
    }).catch(console.error);
    document.title = '首页 - AeroNote';
  }, []);

  // 筛选条件变化时，重置文章列表并重新拉取第一页
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');
    setPage(1);

    api.getPosts({ page: 1, per_page: 8, category, tag, search })
      .then(data => {
        if (isCancelled) return;
        setPosts(data.posts);
        setTotal(data.total);
        setHasMore(data.has_next);
        setLoading(false);
      })
      .catch(err => {
        if (isCancelled) return;
        setError(err.message || '加载文章失败');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [category, tag, search]);

  // 加载更多文章（下一页追加）
  const loadMorePosts = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    api.getPosts({ page: nextPage, per_page: 8, category, tag, search })
      .then(data => {
        setPosts(prev => {
          const existingIds = new Set(prev.map((p: Post) => p.id));
          const newItems = data.posts.filter((p: Post) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
        setPage(nextPage);
        setHasMore(data.has_next);
        setLoadingMore(false);
      })
      .catch(err => {
        console.error('加载更多文章失败:', err);
        setLoadingMore(false);
      });
  }, [loading, loadingMore, hasMore, page, category, tag, search]);

  // 滚动触底监听 (IntersectionObserver)
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMorePosts();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMorePosts, hasMore, loading, loadingMore]);

  const clearFilter = () => {
    setSearchParams(new URLSearchParams());
  };

  // Modern Clean Hero (Supports custom background image or minimalist gradient)
  const homeHero = (
    <header
      className={`home-hero ${homepageBg ? 'with-custom-bg' : ''}`}
      style={homepageBg ? { backgroundImage: `url("${homepageBg}")` } : undefined}
    >
      {homepageBg && <div className="home-hero-bg-overlay" />}
      {homepageBg && <div className="home-hero-feather-fade" />}

      <div className="home-hero-inner">
        <div className="home-hero-badge">
          <span className="badge-dot" />
          <span>DIGITAL GARDEN & NOTES</span>
        </div>
        <h1 className="home-hero-title">{siteTitle}</h1>
        <p className="home-hero-subtitle">{siteSubtitle}</p>

        {/* Quick Topics Pill Bar */}
        {categories.length > 0 && (
          <div className="home-topics-bar">
            <button
              type="button"
              className={`topic-pill ${!category ? 'active' : ''}`}
              onClick={clearFilter}
            >
              全部文章
            </button>
            {categories.slice(0, 6).map(c => (
              <button
                type="button"
                key={c.id}
                className={`topic-pill ${category === c.slug ? 'active' : ''}`}
                onClick={() => {
                  const np = new URLSearchParams(searchParams);
                  np.set('category', c.slug);
                  setSearchParams(np);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );

  return (
    <Layout hero={homeHero}>
      {/* 右侧上/下滚动导航按钮（滚动后显示） */}
      <ScrollNav />

      <div className="home-content-container">
        {/* Active Filter Bar */}
        {(search || category || tag) && (
          <div className="filter-status-bar">
            <div className="filter-status-left">
              <span className="filter-label">当前筛选：</span>
              {search && (
                <span className="filter-tag">
                  关键词: “{search}”
                </span>
              )}
              {category && (
                <span className="filter-tag">
                  <IconFolder size={12} />
                  {categories.find(c => c.slug === category)?.name || category}
                </span>
              )}
              {tag && (
                <span className="filter-tag">
                  <IconTag size={12} />
                  {tags.find(t => t.slug === tag)?.name || tag}
                </span>
              )}
              <span className="filter-count">共 {total} 篇</span>
            </div>
            <button
              type="button"
              onClick={clearFilter}
              className="filter-clear-btn"
              title="清除筛选"
            >
              <IconClose size={13} />
              <span>重置</span>
            </button>
          </div>
        )}

        {/* Post List */}
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>正在加载文章列表...</p>
          </div>
        ) : error ? (
          <div className="alert-box alert-error">{error}</div>
        ) : posts.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon">
              <IconBookOpen size={36} />
            </div>
            <h3>暂无相关文章</h3>
            <p>没有找到符合当前条件的内容，试着换个关键词或分类检索。</p>
            <button type="button" onClick={clearFilter} className="btn-clean">
              查看全部文章
            </button>
          </div>
        ) : (
          <div className="post-list-stream">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}

            {/* Bottom Infinite Scroll Sentinel */}
            <div ref={observerTarget} className="scroll-sentinel">
              {loadingMore && (
                <div className="scroll-loading-indicator">
                  <div className="loading-spinner" style={{ width: 18, height: 18 }} />
                  <span>正在加载更多文章...</span>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div className="scroll-end-indicator">
                  <span>· 已展示全部 {posts.length} 篇文章 ·</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
