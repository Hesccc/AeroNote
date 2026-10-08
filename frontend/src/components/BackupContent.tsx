import React, { useState, useEffect, useRef } from 'react';
import { api, type BackupFileItem } from '../utils/api';

export const BackupContent: React.FC = () => {
  const [backups, setBackups] = useState<BackupFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const sqlFileRef = useRef<HTMLInputElement>(null);
  const fullZipFileRef = useRef<HTMLInputElement>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const loadBackups = () => {
    setLoading(true);
    api.adminGetBackups()
      .then(res => {
        setBackups(res.backups);
        setLoading(false);
      })
      .catch(err => {
        showMsg(err.message || '获取备份列表失败', 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // 执行各类型导出
  const handleExport = async (type: 'markdown' | 'db' | 'oss' | 'full') => {
    const titles = {
      markdown: 'Markdown 文章归档',
      db: '数据库 SQL Dump',
      oss: 'OSS 图片库及本地静态资源',
      full: '全站数据与静态资源完整包',
    };
    setOperating(type);
    try {
      let res;
      if (type === 'markdown') res = await api.adminExportMarkdown();
      else if (type === 'db') res = await api.adminExportDatabase();
      else if (type === 'oss') res = await api.adminExportOss();
      else res = await api.adminExportFullSite();

      showMsg(res.msg || `${titles[type]} 导出成功！`);
      loadBackups();
    } catch (err: unknown) {
      showMsg((err as Error).message || `${titles[type]} 导出失败`, 'error');
    } finally {
      setOperating(null);
    }
  };

  // 删除备份文件
  const handleDelete = async (filename: string) => {
    if (!confirm(`确定删除备份文件「${filename}」吗？此操作不可撤销。`)) return;
    try {
      await api.adminDeleteBackup(filename);
      showMsg('备份文件已成功删除');
      setBackups(prev => prev.filter(b => b.filename !== filename));
    } catch (err: unknown) {
      showMsg((err as Error).message || '删除备份失败', 'error');
    }
  };

  // 安全带鉴权下载备份文件
  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      await api.adminDownloadBackup(filename);
      showMsg(`备份「${filename}」已开始下载`);
    } catch (err: unknown) {
      showMsg((err as Error).message || '下载备份失败', 'error');
    } finally {
      setDownloading(null);
    }
  };

  // 从已有文件恢复数据库
  const handleRestoreFromFile = async (filename: string) => {
    if (!confirm(`⚠️ 危险操作警告：\n确定要将底层数据库恢复至备份「${filename}」吗？\n当前数据库内的所有表与数据将被该备份全面覆盖！`)) return;
    setOperating(`restore_${filename}`);
    try {
      const res = await api.adminRestoreDatabase(filename);
      showMsg(res.msg || '数据库恢复完成！');
    } catch (err: unknown) {
      showMsg((err as Error).message || '数据库恢复失败', 'error');
    } finally {
      setOperating(null);
    }
  };

  // 上传 SQL 文件恢复数据库
  const handleUploadSqlRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`⚠️ 危险操作警告：\n确定要上传并执行 SQL 文件「${file.name}」吗？\n这将直接修改或覆盖现有数据库数据！`)) {
      if (sqlFileRef.current) sqlFileRef.current.value = '';
      return;
    }
    setOperating('upload_sql');
    try {
      const res = await api.adminRestoreDatabase(undefined, file);
      showMsg(res.msg || 'SQL 文件执行及数据库恢复完成！');
      loadBackups();
    } catch (err: unknown) {
      showMsg((err as Error).message || 'SQL 恢复失败', 'error');
    } finally {
      setOperating(null);
      if (sqlFileRef.current) sqlFileRef.current.value = '';
    }
  };

  // 从已有文件一键恢复全站
  const handleRestoreFullSiteFromFile = async (filename: string) => {
    if (!confirm(`⚠️ 高危操作警告：\n确定要使用全量容灾包「${filename}」一键恢复全站吗？\n当前数据库所有表和数据将被该备份完全重置覆盖，同时 uploads 图片库与静态附件也将同步还原！`)) return;
    setOperating(`restore_full_${filename}`);
    try {
      const res = await api.adminRestoreFullSite(filename);
      showMsg(res.msg || '全站一键恢复完成！');
      loadBackups();
    } catch (err: unknown) {
      showMsg((err as Error).message || '全站恢复失败', 'error');
    } finally {
      setOperating(null);
    }
  };

  // 上传 ZIP 文件一键恢复全站
  const handleUploadFullSiteRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`⚠️ 高危操作警告：\n确定要上传全站容灾包「${file.name}」并一键恢复全站吗？\n当前数据库所有表和数据将被完全重置覆盖，同时 uploads 图片库与静态附件也将同步还原！`)) {
      if (fullZipFileRef.current) fullZipFileRef.current.value = '';
      return;
    }
    setOperating('upload_full');
    try {
      const res = await api.adminRestoreFullSite(undefined, file);
      showMsg(res.msg || '全站一键恢复完成！');
      loadBackups();
    } catch (err: unknown) {
      showMsg((err as Error).message || '全站恢复失败', 'error');
    } finally {
      setOperating(null);
      if (fullZipFileRef.current) fullZipFileRef.current.value = '';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'markdown':
        return <span className="admin-badge" style={{ background: '#3b82f6', color: '#fff' }}>Markdown</span>;
      case 'database':
        return <span className="admin-badge" style={{ background: '#10b981', color: '#fff' }}>数据库 SQL</span>;
      case 'oss':
        return <span className="admin-badge" style={{ background: '#f59e0b', color: '#fff' }}>OSS/图片库</span>;
      default:
        return <span className="admin-badge" style={{ background: '#8b5cf6', color: '#fff' }}>全站备份</span>;
    }
  };

  return (
    <div className="backup-page-container" style={{ width: '100%' }}>
      {msg && (
        <div className={`admin-alert admin-alert-${msgType}`} style={{ marginBottom: '1rem' }}>
          <span>{msgType === 'success' ? '✓' : '✕'}</span>
          <span>{msg}</span>
        </div>
      )}

      {/* 快捷备份操作卡片面板 */}
      <div className="backup-grid-cards">
        {/* 1. 全站数据备份 */}
        <div className="backup-action-card">
          <div className="backup-card-header">
            <div className="backup-card-icon-box backup-icon-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <span className="backup-pill-tag">全量容灾</span>
          </div>

          <div className="backup-card-body">
            <h3 className="backup-card-title">全站数据与静态资源</h3>
            <p className="backup-card-desc">
              一键打包全量 SQL、文章原稿、本地 uploads 图片库及配置文件，提供整机级快照。
            </p>
          </div>

          <div className="backup-card-footer">
            <input
              type="file"
              ref={fullZipFileRef}
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleUploadFullSiteRestore}
            />
            <button
              type="button"
              className="backup-btn backup-btn-secondary"
              onClick={() => fullZipFileRef.current?.click()}
              disabled={!!operating}
              title="上传全站 ZIP 备份包直接一键恢复整机数据与静态附件"
            >
              {operating === 'upload_full' ? '恢复中…' : '一键恢复全站'}
            </button>
            <button
              type="button"
              className="backup-btn backup-btn-primary"
              onClick={() => handleExport('full')}
              disabled={!!operating}
            >
              {operating === 'full' ? '正在打包中…' : '一键打包全站'}
            </button>
          </div>
        </div>

        {/* 2. 数据库备份与恢复 */}
        <div className="backup-action-card">
          <div className="backup-card-header">
            <div className="backup-card-icon-box backup-icon-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <span className="backup-pill-tag">核心数据</span>
          </div>

          <div className="backup-card-body">
            <h3 className="backup-card-title">数据库备份与还原</h3>
            <p className="backup-card-desc">
              导出标准 MySQL 数据库结构与全部数据表；支持直接上传外部 SQL 脚本执行恢复。
            </p>
          </div>

          <div className="backup-card-footer">
            <input
              type="file"
              ref={sqlFileRef}
              accept=".sql"
              style={{ display: 'none' }}
              onChange={handleUploadSqlRestore}
            />
            <button
              type="button"
              className="backup-btn backup-btn-secondary"
              onClick={() => sqlFileRef.current?.click()}
              disabled={!!operating}
              title="上传外部 SQL 文件直接恢复数据库"
            >
              {operating === 'upload_sql' ? '恢复中…' : '上传还原'}
            </button>
            <button
              type="button"
              className="backup-btn backup-btn-primary"
              onClick={() => handleExport('db')}
              disabled={!!operating}
            >
              {operating === 'db' ? '导出中…' : '导出 SQL'}
            </button>
          </div>
        </div>

        {/* 3. Markdown 导出 */}
        <div className="backup-action-card">
          <div className="backup-card-header">
            <div className="backup-card-icon-box backup-icon-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span className="backup-pill-tag">文章原稿</span>
          </div>

          <div className="backup-card-body">
            <h3 className="backup-card-title">Markdown 文章导出</h3>
            <p className="backup-card-desc">
              批量生成独立 .md 文件打包，保留标题、分类、标签与摘要等 Frontmatter 元数据。
            </p>
          </div>

          <div className="backup-card-footer">
            <button
              type="button"
              className="backup-btn backup-btn-primary"
              onClick={() => handleExport('markdown')}
              disabled={!!operating}
            >
              {operating === 'markdown' ? '导出中…' : '导出文章归档'}
            </button>
          </div>
        </div>

        {/* 4. OSS 图片库备份 */}
        <div className="backup-action-card">
          <div className="backup-card-header">
            <div className="backup-card-icon-box backup-icon-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span className="backup-pill-tag">媒体资源</span>
          </div>

          <div className="backup-card-body">
            <h3 className="backup-card-title">OSS 图片库备份</h3>
            <p className="backup-card-desc">
              打包图床元数据、本地 uploads 静态媒体目录及缓存图片，保障图片资产安全。
            </p>
          </div>

          <div className="backup-card-footer">
            <button
              type="button"
              className="backup-btn backup-btn-primary"
              onClick={() => handleExport('oss')}
              disabled={!!operating}
            >
              {operating === 'oss' ? '打包中…' : '打包图片库'}
            </button>
          </div>
        </div>
      </div>

      {/* 历史备份文件管理列表 */}
      <div className="backup-table-card" style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--admin-text-1)', margin: 0 }}>已归档历史备份</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-3)', display: 'inline-block', marginTop: '0.2rem' }}>
              共 {backups.length} 个历史归档，可一键下载到本地或直接还原至数据库
            </span>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={loadBackups}
            disabled={loading}
          >
            🔄 刷新列表
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--admin-text-3)' }}>
            <div className="admin-loading-dots" style={{ marginBottom: '0.75rem' }}>
              <span className="admin-loading-dot" /><span className="admin-loading-dot" /><span className="admin-loading-dot" />
            </div>
            正在拉取备份文件清单...
          </div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--admin-text-3)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem', opacity: 0.6 }}>📦</div>
            <div style={{ fontSize: '0.92rem', color: 'var(--admin-text-2)', fontWeight: 500 }}>暂无已生成的备份文件</div>
            <p style={{ fontSize: '0.8rem', margin: '0.35rem 0 0', color: 'var(--admin-text-3)' }}>点击上方操作卡片即可立即生成对应的数据归档包</p>
          </div>
        ) : (
          <div className="admin-table-wrap" style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>备份文件名</th>
                  <th>类型</th>
                  <th>文件大小</th>
                  <th>创建时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.filename}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1rem', opacity: 0.85 }}>
                          {b.type === 'markdown' ? '📝' : (b.type === 'database' || b.filename.endsWith('.sql')) ? '🗄️' : b.type === 'oss' ? '🖼️' : '📦'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--admin-text-1)' }}>
                          {b.filename}
                        </span>
                      </div>
                    </td>
                    <td>{getTypeBadge(b.type)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: 'var(--admin-text-2)' }}>{b.size_formatted}</td>
                    <td style={{ fontSize: '0.84rem', color: 'var(--admin-text-3)' }}>{b.created_at}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => handleDownload(b.filename)}
                          disabled={downloading === b.filename}
                          title="下载到本地"
                        >
                          {downloading === b.filename ? '下载中…' : '下载'}
                        </button>
                        {(b.type === 'database' || b.filename.endsWith('.sql')) && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => handleRestoreFromFile(b.filename)}
                            disabled={!!operating}
                            title="从该 SQL 备份恢复数据库"
                          >
                            {operating === `restore_${b.filename}` ? '还原中…' : '恢复至此库'}
                          </button>
                        )}
                        {(b.type === 'full' || (b.filename.endsWith('.zip') && b.filename.includes('full'))) && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => handleRestoreFullSiteFromFile(b.filename)}
                            disabled={!!operating}
                            title="一键将整机备份包（数据库及图片附件）还原至全站"
                            style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.4)' }}
                          >
                            {operating === `restore_full_${b.filename}` ? '全站还原中…' : '一键恢复全站'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDelete(b.filename)}
                          title="永久删除此备份"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
