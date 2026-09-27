import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USERNAME = process.env.GH_USERNAME || "myangell5522";
const DISPLAY_NAME = process.env.GH_DISPLAY_NAME || "myangell";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const OUT_FILE = join(ROOT, "widgets", "profile-card.svg");
const AVATAR_FILE = join(ROOT, "assets", "avatar.jpg");

const WIDTH = 900;
const HEIGHT = 430;
const CX = 450;
const CY = 208;
const AVATAR_R = 74;
const DONUT_INNER = 92;
const DONUT_OUTER = 118;
const LOGO_R = 150;
const BADGE_R = 22;

const GOLD = "#E8B84A";
const GOLD_BRIGHT = "#F0C85A";
const CREAM = "#FFF6E4";
const PLATE_DARK = "#1A1408";
const TEXT = "#E8EEF7";
const MUTED = "#8B95A8";
const BG = "#0B1020";
const CHIP = "#141A28";

const LANG_COLORS = {
  "C#": "#512BD4",
  Java: "#B07219",
  Python: "#3572A5",
  JavaScript: "#F1E05A",
  TypeScript: "#3178C6",
  Lua: "#4F6CFF",
  CSS: "#563D7C",
  HTML: "#E34C26",
  "C++": "#F34B7D",
  C: "#555555",
  Go: "#00ADD8",
  Rust: "#DEA584",
  PHP: "#4F5D95",
  Kotlin: "#A97BFF",
  Ruby: "#701516",
  Shell: "#89E051",
  Dart: "#00B4AB",
  Swift: "#F05138",
  Vue: "#41B883",
  SCSS: "#C6538C",
  Dockerfile: "#384D54",
  PowerShell: "#012456",
  "Jupyter Notebook": "#DA5B0B",
  Cython: "#FCD54A",
  Other: "#6E7681",
};

const ICON_SLUGS = {
  "C#": "csharp",
  Java: "openjdk",
  Python: "python",
  JavaScript: "javascript",
  TypeScript: "typescript",
  Lua: "lua",
  CSS: "css",
  HTML: "html5",
  "C++": "cplusplus",
  C: "c",
  Go: "go",
  Rust: "rust",
  PHP: "php",
  Kotlin: "kotlin",
  Ruby: "ruby",
  Shell: "gnubash",
  Dart: "dart",
  Swift: "swift",
  Vue: "vuedotjs",
  SCSS: "sass",
  Dockerfile: "docker",
  PowerShell: "powershell",
  "Jupyter Notebook": "jupyter",
};

const HIDDEN_LANGS = new Set(["TeX", "Makefile", "CMake", "Batchfile", "HLSL"]);

function headers(extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "danceqqq-profile-widget",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function luminance(hex) {
  const n = Number.parseInt(String(hex).replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return 0;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function plateColors(lang) {
  const light = luminance(lang.color) > 165;
  return {
    fill: light ? PLATE_DARK : CREAM,
    glyph: lang.color,
  };
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function donutSlice(cx, cy, r0, r1, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

function spreadAngles(angles, minSep) {
  if (angles.length < 2) return angles;
  const items = angles.map((a, i) => ({ a, i })).sort((x, y) => x.a - y.a);
  for (let pass = 0; pass < 10; pass++) {
    for (let k = 0; k < items.length; k++) {
      const curr = items[k];
      const next = items[(k + 1) % items.length];
      let delta = next.a - curr.a;
      if (k === items.length - 1) delta += Math.PI * 2;
      if (delta < minSep) {
        const push = (minSep - delta) / 2;
        curr.a -= push;
        next.a += push;
      }
    }
  }
  const out = new Array(angles.length);
  for (const item of items) out[item.i] = item.a;
  return out;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 180)}`);
  }
  return res.json();
}

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json).slice(0, 300));
  }
  return json.data;
}

function rankLanguages(entries) {
  const sorted = entries.filter((item) => item.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  const top = sorted.slice(0, 6);
  const restBytes = sorted.slice(6).reduce((sum, item) => sum + item.bytes, 0);
  const total = top.reduce((sum, item) => sum + item.bytes, 0) + restBytes;
  if (restBytes > 0 && total > 0 && restBytes / total >= 0.04 && top.length === 6) {
    top.push({ name: "Other", bytes: restBytes, color: LANG_COLORS.Other });
  }
  const all = top.reduce((sum, item) => sum + item.bytes, 0) || 1;
  return top.map((item) => ({
    name: item.name,
    bytes: item.bytes,
    color: LANG_COLORS[item.name] || item.color || "#6E7681",
    pct: item.bytes / all,
  }));
}

function tally(names) {
  const totals = new Map();
  for (const name of names) {
    if (!name || HIDDEN_LANGS.has(name)) continue;
    const current = totals.get(name) || { name, bytes: 0, color: LANG_COLORS[name] };
    current.bytes += 1;
    totals.set(name, current);
  }
  return [...totals.values()];
}

async function fetchFromGraphql() {
  const data = await graphql(
    `query ($login: String!) {
      user(login: $login) {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes {
            isPrivate
            languages(first: 1, orderBy: {field: SIZE, direction: DESC}) {
              edges { node { name color } }
            }
          }
        }
      }
    }`,
    { login: USERNAME },
  );

  const totals = new Map();
  for (const repo of data.user?.repositories?.nodes || []) {
    if (repo.isPrivate) continue;
    const primary = repo.languages?.edges?.[0];
    if (!primary || HIDDEN_LANGS.has(primary.node.name)) continue;
    const name = primary.node.name;
    const current = totals.get(name) || { name, bytes: 0, color: LANG_COLORS[name] || primary.node.color };
    current.bytes += 1;
    totals.set(name, current);
  }
  return [...totals.values()];
}

async function fetchLanguagesRest() {
  const repos = await gh(`/users/${USERNAME}/repos?per_page=100&type=owner&sort=pushed`);
  return tally(
    repos.filter((repo) => !repo.fork && !repo.private).map((repo) => repo.language),
  );
}

async function fetchLanguagesHtml() {
  const res = await fetch(`https://github.com/${USERNAME}?tab=repositories&type=source`, {
    headers: { "User-Agent": "danceqqq-profile-widget" },
  });
  if (!res.ok) throw new Error(`HTML languages ${res.status}`);
  const html = await res.text();
  const names = [...html.matchAll(/itemprop="programmingLanguage">([^<]+)</g)].map((m) => m[1].trim());
  if (names.length === 0) throw new Error("No programmingLanguage tags");
  return tally(names);
}

async function fetchIconPath(slug) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/simple-icons@14/icons/${slug}.svg`,
    `https://cdn.jsdelivr.net/npm/simple-icons@11/icons/${slug}.svg`,
    `https://cdn.simpleicons.org/${slug}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "danceqqq-profile-widget" } });
      if (!res.ok) continue;
      const svg = await res.text();
      const match = svg.match(/<path[^>]*\sd="([^"]+)"/i);
      if (match) return match[1];
    } catch {
      // next source
    }
  }
  return null;
}

async function withIcons(languages) {
  const paths = await mapPool(languages, 6, async (lang) => {
    const slug = ICON_SLUGS[lang.name];
    return slug ? fetchIconPath(slug) : null;
  });
  return languages.map((lang, i) => ({ ...lang, icon: paths[i] }));
}

function langIcon(lang, x, y, size, fill) {
  if (!lang.icon) {
    return `<text x="${x.toFixed(1)}" y="${(y + size * 0.32).toFixed(1)}" text-anchor="middle" fill="${fill}" font-size="${(size * 0.42).toFixed(1)}" font-weight="700">${esc(lang.name.slice(0, 2))}</text>`;
  }
  const scale = size / 24;
  return `<g transform="translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${scale.toFixed(3)})">
    <path d="${esc(lang.icon)}" fill="${fill}"/>
  </g>`;
}

function renderLogoBadge(lang, x, y, radius = BADGE_R) {
  const plate = plateColors(lang);
  const iconSize = radius * 0.92;
  return `
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="${plate.fill}" stroke="${GOLD}" stroke-width="1.7"/>
    ${langIcon(lang, x, y, iconSize, plate.glyph)}`;
}

function pillWidth(lang) {
  const label = `${lang.name}  ${Math.round(lang.pct * 100)}%`;
  return 44 + label.length * 7.1;
}

function renderPills(languages) {
  if (languages.length === 0) return "";
  const widths = languages.map(pillWidth);
  const gap = 10;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (languages.length - 1);
  let x = (WIDTH - total) / 2;
  const y = 376;
  const h = 28;

  return languages
    .map((lang, i) => {
      const w = widths[i];
      const label = `${lang.name}  ${Math.round(lang.pct * 100)}%`;
      const cx = x + 18;
      const cy = y + h / 2;
      const node = `
      <g>
        <rect x="${x.toFixed(1)}" y="${y}" rx="14" width="${w.toFixed(1)}" height="${h}" fill="${CHIP}" stroke="${GOLD}" stroke-opacity="0.35"/>
        ${renderLogoBadge(lang, cx, cy, 12)}
        <text x="${(x + 34).toFixed(1)}" y="${y + 18}" fill="${TEXT}" font-size="12" font-weight="600">${esc(label)}</text>
      </g>`;
      x += w + gap;
      return node;
    })
    .join("");
}

function renderDonut(languages) {
  if (languages.length === 0) {
    return `<circle cx="${CX}" cy="${CY}" r="${(DONUT_INNER + DONUT_OUTER) / 2}" fill="none" stroke="#2A2418" stroke-width="${DONUT_OUTER - DONUT_INNER}"/>`;
  }

  const gap = 0.032;
  let angle = -Math.PI / 2;
  const slices = [];
  const mids = [];

  for (const lang of languages) {
    const sweep = Math.max(lang.pct * Math.PI * 2 - gap, 0.09);
    const a0 = angle + gap / 2;
    const a1 = a0 + sweep;
    slices.push(
      `<path d="${donutSlice(CX, CY, DONUT_INNER, DONUT_OUTER, a0, a1)}" fill="${lang.color}">
        <title>${esc(lang.name)} ${Math.round(lang.pct * 100)}%</title>
      </path>`,
    );
    mids.push((a0 + a1) / 2);
    angle = a1 + gap / 2;
  }

  const logoAngles = spreadAngles(mids, 0.64);
  const logos = languages
    .map((lang, i) => {
      const [lx, ly] = polar(CX, CY, LOGO_R, logoAngles[i]);
      return `<g>${renderLogoBadge(lang, lx, ly)}</g>`;
    })
    .join("");

  return `${slices.join("")}${logos}`;
}

function renderCard({ avatarData, languages }) {
  const handle = `@${USERNAME}`;
  const dotX = 860 - handle.length * 7.55 - 14;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(DISPLAY_NAME)} GitHub profile">
  <title>${esc(DISPLAY_NAME)} · live GitHub widget</title>
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_BRIGHT}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16120C"/>
      <stop offset="1" stop-color="${BG}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="40%" r="46%">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarClip">
      <circle cx="${CX}" cy="${CY}" r="${AVATAR_R}"/>
    </clipPath>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <style>
      .fg { font-family: 'Segoe UI', Ubuntu, system-ui, sans-serif; }
      .live { animation: pulse 2.8s ease-in-out infinite; }
      @keyframes pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" rx="22" fill="url(#panel)"/>
  <rect x="1.2" y="1.2" width="${WIDTH - 2.4}" height="${HEIGHT - 2.4}" rx="21" fill="none" stroke="url(#frame)" stroke-opacity="0.7"/>
  <rect x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" rx="16" fill="none" stroke="#2A2418"/>
  <rect x="22" y="22" width="${WIDTH - 44}" height="3" rx="1.5" fill="url(#frame)" opacity="0.95"/>

  <text class="fg" x="40" y="52" fill="${TEXT}" font-size="22" font-weight="700">${esc(DISPLAY_NAME)}</text>
  <text class="fg" x="40" y="72" fill="${MUTED}" font-size="12">GitHub profile widget</text>

  <g>
    <circle class="live" cx="${dotX.toFixed(1)}" cy="47" r="4" fill="${GOLD_BRIGHT}" filter="url(#glow)"/>
    <text class="fg" x="860" y="52" text-anchor="end" fill="${GOLD_BRIGHT}" font-size="13" font-weight="600">${esc(handle)}</text>
    <text class="fg" x="860" y="72" text-anchor="end" fill="${MUTED}" font-size="11">languages</text>
  </g>

  <circle cx="${CX}" cy="${CY}" r="168" fill="url(#halo)"/>
  ${renderDonut(languages)}

  <circle cx="${CX}" cy="${CY}" r="${AVATAR_R + 9}" fill="none" stroke="${GOLD_BRIGHT}" stroke-width="2.6" class="live" filter="url(#glow)"/>
  <circle cx="${CX}" cy="${CY}" r="${AVATAR_R + 14}" fill="none" stroke="${GOLD}" stroke-width="1.25" opacity="0.92"/>
  <image
    href="data:image/jpeg;base64,${avatarData}"
    xlink:href="data:image/jpeg;base64,${avatarData}"
    x="${CX - AVATAR_R}"
    y="${CY - AVATAR_R}"
    width="${AVATAR_R * 2}"
    height="${AVATAR_R * 2}"
    clip-path="url(#avatarClip)"
    preserveAspectRatio="xMidYMid slice"
  />
  <circle cx="${CX}" cy="${CY}" r="${AVATAR_R}" fill="none" stroke="#071018" stroke-width="1.2"/>

  ${renderPills(languages)}
</svg>
`;
}

async function firstOk(tasks) {
  let lastError;
  for (const task of tasks) {
    try {
      const value = await task();
      if (value && (Array.isArray(value) ? value.length : true)) return value;
    } catch (error) {
      lastError = error;
      console.error(error.message);
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function main() {
  const avatarData = readFileSync(AVATAR_FILE).toString("base64");
  let languages = [];

  if (TOKEN) {
    try {
      languages = await fetchFromGraphql();
    } catch (error) {
      console.error("GraphQL failed:", error.message);
    }
  }

  if (languages.length === 0) {
    try {
      languages = await firstOk([fetchLanguagesHtml, fetchLanguagesRest]);
    } catch (error) {
      console.error("Language fetch failed:", error.message);
    }
  }

  languages = await withIcons(rankLanguages(languages));
  if (languages.length === 0) {
    languages = await withIcons(
      rankLanguages([
        { name: "C#", bytes: 8, color: LANG_COLORS["C#"] },
        { name: "Java", bytes: 4, color: LANG_COLORS.Java },
        { name: "Python", bytes: 3, color: LANG_COLORS.Python },
        { name: "Lua", bytes: 2, color: LANG_COLORS.Lua },
        { name: "JavaScript", bytes: 1, color: LANG_COLORS.JavaScript },
        { name: "CSS", bytes: 1, color: LANG_COLORS.CSS },
      ]),
    );
  }

  mkdirSync(join(ROOT, "widgets"), { recursive: true });
  writeFileSync(OUT_FILE, renderCard({ avatarData, languages }));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(
    "Languages:",
    languages.map((l) => `${l.name} ${Math.round(l.pct * 100)}%`).join(", ") || "(none)",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
