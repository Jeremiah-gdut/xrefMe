import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'X:/HugoBlog/xrefMe';
const sourceRoot = 'X:/HugoBlog/Je2em1ah';
const blogTarget = path.join(projectRoot, 'src/content/blog');
const imagesRoot = path.join(projectRoot, 'public/images');

const mapping = [
  { source: '2025_summary/index.md', target: '2025-summary.md' },
  {
    source: '第四届网鼎杯网络安全大赛青龙组初赛writeup/index.md',
    target: 'wdcup-2024-writeup.md',
  },
  {
    source: '符号执行/index.md',
    target: 'symbolic-execution-string-deobfuscation.md',
  },
  { source: 'ADCTF/ADCTF.md', target: 'adctf-writeup.md' },
  { source: 'ARM/index.md', target: 'arm-notes.md' },
  { source: 'CISCN_WriteUp/index.md', target: 'ciscn-2024-writeup.md' },
  {
    source: 'FridaNote/Frida 检测与过检测.md',
    target: 'frida-detection-bypass.md',
    title: 'Frida 检测与过检测',
    description: '待施工。',
    date: '2025-01-02T00:16:49+08:00',
  },
  { source: 'FridaNote/Frida hook so.md', target: 'frida-hook-so.md' },
  {
    source: 'FridaNote/Frida Hook实现APP关键代码快速定位(Java层).md',
    target: 'frida-hook-java.md',
  },
  { source: 'FridaNote/Frida相关api.md', target: 'frida-api-notes.md' },
  { source: 'FridaNote/So层相关知识.md', target: 'android-so-notes.md' },
  {
    source: 'Game2025/index.md',
    target: 'game-security-2025-android-preliminary.md',
  },
  {
    source: 'GameSafety2021/2021初赛.md',
    target: 'game-safety-2021-preliminary.md',
  },
  {
    source: 'GameSafety2021/2021决赛.md',
    target: 'game-safety-2021-final.md',
  },
  {
    source: 'Indbr/(1)间接跳转混淆.md',
    target: 'arkari-indirect-branch-obfuscation.md',
  },
  {
    source: 'NewStarCTF2024-Re方向wp汇总/index.md',
    target: 'newstar-ctf-2024-re-writeup.md',
  },
  { source: 'VNCTF/index.md', target: 'vnctf-2025-writeup.md' },
];

function parseSourceFrontmatter(text) {
  const match = text.match(/^(?<delim>\+\+\+|---)\r?\n(?<fm>[\s\S]*?)\r?\n\k<delim>\r?\n?(?<body>[\s\S]*)$/u);
  if (!match?.groups) {
    return { frontmatter: '', body: text };
  }
  return {
    frontmatter: match.groups.fm,
    body: match.groups.body,
  };
}

function extractField(frontmatter, name) {
  const pattern = new RegExp(`^${name}\\s*[=:]\\s*["']?(.*?)["']?\\s*$`, 'mu');
  return frontmatter.match(pattern)?.[1] ?? '';
}

function yamlQuote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function getUniqueImageUrls(text) {
  const matches = [];
  const seen = new Set();
  const patterns = [
    /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gu,
    /<img\b[^>]*?\bsrc=(["'])(https?:\/\/[^"'>\s]+)\1[^>]*>/gu,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const url = match[2] ?? match[1];
      if (url && !seen.has(url)) {
        seen.add(url);
        matches.push(url);
      }
    }
  }

  return matches;
}

function normalizeCodeFenceLabels(text) {
  return text
    .replaceAll(/^```CPP$/gmu, '```cpp')
    .replaceAll(/^```Cpp$/gmu, '```cpp')
    .replaceAll(/^```C$/gmu, '```c')
    .replaceAll(/^```Javascript$/gmu, '```javascript')
    .replaceAll(/^```Java$/gmu, '```java')
    .replaceAll(/^```assembly$/gmu, '```asm');
}

for (const entry of mapping) {
  const sourcePath = path.join(sourceRoot, 'content/post', entry.source);
  const targetPath = path.join(blogTarget, entry.target);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const { frontmatter, body } = parseSourceFrontmatter(raw);

  const title =
    (entry.title ?? extractField(frontmatter, 'title')) ||
    path.basename(sourcePath, path.extname(sourcePath));
  const description =
    (entry.description ?? extractField(frontmatter, 'description')) || title;
  const pubDate =
    (entry.date ?? extractField(frontmatter, 'date')) ||
    fs.statSync(sourcePath).mtime.toISOString();
  const updatedDate = extractField(frontmatter, 'lastmod');
  const slug = path.basename(entry.target, '.md');

  let localizedBody = body.replace(/^\r?\n/u, '');
  const articleImagesDir = path.join(imagesRoot, slug);

  if (fs.existsSync(articleImagesDir)) {
    const localFiles = fs
      .readdirSync(articleImagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name)
      .sort((a, b) => a.localeCompare(b, 'en'));

    const urls = getUniqueImageUrls(localizedBody);
    if (urls.length !== localFiles.length) {
      throw new Error(
        `Image count mismatch for ${slug}: source has ${urls.length}, local dir has ${localFiles.length}`,
      );
    }

    urls.forEach((url, index) => {
      localizedBody = localizedBody.split(url).join(`/images/${slug}/${localFiles[index]}`);
    });
  }

  localizedBody = normalizeCodeFenceLabels(localizedBody);

  const output = [
    '---',
    `title: ${yamlQuote(title)}`,
    `description: ${yamlQuote(description)}`,
    `pubDate: ${yamlQuote(pubDate)}`,
    ...(updatedDate ? [`updatedDate: ${yamlQuote(updatedDate)}`] : []),
    'draft: false',
    '---',
    '',
    localizedBody,
  ].join('\n');

  fs.writeFileSync(targetPath, output, 'utf8');
}

console.log(`Rebuilt ${mapping.length} posts from source.`);
