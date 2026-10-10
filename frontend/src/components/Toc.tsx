import React, { useEffect, useState, useRef, useMemo } from 'react';
import { slugify } from '../utils/slugify';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TocProps {
  content: string;
}

function parseToc(markdown: string): TocItem[] {
  // 预先剔除代码块（``` ... ``` 或 ~~~ ... ~~~），避免代码块中的注释符号（如 # 注释）被误识别为文章标题
  const cleanMarkdown = markdown
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/^~~~[\s\S]*?^~~~/gm, '');

  const headingRegex = /^(#{1,4})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;
  const ids = new Map<string, number>();

  while ((match = headingRegex.exec(cleanMarkdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim().replace(/\*\*(.+?)\*\*/g, '$1');
    let id = slugify(text);

    // Handle duplicate IDs
    const count = ids.get(id) || 0;
    ids.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;

    items.push({ id, text, level });
  }
  return items;
}

export const Toc: React.FC<TocProps> = ({ content }) => {
  const [activeId, setActiveId] = useState('');
  const tocItems = useMemo(() => parseToc(content), [content]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!tocItems.length) return;

    observerRef.current?.disconnect();

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-60px 0px -70% 0px',
      threshold: 0,
    });

    tocItems.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [tocItems]);

  if (tocItems.length === 0) return null;

  return (
    <div className="toc-widget">
      <ul className="toc-list">
        {tocItems.map((item) => (
          <li
            key={item.id}
            className={`toc-item h${item.level} ${activeId === item.id ? 'active' : ''}`}
          >
            <a
              href={`#${item.id}`}
              className="toc-link"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (el) {
                  const offset = 80;
                  const top = el.getBoundingClientRect().top + window.scrollY - offset;
                  window.scrollTo({ top, behavior: 'smooth' });
                  setActiveId(item.id);
                }
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
