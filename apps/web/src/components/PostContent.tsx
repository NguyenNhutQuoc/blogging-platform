/**
 * Renders Tiptap HTML output safely in the browser.
 * The content is HTML from the server — we trust it because it's
 * author-generated content stored in our own DB, not user-supplied
 * untrusted HTML. For a public-facing platform, consider running this
 * through DOMPurify if you allow guest submissions in the future.
 */
export function PostContent({ html }: { html: string }) {
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
