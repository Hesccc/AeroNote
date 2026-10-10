import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import type { PostDetailData } from '../utils/api';
import { Layout } from '../components/Layout';
import { ScrollNav } from '../components/ScrollNav';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { Toc } from '../components/Toc';
import { PostPosterModal } from '../components/PostPosterModal';
import { GiscusComment } from '../components/GiscusComment';
import {
  IconCalendar,
  IconClock,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
  IconUser,
  IconBookOpen,
} from '../components/Icons';
import { getDeterministicEmoji } from '../utils/emoji';

export const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // 监听全文阅读滚动进度百分比
  useEffect(() => {
    const calculateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const percent = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
        setScrollProgress(percent);
      }
    };

    calculateProgress();
    window.addEventListener('scroll', calculateProgress, { passive: true });
    return () => window.removeEventListener('scroll', calculateProgress);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');

    api.getPost(parseInt(id, 10))
      .then(data => {
        if (!active) return;
        setPost(data);
        setLoading(false);
        document.title = `${data.title} - AeroNote`;
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || '加载文章详情失败');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const formattedDate = post
    ? new Date(post.create_time).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const wordCount = post?.content ? Math.ceil(post.content.length / 2) : 0;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 300));

  return (
    <Layout>
      {/* 顶部阅读滚动进度条 */}
      <div
        className="reading-progress-bar"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* 统一的页面右侧悬浮上下滚动按钮（滚动后显示） */}
      <ScrollNav />

      <div className="post-detail-layout">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>正在载入文章内容...</p>
          </div>
        ) : error || !post ? (
          <div className="empty-state-box">
            <h3>文章不存在或已被删除</h3>
            <p>{error || '未能找到目标文章，请确认链接是否正确。'}</p>
            <Link to="/" className="btn-clean">
              返回首页
            </Link>
          </div>
        ) : (
          <>
            {/* Sidebar Table of Contents (TOC) - 移动到文章内容左侧 */}
            <aside className="post-sidebar">
              <div className="post-sidebar-sticky">
                <div className="toc-header-label">
                  <span>文章目录</span>
                </div>
                <Toc content={post.content || ''} />
              </div>
            </aside>

            {/* Main Article Content */}
            <article className="post-article-container">
              {/* Back to Home / Archives Breadcrumb */}
              <div className="post-breadcrumb">
                <Link to="/" className="breadcrumb-link">
                  <IconArrowLeft size={14} />
                  <span>返回文章流</span>
                </Link>
                {post.categories && post.categories.length > 0 && (
                  <>
                    <span className="breadcrumb-sep">/</span>
                    <Link to={`/?category=${post.categories[0].slug}`} className="breadcrumb-link">
                      {post.categories[0].name}
                    </Link>
                  </>
                )}
              </div>

              {/* Article Header */}
              <header className="post-header">
                {/* Category & Tags Badges */}
                <div className="post-header-badges">
                  {post.categories && post.categories.map(cat => (
                    <Link
                      key={cat.id}
                      to={`/?category=${cat.slug}`}
                      className="post-cat-badge"
                    >
                      <span style={{ fontSize: '0.85rem' }}>{getDeterministicEmoji(cat.name)}</span>
                      <span>{cat.name}</span>
                    </Link>
                  ))}
                  {post.tags && post.tags.map(tag => (
                    <Link
                      key={tag.id}
                      to={`/?tag=${tag.slug}`}
                      className="post-tag-badge"
                    >
                      <span style={{ fontSize: '0.78rem' }}>{getDeterministicEmoji(tag.name)}</span>
                      <span>{tag.name}</span>
                    </Link>
                  ))}
                </div>

                {/* Article Title */}
                <h1 className="post-title">{post.title}</h1>

                {/* Article Meta Bar */}
                <div className="post-meta-row">
                  <div className="meta-left">
                    <span className="meta-item">
                      <IconCalendar size={14} />
                      <time dateTime={post.create_time}>{formattedDate}</time>
                    </span>
                    <span className="meta-dot">·</span>
                    <span className="meta-item">
                      <IconClock size={14} />
                      <span>约 {readMinutes} 分钟阅读 ({wordCount.toLocaleString()} 字)</span>
                    </span>
                    <span className="meta-dot">·</span>
                    <span className="meta-item">
                      <IconEye size={14} />
                      <span>{post.access_count} 次浏览</span>
                    </span>
                  </div>
                  <div className="meta-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {post.author && (
                      <span className="meta-author">
                        <IconUser size={13} />
                        <span>{post.author}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      className="post-share-poster-btn"
                      onClick={() => setShowPosterModal(true)}
                      title="生成文章海报卡片"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>生成海报</span>
                    </button>
                  </div>
                </div>
              </header>

              {/* Optional Post Feature Image */}
              {post.thumbnail && (
                <div className="post-feature-image-wrap">
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="post-feature-image"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Article Markdown Content */}
              <div className="post-content-wrap">
                <MarkdownRenderer content={post.content || ''} />
              </div>

              {/* Article Footer: 上一篇/下一篇导航 与 相关文章推荐 */}
              <footer className="post-footer">
                {/* 1. 上一篇 / 下一篇 导航卡片 */}
                <div className="post-nav-cards">
                  {post.prev_post ? (
                    <Link to={`/posts/${post.prev_post.id}`} className="post-nav-card post-nav-prev">
                      <div className="post-nav-label">
                        <IconArrowLeft size={13} />
                        <span>上一篇</span>
                      </div>
                      <div className="post-nav-title">{post.prev_post.title}</div>
                    </Link>
                  ) : (
                    <div className="post-nav-card post-nav-disabled">
                      <div className="post-nav-label">上一篇</div>
                      <div className="post-nav-title">已是第一篇文章</div>
                    </div>
                  )}

                  {post.next_post ? (
                    <Link to={`/posts/${post.next_post.id}`} className="post-nav-card post-nav-next">
                      <div className="post-nav-label">
                        <span>下一篇</span>
                        <IconArrowRight size={13} />
                      </div>
                      <div className="post-nav-title">{post.next_post.title}</div>
                    </Link>
                  ) : (
                    <div className="post-nav-card post-nav-disabled">
                      <div className="post-nav-label">下一篇</div>
                      <div className="post-nav-title">已是最新一篇文章</div>
                    </div>
                  )}
                </div>

                {/* 2. 相关推荐 (同分类/同标签) */}
                {post.related_posts && post.related_posts.length > 0 && (
                  <div className="post-related-section">
                    <div className="post-related-heading">
                      <IconBookOpen size={16} />
                      <span>相关推荐</span>
                    </div>
                    <div className="post-related-grid">
                      {post.related_posts.map(rPost => (
                        <Link key={rPost.id} to={`/posts/${rPost.id}`} className="post-related-card">
                          <div className="post-related-meta">
                            {rPost.categories && rPost.categories[0] && (
                              <span className="post-related-category">{rPost.categories[0].name}</span>
                            )}
                            <span className="post-related-date">
                              {rPost.create_time ? new Date(rPost.create_time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}
                            </span>
                          </div>
                          <h4 className="post-related-title">{rPost.title}</h4>
                          {rPost.summary && (
                            <p className="post-related-summary">{rPost.summary}</p>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="post-footer-actions">
                  <button
                    type="button"
                    className="btn-clean"
                    onClick={() => setShowPosterModal(true)}
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>生成分享海报</span>
                  </button>
                  <Link to="/archives" className="btn-clean">
                    <IconArrowLeft size={14} />
                    <span>查看全部归档</span>
                  </Link>
                </div>
              </footer>

              {/* 3. 读者互动与评论区 (Giscus) */}
              <GiscusComment postId={post.id} postTitle={post.title} />
            </article>
          </>
        )}
      </div>

      {/* 海报卡片生成 Modal */}
      {showPosterModal && post && (
        <PostPosterModal
          post={post}
          onClose={() => setShowPosterModal(false)}
        />
      )}
    </Layout>
  );
};
