// Build-time / gate schema for TAPEOUT content.
// valibot is a gate dependency only — the game runtime does not import this file.
import * as v from 'valibot';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// looseObject: challenges/gear carry optional pedagogy fields (boss, atk, …)
// that are not all enumerated here. Unknown keys must not fail the gate.
const object = v.looseObject || v.object;

const ID = v.pipe(v.string(), v.minLength(2), v.maxLength(40), v.regex(/^[A-Za-z][A-Za-z0-9_+]*$/));
const Port = v.object({
  n: v.pipe(v.string(), v.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)),
  d: v.picklist(['in', 'out']),
  w: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(32)),
});
const Iface = v.object({
  name: v.pipe(v.string(), v.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)),
  ports: v.pipe(v.array(Port), v.minLength(1)),
});
const CombTest = v.object({
  type: v.literal('comb'),
  vectors: v.pipe(v.array(v.object({ in: v.record(v.string(), v.number()), out: v.record(v.string(), v.number()) })), v.minLength(1)),
});
const SeqTest = v.object({
  type: v.literal('seq'),
  watch: v.pipe(v.array(v.string()), v.minLength(1)),
  frames: v.pipe(v.array(v.record(v.string(), v.number())), v.minLength(1)),
  makeRef: v.optional(v.function()),
  expected: v.optional(v.array(v.record(v.string(), v.any()))),
});

export const ChallengeSchema = object({
  id: ID,
  world: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)),
  title: v.pipe(v.string(), v.minLength(3)),
  xp: v.pipe(v.number(), v.integer(), v.minValue(1)),
  brief: v.pipe(v.string(), v.minLength(20)),
  iface: Iface,
  starter: v.string(),
  hints: v.array(v.string()),
  solution: v.pipe(v.string(), v.minLength(10)),
  test: v.union([CombTest, SeqTest]),
  boss: v.optional(v.boolean()),
  table: v.optional(v.any()),
});

export const LessonSchema = object({
  id: v.pipe(v.string(), v.regex(/^L[1-7][a-z]$/)),
  title: v.pipe(v.string(), v.minLength(3)),
  body: v.pipe(v.string(), v.minLength(20)),
  code: v.optional(v.string()),
});

export const GauntletSchema = object({
  id: ID,
  world: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)),
  title: v.pipe(v.string(), v.minLength(3)),
  xp: v.pipe(v.number(), v.integer(), v.minValue(1)),
  gen: v.function(),
  intro: v.pipe(v.string(), v.minLength(10)),
});

export const AchievementSchema = object({
  id: ID,
  name: v.pipe(v.string(), v.minLength(2)),
  desc: v.pipe(v.string(), v.minLength(4)),
  xp: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const GearSchema = object({
  id: v.pipe(v.string(), v.regex(/^[a-z]_[a-z0-9]+$/)),
  slot: v.picklist(['weapon', 'armor', 'tool', 'consumable']),
  name: v.pipe(v.string(), v.minLength(2)),
  cost: v.pipe(v.number(), v.minValue(0)),
  blurb: v.pipe(v.string(), v.minLength(4)),
});

function issuePath(issue) {
  const p = (issue.path || []).map((x) => (x && x.key != null ? x.key : x)).join('.');
  return p || '(root)';
}

export function formatValibotError(file, err) {
  const issues = err.issues || [];
  return issues.map((iss) => `${file} · ${issuePath(iss)}: ${iss.message}`).join('\n') || String(err);
}

export function validateCatalog(cat) {
  const errors = [];
  const push = (file, e) => {
    if (e && e.issues) errors.push(formatValibotError(file, e));
    else errors.push(`${file}: ${e && e.message ? e.message : e}`);
  };

  cat.CODE_CHALLENGES.forEach((ch) => {
    const r = v.safeParse(ChallengeSchema, ch);
    if (!r.success) push(`content/world-${ch.world}/challenges.js [${ch.id}]`, r);
    const ports = new Set((ch.iface && ch.iface.ports || []).map((p) => p.n));
    if (ch.test && ch.test.type === 'comb' && ch.test.vectors && ch.test.vectors[0]) {
      for (const k of Object.keys(ch.test.vectors[0].out || {})) {
        if (!ports.has(k)) errors.push(`content/world-${ch.world}/challenges.js [${ch.id}]: test output '${k}' is not a port`);
      }
    }
    if (ch.test && ch.test.type === 'seq') {
      for (const w of ch.test.watch || []) {
        if (!ports.has(w)) errors.push(`content/world-${ch.world}/challenges.js [${ch.id}]: watch '${w}' is not a port`);
      }
    }
  });

  for (const [wid, lessons] of Object.entries(cat.LESSONS)) {
    (lessons || []).forEach((L) => {
      const r = v.safeParse(LessonSchema, L);
      if (!r.success) push(`content/world-${wid}/lessons.js [${L.id}]`, r);
    });
  }

  cat.GAUNTLETS.forEach((g) => {
    const r = v.safeParse(GauntletSchema, g);
    if (!r.success) push(`content/world-${g.world}/gauntlets.js [${g.id}]`, r);
  });

  cat.ACHIEVEMENTS.forEach((a) => {
    const r = v.safeParse(AchievementSchema, a);
    if (!r.success) push(`content/achievements.js [${a.id}]`, r);
  });

  cat.ITEMS.forEach((it) => {
    const r = v.safeParse(GearSchema, it);
    if (!r.success) push(`content/gear.js [${it.id}]`, r);
  });

  // Cross-references
  const lessonIds = new Set();
  Object.values(cat.LESSONS).forEach((arr) => (arr || []).forEach((L) => lessonIds.add(L.id)));
  const topicIds = new Set((cat.TOPIC_LIST || []).map((t) => t.id));
  for (const ch of cat.CODE_CHALLENGES) {
    const topic = cat.TOPIC_OF[ch.id];
    if (!topic) errors.push(`TOPIC_OF missing for challenge '${ch.id}'`);
    else if (topicIds.size && !topicIds.has(topic)) errors.push(`challenge '${ch.id}' topic '${topic}' is not in TOPIC_LIST`);
    const lessons = cat.LESSONS[ch.world];
    if (!lessons || !lessons.length) {
      errors.push(`challenge '${ch.id}' world ${ch.world} has no governing field notes`);
    }
  }
  const seenCh = new Set();
  for (const c of cat.ALL_CHALLENGES) {
    if (seenCh.has(c.id)) errors.push(`duplicate catalog id '${c.id}'`);
    seenCh.add(c.id);
  }
  const gearIds = new Set(cat.ITEMS.map((i) => i.id));
  for (const id of ['w_iron', 'a_cloth']) {
    if (!gearIds.has(id)) errors.push(`default gear '${id}' is missing from ITEMS`);
  }
  const chIds = new Set(cat.ALL_CHALLENGES.map((c) => c.id));
  for (const id of Object.keys(cat.WORLD_ORDER)) {
    if (!chIds.has(id) && !id.startsWith('tg_')) {
      // WORLD_ORDER may include gauntlet/truth ids that must exist
      if (!chIds.has(id)) errors.push(`WORLD_ORDER references unknown challenge '${id}'`);
    }
  }
  for (const id of Object.keys(cat.REMIX)) {
    if (!cat.CODE_CHALLENGES.some((c) => c.id === id)) errors.push(`REMIX '${id}' has no base challenge`);
  }

  return errors;
}

export function collectIds(cat) {
  const ids = {
    challenge: cat.ALL_CHALLENGES.map((c) => c.id).sort(),
    lesson: Object.values(cat.LESSONS).flat().map((L) => L.id).sort(),
    achievement: cat.ACHIEVEMENTS.map((a) => a.id).sort(),
    gear: cat.ITEMS.map((i) => i.id).sort(),
  };
  return ids;
}

export function loadManifest() {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(here, 'ids.manifest.json'), 'utf8'));
}

export function diffManifest(current, shipped) {
  const missing = [];
  for (const kind of Object.keys(shipped)) {
    const now = new Set(current[kind] || []);
    for (const id of shipped[kind] || []) {
      if (!now.has(id)) missing.push({ kind, id });
    }
  }
  return missing;
}
