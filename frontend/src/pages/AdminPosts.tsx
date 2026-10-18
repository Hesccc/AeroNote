import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { Post, Category } from '../utils/api';
import { AdminLayout } from '../components/AdminLayout';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SortField = 'id' | 'title' | 'access_count' | 'status' | 'create_time' | 'update_time';
type SortOrder = 'asc' | 'desc';

// ─── SortIcon ──────────────────────────────────────────────────────────────────

const SortIcon: React.FC<{ field: SortField; current: SortField; order: SortOrder }> = ({ field, current, order }) => {
  const active = field === current;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginLeft: 5, verticalAlign: 'middle', opacity: active ? 1 : 0.25 }}>
      <svg width="7" height="4" viewBox="0 0 8 5" fill={active && order === 'asc' ? 'var(--admin-text-1)' : 'var(--admin-text-3)'}>
        <path d="M4 0L8 5H0L4 0Z" />
      </svg>
      <svg width="7" height="4" viewBox="0 0 8 5" fill={active && order === 'desc' ? 'var(--admin-text-1)' : 'var(--admin-text-3)'}>
        <path d="M4 5L0 0H8L4 5Z" />
      </svg>
    </span>
  );
};

// ─── SortableTh ───────────────────────────────────────────────────────────────

const SortableTh: React.FC<{
  field: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (f: SortField) => void;
  style?: React.CSSProperties;
}> = ({ field, label, sortBy, sortOrder, onSort, style }) => (
  <th
    onClick={() => onSort(field)}
    style={{
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {label}
      <SortIcon field={field} current={sortBy} order={sortOrder} />
    </span>
  </th>
);

// ─── Checkbox ─────────────────────────────────────────────────────────────────

const Checkbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}> = ({ checked, indeterminate = false, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--admin-text-1)', borderRadius: 4 }}
    />
  );
};

// ─── Batch Toolbar ─────────────────────────────────────────────────────────────

const BatchToolbar: React.FC<{
  selectedIds: number[];
  onAction: (action: 'publish' | 'draft' | 'delete') => void;
  operating: boolean;
  onClear: () => void;
}> = ({ selectedIds, onAction, operating, onClear }) => {
  if (selectedIds.length === 0) return null;
  return (
    <div className="admin-batch-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span className="admin-badge admin-badge-success" style={{ padding: '0.2rem 0.6rem' }}>
          已选中 {selectedIds.length} 篇
        </span>
        <button
          type="button"
          onClick={onClear}
          className="admin-btn admin-btn-ghost admin-btn-sm"
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.76rem' }}
        >
          取消选择
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="admin-btn admin-btn-secondary admin-btn-sm"
          disabled={operating}
          onClick={() => onAction('publish')}
        >
          设为已发布
        </button>
        <button
          className="admin-btn admin-btn-secondary admin-btn-sm"
          disabled={operating}
          onClick={() => onAction('draft')}
        >
          转入草稿箱
        </button>
        <button
          className="admin-btn admin-btn-danger admin-btn-sm"
          disabled={operating}
          onClick={() => onAction('delete')}
        >
          批量删除
        </button>
      </div>
    </div>
  );
};

// ─── Import Modal ──────────────────────────────────────────────────────────────

const ImportModal: React.FC<{
  onClose: () => void;
  onDone: () => void;
}> = ({ onClose, onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; titles: string[]; errors: string[] } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.md') && !ext.endsWith('.zip')) {
      setError('仅支持 .md 文件或 .zip 压缩包');
      return;
    }
    setError('');
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await api.adminImportPosts(file);
      setResult(res);
      onDone();
    } catch (err: unknown) {
      setError((err as Error).message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 500, background: 'var(--admin-bg-2)', border: '1px solid var(--admin-border)', borderRadius: 12, boxShadow: 'var(--admin-shadow)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="admin-brand-icon" style={{ width: 28, height: 28 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--admin-text-1)' }}>批量导入文章</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-3)' }}>支持 Markdown (.md) 或 Zip 压缩包</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-text-3)', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="admin-alert admin-alert-success">
                成功导入 {result.imported} 篇{result.skipped > 0 ? `，跳过 ${result.skipped} 篇` : ''}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => { setResult(null); setFile(null); }}>继续导入</button>
                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={onClose}>完成</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--admin-text-1)' : 'var(--admin-border)'}`,
                  borderRadius: 10,
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--admin-input-bg)',
                }}
              >
                <input ref={fileInputRef} type="file" accept=".md,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--admin-text-1)', marginBottom: '0.25rem' }}>
                  {file ? file.name : '点击或拖拽上传 Markdown 文件'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)' }}>
                  解析 Frontmatter 元数据，自动保存为草稿
                </div>
              </div>
              {error && <div className="admin-alert admin-alert-error">{error}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="admin-btn admin-btn-secondary" onClick={onClose}>取消</button>
                <button className="admin-btn admin-btn-primary" onClick={handleUpload} disabled={!file || uploading}>
                  {uploading ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main AdminPosts Page ──────────────────────────────────────────────────────

export const AdminPosts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status'); // '0' | '3' | null (all)
  const categoryFilter = searchParams.get('category_id') || '';
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const sortBy = (searchParams.get('sort_by') || 'create_time') as SortField;
  const sortOrder = (searchParams.get('sort_order') || 'desc') as SortOrder;

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(search);
  const [showImport, setShowImport] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [operating, setOperating] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  const setParam = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    });
    setSearchParams(p);
  };

  // 加载分类列表用于过滤
  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    api.adminGetPosts({
      page,
      per_page: perPage,
      search: search || undefined,
      status: statusFilter !== null && statusFilter !== '' ? parseInt(statusFilter, 10) : undefined,
      category_id: categoryFilter ? parseInt(categoryFilter, 10) : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    })
      .then(data => {
        setPosts(data.posts);
        setPages(data.pages);
        setTotal(data.total ?? 0);
        setLoading(false);
        setSelectedIds(new Set());
      })
      .catch((err: unknown) => {
        setError((err as Error).message || '获取文章列表失败');
        setLoading(false);
      });
  }, [page, perPage, search, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setParam({ sort_order: sortOrder === 'desc' ? 'asc' : 'desc', page: '1' });
    } else {
      setParam({ sort_by: field, sort_order: 'desc', page: '1' });
    }
  };

  // Selection
  const allSelected = posts.length > 0 && posts.every(p => selectedIds.has(p.id));
  const someSelected = !allSelected && posts.some(p => selectedIds.has(p.id));
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(posts.map(p => p.id)));
  const toggleOne = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Batch
  const handleBatchAction = async (action: 'publish' | 'draft' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm(`确认批量删除选中的 ${ids.length} 篇文章？`)) return;
    setOperating(true);
    try {
      const r = await api.adminBatchPosts(action, ids);
      setBatchMsg(r.msg);
      fetchPosts();
      setTimeout(() => setBatchMsg(''), 3000);
    } catch (e: unknown) {
      setBatchMsg((e as Error).message || '操作失败');
    } finally {
      setOperating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确认删除这篇文章？')) return;
    try {
      await api.adminDeletePost(id);
      fetchPosts();
    } catch (e: unknown) {
      alert((e as Error).message || '删除失败');
    }
  };

  const handleToggleStatus = async (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = post.status === 0 ? 3 : 0;
    try {
      await api.adminUpdatePost(post.id, { status: nextStatus });
      fetchPosts();
    } catch (e: unknown) {
      alert((e as Error).message || '更改状态失败');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParam({ search: searchInput || null, page: '1' });
  };

  const sortThProps = (field: SortField) => ({ field, sortBy, sortOrder, onSort: handleSort });

  return (
    <AdminLayout>
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => fetchPosts()} />
      )}

      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="admin-page-title">文章管理</div>
          <div className="admin-page-subtitle">
            共收录 {total} 篇技术内容与随笔 · 支持即时检索、多维筛选与批量处理
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            className="admin-btn admin-btn-secondary admin-btn-sm"
            onClick={() => setShowImport(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>导入文章</span>
          </button>
          <Link to="/admin/posts/new" className="admin-btn admin-btn-primary admin-btn-sm" style={{ textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>撰写文章</span>
          </Link>
        </div>
      </div>

      {batchMsg && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: '1rem' }}>
          {batchMsg}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="posts-filter-bar">
        {/* Status Segmented Switch */}
        <div className="posts-status-pill-group">
          <button
            type="button"
            className={`status-pill ${statusFilter === null || statusFilter === '' ? 'is-active' : ''}`}
            onClick={() => setParam({ status: null, page: '1' })}
          >
            全部
          </button>
          <button
            type="button"
            className={`status-pill ${statusFilter === '0' ? 'is-active' : ''}`}
            onClick={() => setParam({ status: '0', page: '1' })}
          >
            已发布
          </button>
          <button
            type="button"
            className={`status-pill ${statusFilter === '3' ? 'is-active' : ''}`}
            onClick={() => setParam({ status: '3', page: '1' })}
          >
            草稿箱
          </button>
        </div>

        {/* Category Selector */}
        <select
          value={categoryFilter}
          onChange={e => setParam({ category_id: e.target.value || null, page: '1' })}
          className="admin-form-control posts-category-select"
        >
          <option value="">全部分类</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Keyword Search */}
        <form onSubmit={handleSearchSubmit} className="posts-search-form">
          <div className="admin-search-bar" style={{ flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--admin-text-3)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="快速检索文章标题..."
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => { setSearchInput(''); setParam({ search: null, page: '1' }); }}
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="admin-btn admin-btn-secondary admin-btn-sm">搜索</button>
        </form>
      </div>

      {/* Bulk Action Toolbar */}
      <BatchToolbar
        selectedIds={Array.from(selectedIds)}
        onAction={handleBatchAction}
        operating={operating}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Posts Table Workspace */}
      <div className="admin-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="admin-loading" style={{ padding: '4rem 0' }}>
            <div className="admin-loading-dots">
              <span className="admin-loading-dot" /><span className="admin-loading-dot" /><span className="admin-loading-dot" />
            </div>
            <p>正在拉取文章索引...</p>
          </div>
        ) : error ? (
          <div className="admin-alert admin-alert-error" style={{ margin: '1.5rem' }}>{error}</div>
        ) : posts.length === 0 ? (
          <div className="admin-loading" style={{ padding: '4rem 1rem' }}>
            <div style={{ color: 'var(--admin-text-3)', opacity: 0.4, marginBottom: '0.5rem' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p style={{ color: 'var(--admin-text-3)' }}>
              {search || statusFilter !== null || categoryFilter ? '未找到符合当前筛选条件的文章' : '暂无文章，点击右上角撰写或导入'}
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ border: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 44, paddingLeft: '1.25rem' }}>
                    <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </th>
                  <SortableTh {...sortThProps('id')} label="ID" style={{ width: 64 }} />
                  <SortableTh {...sortThProps('title')} label="文章标题" />
                  <th style={{ width: 120 }}>分类</th>
                  <th style={{ width: 140 }}>标签</th>
                  <SortableTh {...sortThProps('access_count')} label="阅读量" style={{ width: 88 }} />
                  <SortableTh {...sortThProps('status')} label="状态" style={{ width: 96 }} />
                  <SortableTh {...sortThProps('create_time')} label="创建时间" style={{ width: 110 }} />
                  <th style={{ textAlign: 'right', width: 110, paddingRight: '1.25rem' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => {
                  const checked = selectedIds.has(post.id);
                  const fmtDate = (s: string) => {
                    const d = new Date(s);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  };

                  return (
                    <tr
                      key={post.id}
                      onClick={() => toggleOne(post.id)}
                      onDoubleClick={() => navigate(`/admin/posts/edit/${post.id}`)}
                      className={`admin-post-row ${checked ? 'is-row-selected' : ''}`}
                      title="双击进入编辑模式，单击切换多选"
                    >
                      <td style={{ paddingLeft: '1.25rem' }} onClick={e => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleOne(post.id)} />
                      </td>

                      <td style={{ color: 'var(--admin-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        #{String(post.id).padStart(3, '0')}
                      </td>

                      <td>
                        <Link
                          to={`/admin/posts/edit/${post.id}`}
                          onClick={e => e.stopPropagation()}
                          className="table-post-title-link"
                          title={post.title}
                        >
                          {post.title}
                        </Link>
                        {(post.summary || post.meta_description) && (
                          <div className="table-post-snippet">{post.summary || post.meta_description}</div>
                        )}
                      </td>

                      <td>
                        {post.categories && post.categories.length > 0 ? (
                          <span className="table-cat-pill">
                            {post.categories[0].name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-3)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {post.tags && post.tags.length > 0 ? (
                            post.tags.slice(0, 2).map(t => (
                              <span key={t.id} className="table-tag-pill">
                                #{t.name}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--admin-text-3)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: 'var(--admin-text-1)' }}>
                        {post.access_count?.toLocaleString() || 0}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={e => handleToggleStatus(post, e)}
                          className="status-toggle-btn"
                          title="点击快速切换发布/草稿状态"
                        >
                          <span className={`admin-badge ${post.status === 0 ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                            <span className="admin-badge-dot" />
                            {post.status === 0 ? '已发布' : '草稿'}
                          </span>
                        </button>
                      </td>

                      <td style={{ color: 'var(--admin-text-3)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {fmtDate(post.create_time)}
                      </td>

                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <Link
                            to={`/admin/posts/edit/${post.id}`}
                            onClick={e => e.stopPropagation()}
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                          >
                            编辑
                          </Link>
                          <button
                            type="button"
                            onClick={e => handleDelete(post.id, e)}
                            className="admin-btn admin-btn-danger admin-btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination Bar */}
        {!loading && total > 0 && (
          <div className="posts-table-footer">
            <div className="footer-summary" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <span>共 <strong>{total}</strong> 篇文章</span>
              <span>·</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>每页显示:</span>
                <select
                  value={perPage}
                  onChange={e => setParam({ per_page: e.target.value, page: '1' })}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-card-border)',
                    backgroundColor: 'var(--admin-card-bg)',
                    color: 'var(--admin-text-1)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  <option value={20}>20 篇</option>
                  <option value={50}>50 篇</option>
                  <option value={100}>100 篇</option>
                  <option value={200}>200 篇</option>
                </select>
              </div>
              {selectedIds.size > 0 && <span>· 当前已选 <strong>{selectedIds.size}</strong> 篇</span>}
            </div>

            {pages > 1 && (
              <div className="admin-pagination" style={{ margin: 0 }}>
                <button
                  type="button"
                  onClick={() => setParam({ page: '1' })}
                  disabled={page === 1}
                  title="首页"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setParam({ page: String(page - 1) })}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', padding: '0 0.5rem', color: 'var(--admin-text-2)' }}>
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setParam({ page: String(page + 1) })}
                  disabled={page === pages}
                >
                  下一页
                </button>
                <button
                  type="button"
                  onClick={() => setParam({ page: String(pages) })}
                  disabled={page === pages}
                  title="末页"
                >
                  »
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
