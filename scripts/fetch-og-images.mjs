import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const NOTES_DIR = join(import.meta.dirname, '..', 'src', 'content', 'notes');
const CACHE_FILE = join(import.meta.dirname, '..', 'src', 'data', 'og-cache.json');
const CONCURRENCY = 5;
const TIMEOUT = 8000;
const FORCE = process.argv.includes('--force');

const UA = 'Mozilla/5.0 (compatible; GenAIInsightBot/1.0; +https://genai-insight.pages.dev)';

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function extractOgImage(html) {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1] : null;
}

async function fetchOgImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    const text = await res.text();
    return extractOgImage(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getUrlsFromNotes() {
  const files = (await readdir(NOTES_DIR)).filter(f => f.endsWith('.md'));
  const urls = [];
  for (const file of files) {
    const content = await readFile(join(NOTES_DIR, file), 'utf-8');
    const match = content.match(/^url:\s*"?([^"\n]+)"?/m);
    if (match) urls.push(match[1].trim());
  }
  return [...new Set(urls)];
}

async function processInBatches(urls, cache) {
  let fetched = 0, success = 0;
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      fetched++;
      const img = await fetchOgImage(url);
      if (img) {
        cache[url] = img;
        success++;
      } else {
        cache[url] = null;
      }
      if (fetched % 10 === 0) {
        process.stdout.write(`  ${fetched}/${urls.length} fetched (${success} with images)\r`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  console.log(`  ${fetched}/${urls.length} fetched (${success} with images)`);
}

async function main() {
  await mkdir(join(import.meta.dirname, '..', 'src', 'data'), { recursive: true });
  const cache = await loadCache();
  const allUrls = await getUrlsFromNotes();

  const toFetch = FORCE
    ? allUrls
    : allUrls.filter(url => !(url in cache));

  console.log(`OG images: ${allUrls.length} URLs total, ${toFetch.length} to fetch (${allUrls.length - toFetch.length} cached)`);

  if (toFetch.length > 0) {
    await processInBatches(toFetch, cache);
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  }

  const withImages = Object.values(cache).filter(v => v !== null).length;
  console.log(`OG cache: ${withImages}/${Object.keys(cache).length} URLs have images`);
}

main();
