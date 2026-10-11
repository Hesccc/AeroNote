import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import type { SystemEnv, BlogStats } from '../utils/api';
import { AdminLayout } from '../components/AdminLayout';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  accentColor: string;
  linkTo?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, icon, accentColor, linkTo }) => {
  const content = (
    <div className="metric-card" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span className="metric-label">{label}</span>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${accentColor}18`,
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span className="metric-value">{value}</span>
        {subValue && (
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)', fontFamily: 'var(--font-mono)' }}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );

  return linkTo ? <Link to={linkTo} style={{ textDecoration: 'none' }}>{content}</Link> : content;
};

export const AdminDashboard: React.FC = () => {
  const [envData, setEnvData] = useState<SystemEnv | null>(null);
  const [stats, setStats] = useState<BlogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError('');
    const t0 = performance.now();

    Promise.all([api.adminGetEnv(), api.adminGetStats()])
      .then(([envRes, statsRes]) => {
        const cost = Math.round(performance.now() - t0);
        setApiLatency(cost);
        setEnvData(envRes);
        setStats(statsRes);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || '获取系统监控数据失败');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 接口健康清单
  const apiEndpoints = [
    { method: 'GET', path: '/api/posts', desc: '前台文章流（无限滚动）', auth: false, status: 'Active' },
    { method: 'GET', path: '/api/posts/:id/cover', desc: '确定性图床缓存服务', auth: false, status: 'Active' },
    { method: 'GET', path: '/api/config', desc: '全站动态基础配置', auth: false, status: 'Active' },
    { method: 'POST', path: '/api/manage/upload', desc: '多格式静态文件上传', auth: true, status: 'Active' },
    { method: 'GET', path: '/api/manage/stats', desc: '深度统计与分析指标', auth: true, status: 'Active' },
    { method: 'GET', path: '/api/manage/env', desc: '底层硬件性能监控', auth: true, status: 'Active' },
  ];

  return (
    <AdminLayout>
      {/* 顶部标题与快速动作 */}
      <div className="admin-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="admin-page-title">数据概览</div>
          <div className="admin-page-subtitle">涵盖文档统计、深度文档分析、应用接口服务与主机性能指标</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={fetchData}
            className="admin-btn admin-btn-secondary admin-btn-sm"
            title="重新采样监控数据"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>刷新采样</span>
          </button>
          <Link to="/admin/posts/new" className="admin-btn admin-btn-primary admin-btn-sm" style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>写新文章</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-loading" style={{ padding: '4rem 0' }}>
          <div className="admin-loading-dots">
            <span className="admin-loading-dot" /><span className="admin-loading-dot" /><span className="admin-loading-dot" />
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--admin-text-3)' }}>正在实时采样全维度分析数据...</p>
        </div>
      ) : (
        <>
          {/* ── 维度一：文档统计 (Document Statistics) ── */}
          <div className="dashboard-section-block">
        <div className="dashboard-section-title-bar">
          <span className="dashboard-section-tag">DIMENSION 01</span>
          <h2 className="dashboard-section-heading">文档统计指标</h2>
          <span className="dashboard-section-sub">全站文章体量、发布状态与读者浏览计数</span>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label="文章总数"
            value={stats ? stats.total_posts : '--'}
            subValue={stats ? `已发布 ${stats.published_posts} / 草稿 ${stats.draft_posts}` : undefined}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
            accentColor="#6366f1"
            linkTo="/admin/posts"
          />
          <MetricCard
            label="已发布文章"
            value={stats ? stats.published_posts : '--'}
            subValue={stats && stats.total_posts ? `占比 ${Math.round((stats.published_posts / stats.total_posts) * 100)}%` : undefined}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
            accentColor="#10b981"
            linkTo="/admin/posts"
          />
          <MetricCard
            label="草稿箱"
            value={stats ? stats.draft_posts : '--'}
            subValue="未正式公开"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            accentColor="#f59e0b"
            linkTo="/admin/posts"
          />
          <MetricCard
            label="读者总阅读量"
            value={stats ? stats.total_views.toLocaleString() : '--'}
            subValue={stats && stats.total_posts ? `篇均 ${Math.round(stats.total_views / (stats.total_posts || 1))} 次` : undefined}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
            accentColor="#0ea5e9"
          />
        </div>
      </div>

      {/* ── 维度二：文档分析 (Document Analysis) ── */}
      <div className="dashboard-section-block">
        <div className="dashboard-section-title-bar">
          <span className="dashboard-section-tag">DIMENSION 02</span>
          <h2 className="dashboard-section-heading">深度文档分析</h2>
          <span className="dashboard-section-sub">字数规模、配图覆盖率与阅读排行分布</span>
        </div>

        <div className="dashboard-two-column-grid">
          {/* 左侧：文字体量与覆盖率 */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                内容结构与排版健康度
              </div>
            </div>
            <div className="admin-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="dashboard-analytic-subgrid">
                <div className="stat-analytic-box">
                  <span className="analytic-label">总撰写字数</span>
                  <span className="analytic-val">{stats ? (stats.total_words > 10000 ? `${(stats.total_words / 10000).toFixed(1)} 万字` : `${stats.total_words} 字`) : '--'}</span>
                  <span className="analytic-sub">Markdown 全文原文字符</span>
                </div>
                <div className="stat-analytic-box">
                  <span className="analytic-label">平均篇幅</span>
                  <span className="analytic-val">{stats ? `${stats.avg_words.toLocaleString()} 字` : '--'}</span>
                  <span className="analytic-sub">深度长篇技术笔记</span>
                </div>
              </div>

              {/* 封面配图覆盖率条形图 */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-text-2)' }}>独立封面配图覆盖率</span>
                  <span style={{ color: 'var(--admin-text-1)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {stats && stats.total_posts ? `${Math.round((stats.with_cover_posts / stats.total_posts) * 100)}%` : '--'}
                  </span>
                </div>
                <div className="stat-progress-bar">
                  <div
                    className="stat-progress-fill"
                    style={{
                      width: stats && stats.total_posts ? `${(stats.with_cover_posts / stats.total_posts) * 100}%` : '0%',
                      background: 'var(--admin-text-1)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--admin-text-3)', marginTop: '0.35rem' }}>
                  <span>独立封面: {stats ? stats.with_cover_posts : 0} 篇</span>
                  <span>自动确定性图床补齐: {stats ? stats.without_cover_posts : 0} 篇</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：热门浏览文章 TOP 5 */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                热门阅读排行榜 (TOP 5)
              </div>
            </div>
            <div className="admin-card-body" style={{ padding: '0.5rem 0' }}>
              {stats?.top_posts && stats.top_posts.length > 0 ? (
                <div className="dashboard-top-list">
                  {stats.top_posts.map((post, idx) => (
                    <Link key={post.id} to={`/admin/posts/edit/${post.id}`} className="dashboard-top-item">
                      <div className="top-item-rank" style={{ opacity: idx < 3 ? 1 : 0.4 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="top-item-title" title={post.title}>
                        {post.title}
                      </div>
                      <div className="top-item-views">
                        <span className="views-num">{post.access_count}</span>
                        <span className="views-label">次阅读</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-3)', fontSize: '0.85rem' }}>
                  暂无阅读排名数据
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 维度三：应用接口 (Application Interfaces) ── */}
      <div className="dashboard-section-block">
        <div className="dashboard-section-title-bar">
          <span className="dashboard-section-tag">DIMENSION 03</span>
          <h2 className="dashboard-section-heading">应用接口服务状态</h2>
          <span className="dashboard-section-sub">
            核心 RESTful 端点健康探测 · 当前客户端通信响应耗时: <strong style={{ color: 'var(--admin-text-1)', fontFamily: 'var(--font-mono)' }}>{apiLatency !== null ? `${apiLatency}ms` : '探测中...'}</strong>
          </span>
        </div>

        <div className="admin-card">
          <div className="table-responsive" style={{ border: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>METHOD</th>
                  <th style={{ width: '220px' }}>ENDPOINT</th>
                  <th>接口业务职能</th>
                  <th style={{ width: '120px' }}>鉴权级别</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>服务状态</th>
                </tr>
              </thead>
              <tbody>
                {apiEndpoints.map((ep, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`method-badge method-${ep.method.toLowerCase()}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--admin-text-1)', fontSize: '0.82rem' }}>
                      {ep.path}
                    </td>
                    <td style={{ color: 'var(--admin-text-2)' }}>{ep.desc}</td>
                    <td>
                      <span style={{
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-mono)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 4,
                        background: ep.auth ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: ep.auth ? 'var(--admin-danger)' : 'var(--admin-success)',
                        border: `1px solid ${ep.auth ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                      }}>
                        {ep.auth ? 'JWT Token' : 'Public'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="admin-badge admin-badge-success">
                        <span className="admin-badge-dot" />
                        {ep.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 维度四：性能监控 (Performance & Hardware) ── */}
      <div className="dashboard-section-block">
        <div className="dashboard-section-title-bar">
          <span className="dashboard-section-tag">DIMENSION 04</span>
          <h2 className="dashboard-section-heading">主机底层性能与运行时</h2>
          <span className="dashboard-section-sub">服务器硬件负荷、运行环境内核与时钟采样</span>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label="CPU 占用率"
            value={envData ? `${envData.cpu_usage}%` : '--'}
            subValue={envData && envData.cpu_usage > 70 ? '负载较高' : '运行良好'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
            accentColor="#ec4899"
          />
          <MetricCard
            label="内存使用率"
            value={envData ? `${envData.mem_usage}%` : '--'}
            subValue={envData && envData.mem_usage > 85 ? '需关注' : '正常范围'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            }
            accentColor="#8b5cf6"
          />
          <MetricCard
            label="宿主操作系统"
            value={envData?.os || '--'}
            subValue="Host Platform"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            }
            accentColor="#06b6d4"
          />
          <MetricCard
            label="持久层数据库"
            value={envData?.db_type || 'MySQL'}
            subValue={envData?.blog_v || 'v1.2.0'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            }
            accentColor="#3fb950"
          />
        </div>

        {/* 详细环境配置表 */}
        <div className="admin-card" style={{ marginTop: '1rem' }}>
          <div className="admin-card-body">
            {envData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                {([
                  ['Python 运行时', envData.python_v],
                  ['Flask 服务核心', envData.flask_v],
                  ['SQLAlchemy ORM', envData.SQLAlchemy_v],
                  ['Node.js 工具环境', envData.node_v],
                  ['系统服务时钟', envData.datetime ? new Date(envData.datetime).toLocaleString('zh-CN') : '--'],
                  ['博客工程版本', envData.blog_v || 'v1.2.0'],
                ] as [string, string][]).map(([k, v], i) => (
                  <div key={i} className="env-meta-spec-card">
                    <span className="spec-label">{k}</span>
                    <span className="spec-value">{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── 维度五：AI 自动化任务运行指标 (AI Task Analytics & Governance) ── */}
      <div className="dashboard-section-block">
        <div className="dashboard-section-title-bar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span className="dashboard-section-tag" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--admin-success)' }}>
              DIMENSION 05
            </span>
            <h2 className="dashboard-section-heading">AI 自动化任务运行指标</h2>
            <span className="dashboard-section-sub">异步分类/标签/摘要定时提取状态、线程负荷与防积压监控</span>
          </div>
          <Link
            to="/admin/settings"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            style={{ fontSize: '0.78rem', textDecoration: 'none' }}
          >
            ⚙️ 前往调度策略配置 →
          </Link>
        </div>

        {/* 核心状态与运行参数网格 */}
        <div className="metrics-grid">
          <MetricCard
            label="守护进程状态"
            value={stats?.ai_scheduler?.enabled ? '已启用' : '已禁用'}
            subValue={stats?.ai_scheduler?.running ? 'Daemon 线程在线' : '离线'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L13 14h-2l.25-4.07A4.002 4.002 0 0 1 12 2z" />
                <circle cx="12" cy="18" r="2" />
              </svg>
            }
            accentColor={stats?.ai_scheduler?.enabled ? '#10b981' : '#f59e0b'}
            linkTo="/admin/settings"
          />
          <MetricCard
            label="Cron 调度策略"
            value={stats?.ai_scheduler?.cron || '*/5 * * * *'}
            subValue="Unix Cron 周期"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            accentColor="#6366f1"
            linkTo="/admin/settings"
          />
          <MetricCard
            label="并发处理线程数"
            value={stats?.ai_scheduler ? `${stats.ai_scheduler.threads} 线程` : '3 线程'}
            subValue="ThreadPoolExecutor"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
            accentColor="#8b5cf6"
            linkTo="/admin/settings"
          />
          <MetricCard
            label="防积压互斥状态"
            value={stats?.ai_scheduler?.is_batch_running ? '批处理进行中' : '空闲监听'}
            subValue={stats?.ai_scheduler?.is_batch_running ? `${stats.ai_scheduler.in_flight_count} 篇在途` : '自动防重避让已就绪'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            accentColor={stats?.ai_scheduler?.is_batch_running ? '#3b82f6' : '#10b981'}
          />
        </div>

        {/* AI 任务负荷与积压监控看板 */}
        <div className="dashboard-two-column-grid" style={{ marginTop: '1rem' }}>
          {/* 左侧：待处理池分布与健康进度 */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                AI 任务队列与待处理池负荷
              </div>
            </div>
            <div className="admin-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="dashboard-tri-grid">
                <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                  <span className="analytic-label">待补齐分类</span>
                  <span className="analytic-val" style={{ fontSize: '1.15rem' }}>
                    {stats?.ai_scheduler ? stats.ai_scheduler.pending_categories_count : '--'}
                  </span>
                  <span className="analytic-sub">未归类文章</span>
                </div>
                <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                  <span className="analytic-label">待补齐标签</span>
                  <span className="analytic-val" style={{ fontSize: '1.15rem' }}>
                    {stats?.ai_scheduler ? stats.ai_scheduler.pending_tags_count : '--'}
                  </span>
                  <span className="analytic-sub">未关联标签</span>
                </div>
                <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                  <span className="analytic-label">待补齐摘要</span>
                  <span className="analytic-val" style={{ fontSize: '1.15rem' }}>
                    {stats?.ai_scheduler ? stats.ai_scheduler.pending_summary_count : '--'}
                  </span>
                  <span className="analytic-sub">无 AI Summary</span>
                </div>
              </div>

              {/* 自动化覆盖完成率进度条 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--admin-text-2)' }}>全站文章 AI 知识特征完善率</span>
                  <span style={{ color: 'var(--admin-text-1)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {stats && stats.total_posts
                      ? `${Math.max(0, Math.round(((stats.total_posts - (stats.ai_scheduler?.total_pending || 0)) / stats.total_posts) * 100))}%`
                      : '--'}
                  </span>
                </div>
                <div className="stat-progress-bar">
                  <div
                    className="stat-progress-fill"
                    style={{
                      width: stats && stats.total_posts
                        ? `${Math.max(0, Math.round(((stats.total_posts - (stats.ai_scheduler?.total_pending || 0)) / stats.total_posts) * 100))}%`
                        : '0%',
                      background: 'var(--admin-accent)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--admin-text-3)', marginTop: '0.35rem' }}>
                  <span>已完成完善: {stats ? Math.max(0, stats.total_posts - (stats.ai_scheduler?.total_pending || 0)) : 0} 篇</span>
                  <span>待处理队列: {stats?.ai_scheduler?.total_pending || 0} 篇</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：时钟节拍与运行状态卡片 */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                调度时钟节拍与执行流水
              </div>
            </div>
            <div className="admin-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="env-meta-spec-card">
                  <span className="spec-label">上次批处理时戳</span>
                  <span className="spec-value">{stats?.ai_scheduler?.last_run_time || '等待首次执行'}</span>
                </div>
                <div className="env-meta-spec-card">
                  <span className="spec-label">下次计划触发时戳</span>
                  <span className="spec-value" style={{ color: 'var(--admin-accent)' }}>{stats?.ai_scheduler?.next_run_time || '等待计算'}</span>
                </div>
                <div className="env-meta-spec-card">
                  <span className="spec-label">当前运行态互斥锁</span>
                  <span className="spec-value">
                    {stats?.ai_scheduler?.is_batch_running ? (
                      <span style={{ color: '#3b82f6' }}>🔒 锁占用（执行中，自动避让重叠）</span>
                    ) : (
                      <span style={{ color: 'var(--admin-success)' }}>🔓 空闲（监听下一周期）</span>
                    )}
                  </span>
                </div>
                <div className="env-meta-spec-card">
                  <span className="spec-label">在途消费文章数量</span>
                  <span className="spec-value">{stats?.ai_scheduler?.in_flight_count || 0} 篇</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </AdminLayout>
  );
};
