import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = import.meta.glob('./blog/posts/*.md', { eager: true }) as Record<
    string,
    { frontmatter: { title: string; date: string; description: string } }
  >;

  const items = Object.entries(posts)
    .map(([path, post]) => ({
      title: post.frontmatter.title,
      pubDate: new Date(post.frontmatter.date),
      description: post.frontmatter.description,
      link: path.replace('./blog/posts/', '/blog/posts/').replace('.md', ''),
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Alptug Dilek',
    description: 'Software engineering blog',
    site: context.site!.toString(),
    items,
  });
}
