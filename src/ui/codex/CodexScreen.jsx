import { useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, Cpu, Search } from 'lucide-react';
import { AudioFX } from '../../audio/index.js';
import { conceptMastery, masteryLevel } from '../../game/recall.js';
import { LESSON_DEPTH, LESSONS, TOPIC_LIST, WORLDS } from '../../game/content.js';
import { noteMeta } from '../../game/codex.js';
import { NoteTerminal } from './NoteTerminal.jsx';

function MasteryMap({ save }) {
  const notes = Object.values(LESSONS).flat();
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="eyebrow" style={{ color: '#7defff', marginBottom: 10 }}>mastery die · live proficiency</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 8 }}>
        {TOPIC_LIST.map((topic) => {
          const record = save.skill?.[topic.id];
          const level = masteryLevel(record);
          const score = conceptMastery(record);
          const recallNotes = notes.filter((lesson) => noteMeta(lesson.id).topic === topic.id);
          const attempts = recallNotes.reduce((sum, lesson) =>
            sum + (save.noteRecall?.[lesson.id]?.attempts || 0), 0);
          return (
            <div key={topic.id} style={{
              minHeight: 82,
              padding: 10,
              border: '1px solid ' + (level >= 3 ? '#2ea56a' : level >= 2 ? '#22d3ee' : level ? '#7a6310' : '#1d2632'),
              borderRadius: 7,
              background: `linear-gradient(0deg,rgba(34,211,238,${0.04 + score * 0.18}),#0b1018)`,
              boxShadow: level >= 3 ? '0 0 18px rgba(46,165,106,.2)' : 'none',
            }}>
              <div style={{ fontSize: 12, color: '#d7e0ea' }}>{topic.label}</div>
              <div style={{ height: 5, background: '#131b26', margin: '9px 0 6px', borderRadius: 9 }}>
                <div style={{ width: `${Math.round(score * 100)}%`, height: '100%', background: level >= 3 ? '#2ea56a' : '#22d3ee', borderRadius: 9 }} />
              </div>
              <div style={{ fontSize: 10.5, color: '#65758b' }}>{Math.round(score * 100)}% · {attempts} recall attempts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CodexScreen({ save, go, onRecall }) {
  const notes = useMemo(() => Object.entries(LESSONS).flatMap(([worldId, lessons]) => {
    const world = WORLDS.find(item => item.id === Number(worldId));
    return lessons.map(lesson => ({ ...lesson, world }));
  }), []);
  const [query, setQuery] = useState('');
  const collected = notes.filter(note => save.lessons?.[note.id]);
  const [selectedId, setSelectedId] = useState(() => collected[0]?.id || null);
  const filtered = notes.filter(note =>
    `${note.title} ${note.world.name} ${note.world.tag}`.toLowerCase().includes(query.toLowerCase()));
  const selected = notes.find(note => note.id === selectedId);

  return (
    <div style={{ marginTop: 18 }}>
      <button className="lnk" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={14} /> menu
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px' }}>
        <BookOpen size={21} color="#7defff" />
        <h1 style={{ margin: 0, fontSize: 24 }}>CODEX</h1>
      </div>
      <div style={{ color: '#76849a', marginBottom: 16 }}>
        {collected.length}/{notes.length} terminals recovered · recall performance feeds the mastery die and spaced review.
      </div>

      <MasteryMap save={save} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,300px) 1fr', gap: 14, alignItems: 'start' }} className="twocol">
        <div className="card" style={{ padding: 12, maxHeight: '72vh', overflow: 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #273245', borderRadius: 7, padding: '7px 9px', marginBottom: 10 }}>
            <Search size={13} color="#76849a" />
            <input value={query} onChange={event => setQuery(event.target.value)}
              placeholder="search topics, worlds…"
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: '#d7e0ea', font: 'inherit', fontSize: 12 }} />
          </label>
          {filtered.map(note => {
            const isCollected = !!save.lessons?.[note.id];
            const record = save.noteRecall?.[note.id];
            return (
              <button key={note.id} disabled={!isCollected}
                onClick={() => { setSelectedId(note.id); AudioFX.click(); }}
                style={{
                  width: '100%', padding: '9px 10px', textAlign: 'left', marginBottom: 6,
                  border: '1px solid ' + (selectedId === note.id ? note.world.color : '#1d2632'),
                  borderRadius: 7, background: '#0b1018', color: isCollected ? '#d7e0ea' : '#4c596b',
                  cursor: isCollected ? 'pointer' : 'not-allowed', font: 'inherit',
                }}>
                <div style={{ fontSize: 12.5 }}>{isCollected ? note.title : 'UNRECOVERED NOTE'}</div>
                <div style={{ fontSize: 10, color: '#65758b', marginTop: 2 }}>
                  {note.world.name} · {record ? `${record.correct}/${record.attempts} recall` : isCollected ? 'collected' : 'locked'}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          {selected && save.lessons?.[selected.id] ? (
            <NoteTerminal lesson={selected} depth={LESSON_DEPTH[selected.id]}
              worldLabel={selected.world.name} accent={selected.world.color}
              collected recallRecord={save.noteRecall?.[selected.id]}
              onRecall={correct => onRecall(selected.id, correct)} />
          ) : (
            <div className="card" style={{ padding: 28, textAlign: 'center', color: '#76849a' }}>
              <Cpu size={28} style={{ marginBottom: 10 }} />
              <div>Recover a field-note terminal in the world to archive it here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { CodexScreen, MasteryMap };
