import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-dynamic';

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nodeToText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (typeof node === 'object') {
    const maybe = node as { props?: { children?: unknown } };
    return nodeToText(maybe.props?.children);
  }
  return '';
}

export default function AdminHelpPage() {
  const notesPath = path.join(process.cwd(), 'docs', 'sample', 'admin_functionality_notes.md');
  
  let notesContent = 'Functionality notes not found.';

  try {
    notesContent = fs.readFileSync(notesPath, 'utf8');
  } catch (err) {
    notesContent = 'Could not read functionality notes.';
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-12">
      <section>
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard Help</h1>
        <p className="text-sm text-muted-foreground mb-6">Welcome to the Nibbot Admin Help Center. This guide provides an exhaustive breakdown of every tool and configuration available to you.</p>
        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-24">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ node, ...props }) => {
                const text = nodeToText(props.children);
                const id = slugify(text);
                return <h2 id={id} {...props} />;
              },
              h3: ({ node, ...props }) => {
                const text = nodeToText(props.children);
                const id = slugify(text);
                return <h3 id={id} {...props} />;
              },
            }}
          >
            {notesContent}
          </ReactMarkdown>
        </article>
      </section>
    </main>
  );
}
