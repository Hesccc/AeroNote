import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { Category, Tag } from '../utils/api';
import { AdminLayout } from '../components/AdminLayout';
import { getDeterministicEmoji } from '../utils/emoji';

interface AdminCategoriesProps {
  activeTab?: 'categories' | 'tags';
}

// Inline SVG icons
const IconCategory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export const AdminCategories: React.FC<AdminCategoriesProps> = ({ activeTab = 'categories' }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPriority, setCatPriority] = useState<number>(0);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.getCategories(), api.getTags()])
      .then(([cats, tgs]) => { setCategories(cats); setTags(tgs); setLoading(false); })
      .catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(''); setErr(''); }, 3000);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catSlug) { flash('分类名称和简称不能为空', true); return; }
    try {
      if (editingCatId) {
        await api.adminUpdateCategory(editingCatId, { name: catName, slug: catSlug, description: catDesc, priority: catPriority });
        flash('分类修改成功');
        setEditingCatId(null);
      } else {
        await api.adminCreateCategory({ name: catName, slug: catSlug, description: catDesc, priority: catPriority });
        flash('分类创建成功');
      }
      setCatName(''); setCatSlug(''); setCatDesc(''); setCatPriority(0);
      fetchData();
    } catch (e: unknown) {
      flash((e as Error).message || '操作失败', true);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description || '');
    setCatPriority(cat.priority ?? 0);
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('确认删除该分类？关联文章不会被删除')) return;
    try {
      await api.adminDeleteCategory(id);
      flash('分类已删除');
      fetchData();
    } catch (e: unknown) {
      flash((e as Error).message || '删除失败', true);
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName || !tagSlug) { flash('标签名称和简称不能为空', true); return; }
    try {
      if (editingTagId) {
        await api.adminUpdateTag(editingTagId, { name: tagName, slug: tagSlug });
        flash('标签修改成功');
        setEditingTagId(null);
      } else {
        await api.adminCreateTag({ name: tagName, slug: tagSlug });
        flash('标签创建成功');
      }
      setTagName(''); setTagSlug('');
      fetchData();
    } catch (e: unknown) {
      flash((e as Error).message || '操作失败', true);
    }
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagSlug(tag.slug);
  };

  const handleDeleteTag = async (id: number) => {
    if (!window.confirm('确认删除该标签？')) return;
    try {
      await api.adminDeleteTag(id);
      flash('标签已删除');
      fetchData();
    } catch (e: unknown) {
      flash((e as Error).message || '删除失败', true);
    }
  };

  const isCat = activeTab === 'categories';

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--admin-text-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--admin-bg)', flexShrink: 0,
          }}>
            {isCat ? <IconCategory /> : <IconTag />}
          </span>
          {isCat ? '分类管理' : '标签管理'}
        </div>
        <div className="admin-page-subtitle">
          {isCat ? `共 ${categories.length} 个分类 · 采用专属确定性 Emoji 标识` : `共 ${tags.length} 个标签 · 采用专属确定性 Emoji 标识`}
        </div>
      </div>

      {/* Alerts */}
      {msg && <div className="admin-alert admin-alert-success" style={{ marginBottom: '1.5rem' }}>{msg}</div>}
      {err && <div className="admin-alert admin-alert-error" style={{ marginBottom: '1.5rem' }}>{err}</div>}

      {loading ? (
        <div className="admin-loading">
          <div className="admin-loading-dots">
            <span className="admin-loading-dot" /><span className="admin-loading-dot" /><span className="admin-loading-dot" />
          </div>
          <p>载入中...</p>
        </div>
      ) : (
        <div className="admin-crud-grid">

          {/* Left: Form Card */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                {isCat ? (editingCatId ? '编辑分类' : '新建分类') : (editingTagId ? '编辑标签' : '新建标签')}
              </div>
            </div>
            <div className="admin-card-body">
              {isCat ? (
                <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">分类名称 *</label>
                    <input
                      type="text"
                      value={catName}
                      onChange={e => { const v = e.target.value; setCatName(v); if (!editingCatId) setCatSlug(v.trim().toLowerCase().replace(/\s+/g, '-')); }}
                      className="admin-form-control"
                      placeholder="如：架构设计"
                    />
                  </div>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">URL 简称 (slug) *</label>
                    <input type="text" value={catSlug} onChange={e => setCatSlug(e.target.value)} className="admin-form-control" placeholder="如：architecture" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
                  </div>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">分类描述</label>
                    <input type="text" value={catDesc} onChange={e => setCatDesc(e.target.value)} className="admin-form-control" placeholder="可选，分类核心定位说明" />
                  </div>
                  <div className="admin-settings-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="admin-form-label">排序优先级 (权重)</label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)' }}>数字越大越靠前展示，默认 0</span>
                    </div>
                    <input
                      type="number"
                      value={catPriority}
                      onChange={e => setCatPriority(parseInt(e.target.value, 10) || 0)}
                      className="admin-form-control"
                      placeholder="如：10"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">专属确定性 Emoji 标识预览</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.85rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 8 }}>
                      <span style={{ fontSize: '1.5rem' }}>{getDeterministicEmoji(catName)}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-2)' }}>系统基于名称自动映射，全站保持一致</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }}>
                      {editingCatId ? '保存修改' : '创建分类'}
                    </button>
                    {editingCatId && (
                      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setEditingCatId(null); setCatName(''); setCatSlug(''); setCatDesc(''); setCatPriority(0); }}>
                        取消
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveTag} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">标签名称 *</label>
                    <input
                      type="text"
                      value={tagName}
                      onChange={e => { const v = e.target.value; setTagName(v); if (!editingTagId) setTagSlug(v.trim().toLowerCase().replace(/\s+/g, '-')); }}
                      className="admin-form-control"
                      placeholder="如：Python"
                    />
                  </div>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">URL 简称 (slug) *</label>
                    <input type="text" value={tagSlug} onChange={e => setTagSlug(e.target.value)} className="admin-form-control" placeholder="如：python" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
                  </div>
                  <div className="admin-settings-row">
                    <label className="admin-form-label">专属确定性 Emoji 标识预览</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.85rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 8 }}>
                      <span style={{ fontSize: '1.5rem' }}>{getDeterministicEmoji(tagName)}</span>
                      <span className="table-tag-pill" style={{ fontSize: '0.82rem' }}>
                        <span style={{ marginRight: 3 }}>{getDeterministicEmoji(tagName)}</span>
                        <span>{tagName || 'preview'}</span>
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }}>
                      {editingTagId ? '保存修改' : '创建标签'}
                    </button>
                    {editingTagId && (
                      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setEditingTagId(null); setTagName(''); setTagSlug(''); }}>
                        取消
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right: List */}
          <div className="admin-card" style={{ overflow: 'hidden' }}>
            <div className="admin-card-header">
              <div className="admin-card-title">
                <div className="admin-card-title-icon" style={{ background: 'var(--admin-input-bg)', color: 'var(--admin-text-2)' }}>
                  {isCat ? <IconCategory /> : <IconTag />}
                </div>
                {isCat ? `已有分类 (${categories.length})` : `已有标签 (${tags.length})`}
              </div>
            </div>

            {isCat ? (
              categories.length === 0 ? (
                <div className="admin-loading" style={{ padding: '3rem 1rem' }}>
                  <div style={{ color: 'var(--admin-text-3)', opacity: 0.5, marginBottom: '0.5rem' }}><IconCategory /></div>
                  <p>暂无分类，在左侧创建第一个</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem 0' }}>
                  {categories.map(cat => (
                    <div key={cat.id} className="admin-tag-item" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                      <span style={{ fontSize: '1.25rem', marginRight: '0.5rem', userSelect: 'none' }}>
                        {getDeterministicEmoji(cat.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="admin-tag-name" style={{ fontWeight: 600, color: 'var(--admin-text-1)' }}>{cat.name}</span>
                          <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: 4, background: 'var(--admin-input-bg)', color: 'var(--admin-text-2)', fontFamily: 'var(--font-mono)' }}>
                            权重: {cat.priority ?? 0}
                          </span>
                        </div>
                        <div className="admin-tag-meta" style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)' }}>/{cat.slug} {cat.description ? `· ${cat.description}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleEditCategory(cat)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <IconEdit /> 编辑
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDeleteCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <IconTrash /> 删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              tags.length === 0 ? (
                <div className="admin-loading" style={{ padding: '3rem 1rem' }}>
                  <div style={{ color: 'var(--admin-text-3)', opacity: 0.5, marginBottom: '0.5rem' }}><IconTag /></div>
                  <p>暂无标签，在左侧创建第一个</p>
                </div>
              ) : (
                <div style={{ padding: '1rem 1.25rem' }}>
                  {/* Tag cloud style */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {tags.map(tag => (
                      <span key={tag.id} className="table-tag-pill" style={{ fontSize: '0.8rem', padding: '0.2rem 0.55rem' }}>
                        <span style={{ marginRight: 3 }}>{getDeterministicEmoji(tag.name)}</span>
                        <span>{tag.name}</span>
                      </span>
                    ))}
                  </div>
                  {/* Tag list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {tags.map(tag => (
                      <div key={tag.id} className="admin-tag-item" style={{ padding: '0.65rem 0.85rem', border: '1px solid var(--admin-border)', borderRadius: 6 }}>
                        <span style={{ fontSize: '1.1rem', marginRight: '0.4rem', userSelect: 'none' }}>
                          {getDeterministicEmoji(tag.name)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="admin-tag-name" style={{ fontWeight: 600, color: 'var(--admin-text-1)', fontSize: '0.86rem' }}>{tag.name}</div>
                          <div className="admin-tag-meta" style={{ fontSize: '0.74rem', color: 'var(--admin-text-3)' }}>#{tag.slug}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleEditTag(tag)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <IconEdit /> 编辑
                          </button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDeleteTag(tag.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <IconTrash /> 删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
