import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const NOTES_SRC = join(import.meta.dirname, '..', 'submodules', 'hermes-knowledge', 'notes');
const NOTES_DEST = join(import.meta.dirname, '..', 'src', 'content', 'notes');
const OG_CACHE = join(import.meta.dirname, '..', 'src', 'data', 'og-cache.json');

const SKIP = new Set(['INDEX.md']);

async function loadOgCache() {
  try {
    return JSON.parse(await readFile(OG_CACHE, 'utf-8'));
  } catch {
    return {};
  }
}

function parseMetadata(content) {
  const meta = {};
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) meta.title = titleMatch[1].trim();

  const urlMatch = content.match(/^\s*[-*]\s*\*\*URL:\*\*\s*(.+)/m);
  if (urlMatch) meta.url = urlMatch[1].trim();

  const dateMatch = content.match(/^\s*[-*]\s*\*\*(Date|Date Saved):\*\*\s*(.+)/m);
  if (dateMatch) meta.date = dateMatch[2].trim();

  const sourceMatch = content.match(/^\s*[-*]\s*\*\*Source:\*\*\s*(.+)/m);
  if (sourceMatch) meta.source = sourceMatch[1].trim();

  const tagsMatch = content.match(/^\s*[-*]\s*\*\*Tags:\*\*\s*(.+)/m);
  if (tagsMatch) {
    meta.tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }

  return meta;
}

function buildFrontmatter(meta, ogCache) {
  const lines = ['---'];
  if (meta.title) lines.push(`title: ${JSON.stringify(meta.title)}`);
  if (meta.date) lines.push(`date: "${meta.date}"`);
  if (meta.source) lines.push(`source: ${JSON.stringify(meta.source)}`);
  if (meta.url) lines.push(`url: ${JSON.stringify(meta.url)}`);
  if (meta.tags?.length) lines.push(`tags: [${meta.tags.map(t => JSON.stringify(t)).join(', ')}]`);
  if (meta.url && ogCache[meta.url]) {
    lines.push(`ogImage: ${JSON.stringify(ogCache[meta.url])}`);
  }
  lines.push('---');
  return lines.join('\n');
}

async function main() {
  await mkdir(NOTES_DEST, { recursive: true });
  const ogCache = await loadOgCache();

  const files = (await readdir(NOTES_SRC)).filter(
    f => f.endsWith('.md') && !SKIP.has(f)
  );

  let count = 0;
  for (const file of files) {
    const content = await readFile(join(NOTES_SRC, file), 'utf-8');

    if (content.startsWith('---')) {
      await writeFile(join(NOTES_DEST, file), content);
    } else {
      const meta = parseMetadata(content);
      const frontmatter = buildFrontmatter(meta, ogCache);
      await writeFile(join(NOTES_DEST, file), frontmatter + '\n\n' + content);
    }
    count++;
  }

  const withOg = files.filter(f => {
    const content = `url: "`;
    return true;
  });

  console.log(`Prepared ${count} notes → ${NOTES_DEST}`);
  const ogCount = Object.values(ogCache).filter(v => v !== null).length;
  if (ogCount) console.log(`  (${ogCount} notes with OG images)`);
}

main();
