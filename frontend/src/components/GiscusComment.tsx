import React, { useEffect, useRef, useState } from 'react';

interface GiscusCommentProps {
  postId: number;
  postTitle: string;
}

export const GiscusComment: React.FC<GiscusCommentProps> = ({ postId, postTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'transparent_dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'transparent_dark'
      : 'light';
  });

  // 读取系统配置中的 Giscus 参数
  const config = React.useMemo(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  }, []);

  const enabled = config.giscus_enabled === 'true' || config.giscus_enabled === '1';
  const repo = (config.giscus_repo || '').trim();
  const repoId = (config.giscus_repo_id || '').trim();
  const category = (config.giscus_category || 'Announcements').trim();
  const categoryId = (config.giscus_category_id || '').trim();
  const mapping = (config.giscus_mapping || 'pathname').trim();
  const reactionsEnabled = config.giscus_reactions === '0' ? '0' : '1';
  const emitMetadata = '0';
  const inputPosition = config.giscus_input_position || 'top';
  const lang = config.giscus_lang || 'zh-CN';

  // 监听全站 data-theme 属性变化，向已加载的 iframe 发送换肤 postMessage
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const nextTheme = isDark ? 'transparent_dark' : 'light';
      setTheme(nextTheme);

      const iframe = containerRef.current?.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { giscus: { setConfig: { theme: nextTheme } } },
          'https://giscus.app'
        );
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // 挂载/重建 Giscus Script
  useEffect(() => {
    if (!enabled || !repo || !repoId || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', repo);
    script.setAttribute('data-repo-id', repoId);
    script.setAttribute('data-category', category);
    script.setAttribute('data-category-id', categoryId);
    script.setAttribute('data-mapping', mapping);
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', reactionsEnabled);
    script.setAttribute('data-emit-metadata', emitMetadata);
    script.setAttribute('data-input-position', inputPosition);
    script.setAttribute('data-theme', theme);
    script.setAttribute('data-lang', lang);
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [enabled, repo, repoId, category, categoryId, mapping, reactionsEnabled, inputPosition, lang, postId, postTitle]);

  if (!enabled) {
    return null;
  }

  // 若开启了开关但缺少必要凭据，展示友好的管理员提示
  if (!repo || !repoId || !categoryId) {
    return (
      <section className="giscus-comment-section">
        <div className="giscus-empty-hint">
          <div className="giscus-hint-icon">💬</div>
          <h4>评论功能尚未配置就绪</h4>
          <p>
            已开启 Giscus 评论开关，请在后台<strong>「系统设置」→「💬 评论设置 (Giscus)」</strong>中填入
            GitHub 仓库名、Repository ID 及 Category ID。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="giscus-comment-section" aria-label="文章讨论与评论">
      <div className="giscus-section-header">
        <div className="giscus-header-title">
          <span className="giscus-header-icon">💬</span>
          <h3>参与讨论</h3>
        </div>
        <span className="giscus-powered-by">
          Powered by{' '}
          <a href="https://giscus.app" target="_blank" rel="noopener noreferrer">
            Giscus
          </a>
        </span>
      </div>
      <div ref={containerRef} className="giscus-embed-wrap" />
    </section>
  );
};
