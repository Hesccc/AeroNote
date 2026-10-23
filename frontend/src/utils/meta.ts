/**
 * 动态更新与注入 OpenGraph (OG)、Twitter Card 及 SEO Meta 标签
 */
export interface ArticleMeta {
  title: string;
  description: string;
  image?: string;
  url?: string;
  author?: string;
  publishedTime?: string;
}

const META_ATTR_KEY = 'data-aeronote-dynamic';

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  if (!content) return;
  let element = document.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    element.setAttribute(META_ATTR_KEY, 'true');
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function updateArticleMeta(meta: ArticleMeta) {
  const pageUrl = meta.url || window.location.href;
  const description = (meta.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);

  // 1. 标准 SEO Meta
  setMetaTag('name', 'description', description);
  if (meta.author) {
    setMetaTag('name', 'author', meta.author);
  }

  // 2. OpenGraph (Facebook, WeChat, Discord, Telegram, Slack 预览卡片)
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', meta.title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:url', pageUrl);
  if (meta.image) {
    setMetaTag('property', 'og:image', meta.image);
  }
  if (meta.publishedTime) {
    setMetaTag('property', 'article:published_time', meta.publishedTime);
  }
  if (meta.author) {
    setMetaTag('property', 'article:author', meta.author);
  }

  // 3. Twitter Card
  setMetaTag('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
  setMetaTag('name', 'twitter:title', meta.title);
  setMetaTag('name', 'twitter:description', description);
  if (meta.image) {
    setMetaTag('name', 'twitter:image', meta.image);
  }
}

export function resetDynamicMeta(defaultDescription?: string) {
  // 移除所有动态注入的 OpenGraph 与 Twitter 标签
  const dynamicMetas = document.querySelectorAll(`meta[${META_ATTR_KEY}="true"]`);
  dynamicMetas.forEach(el => el.remove());

  // 恢复默认 description
  if (defaultDescription) {
    const descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', defaultDescription);
    }
  }
}
