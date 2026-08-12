import * as THREE from "three";
import { CAMPUS_SIZE, COURT_HALF } from '../world/campus.js';

const WALL_H = 5;

function makeTextCanvas(lines, opts) {
  const o = opts || {};
  const cv = document.createElement('canvas');
  cv.width = o.w || 512; cv.height = o.h || 256;
  const g = cv.getContext('2d');
  g.fillStyle = o.bg || '#0A0E14';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = o.border || '#22D3EE';
  g.lineWidth = 6;
  g.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    g.fillStyle = ln.color || '#E8F1FA';
    g.font = `${ln.bold ? '700' : '500'} ${ln.size || 44}px monospace`;
    g.fillText(ln.text, cv.width / 2, cv.height * (i + 1) / (n + 1));
  });
  const tx = new THREE.CanvasTexture(cv);
  return tx;
}

function groundTexture(model) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  const S = 1024 / CAMPUS_SIZE;
  const X = (wx) => (wx + CAMPUS_SIZE / 2) * S;
  const Z = (wz) => (wz + CAMPUS_SIZE / 2) * S;
  g.fillStyle = '#0A0F16';
  g.fillRect(0, 0, 1024, 1024);
  // faint substrate grid
  g.strokeStyle = 'rgba(34,211,238,0.06)';
  g.lineWidth = 1;
  for (let i = 0; i <= 32; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(1024, i * 32); g.stroke();
  }
  // traces: plaza -> each district gate
  model.districts.forEach(d => {
    const a = model.anchors[d.w];
    const gx = d.x + a.facing.fx * COURT_HALF, gz = d.z + a.facing.fz * COURT_HALF;
    g.strokeStyle = 'rgba(34,211,238,0.55)';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(0), Z(0));
    // manhattan route: out along district's dominant axis then across
    if (a.facing.fz !== 0) { g.lineTo(X(d.x), Z(0)); g.lineTo(X(d.x), Z(gz)); }
    else { g.lineTo(X(0), Z(d.z)); g.lineTo(X(gx), Z(d.z)); }
    g.stroke();
    g.strokeStyle = 'rgba(125,239,255,0.9)';
    g.lineWidth = 3;
    g.stroke();
    // district pad
    g.fillStyle = 'rgba(13,20,28,1)';
    g.strokeStyle = '#' + d.color.toString(16).padStart(6, '0');
    g.lineWidth = 4;
    const px = X(d.x - COURT_HALF), pz = Z(d.z - COURT_HALF), ps = COURT_HALF * 2 * S;
    g.fillRect(px, pz, ps, ps);
    g.globalAlpha = 0.8; g.strokeRect(px, pz, ps, ps); g.globalAlpha = 1;
  });
  // plaza pad
  g.beginPath();
  g.arc(X(0), Z(0), 40 * S, 0, Math.PI * 2);
  g.fillStyle = 'rgba(16,24,33,1)'; g.fill();
  g.strokeStyle = 'rgba(125,239,255,0.7)'; g.lineWidth = 4; g.stroke();
  const tx = new THREE.CanvasTexture(cv);
  tx.anisotropy = 4;
  return tx;
}

function matStd(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.15 }, opts || {})); }

function addBoxMesh(scene, cx, cy, cz, sx, sy, sz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(cx, cy, cz);
  scene.add(m);
  return m;
}

function mineLabelSprite(text, color, scale) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = '600 34px "Segoe UI", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  cv.width = w; cv.height = 64;
  const c2 = cv.getContext('2d');
  c2.fillStyle = 'rgba(8,12,18,0.78)';
  c2.fillRect(0, 0, w, 64);
  c2.strokeStyle = color; c2.globalAlpha = 0.6; c2.strokeRect(1, 1, w - 2, 62); c2.globalAlpha = 1;
  c2.font = '600 34px "Segoe UI", sans-serif';
  c2.fillStyle = color; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const s = scale || 1;
  sp.scale.set((w / 64) * 1.6 * s, 1.6 * s, 1);
  return sp;
}

export {
  WALL_H, makeTextCanvas, groundTexture, matStd,
  addBoxMesh, mineLabelSprite,
};
