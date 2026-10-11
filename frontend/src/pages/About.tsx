import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Layout } from '../components/Layout';
import { IconUser, IconFeather } from '../components/Icons';
import { PageHeroBanner } from '../components/PageHeroBanner';

export const About: React.FC = () => {
  const [config, setConfig] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('blog_config');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(() => Object.keys(config).length === 0);

  useEffect(() => {
    document.title = '关于本站 - AeroNote';
    api.getConfig()
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const siteTitle = config.website_title || '';
  const siteDesc = config.website_desc || '';
  const aboutSubtitle = config.about_profile_subtitle || '';

  const hero = (
    <PageHeroBanner
      tag="AUTHOR & ABOUT"
      tagIcon={<IconUser size={14} />}
      title="关于作者与站点"
      subtitle="记录技术探索与工程实践，于碎片化的网络世界中保持专注与思考"
    />
  );

  return (
    <Layout hero={hero}>
      <div className="page-shell">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>正在读取站长自述...</p>
          </div>
        ) : (
          <div className="about-content-layout">
            {/* Author Profile Card */}
            <div className="about-profile-card">
              <div className="about-avatar-wrapper">
                {config.website_avatar ? (
                  <img
                    src={config.website_avatar}
                    alt={siteTitle}
                    className="about-avatar-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.about-avatar-symbol') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span
                  className="about-avatar-symbol"
                  style={{ display: config.website_avatar ? 'none' : 'flex' }}
                >
                  <IconFeather size={32} />
                </span>
              </div>
              <h2 className="about-author-name">{siteTitle}</h2>
              <p className="about-author-subtitle">{aboutSubtitle}</p>

              {/* Social Channels */}
              {(config.author_github || config.author_email) && (
                <div className="about-social-row">
                  {config.author_github && (
                    <a
                      href={config.author_github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-btn"
                      title="GitHub"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      <span>GitHub</span>
                    </a>
                  )}
                  {config.author_email && (
                    <a
                      href={`mailto:${config.author_email}`}
                      className="social-btn"
                      title="Email"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <span>Email</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Narrative & Manifesto Section */}
            <div className="about-narrative-card">
              <div className="narrative-section">
                <h3 className="narrative-title">关于博客</h3>
                <p className="narrative-body">{siteDesc}</p>
              </div>

              {(config.about_content || config.about_profile_content || config.about_tech_stack) && (
                <div className="narrative-section">
                  <h3 className="narrative-title">个人自述</h3>
                  {(config.about_content || config.about_profile_content) && (
                    <div
                      className="narrative-body"
                      style={{
                        whiteSpace: 'pre-wrap',
                        marginBottom: config.about_tech_stack ? '0.85rem' : 0
                      }}
                    >
                      {config.about_content || config.about_profile_content}
                    </div>
                  )}
                  {config.about_tech_stack && (
                    <div className="tech-stack-pills">
                      {config.about_tech_stack
                        .split(/[;,；，\n]/)
                        .map(t => t.trim())
                        .filter(Boolean)
                        .map((tech, i) => (
                          <span key={i} className="tech-pill">{tech}</span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
