import fs from "fs";
import path from "path";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  shop: string;
  content: string;
}

export function getAllPosts(): BlogPost[] {
  try {
    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith(".json"));
    const posts = files.map(f => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, f), "utf8");
      return JSON.parse(raw) as BlogPost;
    });
    return posts.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const file = path.join(BLOG_DIR, `${slug}.json`);
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as BlogPost;
  } catch {
    return null;
  }
}

export function getLatestPosts(limit = 3): BlogPost[] {
  return getAllPosts().slice(0, limit);
}

const CATEGORY_LABELS: Record<string, string> = {
  tipy: "Tipy", kupony: "Kupóny", navody: "Návody", porovnanie: "Porovnanie",
};
export function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] || cat;
}
