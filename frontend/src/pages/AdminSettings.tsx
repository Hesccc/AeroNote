import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { AdminLayout } from '../components/AdminLayout';

interface SettingTab {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
}

const TABS: SettingTab[] = [
  {
    id: 'basic',
    name: '站点信息',
    desc: '全站标题、域名网址及工信部备案信息',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    name: '视觉与外观',
    desc: '站长头像、浏览器标签图标及首页横幅',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: 'seo',
    name: 'SEO 检索',
    desc: '搜索引擎 Meta 关键词与全站摘要说明',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: 'about',
    name: '作者自述',
    desc: '博主个人职业头衔定位与主页详细自述',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 'ai',
    name: 'AI 大模型',
    desc: 'OpenAI 协议大模型接口、API Key 与模型设定',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L13 14h-2l.25-4.07A4.002 4.002 0 0 1 12 2z" />
        <circle cx="12" cy="18" r="2" />
        <path d="M6 10H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 10h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
    {
      id: 'ai-scheduler',
      name: 'AI 定时任务',
      desc: '自动化提取分类/标签/摘要任务管理与执行日志',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'ai-prompts',
      name: 'AI 提示词配置',
      desc: '按任务项分类自定义各功能 Prompt 与模板变量',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'open-api',
      name: '开放 API 与同步',
      desc: '思源笔记、Obsidian 及外部 Webhook 推送密钥与配置',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
    {
      id: 'comment',
      name: '评论设置 (Giscus)',
      desc: '基于 GitHub Discussions 的无服务器极客评论系统',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ];

export const AdminSettings: React.FC = () => {
  const [config, setConfig] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(() => Object.keys(config).length === 0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [bgPreviewError, setBgPreviewError] = useState(false);

  // AI 连通性测试状态
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // AI 定时任务状态与日志
  const [schedulerStatus, setSchedulerStatus] = useState<{
    enabled: boolean;
    cron: string;
    threads: number;
    running: boolean;
    is_batch_running: boolean;
    in_flight_count: number;
    last_run_time: string;
    next_run_time: string;
    processed_count: number;
    pending_categories_count: number;
    pending_tags_count: number;
    pending_summary_count: number;
    total_pending: number;
  } | null>(null);
  const [schedulerLogs, setSchedulerLogs] = useState<Array<{ time: string; level: string; message: string }>>([]);
  const [cronInput, setCronInput] = useState('*/5 * * * *');
  const [threadsInput, setThreadsInput] = useState(3);
  const [savingCron, setSavingCron] = useState(false);
  const [savingThreads, setSavingThreads] = useState(false);
  const [togglingScheduler, setTogglingScheduler] = useState(false);
  const [triggeringScheduler, setTriggeringScheduler] = useState(false);
  const [schedulerMsg, setSchedulerMsg] = useState('');

  // AI 提示词自定义配置状态
  const [promptsList, setPromptsList] = useState<any[]>([]);
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [savingPromptKey, setSavingPromptKey] = useState<string | null>(null);
  const [promptMsg, setPromptMsg] = useState('');

  // 开放 API Token 状态
  const [openToken, setOpenToken] = useState('');
  const [resettingToken, setResettingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [openTokenMsg, setOpenTokenMsg] = useState('');

  const loadOpenToken = () => {
    api.adminGetOpenToken().then(res => {
      setOpenToken(res.token || '');
    }).catch(console.error);
  };

  const handleResetOpenToken = async () => {
    if (!confirm('确定要重新生成开放 API 密钥吗？原有的 Token 将立即失效，请同步更新下游发布系统（如思源笔记）。')) return;
    setResettingToken(true);
    try {
      const res = await api.adminResetOpenToken();
      setOpenToken(res.token);
      setOpenTokenMsg(res.msg || 'Token 已更新！');
      setTimeout(() => setOpenTokenMsg(''), 4000);
    } catch (err: unknown) {
      setError((err as Error).message || '重置 Token 失败');
    } finally {
      setResettingToken(false);
    }
  };

  const handleCopyOpenToken = () => {
    if (!openToken) return;
    navigator.clipboard.writeText(openToken).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }).catch(() => {});
  };

  const loadPromptsData = () => {
    api.aiGetPrompts().then(res => {
      setPromptsList(res.prompts || []);
      const drafts: Record<string, string> = {};
      (res.prompts || []).forEach(p => {
        drafts[p.key] = p.current_prompt;
      });
      setPromptDrafts(drafts);
    }).catch(console.error);
  };

  const loadSchedulerData = () => {
    api.aiGetSchedulerStatus().then(res => {
      setSchedulerStatus(res);
      if (res.cron) setCronInput(res.cron);
      if (res.threads) setThreadsInput(res.threads);
    }).catch(console.error);
    api.aiGetSchedulerLogs().then(res => setSchedulerLogs(res.logs || [])).catch(console.error);
  };

  const handleSaveThreads = async (num: number) => {
    setSavingThreads(true);
    setSchedulerMsg('');
    try {
      const res = await api.aiSetSchedulerThreads(num);
      setSchedulerMsg(res.msg);
      setSchedulerStatus(res.status);
      setThreadsInput(res.status.threads);
    } catch (err: unknown) {
      setError((err as Error).message || '保存并发线程数失败');
    } finally {
      setSavingThreads(false);
    }
  };

  const handleSaveCron = async (exprToSave?: string) => {
    const expr = exprToSave || cronInput;
    setSavingCron(true);
    setSchedulerMsg('');
    try {
      const res = await api.aiSetSchedulerCron(expr);
      setSchedulerMsg(res.msg);
      setSchedulerStatus(res.status);
      setCronInput(res.status.cron);
    } catch (err: unknown) {
      setError((err as Error).message || '保存 Cron 表达式失败');
    } finally {
      setSavingCron(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-scheduler') {
      loadSchedulerData();
    }
  }, [activeTab]);

  const handleToggleScheduler = async (newEnabled: boolean) => {
    setTogglingScheduler(true);
    setSchedulerMsg('');
    try {
      await api.aiToggleScheduler(newEnabled);
      setSchedulerMsg(`定时任务已${newEnabled ? '启用' : '禁用'}`);
      loadSchedulerData();
    } catch (err: unknown) {
      setError((err as Error).message || '切换定时任务失败');
    } finally {
      setTogglingScheduler(false);
    }
  };

  const handleTriggerScheduler = async () => {
    setTriggeringScheduler(true);
    setSchedulerMsg('');
    try {
      const res = await api.aiTriggerScheduler();
      setSchedulerMsg(res.msg);
      loadSchedulerData();
    } catch (err: unknown) {
      setError((err as Error).message || '触发任务失败');
    } finally {
      setTriggeringScheduler(false);
    }
  };

  const handleSavePrompt = async (key: string, value: string) => {
    setSavingPromptKey(key);
    setPromptMsg('');
    try {
      const res = await api.aiUpdatePrompt(key, value);
      setPromptMsg(res.msg || 'Prompt 提示词保存成功！');
      setPromptsList(res.prompts || []);
      setEditingPromptKey(null);
      setTimeout(() => setPromptMsg(''), 4000);
    } catch (err: unknown) {
      setError((err as Error).message || '保存提示词失败');
    } finally {
      setSavingPromptKey(null);
    }
  };

  const handleResetPrompt = (key: string, defaultVal: string) => {
    setPromptDrafts(prev => ({ ...prev, [key]: defaultVal }));
    handleSavePrompt(key, defaultVal);
  };

  useEffect(() => {
    api.getConfig()
      .then(data => { setConfig(data); setLoading(false); })
      .catch(err => { setError(err.message || '获取配置信息失败'); setLoading(false); });
    loadPromptsData();
    loadOpenToken();
  }, []);

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (key === 'homepage_bg') setBgPreviewError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const updated = await api.adminUpdateConfig(config);
      setConfig(updated);
      setMsg('设置已保存并同步全站生效！');
      setSaving(false);
      if (updated.homepage_bg) {
        document.documentElement.style.setProperty('--runtime-bg-image', `url("${updated.homepage_bg}")`);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '保存设置失败');
      setSaving(false);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await api.aiTestConnection({
        api_key: config.llm_api_key,
        base_url: config.llm_base_url,
        model: config.llm_model,
      });
      setAiTestResult({ success: true, msg: res.msg });
    } catch (err: unknown) {
      setAiTestResult({ success: false, msg: (err as Error).message || '连接失败' });
    } finally {
      setTestingAi(false);
    }
  };

  const activeTabMeta = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <div className="admin-page-title">系统设置</div>
          <div className="admin-page-subtitle">管理全站全局配置、SEO 检索、前台视觉与作者自述</div>
        </div>
      </div>

      {msg && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: '1.25rem' }}>
          {msg}
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-loading" style={{ padding: '4rem 0' }}>
          <div className="admin-loading-dots">
            <span className="admin-loading-dot" /><span className="admin-loading-dot" /><span className="admin-loading-dot" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="settings-single-column-form">
          {/* Top Segmented Sub-Navbar above content card */}
          <div className="settings-top-navbar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`settings-top-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              >
                <span className="top-tab-icon">{tab.icon}</span>
                <span className="top-tab-title">{tab.name}</span>
              </button>
            ))}
          </div>

          {/* Configuration Workspace Block directly below */}
          <main className="settings-workspace-card">
            <div className="settings-pane-header">
              <h3 className="settings-pane-title">{activeTabMeta.name}</h3>
              <p className="settings-pane-desc">{activeTabMeta.desc}</p>
            </div>

              {/* 1. Basic & Site */}
              {activeTab === 'basic' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">网站标题 (Title) *</label>
                    <input
                      type="text"
                      value={config.website_title || ''}
                      onChange={e => handleChange('website_title', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：AeroNote"
                    />
                    <div className="admin-form-hint">显示于前台顶栏、移动端菜单、浏览器标签与全站副标题</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">站点主域名 (URL) *</label>
                    <input
                      type="url"
                      value={config.website_url || ''}
                      onChange={e => handleChange('website_url', e.target.value)}
                      className="admin-form-control"
                      placeholder="https://example.com"
                    />
                    <div className="admin-form-hint">生成规范链接 (Canonical URL)、Sitemap 与 RSS 订阅基准地址</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">工信部 ICP 备案号</label>
                    <input
                      type="text"
                      value={config.website_icp || ''}
                      onChange={e => handleChange('website_icp', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：湘ICP备20003211号-1"
                    />
                    <div className="admin-form-hint">展示在全站底部的工信部合规备案凭证，支持自动跳转查询</div>
                  </div>
                </div>
              )}

              {/* 2. Appearance & Identity */}
              {activeTab === 'appearance' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">站长个人头像 URL</label>
                    <input
                      type="text"
                      value={config.website_avatar || ''}
                      onChange={e => handleChange('website_avatar', e.target.value)}
                      className="admin-form-control"
                      placeholder="如: /uploads/images/... 或外部高质量图片链接"
                    />
                    <div className="admin-form-hint">展示于“关于我”页面、前台顶栏微徽标及后台左侧用户栏</div>

                    {config.website_avatar && (
                      <div className="settings-preview-row">
                        <img
                          src={config.website_avatar}
                          alt="头像预览"
                          className="avatar-preview-img"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="preview-label-group">
                          <div className="preview-label-title">当前头像实时预览</div>
                          <div className="preview-label-sub">{config.website_avatar}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">标签页 Favicon 图标 URL</label>
                    <input
                      type="text"
                      value={config.website_icon || ''}
                      onChange={e => handleChange('website_icon', e.target.value)}
                      className="admin-form-control"
                      placeholder="/favicon.ico 或图片完整 URL"
                    />
                    <div className="admin-form-hint">浏览器标签页的小图标，支持即时注入 DOM 更新</div>

                    {config.website_icon && (
                      <div className="settings-preview-row">
                        <img
                          src={config.website_icon}
                          alt="图标预览"
                          style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'contain' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="preview-label">Favicon 图标预览</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">首页副标语 (Hero Subtitle)</label>
                    <input
                      type="text"
                      value={config.homepage_subtitle || ''}
                      onChange={e => handleChange('homepage_subtitle', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：记录技术沉淀 · 分享生活思考 · 散漫而行"
                    />
                    <div className="admin-form-hint">前台首页顶部主标题下方的一句个性化签名</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">首页背景图片 (URL 或相对路径 /uploads/...)</label>
                    <input
                      type="text"
                      value={config.homepage_bg || ''}
                      onChange={e => handleChange('homepage_bg', e.target.value)}
                      className="admin-form-control"
                      placeholder="支持完整 URL 或相对路径 /uploads/images/..."
                    />
                    <div className="admin-form-hint">支持完整外部 HTTP 链接，也支持输入系统上传路径（如 /uploads/images/...）</div>

                    {config.homepage_bg && !bgPreviewError && (
                      <div className="bg-preview-box">
                        <img
                          src={config.homepage_bg}
                          alt="背景预览"
                          onError={() => setBgPreviewError(true)}
                          className="bg-preview-img"
                        />
                        <span className="bg-preview-badge">背景图片预览</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. SEO */}
              {activeTab === 'seo' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">全局关键词 (Meta Keywords)</label>
                    <input
                      type="text"
                      value={config.website_keywords || ''}
                      onChange={e => handleChange('website_keywords', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：Splunk; Python; Linux; 安全运营; 运维自动化"
                    />
                    <div className="admin-form-hint">有助于提升爬虫收录权重，多个关键词请使用分号 (;) 或逗号分隔</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">全站摘要描述 (Meta Description)</label>
                    <textarea
                      value={config.website_desc || ''}
                      onChange={e => handleChange('website_desc', e.target.value)}
                      className="admin-form-control"
                      placeholder="简洁描述博客的主要技术方向与内容沉淀，建议 80~150 字"
                      rows={5}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                    <div className="admin-form-hint">直接呈现于搜索引擎检索卡片正文及社交分享链接卡片中</div>
                  </div>
                </div>
              )}

              {/* 4. About Author */}
              {activeTab === 'about' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">博主头衔定位 (Profile Subtitle)</label>
                    <input
                      type="text"
                      value={config.about_profile_subtitle || ''}
                      onChange={e => handleChange('about_profile_subtitle', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：安全运营 / 数据分析 / 自动化运维 / 独立技术博主"
                    />
                    <div className="admin-form-hint">展示在“关于”页个人名片名字下方的身份定位说明</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">个人详细自述正文</label>
                    <textarea
                      value={config.about_content || ''}
                      onChange={e => handleChange('about_content', e.target.value)}
                      className="admin-form-control"
                      placeholder="支持多行文本，记录个人技术成长路径、开源项目与个人寄语..."
                      rows={9}
                      style={{ minHeight: '180px', resize: 'vertical', lineHeight: 1.7 }}
                    />
                    <div className="admin-form-hint">前台渲染时严格保留换行排版与段落间隔</div>
                  </div>
                </div>
              )}

              {/* 5. AI Large Language Model */}
              {activeTab === 'ai' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">API 接口基础地址 (Base URL) *</label>
                    <input
                      type="text"
                      value={config.llm_base_url || ''}
                      onChange={e => handleChange('llm_base_url', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：https://api.openai.com/v1 或第三方中转/自建 Ollama 兼容地址"
                    />
                    <div className="admin-form-hint">兼容所有遵循 OpenAI 标准的供应商（DeepSeek, Moonshot, 阿里云百炼, OpenAI, Ollama 等）</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">API Key 凭证 *</label>
                    <input
                      type="password"
                      value={config.llm_api_key || ''}
                      onChange={e => handleChange('llm_api_key', e.target.value)}
                      className="admin-form-control"
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                    <div className="admin-form-hint">密钥加密保存在本地配置中，用于文章分类标签生成、智能摘要提炼与文本校对</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">模型标识符 (Model ID) *</label>
                    <input
                      type="text"
                      value={config.llm_model || ''}
                      onChange={e => handleChange('llm_model', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：gemini-3.8-flash-high, qwen3.8-max, gpt-4o-mini 等"
                    />
                    <div className="admin-form-hint">指定调用的大模型具体型号名称（请与服务商所提供的 Model ID 一致）</div>
                  </div>

                  {/* AI 连通性测试板块 */}
                  <div style={{ padding: '1rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 8, marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--admin-text-1)' }}>模型服务连通性测试</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--admin-text-3)', marginTop: 2 }}>
                          直接使用上方填写的参数进行鉴权握手，无需先行保存
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestAi}
                        disabled={testingAi || !config.llm_api_key}
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                      >
                        {testingAi ? '正在连接探测...' : '测试接口连通性'}
                      </button>
                    </div>

                    {aiTestResult && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 6,
                          fontSize: '0.82rem',
                          lineHeight: 1.5,
                          background: aiTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: aiTestResult.success ? 'var(--admin-success)' : 'var(--admin-danger)',
                          border: `1px solid ${aiTestResult.success ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {aiTestResult.success ? `✓ ${aiTestResult.msg}` : `✕ ${aiTestResult.msg}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. AI Scheduled Tasks & Logs */}
              {activeTab === 'ai-scheduler' && (
                <div className="settings-form-stack">
                  {schedulerMsg && (
                    <div className="admin-alert admin-alert-success" style={{ marginBottom: '0.5rem' }}>
                      {schedulerMsg}
                    </div>
                  )}

                  {/* 调度器控制看板卡片 */}
                  <div style={{ padding: '1.25rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--admin-border)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--admin-text-1)', margin: 0 }}>
                            后台自动异步分析提取任务
                          </h4>
                          <span className={`admin-badge ${schedulerStatus?.enabled ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                            <span className="admin-badge-dot" />
                            {schedulerStatus?.enabled ? '已启用 (运行中)' : '已禁用 (休眠)'}
                          </span>
                          {schedulerStatus?.is_batch_running && (
                            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)', color: 'var(--admin-accent)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                              ⚡ 多线程处理中 ({schedulerStatus.in_flight_count} 篇在途)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-3)', marginTop: '0.35rem' }}>
                          周期性扫描未关联分类、未关联标签或缺失摘要的文章，调用大模型并发提取与丰富（具备互斥锁与防积压避让机制，已处理文章绝不重复分析）
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleScheduler(!schedulerStatus?.enabled)}
                          disabled={togglingScheduler}
                          className={`admin-btn admin-btn-sm ${schedulerStatus?.enabled ? 'admin-btn-secondary' : 'admin-btn-primary'}`}
                        >
                          {togglingScheduler ? '切换中...' : (schedulerStatus?.enabled ? '暂停/禁用任务' : '开启自动调度')}
                        </button>
                        <button
                          type="button"
                          onClick={handleTriggerScheduler}
                          disabled={triggeringScheduler}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          title="立即触发一次文章扫描与补齐处理"
                        >
                          {triggeringScheduler ? '处理中...' : '立即执行一次'}
                        </button>
                      </div>
                    </div>

                    {/* 状态参数网格 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                        <span className="analytic-label">上次执行时间</span>
                        <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--admin-text-1)' }}>
                          {schedulerStatus?.last_run_time || '等待调度'}
                        </span>
                      </div>
                      <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                        <span className="analytic-label">下次计划触发</span>
                        <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--admin-accent)' }}>
                          {schedulerStatus?.next_run_time || '等待计算'}
                        </span>
                      </div>
                      <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                        <span className="analytic-label">待补齐分类/标签文章</span>
                        <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--admin-text-1)' }}>
                          {schedulerStatus ? schedulerStatus.pending_categories_count : '--'}
                        </span>
                      </div>
                      <div className="stat-analytic-box" style={{ padding: '0.75rem' }}>
                        <span className="analytic-label">待补齐摘要文章</span>
                        <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--admin-text-1)' }}>
                          {schedulerStatus ? schedulerStatus.pending_summary_count : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 调度执行时间调整控件 (Cron 表达式) */}
                  <div style={{ padding: '1.25rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 10, marginTop: '0.5rem' }}>
                    <div style={{ marginBottom: '0.85rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--admin-text-1)', margin: 0 }}>
                        执行周期与时间策略 (Cron 表达式)
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)', marginTop: '0.2rem' }}>
                        使用标准的 5 位 Unix Cron 表达式灵活控制执行周期（分 时 日 月 周）
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <input
                          type="text"
                          value={cronInput}
                          onChange={e => setCronInput(e.target.value)}
                          placeholder="例如: */5 * * * * (每 5 分钟)"
                          className="admin-form-control"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveCron()}
                        disabled={savingCron || !cronInput.trim()}
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        style={{ minWidth: '110px' }}
                      >
                        {savingCron ? '校验保存中...' : '更新执行周期'}
                      </button>
                    </div>

                    {/* 常用预设快捷方式 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--admin-text-3)' }}>常用快捷周期预设:</span>
                      {[
                        { label: '每 2 分钟', cron: '*/2 * * * *' },
                        { label: '每 5 分钟 (推荐)', cron: '*/5 * * * *' },
                        { label: '每 15 分钟', cron: '*/15 * * * *' },
                        { label: '每小时整', cron: '0 * * * *' },
                        { label: '每天凌晨 2 点', cron: '0 2 * * *' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCronInput(preset.cron);
                            handleSaveCron(preset.cron);
                          }}
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.55rem',
                            border: '1px solid var(--admin-border)',
                            background: cronInput === preset.cron ? 'var(--admin-hover)' : 'transparent',
                            color: cronInput === preset.cron ? 'var(--admin-text-1)' : 'var(--admin-text-2)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 并发多线程数调节控件 */}
                  <div style={{ padding: '1.25rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 10, marginTop: '0.5rem' }}>
                    <div style={{ marginBottom: '0.85rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--admin-text-1)', margin: 0 }}>
                        大模型处理并发线程数 (ThreadPoolExecutor)
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-3)', marginTop: '0.2rem' }}>
                        单批次文章将分配到多线程并行调用大模型分析，大幅提升吞吐速度（建议设置 2~5 线程，防超出服务商并发限制）
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '220px' }}>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={threadsInput}
                          onChange={e => setThreadsInput(parseInt(e.target.value, 10))}
                          style={{ flex: 1, accentColor: 'var(--admin-text-1)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: '40px', color: 'var(--admin-text-1)' }}>
                          {threadsInput} 线程
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {[1, 3, 5, 8].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setThreadsInput(num);
                              handleSaveThreads(num);
                            }}
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.5rem',
                              border: '1px solid var(--admin-border)',
                              background: threadsInput === num ? 'var(--admin-hover)' : 'transparent',
                              color: threadsInput === num ? 'var(--admin-text-1)' : 'var(--admin-text-2)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            {num} 线程
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleSaveThreads(threadsInput)}
                          disabled={savingThreads}
                          className="admin-btn admin-btn-primary admin-btn-sm"
                          style={{ minWidth: '90px', marginLeft: '0.25rem' }}
                        >
                          {savingThreads ? '保存中...' : '保存线程数'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 调度执行日志控制台面板 */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className="admin-form-label" style={{ margin: 0 }}>调度任务实时日志 (最近 200 条记录)</label>
                      <button
                        type="button"
                        onClick={loadSchedulerData}
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        style={{ padding: '0.15rem 0.5rem', fontSize: '0.74rem' }}
                      >
                        刷新日志
                      </button>
                    </div>

                    <div style={{
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 8,
                      padding: '0.75rem',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      {schedulerLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--admin-text-3)', padding: '2rem 0' }}>
                          暂无调度执行日志记录
                        </div>
                      ) : (
                        schedulerLogs.map((log, idx) => {
                          const levelColor = log.level === 'SUCCESS' ? 'var(--admin-success)' :
                                             log.level === 'ERROR' ? 'var(--admin-danger)' :
                                             log.level === 'WARN' ? 'var(--admin-warning)' : 'var(--admin-text-3)';
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--admin-text-3)', flexShrink: 0 }}>[{log.time}]</span>
                              <span style={{ color: levelColor, fontWeight: 700, flexShrink: 0, width: '56px' }}>[{log.level}]</span>
                              <span style={{ color: 'var(--admin-text-1)', wordBreak: 'break-all' }}>{log.message}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pane: AI Prompts Customization */}
              {activeTab === 'ai-prompts' && (
                <div className="settings-pane active">
                  <div className="settings-pane-header">
                    <h3 className="settings-pane-title">AI 任务项 Prompt 自定义配置</h3>
                    <p className="settings-pane-desc">按功能分类配置大模型提示词模板，支持自由修改指导原则、输出约束与业务要求；保存后在定时任务调度与创作助手中即时生效。</p>
                  </div>

                  {promptMsg && (
                    <div className="admin-alert admin-alert-success" style={{ marginBottom: '1.25rem' }}>
                      <span>✓</span>
                      <span>{promptMsg}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {promptsList.map(item => {
                      const isEditing = editingPromptKey === item.key;
                      const isSaving = savingPromptKey === item.key;
                      const draftValue = promptDrafts[item.key] ?? item.current_prompt;

                      return (
                        <div key={item.key} className="admin-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="admin-badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                  {item.category}
                                </span>
                                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--admin-text-1)', fontWeight: 600 }}>
                                  {item.title}
                                </h4>
                                {item.is_customized ? (
                                  <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                    ● 已自定义
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-3)', background: 'var(--admin-hover)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                    默认模板
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--admin-text-3)' }}>
                                {item.desc}
                              </p>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {item.is_customized && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-ghost admin-btn-sm"
                                  onClick={() => handleResetPrompt(item.key, item.default_prompt)}
                                  disabled={isSaving}
                                  title="清空自定义配置并恢复至系统内置默认 Prompt"
                                >
                                  恢复默认
                                </button>
                              )}
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-primary admin-btn-sm"
                                    onClick={() => handleSavePrompt(item.key, draftValue)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? '保存中...' : '保存修改'}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-secondary admin-btn-sm"
                                    onClick={() => {
                                      setEditingPromptKey(null);
                                      setPromptDrafts(prev => ({ ...prev, [item.key]: item.current_prompt }));
                                    }}
                                    disabled={isSaving}
                                  >
                                    取消
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => setEditingPromptKey(item.key)}
                                >
                                  编辑 Prompt
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <textarea
                                className="admin-form-control"
                                rows={8}
                                value={draftValue}
                                onChange={e => {
                                  const val = e.target.value;
                                  setPromptDrafts(prev => ({ ...prev, [item.key]: val }));
                                }}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.82rem',
                                  lineHeight: 1.6,
                                  background: 'var(--admin-bg)',
                                  resize: 'vertical',
                                }}
                              />
                              <span style={{ fontSize: '0.74rem', color: 'var(--admin-text-3)' }}>
                                💡 提示：支持保留系统预设占位符，例如分类提取支持 <code>{'{category_list}'}</code> 与 <code>{'{tag_list}'}</code>。
                              </span>
                            </div>
                          ) : (
                            <div style={{
                              background: 'var(--admin-bg)',
                              border: '1px solid var(--admin-border)',
                              borderRadius: 8,
                              padding: '0.85rem 1rem',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              color: 'var(--admin-text-2)',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              maxHeight: '140px',
                              overflowY: 'auto',
                            }}>
                              {item.current_prompt}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pane: Open API & Siyuan Webhook Sync */}
              {activeTab === 'open-api' && (
                <div className="settings-pane active">
                  <div className="settings-pane-header">
                    <h3 className="settings-pane-title">开放 API 与外部发布对接</h3>
                    <p className="settings-pane-desc">支持思源笔记（通过 siyuan-plugin-publisher 插件）、Obsidian、以及外部自动化系统（Webhook / CI/CD）一键推送文章入库与幂等更新。</p>
                  </div>

                  {openTokenMsg && (
                    <div className="admin-alert admin-alert-success" style={{ marginBottom: '1.25rem' }}>
                      <span>✓</span>
                      <span>{openTokenMsg}</span>
                    </div>
                  )}

                  {/* 1. API 认证密钥卡片 */}
                  <div className="admin-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--admin-text-1)', fontWeight: 600 }}>
                          🔑 开放接口专属 API Token
                        </h4>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--admin-text-3)' }}>
                          高强度独立长效密钥，不受管理员日常登录注销影响，用于下游发布系统鉴权。
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={handleCopyOpenToken}
                          disabled={!openToken}
                        >
                          {tokenCopied ? '✓ 已复制' : '复制 Token'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={handleResetOpenToken}
                          disabled={resettingToken}
                          title="重新生成随机 Token"
                        >
                          {resettingToken ? '重置中…' : '重新生成'}
                        </button>
                      </div>
                    </div>

                    <div style={{
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 8,
                      padding: '0.75rem 1rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      color: openToken ? 'var(--admin-text-1)' : 'var(--admin-text-3)',
                      wordBreak: 'break-all',
                      userSelect: 'all',
                      letterSpacing: '0.02em',
                    }}>
                      {openToken || '正在生成或读取开放 Token...'}
                    </div>
                  </div>

                  {/* 2. 思源笔记与外部系统对接指引 */}
                  <div className="admin-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--admin-text-1)', fontWeight: 600 }}>
                      🚀 思源笔记 Publisher 插件对接配置指南
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem', color: 'var(--admin-text-2)', lineHeight: 1.6 }}>
                      <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--admin-border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text-1)', marginBottom: '0.5rem' }}>
                          1. 接口同步请求地址 (Webhook Endpoint)
                        </div>
                        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                          {window.location.origin}/api/open/posts/sync
                        </code>
                      </div>

                      <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--admin-border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text-1)', marginBottom: '0.5rem' }}>
                          2. 请求头认证配置 (HTTP Headers)
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--admin-text-2)' }}>
                          Authorization: Bearer {openToken || '<YOUR_TOKEN>'}<br />
                          Content-Type: application/json
                        </div>
                      </div>

                      <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--admin-border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text-1)', marginBottom: '0.5rem' }}>
                          3. 请求体数据协议规范 (JSON Payload)
                        </div>
                        <pre style={{
                          margin: 0,
                          padding: '0.75rem',
                          background: 'var(--admin-card-bg)',
                          borderRadius: 6,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                          overflowX: 'auto',
                          color: 'var(--admin-text-1)',
                        }}>
{`{
  "source_id": "20240315120000-xxxx", // 思源文档唯一ID (支持自动覆盖更新，不重复生篇)
  "title": "文章标题",
  "content": "# Markdown 文章正文...",
  "category": "分类名称",           // 可选，不存在自动创建
  "tags": ["标签1", "标签2"],       // 可选，数组或逗号分隔字符串
  "thumbnail": "https://...",     // 可选封面配图
  "status": 0                     // 0: 直接发布 (默认), 3: 存为草稿
}`}
                        </pre>
                      </div>

                      <div style={{ color: 'var(--admin-text-3)', fontSize: '0.8rem' }}>
                        💡 <strong>幂等特性保证</strong>：相同 <code>source_id</code>（或思源文档 ID）再次推送时，系统将智能就地更新该文章的标题、内容、分类与标签，而不会产生重复多余文章。
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. Giscus Comment Settings */}
              {activeTab === 'comment' && (
                <div className="settings-form-stack">
                  <div className="admin-form-group">
                    <label className="admin-form-label">Giscus 评论功能总开关</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="radio"
                          name="giscus_enabled"
                          checked={config.giscus_enabled === 'true' || config.giscus_enabled === '1'}
                          onChange={() => handleChange('giscus_enabled', 'true')}
                        />
                        <span>开启评论区</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="radio"
                          name="giscus_enabled"
                          checked={config.giscus_enabled !== 'true' && config.giscus_enabled !== '1'}
                          onChange={() => handleChange('giscus_enabled', 'false')}
                        />
                        <span>关闭评论区</span>
                      </label>
                    </div>
                    <div className="admin-form-hint">
                      开启后将在文章详情页底部加载 Giscus 评论区；若尚未配置仓库信息，前台会展示提示。
                    </div>
                  </div>

                  <div style={{ padding: '0.9rem 1.1rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 8, fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--admin-text-2)' }}>
                    💡 <strong>如何获取 Giscus 配置？</strong>
                    <br />
                    1. 确保您的 GitHub 仓库为 <strong>Public（公开）</strong>，且在仓库 <em>Settings → Features</em> 中勾选开启了 <strong>Discussions</strong>。
                    <br />
                    2. 在 GitHub 上安装 <a href="https://github.com/apps/giscus" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-primary)', textDecoration: 'underline' }}>Giscus App</a> 并授权该仓库。
                    <br />
                    3. 打开 <a href="https://giscus.app/zh-CN" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-primary)', textDecoration: 'underline' }}>giscus.app</a> 官网，输入您的仓库名称，即可直接复制生成的 Repository ID 与 Category ID。
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">GitHub 仓库名称 (Repo) *</label>
                    <input
                      type="text"
                      value={config.giscus_repo || ''}
                      onChange={e => handleChange('giscus_repo', e.target.value)}
                      className="admin-form-control"
                      placeholder="格式：所有者/仓库名，如 Hesccc/AeroNote"
                    />
                    <div className="admin-form-hint">必须是公开仓库，如 Hesccc/AeroNote</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">仓库唯一 ID (Repository ID) *</label>
                    <input
                      type="text"
                      value={config.giscus_repo_id || ''}
                      onChange={e => handleChange('giscus_repo_id', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：R_kgDO..."
                    />
                    <div className="admin-form-hint">在 giscus.app 填入仓库名后自动生成的 data-repo-id</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Discussions 分类名 (Category)</label>
                    <input
                      type="text"
                      value={config.giscus_category || ''}
                      onChange={e => handleChange('giscus_category', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：Announcements 或 General"
                    />
                    <div className="admin-form-hint">推荐使用 Announcements 分类（只有管理员可发主帖，读者可自由回复）</div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">分类唯一 ID (Category ID) *</label>
                    <input
                      type="text"
                      value={config.giscus_category_id || ''}
                      onChange={e => handleChange('giscus_category_id', e.target.value)}
                      className="admin-form-control"
                      placeholder="如：DIC_kwDO..."
                    />
                    <div className="admin-form-hint">在 giscus.app 选择分类后自动生成的 data-category-id</div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label className="admin-form-label">文章与 Discussion 映射关系</label>
                      <select
                        value={config.giscus_mapping || 'pathname'}
                        onChange={e => handleChange('giscus_mapping', e.target.value)}
                        className="admin-form-control"
                      >
                        <option value="pathname">URL 路径 (pathname，推荐)</option>
                        <option value="title">文章标题 (title)</option>
                        <option value="og:title">文章 OpenGraph 标题</option>
                      </select>
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-form-label">表情点赞 (Reactions)</label>
                      <select
                        value={config.giscus_reactions || '1'}
                        onChange={e => handleChange('giscus_reactions', e.target.value)}
                        className="admin-form-control"
                      >
                        <option value="1">开启 Reaction 表情互动</option>
                        <option value="0">关闭 Reaction 表情互动</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Save Bar (仅常规表单 Tab 展现) */}
              {!['ai-scheduler', 'ai-prompts', 'open-api'].includes(activeTab) && (
                <div className="settings-pane-footer">
                  <button
                    type="submit"
                    disabled={saving}
                    className="admin-btn admin-btn-primary"
                    style={{ minWidth: '150px' }}
                  >
                    {saving ? '正在保存更改...' : '保存当前设置'}
                  </button>
                </div>
              )}
            </main>
        </form>
      )}
    </AdminLayout>
  );
};
