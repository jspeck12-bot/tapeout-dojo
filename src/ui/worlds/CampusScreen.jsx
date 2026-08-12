import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Terminal, X, Zap,
} from "lucide-react";
import * as THREE from "three";
import { AudioFX } from '../../audio/index.js';
import { FR } from '../../telemetry/flight-recorder.js';
import { disposeScene, makePostFX } from '../../graphics/cinematic.js';
import {
  buildFabUltra, buildCampusWorld, applyCampusProgress,
} from '../../graphics/world-builders.js';
import { nearestInteractable, resolveCollisions } from '../../world/collision.js';
import { worldUnlockedEx } from '../../world/challenges.js';
import {
  CAMPUS_SIZE, COURT_HALF, campusModel, campusProgress,
} from '../../world/campus.js';
import { WORLDS } from '../../game/content.js';
import {
  WorldScreen, GauntletScreen, TruthScreen, CodeScreen,
  BlitzScreen, BugScreen, AchScreen, ManualScreen,
} from '../challenges.jsx';
import {
  ForgeScreen, TrainingScreen, ProfilesScreen,
} from '../meta.jsx';
import { ShopScreen } from '../combat.jsx';
import { TouchControls } from '../world-shared.jsx';

function CampusScreen({ save, go, cb }) {
  const mountRef = useRef(null);
  const minimapRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState(null);
  const [showHelp, setShowHelp] = useState(!save.campusVisited);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRef2 = useRef(save); saveRef2.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKey = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => {
    setShowHelp(!save.campusVisited);
    if (!save.campusVisited) cb.onVisited();
  }, [cb.activeSlot]); // eslint-disable-line

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'campus') { setOverlay(null); return; }
    if (sc.name === 'mine') { setOverlay(null); go({ name: 'mine' }); return; }
    if (sc.name === 'dungeon') { setOverlay(null); go({ name: 'dungeon', w: sc.w }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);

  // ---------- engine ----------
  useEffect(() => {
    const mount = mountRef.current;
    let renderer, post = null, scene = null, raf = 0, alive = true;
    const cleanup = [];
    let tornDown = false;
    const teardown = () => {
      if (tornDown) return;
      tornDown = true;
      alive = false;
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
      disposeScene(scene);
      try {
        renderer && renderer.dispose();
        post && post.dispose();
        renderer && renderer.forceContextLoss && renderer.forceContextLoss();
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch (e) { }
      engineRef.current = null;
    };
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      scene = new THREE.Scene();
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      const camera = new THREE.PerspectiveCamera(72, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 600);
      camera.rotation.order = 'YXZ';

      const model = campusModel();
      const api = buildCampusWorld(scene, model);
      try { buildFabUltra(scene, model, api); } catch (e) { }

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.04 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0;
      let zoneW = 0, promptKey = '', miniT = 0, helpDismissed = false;

      const lockedTest = (it) => {
        const s = saveRef2.current;
        if (it.kind === 'arcade' && it.needsW3) return !worldUnlockedEx(3, s) ? 'SEALED — opens with Module Foundry' : null;
        if (it.kind === 'console') return !worldUnlockedEx(it.w, s) ? 'SEALED' : null;
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        const lock = lockedTest(it);
        if (lock) { AudioFX.bad(); return; }
        if (it.kind === 'pad') openOverlay({ name: 'fasttravel' });
        else openOverlay({ ...it.target });
      };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      // touch-look on the canvas (right half); joystick handled by HUD via inputRef
      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.005;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.004));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      let progress = campusProgress(saveRef2.current);
      applyCampusProgress(api, model, progress);

      engineRef.current = {
        applyProgress: (p) => { progress = p; applyCampusProgress(api, model, p); },
        teleport: (w) => {
          const spot = model.padSpots.find(s => s.w === w);
          if (!spot) return;
          player.x = spot.x; player.z = spot.z + 3;
          const d = model.districts.find(dd => dd.w === w);
          if (d) player.yaw = Math.atan2(-(d.x - player.x), (d.z - player.z)) + Math.PI;
          AudioFX.good();
        },
        interact: tryInteract,
      };

      const clock = new THREE.Clock();
      const camVec = new THREE.Vector3();
      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;
        const paused = !!overlayRef.current;

        if (!paused) {
          const inp = inputRef.current;
          const sprint = keys.ShiftLeft || keys.ShiftRight || inp.sprint;
          const sp = sprint ? 17 : 10;
          let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + inp.jx;
          let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + inp.jy;
          const len = Math.hypot(mx, mz);
          if (len > 1) { mx /= len; mz /= len; }
          if (len > 0.01) {
            if (!helpDismissed) { helpDismissed = true; setShowHelp(false); }
            const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
            const vx = (-sy) * (-mz) + cy * mx;
            const vz = (-cy) * (-mz) + (-sy) * mx;
            const res = resolveCollisions(player.x + vx * sp * dt, player.z + vz * sp * dt, 0.9, model.colliders);
            player.x = res.x; player.z = res.z;
          }
          // interact prompt
          const it = nearestInteractable(player.x, player.z, model.interactables);
          const lock = it ? lockedTest(it) : null;
          const pk = it ? it.id + (lock ? '!' : '') : '';
          if (pk !== promptKey) {
            promptKey = pk;
            setPrompt(it ? { text: lock ? lock : (isTouch ? 'TAP ⏎ — ' : '[E] ') + it.prompt, locked: !!lock } : null);
          }
          // district banner
          let zw = 0;
          for (const d of model.districts) {
            if (Math.abs(player.x - d.x) < COURT_HALF && Math.abs(player.z - d.z) < COURT_HALF) { zw = d.w; break; }
          }
          if (zw !== zoneW) {
            zoneW = zw;
            setBanner(zw ? model.districts.find(d => d.w === zw).name : null);
          }
        }

        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;

        api.anims.forEach(f => f(t, dt));
        // billboard kiosk screens
        camVec.set(player.x, 0, player.z);
        Object.values(api.kioskScreens).forEach(k => {
          k.screen.lookAt(camVec.x, k.screen.position.y, camVec.z);
        });

        // minimap @ ~8Hz
        miniT += dt;
        if (miniT > 0.12 && minimapRef.current) {
          miniT = 0;
          drawMinimap(minimapRef.current, model, player, progress);
        }

        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      loop();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      if (alive) setFailed(true);
      teardown();
    }
    return teardown;
  }, []); // eslint-disable-line

  // progress sync on save changes
  useEffect(() => {
    if (engineRef.current) engineRef.current.applyProgress(campusProgress(save));
  }, [save]);

  // ---------- overlay router (mirrors App routes) ----------
  const renderOverlay = () => {
    if (!overlay) return null;
    const s = save;
    let body = null, label = 'CONSOLE';
    if (overlay.name === 'world') { label = WORLDS.find(w => w.id === overlay.w).name; body = <WorldScreen w={overlay.w} save={s} go={oGo} onLessonRecall={cb.onLessonRecall} />; }
    else if (overlay.name === 'gauntlet') { label = 'GAUNTLET'; body = <GauntletScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'truth') { label = 'TRUTH TABLE'; body = <TruthScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'code') { label = 'WORKBENCH'; body = <CodeScreen key={overlay.id + '|' + (s.ngplus ? 'ng' : s.mode)} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={s} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={s} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={s} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={s} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={s} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={s} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') {
      label = 'PROFILES';
      body = <ProfilesScreen save={s} activeSlot={cb.activeSlot} go={oGo}
        onLoadSlot={async (slot) => { await cb.onLoadSlot(slot); setOverlay(null); }}
        onNewSlot={(slot) => { cb.onNewSlot(slot); setOverlay(null); }}
        onDeleteSlot={async (slot) => { await cb.onDeleteSlot(slot); setOverlay(null); }}
        onImport={(raw) => { cb.onImport(raw); setOverlay(null); }}
        readSlot={cb.readSlot} />;
    }
    else if (overlay.name === 'fasttravel') {
      label = 'FAST TRAVEL';
      const spots = [{ w: 0, name: 'Central Plaza' }].concat(WORLDS.filter(w => worldUnlockedEx(w.id, s)).map(w => ({ w: w.id, name: w.name })));
      body = (
        <div style={{ marginTop: 22, maxWidth: 460 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>trace network · cleared pads only</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {spots.map(sp => (
              <button key={sp.w} className="card" style={{ padding: '12px 15px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => { engineRef.current && engineRef.current.teleport(sp.w); setOverlay(null); }}>
                <Zap size={13} color="#7DEFFF" />
                <span style={{ fontSize: 14 }}>{sp.name}</span>
                <ChevronRight size={14} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(4,7,12,0.88)', backdropFilter: 'blur(2px)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1D2632', paddingBottom: 10 }}>
            <Terminal size={14} color="#7DEFFF" />
            <span className="eyebrow" style={{ color: '#7DEFFF' }}>console link · {label}</span>
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              <X size={12} /> close
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the 3D fab. Direct console uplinks below — same destinations, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {WORLDS.map(w => {
              const unlocked = worldUnlockedEx(w.id, save);
              return (
                <button key={w.id} className="card" disabled={!unlocked}
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: unlocked ? 'pointer' : 'not-allowed', opacity: unlocked ? 1 : 0.58 }}
                  onClick={() => openOverlay({ name: 'world', w: w.id })}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</span>
                  <div style={{ fontSize: 10.5, color: unlocked ? '#5A6A80' : '#FF8B82', marginTop: 2 }}>
                    {unlocked ? 'console ready' : 'SEALED — clear the previous district'}
                  </div>
                </button>
              );
            })}
            {[['Training Grounds', { name: 'training' }], ['Binary Blitz', { name: 'blitz' }], ['Bug Bounty', { name: 'bugs' }], ['Service Record', { name: 'ach' }], ['Field Manual', { name: 'manual' }], ['Scrap Exchange', { name: 'shop' }]].map(([nm, tg]) => (
              <button key={nm} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => openOverlay(tg)}>
                <span style={{ fontSize: 13 }}>{nm}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#060A12' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* exit */}
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {/* crosshair */}
      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#7DEFFF', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #22D3EE' }} />
      )}

      {/* district banner */}
      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(10,14,20,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#7DEFFF' }}>
            {banner.toUpperCase()}
          </div>
        </div>
      )}

      {/* interact prompt */}
      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,14,20,0.86)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#155E6B'), color: prompt.locked ? '#FF8B82' : '#7DEFFF', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {/* minimap */}
      {!overlay && (
        <canvas ref={minimapRef} width={150} height={150}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 22, border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(8,12,18,0.85)' }} />
      )}

      {/* help card */}
      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 8 }}>fab floor access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ opens consoles.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E opens consoles. Follow the glowing traces — Bit Mines is southwest.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {/* touch controls */}
      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

function drawMinimap(cv, model, player, progress) {
  const g = cv.getContext('2d');
  const S = cv.width / CAMPUS_SIZE;
  const X = (x) => (x + CAMPUS_SIZE / 2) * S;
  const Z = (z) => (z + CAMPUS_SIZE / 2) * S;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(8,12,18,0.2)';
  g.fillRect(0, 0, cv.width, cv.height);
  model.districts.forEach(d => {
    const p = (progress && progress.perWorld[d.w]) || {};
    g.strokeStyle = !p.unlocked ? '#39434f' : p.complete ? '#2EA56A' : '#' + d.color.toString(16).padStart(6, '0');
    g.lineWidth = 1.5;
    g.globalAlpha = p.unlocked ? 0.95 : 0.45;
    g.strokeRect(X(d.x - COURT_HALF), Z(d.z - COURT_HALF), COURT_HALF * 2 * S, COURT_HALF * 2 * S);
    g.globalAlpha = 1;
  });
  // plaza
  g.beginPath();
  g.arc(X(0), Z(0), 38 * S, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(125,239,255,0.5)';
  g.stroke();
  // gates
  model.gates.forEach(gt => {
    const open = !gt.collider.off ? false : true;
    g.fillStyle = open ? '#2EA56A' : '#FF8B82';
    g.fillRect(X(gt.x) - 2, Z(gt.z) - 2, 4, 4);
  });
  // player arrow
  g.save();
  g.translate(X(player.x), Z(player.z));
  g.rotate(-player.yaw);
  g.fillStyle = '#FFE27A';
  g.beginPath();
  g.moveTo(0, -5); g.lineTo(3.4, 4); g.lineTo(-3.4, 4);
  g.closePath();
  g.fill();
  g.restore();
}

export { CampusScreen };
