const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface Post {
  id: number;
  title: string;
  author: string;
  content: string;
  word_count?: number;
  access_count: number;
  thumbnail: string | null;
  status: number;
  create_time: string;
  update_time: string;
  meta_description: string | null;
  summary: string | null;
  categories: { id: number; name: string; slug: string; color: string }[];
  tags: { id: number; name: string; slug: string; color: string }[];
}

export interface PostNavInfo {
  id: number;
  title: string;
  thumbnail: string | null;
}

export interface PostDetailData extends Post {
  prev_post?: PostNavInfo | null;
  next_post?: PostNavInfo | null;
  related_posts?: Post[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  parent_id: number;
  priority?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export interface SystemEnv {
  os: string;
  run_env: string;
  python_v: string;
  flask_v: string;
  blog_v: string;
  datetime: string;
  db_type: string;
  SQLAlchemy_v: string;
  node_v: string;
  cpu_usage: number;
  mem_usage: number;
}

export interface BackupFileItem {
  filename: string;
  type: 'markdown' | 'oss' | 'database' | 'full';
  size: number;
  size_formatted: string;
  created_at: string;
  download_url: string;
}

export interface BackupListResult {
  backups: BackupFileItem[];
  count: number;
  backup_dir: string;
}

export interface BlogStats {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
  total_categories: number;
  total_tags: number;
  total_views: number;
  total_words: number;
  avg_words: number;
  with_cover_posts: number;
  without_cover_posts: number;
  top_posts: Array<{
    id: number;
    title: string;
    access_count: number;
    create_time: string;
  }>;
  recent_posts: Array<{
    id: number;
    title: string;
    status: number;
    create_time: string;
  }>;
  ai_scheduler?: {
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
  };
}

export interface AiPromptItem {
  key: string;
  category: string;
  title: string;
  desc: string;
  default_prompt: string;
  current_prompt: string;
  is_customized: boolean;
}

export interface OssImage {
  id: number;
  url: string;
  file_name: string;
  remark: string;
  create_time: string;
  update_time: string;
}

export interface OssImageListResult {
  images: OssImage[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('blog_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[API Network Error] 请求 ${url} 失败:`, error.message);
    throw new Error(`网络请求失败(${error.message})，请确认后端 Flask 服务已启动`);
  }

  if (response.status === 401) {
    localStorage.removeItem('blog_token');
    localStorage.removeItem('blog_username');
    if (!window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.msg || '认证已失效，正在跳转登录...');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.msg || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Authentication
  login: async (username: string, password: string) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('blog_token', data.token);
    localStorage.setItem('blog_username', data.username);
    return data;
  },
  
  logout: () => {
    localStorage.removeItem('blog_token');
    localStorage.removeItem('blog_username');
  },

  getCurrentUser: () => {
    return apiFetch('/api/auth/me');
  },

  changePassword: (data: { old_password: string; new_password: string }): Promise<{ msg: string }> => {
    return apiFetch('/api/manage/user/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Public Posts, Categories, Tags & Config
  getPosts: (params: { page?: number; per_page?: number; category?: string; tag?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.per_page) query.set('per_page', params.per_page.toString());
    if (params.category) query.set('category', params.category);
    if (params.tag) query.set('tag', params.tag);
    if (params.search) query.set('search', params.search);
    
    return apiFetch(`/api/posts?${query.toString()}`);
  },

  getPost: (id: number): Promise<PostDetailData> => {
    return apiFetch(`/api/posts/${id}`);
  },

  getCategories: (): Promise<Category[]> => {
    return apiFetch('/api/categories');
  },

  getTags: (): Promise<Tag[]> => {
    return apiFetch('/api/tags');
  },

  getConfig: (): Promise<Record<string, string>> => {
    return apiFetch('/api/config').then(data => {
      try {
        localStorage.setItem('blog_config', JSON.stringify(data));
      } catch (e) {
        console.error('Failed to cache config', e);
      }
      return data;
    });
  },

  // Admin Manage APIs
  adminGetPosts: (params: { page?: number; per_page?: number; search?: string; status?: number; category_id?: number; sort_by?: string; sort_order?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.per_page) query.set('per_page', params.per_page.toString());
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined && params.status !== null) query.set('status', params.status.toString());
    if (params.category_id) query.set('category_id', params.category_id.toString());
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);

    return apiFetch(`/api/manage/posts?${query.toString()}`);
  },

  adminGetPost: (id: number): Promise<Post> => {
    return apiFetch(`/api/manage/posts/${id}`);
  },

  adminCreatePost: (post: { title: string; content: string; status: number; category_id?: number; tag_ids: number[]; thumbnail?: string | null; meta_description?: string | null; summary?: string | null }): Promise<Post> => {
    return apiFetch('/api/manage/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  },

  adminUpdatePost: (id: number, post: { title?: string; content?: string; status?: number; category_id?: number | null; tag_ids?: number[]; thumbnail?: string | null; meta_description?: string | null; summary?: string | null }): Promise<Post> => {
    return apiFetch(`/api/manage/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(post),
    });
  },

  adminDeletePost: (id: number) => {
    return apiFetch(`/api/manage/posts/${id}`, {
      method: 'DELETE',
    });
  },

  adminGetEnv: (): Promise<SystemEnv> => {
    return apiFetch('/api/manage/env');
  },

  adminGetStats: (): Promise<BlogStats> => {
    return apiFetch('/api/manage/stats');
  },

  // Admin Categories & Tags
  adminCreateCategory: (cat: { name: string; slug: string; description?: string; color?: string; priority?: number }) => {
    return apiFetch('/api/manage/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  },

  adminUpdateCategory: (id: number, cat: { name?: string; slug?: string; description?: string; color?: string; priority?: number }) => {
    return apiFetch(`/api/manage/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat),
    });
  },

  adminDeleteCategory: (id: number) => {
    return apiFetch(`/api/manage/categories/${id}`, {
      method: 'DELETE',
    });
  },

  adminCreateTag: (tag: { name: string; slug: string; color?: string }) => {
    return apiFetch('/api/manage/tags', {
      method: 'POST',
      body: JSON.stringify(tag),
    });
  },

  adminUpdateTag: (id: number, tag: { name?: string; slug?: string; color?: string }) => {
    return apiFetch(`/api/manage/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tag),
    });
  },

  adminDeleteTag: (id: number) => {
    return apiFetch(`/api/manage/tags/${id}`, {
      method: 'DELETE',
    });
  },

  adminUpdateConfig: (config: Record<string, string>): Promise<Record<string, string>> => {
    return apiFetch('/api/manage/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }).then(data => {
      try {
        localStorage.setItem('blog_config', JSON.stringify(data));
      } catch (e) {
        console.error('Failed to update config cache', e);
      }
      return data;
    });
  },

  // OSS 图片库
  ossGetRandom: (): Promise<{ url: string | null; id?: number }> => {
    return apiFetch('/api/oss/random');
  },

  adminOssGetImages: (params: { page?: number; per_page?: number; search?: string; type?: string } = {}): Promise<OssImageListResult> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.per_page) query.set('per_page', params.per_page.toString());
    if (params.search) query.set('search', params.search);
    if (params.type) query.set('type', params.type);
    return apiFetch(`/api/manage/oss/images?${query.toString()}`);
  },

  adminOssAddImages: (urls: string[]): Promise<{ msg: string; added: OssImage[]; skipped: string[] }> => {
    return apiFetch('/api/manage/oss/images', {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
  },

  adminOssDeleteImage: (id: number) => {
    return apiFetch(`/api/manage/oss/images/${id}`, { method: 'DELETE' });
  },

  adminOssBatchDelete: (ids: number[]) => {
    return apiFetch('/api/manage/oss/images/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  adminOssImportFromPosts: (): Promise<{ msg: string; added: number; skipped: number }> => {
    return apiFetch('/api/manage/oss/import-from-posts', { method: 'POST' });
  },

  adminImportPosts: (file: File): Promise<{ msg: string; imported: number; skipped: number; titles: string[]; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/api/manage/posts/import', {
      method: 'POST',
      body: formData,
    });
  },

  adminBatchPosts: (action: 'delete' | 'publish' | 'draft', ids: number[]): Promise<{ msg: string; affected: number }> => {
    return apiFetch('/api/manage/posts/batch', {
      method: 'POST',
      body: JSON.stringify({ action, ids }),
    });
  },

  // Upload APIs
  uploadImage: async (file: File, remark?: string): Promise<{ msg: string; url: string; file_name: string; id: number | null }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (remark) formData.append('remark', remark);
    return apiFetch('/api/manage/upload', {
      method: 'POST',
      body: formData,
    });
  },

  uploadImages: async (files: File[], remark?: string): Promise<{ msg: string; url: string; file_name: string; id: number | null; items: Array<{ url: string; file_name: string; id: number | null }> }> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (remark) formData.append('remark', remark);
    return apiFetch('/api/manage/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // LLM AI Assistant APIs
  aiAnalyzeTaxonomy: (data: { title: string; content: string }): Promise<{
    category: { id: number; name: string; slug: string } | null;
    tags: Array<{ id: number; name: string; slug: string }>;
    created_categories: Array<{ id: number; name: string; slug: string }>;
    created_tags: Array<{ id: number; name: string; slug: string }>;
  }> => {
    return apiFetch('/api/manage/ai/analyze-taxonomy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  aiGenerateSummary: (data: { title: string; content: string }): Promise<{ summary: string }> => {
    return apiFetch('/api/manage/ai/generate-summary', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  aiProofread: (data: { content: string }): Promise<{ revised_content: string; suggestions: string[] }> => {
    return apiFetch('/api/manage/ai/proofread', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  aiExpand: (data: { title: string; content: string; instruction?: string }): Promise<{ expanded_content: string }> => {
    return apiFetch('/api/manage/ai/expand', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  aiTestConnection: (data?: { api_key?: string; base_url?: string; model?: string }): Promise<{ success: boolean; msg: string; reply?: string }> => {
    return apiFetch('/api/manage/ai/test-connection', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  // AI Scheduler Management & Logs
  aiGetSchedulerStatus: (): Promise<{
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
  }> => {
    return apiFetch('/api/manage/ai/scheduler/status');
  },

  aiSetSchedulerCron: (cron: string): Promise<{ success: boolean; msg: string; status: any }> => {
    return apiFetch('/api/manage/ai/scheduler/cron', {
      method: 'POST',
      body: JSON.stringify({ cron }),
    });
  },

  aiSetSchedulerThreads: (threads: number): Promise<{ success: boolean; msg: string; status: any }> => {
    return apiFetch('/api/manage/ai/scheduler/threads', {
      method: 'POST',
      body: JSON.stringify({ threads }),
    });
  },

  aiToggleScheduler: (enabled: boolean): Promise<{ enabled: boolean }> => {
    return apiFetch('/api/manage/ai/scheduler/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  aiTriggerScheduler: (): Promise<{ msg: string; count: number }> => {
    return apiFetch('/api/manage/ai/scheduler/trigger', {
      method: 'POST',
    });
  },

  aiGetSchedulerLogs: (): Promise<{
    logs: Array<{ time: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'; message: string }>;
  }> => {
    return apiFetch('/api/manage/ai/scheduler/logs');
  },

  // 备份中心 API
  adminGetBackups: (): Promise<BackupListResult> => {
    return apiFetch('/api/manage/backups');
  },

  adminDeleteBackup: (filename: string): Promise<{ msg: string }> => {
    return apiFetch(`/api/manage/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  },

  adminDownloadBackup: async (filename: string): Promise<void> => {
    const token = localStorage.getItem('blog_token') || localStorage.getItem('token') || '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${API_BASE_URL}/api/manage/backups/download/${encodeURIComponent(filename)}${query}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ msg: `下载请求失败 (${response.status})` }));
      throw new Error(err.msg || `下载失败 (${response.status})`);
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(link);
  },

  adminExportMarkdown: (): Promise<{ msg: string; filename: string; download_url: string }> => {
    return apiFetch('/api/manage/backups/export/markdown', { method: 'POST' });
  },

  adminExportDatabase: (): Promise<{ msg: string; filename: string; download_url: string }> => {
    return apiFetch('/api/manage/backups/export/db', { method: 'POST' });
  },

  adminExportOss: (): Promise<{ msg: string; filename: string; download_url: string }> => {
    return apiFetch('/api/manage/backups/export/oss', { method: 'POST' });
  },

  adminExportFullSite: (): Promise<{ msg: string; filename: string; download_url: string }> => {
    return apiFetch('/api/manage/backups/export/full', { method: 'POST' });
  },

  adminRestoreDatabase: (filename?: string, file?: File): Promise<{ msg: string; executed_count: number }> => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch('/api/manage/backups/restore/sql', {
        method: 'POST',
        body: formData,
      });
    }
    return apiFetch('/api/manage/backups/restore/sql', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  },

  adminRestoreFullSite: (filename?: string, file?: File): Promise<{ msg: string; executed_sql_count: number; restored_files_count: number }> => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch('/api/manage/backups/restore/full', {
        method: 'POST',
        body: formData,
      });
    }
    return apiFetch('/api/manage/backups/restore/full', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  },

  // AI 自定义提示词配置 API
  aiGetPrompts: (): Promise<{ prompts: AiPromptItem[] }> => {
    return apiFetch('/api/manage/ai/prompts');
  },

  aiUpdatePrompt: (key: string, value: string): Promise<{ msg: string; prompts: AiPromptItem[] }> => {
    return apiFetch('/api/manage/ai/prompts', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  },

  // 开放 API Token 管理
  adminGetOpenToken: (): Promise<{ token: string }> => {
    return apiFetch('/api/manage/open-token');
  },

  adminResetOpenToken: (): Promise<{ token: string; msg: string }> => {
    return apiFetch('/api/manage/open-token', { method: 'POST' });
  },
};
