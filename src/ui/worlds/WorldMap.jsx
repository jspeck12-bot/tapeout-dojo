import { X } from '../components/fab-icons.jsx';
import { activeDone } from '../../world/challenges.js';
import { featureComplete } from '../../world/exploration.js';

function WorldMap({ model, save, world, accent, onClose }) {
  const bounds = model.bounds;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const xOf = (x) => ((x - bounds.minX) / width) * 700;
  const yOf = (z) => ((z - bounds.minZ) / depth) * 520;
  const done = activeDone(save);
  const features = model.exploration?.features || [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 58, background: 'rgba(3,5,9,.96)', overflow: 'auto', padding: 18 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div className="eyebrow" style={{ color: accent }}>survey map · world {world}</div>
            <div style={{ fontSize: 21, marginTop: 3 }}>{model.exploration?.landmark || 'UNMAPPED LANDMARK'}</div>
          </div>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={onClose}><X size={12} /> close map</button>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <svg viewBox="0 0 700 520" style={{ width: '100%', maxHeight: '70vh', background: '#080d14', borderRadius: 8 }}>
            {model.rects.map((rect, index) => (
              <rect key={index}
                x={xOf(rect.x1)} y={yOf(rect.z1)}
                width={Math.max(2, xOf(rect.x2) - xOf(rect.x1))}
                height={Math.max(2, yOf(rect.z2) - yOf(rect.z1))}
                fill="rgba(34,211,238,.06)" stroke="rgba(125,239,255,.32)" strokeWidth="2" />
            ))}
            {(model.path || []).slice(1).map((point, index) => {
              const prior = model.path[index];
              return <line key={index} x1={xOf(prior.x)} y1={yOf(prior.z)} x2={xOf(point.x)} y2={yOf(point.z)}
                stroke={accent} strokeOpacity=".34" strokeWidth="3" strokeDasharray="8 7" />;
            })}
            {model.interactables.filter(item => item.ord).map(item => {
              const complete = item.kind === 'book' ? !!save.lessons?.[item.lid] : !!done[item.id];
              return (
                <g key={item.id} transform={`translate(${xOf(item.x)} ${yOf(item.z)})`}>
                  <circle r={item.boss ? 9 : 6} fill={complete ? '#2ea56a' : item.boss ? '#facc15' : accent} />
                  <text y="-9" textAnchor="middle" fill="#d7e0ea" fontSize="11">{item.ord}</text>
                </g>
              );
            })}
            {features.filter(feature =>
              feature.kind === 'grace' || featureComplete(save, feature)).map(feature => (
              <g key={feature.id} transform={`translate(${xOf(feature.x)} ${yOf(feature.z)})`}>
                <rect x="-6" y="-6" width="12" height="12" rx="2"
                  fill={feature.kind === 'grace' ? '#7defff' : feature.kind === 'lore' ? '#a3e635' : '#ffc76b'} />
                <text y="18" textAnchor="middle" fill="#9fb0c4" fontSize="9">
                  {feature.kind === 'grace' ? 'GRACE' : feature.kind.toUpperCase()}
                </text>
              </g>
            ))}
            <circle cx={xOf(model.spawn.x)} cy={yOf(model.spawn.z)} r="6" fill="#ffffff" />
            <text x={xOf(model.spawn.x)} y={yOf(model.spawn.z) - 10} textAnchor="middle" fill="#fff" fontSize="9">SPAWN</text>
          </svg>
          <div style={{ display: 'flex', gap: 14, marginTop: 9, color: '#76849a', fontSize: 11, flexWrap: 'wrap' }}>
            <span>● station</span><span style={{ color: '#7defff' }}>■ grace</span>
            <span style={{ color: '#a3e635' }}>■ history</span><span style={{ color: '#ffc76b' }}>■ secret</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { WorldMap };
