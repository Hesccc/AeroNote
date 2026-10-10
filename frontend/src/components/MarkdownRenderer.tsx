import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import Prism from 'prismjs';
import { slugify } from '../utils/slugify';

// 导入常用语言高亮支持
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';

interface MarkdownRendererProps {
  content: string;
}

const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // 兜底降级复制
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      className={`code-copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      title="复制到剪贴板"
    >
      {copied ? '✓ 已复制' : '复制'}
    </button>
  );
};

const createHeadingRenderer = (Tag: 'h1' | 'h2' | 'h3' | 'h4', headingCounts: Map<string, number>) => {
  return ({ children }: { children?: React.ReactNode }) => {
    const text = typeof children === 'string' ? children : String(children || '');
    let id = slugify(text);
    const count = headingCounts.get(id) || 0;
    headingCounts.set(id, count + 1);
    if (count > 0) {
      id = `${id}-${count}`;
    }
    return <Tag id={id}>{children}</Tag>;
  };
};

const baseComponents: Components = {
  // 针对 pre / code 进行现代代码框容器包装
  pre: ({ children, ...props }) => {
    return (
      <div className="code-block-wrapper">
        <pre {...props}>{children}</pre>
      </div>
    );
  },
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1].toLowerCase() : '';
    const codeString = String(children).replace(/\n$/, '');

    // 块级代码高亮处理
    if (className || match) {
      const grammar = Prism.languages[lang] || Prism.languages.javascript;
      let highlighted = codeString;
      if (grammar) {
        try {
          highlighted = Prism.highlight(codeString, grammar, lang || 'javascript');
        } catch {
          highlighted = codeString;
        }
      }

      return (
        <>
          <div className="code-block-header">
            <span className="code-block-lang">{lang ? lang.toUpperCase() : 'CODE'}</span>
            <CopyButton code={codeString} />
          </div>
          <code
            className={`${className || ''} language-${lang || 'text'}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </>
      );
    }

    // 行内代码
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const headingCounts = new Map<string, number>();
  const components: Components = {
    ...baseComponents,
    h1: createHeadingRenderer('h1', headingCounts),
    h2: createHeadingRenderer('h2', headingCounts),
    h3: createHeadingRenderer('h3', headingCounts),
    h4: createHeadingRenderer('h4', headingCounts),
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
