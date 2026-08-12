// SM-2-lite spaced-recall telemetry, keyed by topic id.
function reviewInit() {
  return {
    seen: 0,
    lapses: 0,
    streak: 0,
    ease: 2.3,
    interval: 0,
    dueDay: 0,
    lastDay: 0,
    lastQ: 0,
  };
}

function clampEase(ease) {
  return Math.max(1.3, Math.min(2.8, ease));
}

function reviewUpdate(record, quality, today) {
  const next = record ? Object.assign(reviewInit(), record) : reviewInit();
  const normalizedQuality = Math.max(0, Math.min(1, quality));
  next.seen += 1;
  next.lastDay = today;
  next.lastQ = normalizedQuality;
  if (normalizedQuality >= 0.5) {
    next.streak += 1;
    next.ease = clampEase(next.ease + (normalizedQuality - 0.6) * 0.4);
    next.interval = next.streak <= 1
      ? 1
      : (next.streak === 2
        ? 3
        : Math.max(1, Math.round((next.interval || 3) * next.ease)));
    next.dueDay = today + next.interval;
  } else {
    next.lapses += 1;
    next.streak = 0;
    next.ease = clampEase(next.ease - 0.2);
    next.interval = 1;
    next.dueDay = today + 1;
  }
  return next;
}

function masteryLevel(record) {
  if (!record || !record.seen) return 0;
  if (record.streak >= 4 && (record.interval || 0) >= 14) return 3;
  if (record.streak >= 2) return 2;
  return 1;
}

function conceptMastery(record) {
  if (!record || !record.seen) return 0;
  const streak = Math.min(1, record.streak / 5);
  const interval = Math.min(1, (record.interval || 0) / 21);
  return Math.max(0, Math.min(1, 0.6 * streak + 0.4 * interval));
}

function todayNum(now) {
  return Math.floor((now == null ? Date.now() : now) / 86400000);
}

function dueTopics(skill, today) {
  const due = [];
  const records = skill || {};
  for (const key in records) {
    if ((records[key].seen || 0) > 0 && (records[key].dueDay || 0) <= today) due.push(key);
  }
  return due;
}

export {
  conceptMastery,
  dueTopics,
  masteryLevel,
  reviewInit,
  reviewUpdate,
  todayNum,
};
