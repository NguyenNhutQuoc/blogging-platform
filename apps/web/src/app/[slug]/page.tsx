import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PostContent } from "@/components/PostContent";
import { AuthorCard } from "@/components/AuthorCard";
import { CommentsSection } from "@/components/CommentsSection";
import { Badge } from "@repo/ui";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) notFound();

  const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

  /** JSON-LD structured data — helps Google display rich results */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.ogImageUrl ?? post.coverImageUrl ?? undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.publishedAt ?? undefined,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Blog Platform",
      url: APP_URL,
    },
    url: `${APP_URL}/${slug}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${APP_URL}/${slug}`,
    },
  };

  return (
    <article className="max-w-3xl mx-auto">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Cover image */}
      {post.coverImageUrl && (
        <div className="mb-8 rounded-xl overflow-hidden aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Categories */}
      {post.categories.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {post.categories.map((cat) => (
            <a key={cat.id} href={`/category/${cat.slug}`}>
              <Badge variant="secondary">{cat.name}</Badge>
            </a>
          ))}
        </div>
      )}

      <h1 className="text-4xl font-bold mb-4 leading-tight">{post.title}</h1>

      {post.excerpt && (
        <p className="text-xl text-muted-foreground mb-6 leading-relaxed">{post.excerpt}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b">
        <span>
          {post.publishedAt
            ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : null}
        </span>
        {post.readingTimeMinutes && (
          <>
            <span>·</span>
            <span>{post.readingTimeMinutes} min read</span>
          </>
        )}
      </div>

      {/* HTML content from Tiptap */}
      <PostContent html={post.content} />

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex gap-2 mt-8 flex-wrap">
          {post.tags.map((tag) => (
            <a key={tag.id} href={`/tag/${tag.slug}`}>
              <Badge variant="outline">#{tag.name}</Badge>
            </a>
          ))}
        </div>
      )}

      {/* Author card */}
      <div className="mt-12">
        <AuthorCard author={post.author} />
      </div>

      {/* Comments */}
      <CommentsSection postId={post.id} />
    </article>
  );
}

async function fetchPost(slug: string) {
  "use cache";
  cacheTag(`post-${slug}`);
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 }); // stale 1h, revalidate 1h, expire 24h

  try {
    const result = await api.posts.getBySlug(slug);
    if (!result.success || !result.data) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) return { title: "Post not found" };

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: post.ogImageUrl ?? post.coverImageUrl
        ? [{ url: (post.ogImageUrl ?? post.coverImageUrl)! }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
    },
    alternates: {
      canonical: post.seoCanonicalUrl ?? `/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  // Pre-render the most recent 100 published posts at build time
  try {
    const result = await api.posts.list({ status: "published", page: 1, pageSize: 100 });
    if (!result.success || !result.data) return [];
    return result.data.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}
