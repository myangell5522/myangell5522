import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USERNAME = process.env.GH_USERNAME || "myangell5522";
const DISPLAY_NAME = process.env.GH_DISPLAY_NAME || "myangell";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
// Optional: path to a JSON file with { languages, stats, calendar } for offline previews.
const FIXTURE = process.env.WIDGET_FIXTURE || "";
const OUT_FILE = join(ROOT, "widgets", "profile-card.svg");
const AVATAR_FILE = join(ROOT, "assets", "avatar.jpg");

// ── Canvas & layout ────────────────────────────────────────────────────────────
const WIDTH = 900;
const HEIGHT = 520;
const PAD = 36;

const CX = 450;
const CY = 228;
const AVATAR_R = 66;
const DONUT_R = 97; // centre-line of the donut ring
const DONUT_W = 20;
const LOGO_R = 140;
const BADGE_R = 19;

const LEFT_X = PAD;
const RIGHT_X = 614;
const COL_W = 250;

const ACT_Y = 398; // contribution panel top
const ACT_H = 104;

// ── Palette ────────────────────────────────────────────────────────────────────
const GOLD = "#E8B84A";
const GOLD_BRIGHT = "#F7D37A";
const CREAM = "#FFF6E4";
const PLATE_DARK = "#1A1408";
const TEXT = "#EEF2F8";
const MUTED = "#8D96A8";
const DIM = "#5B6375";
const BG_TOP = "#14110B";
const BG_BOTTOM = "#0A0E1A";

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

// Stroke icons (24×24) for the stat tiles.
const UI_ICONS = {
  star: `<path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z"/>`,
  users: `<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20.5v-.8a5.7 5.7 0 0 1 5.7-5.7h1.6a5.7 5.7 0 0 1 5.7 5.7v.8"/><path d="M15.6 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M21.5 20.5v-.8a5.3 5.3 0 0 0-3.4-5"/>`,
  repo: `<path d="M4.5 19.2V5.3a2.3 2.3 0 0 1 2.3-2.3h12.7v13.6H7a2.5 2.5 0 0 0-2.5 2.6z"/><path d="M4.5 19.2A2.5 2.5 0 0 0 7 21.6h12.5v-5"/><path d="M9 7.5h6"/>`,
  pulse: `<path d="M2.5 12.5h4l2.6-7 5 14 2.6-7h4.8"/>`,
  flame: `<path d="M12 21.5c3.9 0 6.8-2.8 6.8-6.6 0-3.6-2.4-5.6-3.7-8.6-.9 1.8-1.9 2.7-3.1 3.1.2-2.6-.9-5-2.7-6.9-.5 3.6-4.1 6.2-4.1 11.2 0 4.2 2.9 7.8 6.8 7.8z"/>`,
  trophy: `<path d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.5H4.2a3.4 3.4 0 0 0 3.6 4.4"/><path d="M16.5 5.5h3.3a3.4 3.4 0 0 1-3.6 4.4"/><path d="M12 13.2v4.3"/><path d="M8.2 20.5h7.6"/>`,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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

const f1 = (n) => Number(n).toFixed(1);
const f2 = (n) => Number(n).toFixed(2);

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
  return { fill: light ? PLATE_DARK : CREAM, glyph: lang.color };
}

// Lift very dark language colours so bars stay visible on the dark card.
function visibleColor(hex) {
  const lum = luminance(hex);
  if (lum >= 70) return hex;
  const n = Number.parseInt(String(hex).replace("#", "").slice(0, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.35);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function arcPath(cx, cy, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${f2(x0)} ${f2(y0)} A${r} ${r} 0 ${large} 1 ${f2(x1)} ${f2(y1)}`;
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

function formatCount(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 10000) return n.toLocaleString("en-US");
  if (n < 1e6) return `${(n / 1000).toFixed(n < 100000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
}

// ── GitHub data ────────────────────────────────────────────────────────────────
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

async function fetchProfileGraphql() {
  const data = await graphql(
    `query ($login: String!) {
      user(login: $login) {
        followers { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
          totalCount
          nodes {
            stargazerCount
            languages(first: 1, orderBy: {field: SIZE, direction: DESC}) {
              edges { node { name color } }
            }
          }
        }
      }
    }`,
    { login: USERNAME },
  );

  const repos = data.user?.repositories?.nodes || [];
  const totals = new Map();
  for (const repo of repos) {
    const primary = repo.languages?.edges?.[0];
    if (!primary || HIDDEN_LANGS.has(primary.node.name)) continue;
    const name = primary.node.name;
    const current = totals.get(name) || { name, bytes: 0, color: LANG_COLORS[name] || primary.node.color };
    current.bytes += 1;
    totals.set(name, current);
  }

  return {
    languages: [...totals.values()],
    stats: {
      stars: repos.reduce((sum, r) => sum + (r.stargazerCount || 0), 0),
      followers: data.user?.followers?.totalCount ?? null,
      repos: data.user?.repositories?.totalCount ?? null,
    },
  };
}

async function fetchCalendarGraphql() {
  const data = await graphql(
    `query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`,
    { login: USERNAME },
  );
  const weeks = data.user?.contributionsCollection?.contributionCalendar?.weeks || [];
  const days = weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));
  if (days.length === 0) throw new Error("Empty contribution calendar");
  return days;
}

let restReposCache;
async function restRepos() {
  restReposCache ??= gh(`/users/${USERNAME}/repos?per_page=100&type=owner&sort=pushed`);
  return restReposCache;
}

async function fetchLanguagesRest() {
  const repos = await restRepos();
  return tally(repos.filter((repo) => !repo.fork && !repo.private).map((repo) => repo.language));
}

async function fetchStatsRest() {
  const [user, repos] = await Promise.all([gh(`/users/${USERNAME}`), restRepos()]);
  const own = repos.filter((r) => !r.fork && !r.private);
  return {
    stars: own.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
    followers: user.followers ?? null,
    repos: own.length,
  };
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

// Public contributions page — works without a token.
async function fetchCalendarHtml() {
  const res = await fetch(`https://github.com/users/${USERNAME}/contributions`, {
    headers: { "User-Agent": "danceqqq-profile-widget" },
  });
  if (!res.ok) throw new Error(`HTML contributions ${res.status}`);
  const html = await res.text();

  const counts = new Map();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const num = m[2].trim().match(/^([\d,]+)\s+contribution/);
    counts.set(m[1], num ? Number(num[1].replaceAll(",", "")) : 0);
  }

  const days = [];
  for (const m of html.matchAll(/<td\b[^>]*\bdata-date="[^"]+"[^>]*>/g)) {
    const tag = m[0];
    const date = tag.match(/data-date="([^"]+)"/)?.[1];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (!date) continue;
    let count = id && counts.has(id) ? counts.get(id) : null;
    if (count == null) {
      // Older markup carried the count directly; otherwise approximate from the level.
      const direct = tag.match(/data-count="(\d+)"/)?.[1];
      const level = Number(tag.match(/data-level="(\d)"/)?.[1] || 0);
      count = direct != null ? Number(direct) : level;
    }
    days.push({ date, count });
  }
  if (days.length === 0) throw new Error("No contribution days found");
  return days;
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
  return languages.map((lang, i) => ({ ...lang, icon: paths[i], iconId: `li${i}` }));
}

// ── Derived activity numbers ───────────────────────────────────────────────────
function summarizeCalendar(rawDays) {
  const days = [...rawDays].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) return null;

  // Last 365 days for the yearly total.
  const lastYear = days.slice(-365);
  const total = lastYear.reduce((s, d) => s + d.count, 0);

  // Longest run of active days.
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // Current streak — today may still be empty without breaking it.
  let current = 0;
  let i = days.length - 1;
  if (days[i].count === 0) i -= 1;
  for (; i >= 0 && days[i].count > 0; i--) current += 1;

  // Bucket into Sunday-started weeks, keep the last 52.
  const weeks = new Map();
  for (const d of days) {
    const t = new Date(`${d.date}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - t.getUTCDay());
    const key = t.toISOString().slice(0, 10);
    const w = weeks.get(key) || { start: key, count: 0 };
    w.count += d.count;
    weeks.set(key, w);
  }
  const weekList = [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start)).slice(-52);

  return { total, longest, current, weeks: weekList };
}

// ── Rendering primitives ───────────────────────────────────────────────────────
function iconSymbols(languages) {
  return languages
    .filter((l) => l.icon)
    .map((l) => `<symbol id="${l.iconId}" viewBox="0 0 24 24"><path d="${esc(l.icon)}"/></symbol>`)
    .join("\n    ");
}

function langGlyph(lang, x, y, size, fill) {
  if (!lang.icon) {
    return `<text x="${f1(x)}" y="${f1(y + size * 0.32)}" text-anchor="middle" fill="${fill}" font-size="${f1(size * 0.42)}" font-weight="700">${esc(lang.name.slice(0, 2))}</text>`;
  }
  return `<use href="#${lang.iconId}" xlink:href="#${lang.iconId}" x="${f1(x - size / 2)}" y="${f1(y - size / 2)}" width="${f1(size)}" height="${f1(size)}" fill="${fill}"/>`;
}

function logoBadge(lang, x, y, radius) {
  const plate = plateColors(lang);
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${radius}" fill="${plate.fill}" stroke="${GOLD}" stroke-width="1.6"/>
        ${langGlyph(lang, x, y, radius * 0.95, plate.glyph)}`;
}

function uiIcon(name, x, y, size = 15, color = GOLD) {
  const s = size / 24;
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f2(s)})" fill="none" stroke="${color}" stroke-width="${f2(1.9)}" stroke-linecap="round" stroke-linejoin="round">${UI_ICONS[name]}</g>`;
}

let clipSeq = 0;
const clipDefs = [];

// Odometer-style number: each digit is a column of 0–9 that rolls into place.
function odometer(value, x, baseline, { size = 26, delay = 0, color = TEXT, weight = 700 } = {}) {
  const LH = Math.round(size * 1.3);
  const dw = size * 0.6;
  const parts = [];
  let cx = x;
  let digitIdx = 0;
  for (const ch of String(value)) {
    if (/\d/.test(ch)) {
      const target = 10 + Number(ch);
      const spans = Array.from(
        { length: 20 },
        (_, k) => `<tspan x="${f1(cx + dw / 2)}" y="${baseline + k * LH}">${k % 10}</tspan>`,
      ).join("");
      parts.push(
        `<g class="roll" style="transform:translateY(-${target * LH}px);animation-delay:${f2(delay + digitIdx * 0.09)}s"><text text-anchor="middle">${spans}</text></g>`,
      );
      cx += dw;
      digitIdx += 1;
    } else {
      const w = ch === "," || ch === "." ? size * 0.28 : ch === "—" ? size * 0.9 : size * 0.56;
      parts.push(`<text class="rise" x="${f1(cx + w / 2)}" y="${baseline}" text-anchor="middle" style="animation-delay:${f2(delay)}s">${esc(ch)}</text>`);
      cx += w;
    }
  }
  const id = `oc${clipSeq++}`;
  clipDefs.push(
    `<clipPath id="${id}"><rect x="${f1(x - 2)}" y="${f1(baseline - size * 0.9)}" width="${f1(cx - x + 4)}" height="${f1(size * 1.18)}"/></clipPath>`,
  );
  return {
    width: cx - x,
    svg: `<g clip-path="url(#${id})" fill="${color}" font-size="${size}" font-weight="${weight}" class="num">${parts.join("")}</g>`,
  };
}

// ── Sections ───────────────────────────────────────────────────────────────────
function renderBackground(accent) {
  return `
  <g clip-path="url(#card)">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#panel)"/>
    <g class="blob b1"><circle cx="190" cy="120" r="260" fill="url(#blobGold)"/></g>
    <g class="blob b2"><circle cx="760" cy="400" r="280" fill="url(#blobAccent)"/></g>
    <g class="blob b3"><circle cx="${CX}" cy="${CY}" r="190" fill="url(#blobGold)" opacity="0.7"/></g>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)" mask="url(#fadeMask)"/>
    <g class="sheen"><rect x="-260" y="-60" width="180" height="${HEIGHT + 120}" fill="url(#sheenGrad)" transform="skewX(-18)"/></g>
  </g>
  <rect x="0.75" y="0.75" width="${WIDTH - 1.5}" height="${HEIGHT - 1.5}" rx="23.25" fill="none" stroke="url(#border)" stroke-width="1.5"/>
  <rect x="0.75" y="0.75" width="${WIDTH - 1.5}" height="${HEIGHT - 1.5}" rx="23.25" fill="none" stroke="#FFFFFF" stroke-opacity="0.04"/>`;
}

function renderHeader(updated) {
  const chipW = 104;
  const chipX = WIDTH - PAD - chipW;
  return `
  <g class="drop">
    <text x="${PAD}" y="58" fill="${TEXT}" font-size="26" font-weight="700" letter-spacing="-0.4">${esc(DISPLAY_NAME)}</text>
    <text x="${PAD}" y="80" font-size="12.5"><tspan fill="${GOLD_BRIGHT}" font-weight="600">@${esc(USERNAME)}</tspan><tspan fill="${MUTED}"> · GitHub overview</tspan></text>
  </g>
  <g class="drop" style="animation-delay:.12s">
    <rect x="${chipX}" y="38" width="${chipW}" height="24" rx="12" fill="${GOLD}" fill-opacity="0.1" stroke="${GOLD}" stroke-opacity="0.35"/>
    <circle class="ping" cx="${chipX + 15}" cy="50" r="3.5" fill="none" stroke="${GOLD_BRIGHT}" stroke-width="1.5"/>
    <circle class="blink" cx="${chipX + 15}" cy="50" r="3.5" fill="${GOLD_BRIGHT}"/>
    <text x="${chipX + 26}" y="54" fill="${GOLD_BRIGHT}" font-size="10" font-weight="700" letter-spacing="1.4">LIVE STATS</text>
    <text x="${WIDTH - PAD}" y="80" text-anchor="end" fill="${DIM}" font-size="11">updated ${esc(updated)}</text>
  </g>`;
}

function glassRect(x, y, w, h, rx = 14) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#glass)" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <rect x="${x + 14}" y="${y}" width="${w - 28}" height="1" fill="url(#hairline)"/>`;
}

function statTile({ x, y, w, h, icon, label, value, delay }) {
  const num = odometer(value, x + 16, y + h - 16, { size: 26, delay: delay + 0.25 });
  return `
  <g class="rise" style="animation-delay:${f2(delay)}s">
    ${glassRect(x, y, w, h)}
    ${uiIcon(icon, x + 15, y + 13, 15)}
    <text x="${x + 37}" y="${y + 25}" fill="${MUTED}" font-size="9.5" font-weight="600" letter-spacing="1.3">${esc(label)}</text>
    ${num.svg}
  </g>`;
}

function renderStats(stats, activity) {
  const w = 120;
  const h = 76;
  const gap = 10;
  const x0 = LEFT_X;
  const x1 = LEFT_X + w + gap;
  const y0 = 104;
  const y1 = y0 + h + gap;
  const y2 = y1 + h + gap;
  const wide = w * 2 + gap;

  const tiles = [
    statTile({ x: x0, y: y0, w, h, icon: "star", label: "STARS", value: formatCount(stats.stars), delay: 0.15 }),
    statTile({ x: x1, y: y0, w, h, icon: "users", label: "FOLLOWERS", value: formatCount(stats.followers), delay: 0.23 }),
    statTile({ x: x0, y: y1, w, h, icon: "repo", label: "REPOS", value: formatCount(stats.repos), delay: 0.31 }),
    statTile({ x: x1, y: y1, w, h, icon: "pulse", label: "CONTRIBS", value: formatCount(activity?.total), delay: 0.39 }),
  ].join("");

  const half = wide / 2;
  const cur = odometer(formatCount(activity?.current), x0 + 16, y2 + h - 16, { size: 26, delay: 0.75 });
  const best = odometer(formatCount(activity?.longest), x0 + half + 12, y2 + h - 16, { size: 26, delay: 0.85 });
  const streak = `
  <g class="rise" style="animation-delay:.47s">
    ${glassRect(x0, y2, wide, h)}
    <line x1="${x0 + half}" y1="${y2 + 16}" x2="${x0 + half}" y2="${y2 + h - 16}" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <g class="flicker" style="transform-origin:${x0 + 22}px ${y2 + 22}px">${uiIcon("flame", x0 + 15, y2 + 13, 15, "#FF9E4A")}</g>
    <text x="${x0 + 37}" y="${y2 + 25}" fill="${MUTED}" font-size="9.5" font-weight="600" letter-spacing="1.3">STREAK</text>
    ${cur.svg}
    <text x="${f1(x0 + 22 + cur.width)}" y="${y2 + h - 16}" fill="${MUTED}" font-size="11">days</text>
    ${uiIcon("trophy", x0 + half + 11, y2 + 13, 15)}
    <text x="${x0 + half + 33}" y="${y2 + 25}" fill="${MUTED}" font-size="9.5" font-weight="600" letter-spacing="1.3">BEST</text>
    ${best.svg}
    <text x="${f1(x0 + half + 18 + best.width)}" y="${y2 + h - 16}" fill="${MUTED}" font-size="11">days</text>
  </g>`;

  return tiles + streak;
}

function renderDonut(languages) {
  if (languages.length === 0) {
    return `<circle cx="${CX}" cy="${CY}" r="${DONUT_R}" fill="none" stroke="#2A2418" stroke-width="${DONUT_W}"/>`;
  }

  const gap = 0.034;
  const DRAW = 1.3; // seconds for the full ring
  const START = 0.35;
  let angle = -Math.PI / 2;
  let frac = 0;
  const slices = [];
  const mids = [];
  const ends = [];

  for (const lang of languages) {
    const sweep = Math.max(lang.pct * Math.PI * 2 - gap, 0.09);
    const a0 = angle + gap / 2;
    const a1 = a0 + sweep;
    const delay = START + frac * DRAW;
    const dur = Math.max(lang.pct * DRAW, 0.18);
    slices.push(
      `<path class="arc" d="${arcPath(CX, CY, DONUT_R, a0, a1)}" pathLength="1" stroke="${lang.color}" style="animation-delay:${f2(delay)}s;animation-duration:${f2(dur)}s"><title>${esc(lang.name)} ${Math.round(lang.pct * 100)}%</title></path>`,
    );
    mids.push((a0 + a1) / 2);
    ends.push(delay + dur);
    frac += lang.pct;
    angle = a1 + gap / 2;
  }

  const logoAngles = spreadAngles(mids, 0.62);
  const logos = languages
    .map((lang, i) => {
      const [lx, ly] = polar(CX, CY, LOGO_R, logoAngles[i]);
      const [tx, ty] = polar(CX, CY, DONUT_R + DONUT_W / 2 + 2, mids[i]);
      const [sx, sy] = polar(CX, CY, LOGO_R - BADGE_R, logoAngles[i]);
      return `
      <g class="pop" style="animation-delay:${f2(ends[i] - 0.1)}s">
        <path d="M${f1(tx)} ${f1(ty)} L${f1(sx)} ${f1(sy)}" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="2 3"/>
        <g class="upright"><g class="bob" style="animation-delay:${f2(-i * 0.7)}s">${logoBadge(lang, lx, ly, BADGE_R)}</g></g>
      </g>`;
    })
    .join("");

  return `
  <g class="orbit">
    <circle cx="${CX}" cy="${CY}" r="${DONUT_R}" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="${DONUT_W}"/>
    <g fill="none" stroke-width="${DONUT_W}">${slices.join("")}</g>
    <circle cx="${CX}" cy="${CY}" r="${LOGO_R}" fill="none" stroke="${GOLD}" stroke-opacity="0.12" stroke-dasharray="1 5"/>
    ${logos}
  </g>`;
}

function renderAvatar(avatarData) {
  const ringR = AVATAR_R + 12;
  const circ = 2 * Math.PI * ringR;
  return `
  <g class="zoom">
    <circle class="breathe" cx="${CX}" cy="${CY}" r="${AVATAR_R + 6}" fill="none" stroke="${GOLD_BRIGHT}" stroke-width="2.4" filter="url(#softGlow)"/>
    <g class="spin">
      <circle cx="${CX}" cy="${CY}" r="${ringR}" fill="none" stroke="url(#ringGrad)" stroke-width="2" stroke-linecap="round" stroke-dasharray="${f1(circ * 0.62)} ${f1(circ * 0.38)}"/>
      <circle cx="${f1(CX + ringR)}" cy="${CY}" r="2.6" fill="${GOLD_BRIGHT}" filter="url(#softGlow)"/>
    </g>
    <circle cx="${CX}" cy="${CY}" r="${AVATAR_R + 2}" fill="${BG_BOTTOM}"/>
    <image href="data:image/jpeg;base64,${avatarData}" xlink:href="data:image/jpeg;base64,${avatarData}"
      x="${CX - AVATAR_R}" y="${CY - AVATAR_R}" width="${AVATAR_R * 2}" height="${AVATAR_R * 2}"
      clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>
    <circle cx="${CX}" cy="${CY}" r="${AVATAR_R}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12"/>
  </g>`;
}

function renderLanguageList(languages) {
  const x = RIGHT_X;
  const top = 104;
  const rowH = languages.length > 6 ? 34 : 38;
  const maxPct = Math.max(...languages.map((l) => l.pct), 0.0001);
  const barX = x + 30;
  const barW = COL_W - 30;

  const rows = languages
    .map((lang, i) => {
      const y = top + 28 + i * rowH;
      const delay = 0.45 + i * 0.08;
      const w = Math.max((lang.pct / maxPct) * barW, 6);
      const color = visibleColor(lang.color);
      const repos = lang.name === "Other" ? "" : ` · ${lang.bytes} repo${lang.bytes === 1 ? "" : "s"}`;
      return `
    <g class="slide" style="animation-delay:${f2(delay)}s">
      <title>${esc(lang.name)} — ${Math.round(lang.pct * 100)}%${esc(repos)}</title>
      ${logoBadge(lang, x + 11, y + 6, 11)}
      <text x="${barX}" y="${y + 10}" fill="${TEXT}" font-size="12.5" font-weight="600">${esc(lang.name)}</text>
      <text x="${x + COL_W}" y="${y + 10}" text-anchor="end" fill="${MUTED}" font-size="11.5" font-weight="600">${Math.round(lang.pct * 100)}%</text>
      <rect x="${barX}" y="${y + 17}" width="${barW}" height="4" rx="2" fill="#FFFFFF" fill-opacity="0.06"/>
      <rect class="fill" x="${barX}" y="${y + 17}" width="${f1(w)}" height="4" rx="2" fill="${color}" style="animation-delay:${f2(delay + 0.2)}s"/>
      <rect class="fill" x="${barX}" y="${y + 15}" width="${f1(w)}" height="8" rx="4" fill="${color}" opacity="0.25" filter="url(#barGlow)" style="animation-delay:${f2(delay + 0.2)}s"/>
    </g>`;
    })
    .join("");

  return `
  <g class="drop" style="animation-delay:.3s">
    <text x="${x}" y="${top + 8}" fill="${MUTED}" font-size="9.5" font-weight="600" letter-spacing="1.3">TOP LANGUAGES</text>
    <text x="${x + COL_W}" y="${top + 8}" text-anchor="end" fill="${DIM}" font-size="10">by repo</text>
  </g>
  ${rows}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderActivity(activity) {
  const x = PAD;
  const y = ACT_Y;
  const w = WIDTH - PAD * 2;
  const h = ACT_H;
  const innerX = x + 18;
  const innerW = w - 36;
  const baseline = y + 78;
  const maxH = 42;

  const weeks = activity?.weeks?.length ? activity.weeks : Array.from({ length: 52 }, () => ({ start: "", count: 0 }));
  const n = weeks.length;
  const step = innerW / n;
  const bw = Math.max(step * 0.66, 3);
  const max = Math.max(...weeks.map((wk) => wk.count), 1);

  let lastLabelX = -100;
  let lastMonth = -1;
  const labels = [];
  const bars = weeks
    .map((wk, i) => {
      const t = wk.count / max;
      const bh = wk.count > 0 ? Math.max(Math.sqrt(t) * maxH, 4) : 2;
      const bx = innerX + i * step + (step - bw) / 2;
      const opacity = wk.count > 0 ? 0.35 + 0.65 * t : 0.12;
      const fill = wk.count > 0 ? "url(#barGrad)" : "#FFFFFF";

      if (wk.start) {
        const month = Number(wk.start.slice(5, 7)) - 1;
        if (month !== lastMonth && bx - lastLabelX > 40) {
          labels.push(`<text x="${f1(bx)}" y="${baseline + 15}" fill="${DIM}" font-size="9.5">${MONTHS[month]}</text>`);
          lastLabelX = bx;
        }
        lastMonth = month;
      }

      const tip = wk.start ? `<title>${wk.count} contribution${wk.count === 1 ? "" : "s"} · week of ${wk.start}</title>` : "";
      return `<rect class="grow" x="${f1(bx)}" y="${f1(baseline - bh)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(Math.min(bw / 2, 3))}" fill="${fill}" fill-opacity="${f2(opacity)}" style="animation-delay:${f2(0.8 + i * 0.022)}s">${tip}</rect>`;
    })
    .join("");

  const peak = weeks.reduce((best, wk, i) => (wk.count > weeks[best].count ? i : best), 0);
  const peakX = innerX + peak * step + step / 2;
  const peakH = weeks[peak].count > 0 ? Math.max(Math.sqrt(1) * maxH, 4) : 0;
  const peakMark = weeks[peak].count > 0
    ? `<g class="pop" style="animation-delay:${f2(0.8 + peak * 0.022 + 0.5)}s">
      <circle class="breathe" cx="${f1(peakX)}" cy="${f1(baseline - peakH - 7)}" r="3" fill="${GOLD_BRIGHT}" filter="url(#softGlow)"/>
    </g>`
    : "";

  const total = activity ? activity.total.toLocaleString("en-US") : "—";
  return `
  <g class="rise" style="animation-delay:.6s">
    ${glassRect(x, y, w, h, 16)}
    <text x="${innerX}" y="${y + 24}" fill="${MUTED}" font-size="9.5" font-weight="600" letter-spacing="1.3">CONTRIBUTIONS · LAST 52 WEEKS</text>
    <text x="${innerX + innerW}" y="${y + 24}" text-anchor="end" font-size="11.5"><tspan fill="${TEXT}" font-weight="700">${esc(total)}</tspan><tspan fill="${MUTED}"> in the last year</tspan></text>
    <line x1="${innerX}" y1="${baseline + 0.5}" x2="${innerX + innerW}" y2="${baseline + 0.5}" stroke="#FFFFFF" stroke-opacity="0.06"/>
    ${bars}
    ${peakMark}
    ${labels.join("")}
  </g>`;
}

function renderCard({ avatarData, languages, stats, activity, updated }) {
  clipSeq = 0;
  clipDefs.length = 0;
  const accent = visibleColor(languages[0]?.color || "#6E56CF");

  const body = [
    renderBackground(accent),
    renderHeader(updated),
    renderStats(stats, activity),
    `<g>${renderDonut(languages)}</g>`,
    renderAvatar(avatarData),
    renderLanguageList(languages),
    renderActivity(activity),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(DISPLAY_NAME)} GitHub profile">
  <title>${esc(DISPLAY_NAME)} · live GitHub widget</title>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="1" stop-color="${BG_BOTTOM}"/>
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="${GOLD_BRIGHT}" stop-opacity="0.95"/>
      <stop offset="0.3" stop-color="${GOLD}" stop-opacity="0.08"/>
      <stop offset="0.55" stop-color="${accent}" stop-opacity="0.75"/>
      <stop offset="0.8" stop-color="${GOLD}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${GOLD_BRIGHT}" stop-opacity="0.95"/>
      <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="10s" repeatCount="indefinite"/>
    </linearGradient>
    <radialGradient id="blobGold">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blobAccent">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheenGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.055"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.018"/>
    </linearGradient>
    <linearGradient id="hairline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD_BRIGHT}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${GOLD_BRIGHT}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${GOLD_BRIGHT}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_BRIGHT}"/>
      <stop offset="0.6" stop-color="${GOLD}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${GOLD_BRIGHT}"/>
    </linearGradient>
    <radialGradient id="fadeGrad" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <mask id="fadeMask"><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fadeGrad)"/></mask>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="#FFFFFF" fill-opacity="0.07"/>
    </pattern>
    <clipPath id="card"><rect width="${WIDTH}" height="${HEIGHT}" rx="24"/></clipPath>
    <clipPath id="avatarClip"><circle cx="${CX}" cy="${CY}" r="${AVATAR_R}"/></clipPath>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="barGlow" x="-10%" y="-200%" width="120%" height="500%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    ${iconSymbols(languages)}
    ${clipDefs.join("\n    ")}
    <style>
      text { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Inter', Ubuntu, system-ui, sans-serif; }
      .num { font-variant-numeric: tabular-nums; }

      /* entrance — keyframes only define the start, so the static state is the final one */
      .rise  { animation: rise .8s cubic-bezier(.2,.8,.2,1) both; }
      .drop  { animation: drop .7s cubic-bezier(.2,.8,.2,1) both; }
      .slide { animation: slide .7s cubic-bezier(.2,.8,.2,1) both; }
      .zoom  { animation: zoom 1s cubic-bezier(.2,1.2,.3,1) both; transform-box: fill-box; transform-origin: center; }
      .pop   { animation: pop .6s cubic-bezier(.3,1.6,.5,1) both; transform-box: fill-box; transform-origin: center; }
      .roll  { animation: roll 1.9s cubic-bezier(.16,1,.3,1) both; }
      .arc   { stroke-dasharray: 1 1; animation-name: draw; animation-timing-function: linear; animation-fill-mode: both; }
      .fill  { animation: fill 1.1s cubic-bezier(.2,.8,.2,1) both; transform-box: fill-box; transform-origin: 0 50%; }
      .grow  { animation: grow .7s cubic-bezier(.2,1.1,.3,1) both; transform-box: fill-box; transform-origin: 50% 100%; }

      @keyframes rise  { from { opacity: 0; transform: translateY(14px); } }
      @keyframes drop  { from { opacity: 0; transform: translateY(-10px); } }
      @keyframes slide { from { opacity: 0; transform: translateX(18px); } }
      @keyframes zoom  { from { opacity: 0; transform: scale(.6); } }
      @keyframes pop   { from { opacity: 0; transform: scale(.2); } }
      @keyframes roll  { from { transform: translateY(0); } }
      @keyframes draw  { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      @keyframes fill  { from { transform: scaleX(0); } }
      @keyframes grow  { from { transform: scaleY(0); } }

      /* ambient loops */
      .orbit   { animation: turn 140s linear infinite; transform-box: view-box; transform-origin: ${CX}px ${CY}px; }
      .upright { animation: turn 140s linear infinite reverse; transform-box: fill-box; transform-origin: center; }
      .bob     { animation: bob 4.2s ease-in-out infinite; }
      .spin    { animation: turn 9s linear infinite; transform-box: view-box; transform-origin: ${CX}px ${CY}px; }
      .breathe { animation: breathe 3.2s ease-in-out infinite; }
      .blink   { animation: breathe 1.6s ease-in-out infinite; }
      .ping    { animation: ping 2s cubic-bezier(0,0,.2,1) infinite; transform-box: fill-box; transform-origin: center; }
      .flicker { animation: flicker 1.8s ease-in-out infinite; }
      .blob    { transform-box: view-box; }
      .b1      { animation: driftA 22s ease-in-out infinite; }
      .b2      { animation: driftB 26s ease-in-out infinite; }
      .b3      { animation: breathe 6s ease-in-out infinite; }
      .sheen   { animation: sheen 9s ease-in-out 2.2s infinite; }

      @keyframes turn    { to { transform: rotate(360deg); } }
      @keyframes bob     { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }
      @keyframes breathe { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
      @keyframes ping    { 0% { transform: scale(1); opacity: .9; } 80%, 100% { transform: scale(3.2); opacity: 0; } }
      @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.08, .95) rotate(-3deg); } 60% { transform: scale(.96, 1.06) rotate(2deg); } }
      @keyframes driftA  { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(120px, 60px); } }
      @keyframes driftB  { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-140px, -50px); } }
      @keyframes sheen   { 0% { transform: translateX(0); } 45%, 100% { transform: translateX(1300px); } }

      @media (prefers-reduced-motion: reduce) {
        * { animation: none !important; }
      }
    </style>
  </defs>
${body}
</svg>
`;
}

// ── Main ───────────────────────────────────────────────────────────────────────
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
  return null;
}

async function main() {
  const avatarData = readFileSync(AVATAR_FILE).toString("base64");
  let languages = [];
  let stats = { stars: null, followers: null, repos: null };
  let days = null;

  if (FIXTURE) {
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8"));
    languages = fx.languages || [];
    stats = { ...stats, ...(fx.stats || {}) };
    days = fx.calendar || null;
  } else {
    if (TOKEN) {
      try {
        const profile = await fetchProfileGraphql();
        languages = profile.languages;
        stats = profile.stats;
      } catch (error) {
        console.error("GraphQL profile failed:", error.message);
      }
    }

    if (languages.length === 0) {
      try {
        languages = (await firstOk([fetchLanguagesHtml, fetchLanguagesRest])) || [];
      } catch (error) {
        console.error("Language fetch failed:", error.message);
      }
    }

    if (stats.followers == null) {
      try {
        stats = await fetchStatsRest();
      } catch (error) {
        console.error("Stats fetch failed:", error.message);
      }
    }

    try {
      days = await firstOk([...(TOKEN ? [fetchCalendarGraphql] : []), fetchCalendarHtml]);
    } catch (error) {
      console.error("Contribution fetch failed:", error.message);
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

  const activity = days ? summarizeCalendar(days) : null;
  // Date only (no time) so the scheduled job commits at most once a day for the stamp.
  const updated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  mkdirSync(join(ROOT, "widgets"), { recursive: true });
  writeFileSync(OUT_FILE, renderCard({ avatarData, languages, stats, activity, updated }));
  console.log(`Wrote ${OUT_FILE}`);
  console.log("Languages:", languages.map((l) => `${l.name} ${Math.round(l.pct * 100)}%`).join(", ") || "(none)");
  console.log("Stats:", JSON.stringify(stats));
  if (activity) console.log(`Activity: ${activity.total} in last year, streak ${activity.current}, best ${activity.longest}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
