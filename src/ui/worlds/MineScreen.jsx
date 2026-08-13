import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen, ChevronLeft, Coins, Map as MapIcon, Settings, X,
} from "lucide-react";
import * as THREE from "three";
import {
  AudioFX, musicCycleTrack, musicEnsure, musicSetState, musicSetTrack,
} from '../../audio/index.js';
import { FR } from '../../telemetry/flight-recorder.js';
import { GAUNTLETS, LESSON_DEPTH, LESSONS } from '../../game/content.js';
import { enemyFor } from '../../game/rpg.js';
import { disposeScene, tuneRenderer, makePostFX, applyGfx } from '../../graphics/cinematic.js';
import { spawnShatter } from '../../graphics/rock.js';
import { updateCreature, makeViewModel, updateViewModel } from '../../graphics/creatures.js';
import { stepCamera, createAmbience } from '../../graphics/immersion.js';
import { buildMineWorld, applyMineProgress } from '../../graphics/world-builders.js';
import { resolveCollisions, nearestInteractable } from '../../world/collision.js';
import { activeDone } from '../../world/challenges.js';
import { mineModel, mineGateOpen, mineZoneAt } from '../../world/mine.js';
import { elevationAt, featureComplete } from '../../world/exploration.js';
import { GauntletScreen } from '../challenges.jsx';
import { NoteTerminal } from '../codex/NoteTerminal.jsx';
import { Paragraphs } from '../foundations.jsx';
import { TouchControls, CinematicFX, EnterFade, DevPerfHUD } from '../world-shared.jsx';
import { WorldMap } from './WorldMap.jsx';

function MineScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('heavy_press'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState('ENTRANCE GALLERY');
  const [showHelp, setShowHelp] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefM = useRef(save); saveRefM.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const lessonIds = (LESSONS[1] || []).map(l => l.id);
  useEffect(() => { cb.onWorldDiscovered(1); }, []); // eslint-disable-line

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    combatFxRef.current = null;
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'mine' || sc.name === 'world') { setOverlay(null); return; }
    setOverlay(sc);
  }, []);

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
      if (renderer) {
        try { renderer.dispose(); } catch (e) { }
        try { post && post.dispose(); } catch (e) { }
        try { renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) { }
        try { renderer.domElement && renderer.domElement.remove(); } catch (e) { }
      }
      ctxRef.current = null;
      ambRef.current = null;
      engineRef.current = null;
      combatFxRef.current = null;
    };
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      scene = new THREE.Scene();
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = mineModel(lessonIds);
      const api = buildMineWorld(scene, model);
      if (post && api.worldArt) post.setGrade(api.worldArt.grade);

      // headlamp
      const lamp = new THREE.SpotLight(0xffe7c0, 2.3, 44, 0.52, 0.5, 1.3);
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 48; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      ambRef.current = createAmbience(scene, 'mine');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const grace = model.exploration?.features.find(feature =>
        feature.kind === 'grace' && saveRefM.current.exploration?.graces?.[feature.id]);
      const graceDistance = grace
        ? Math.hypot(model.spawn.x - grace.x, model.spawn.z - grace.z) || 1
        : 1;
      const player = {
        x: grace ? grace.x + (model.spawn.x - grace.x) / graceDistance * 3.2 : model.spawn.x,
        z: grace ? grace.z + (model.spawn.z - grace.z) / graceDistance * 3.2 : model.spawn.z,
        yaw: model.spawn.yaw,
        pitch: -0.03,
      };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'ENTRANCE GALLERY', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !mineGateOpen(saveRefM.current)) return 'SEALED — clear the five outer galleries';
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        if (it.kind === 'grace' || it.kind === 'cache' || it.kind === 'lore') {
          cb.onExploreFeature(it);
          if (it.kind === 'lore') openOverlay({ name: 'lore', feature: it });
          else AudioFX.good();
          return;
        }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyM') { try { musicCycleTrack(1); } catch (e) { } }
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

      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyMineProgress(api, model, saveRefM.current);
      let last = performance.now();
      let _aim = null, _flash = null, _hp = null, _hpTex = null, _lastBar = -1, _prevE = null, _prevP = null, _punchT = -9e9, _flashT = -9e9, _shakeT = -9e9, _vigT = -9e9, _prevOver = null, _prevPhase = 1;
      const drawHpBar = (tex, frac, tele) => {
        const cv = tex.userData.cv, x = cv.getContext('2d'); x.clearRect(0, 0, 256, 64);
        x.fillStyle = 'rgba(8,10,14,0.82)'; x.fillRect(8, 22, 240, 20);
        x.fillStyle = '#FF5252'; x.fillRect(10, 24, 236 * frac, 16);
        if (tele > 0.02) { x.fillStyle = 'rgba(255,205,80,' + (0.35 + 0.5 * tele) + ')'; x.fillRect(10, 45, 236 * Math.min(1, tele), 6); }
        x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.strokeRect(8, 22, 240, 20);
        tex.needsUpdate = true;
      };
      const tick = () => {
        if (!alive) return;
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 11.5 : 7.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = mineGateOpen(saveRefM.current) ? model.colliders : model.collidersClosed;
          const res = resolveCollisions(nx, nz, 0.55, cols);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id + '|' + (lockedTest(it) || '') : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else {
              const lock = lockedTest(it);
              let text;
              if (lock) text = lock;
              else if (it.kind === 'fight') {
                const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
                const g = GAUNTLETS.find(x => x.id === it.id);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (g ? ' · ' + g.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefM.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = (LESSONS[1] || []).find(l => l.id === it.lid);
                text = (isTouch ? '⏎ ' : '[E] ') + 'READ — ' + (it.ord ? '#' + it.ord + ' · ' : '') + (L ? L.title : 'field note');
              } else if (it.kind === 'grace') {
                text = (isTouch ? '⏎ ' : '[E] ') + 'SYNC — TRACE GRACE';
              } else if (it.kind === 'lore') {
                text = (isTouch ? '⏎ ' : '[E] ') + 'ARCHIVE — ' + it.title;
              } else if (it.kind === 'cache') {
                text = (isTouch ? '⏎ ' : '[E] ') + 'RECOVER — HIDDEN SCRAP CACHE';
              } else text = (isTouch ? '⏎ ' : '[E] ') + 'MENU — back to the main menu';
              setPrompt({ text, locked: !!lock });
            }
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        if (frame % 30 === 0) applyMineProgress(api, model, saveRefM.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        const elevation = elevationAt(model, player.x, player.z);
        camera.position.set(player.x, 1.7 + elevation, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _tot = _ov && _ov.name === 'gauntlet' && api && api.totems ? api.totems[_ov.id] : null;
        if (_tot && _tot.creature) {
          const _cr = _tot.creature;
          if (!_aim) _aim = new THREE.PerspectiveCamera();
          if (!_flash) { _flash = new THREE.PointLight(0xfff1c0, 0, 20, 2.0); scene.add(_flash); }
          if (!_hp) {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
            _hpTex = new THREE.CanvasTexture(cv); _hpTex.userData = { cv };
            _hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _hpTex, transparent: true, depthTest: false }));
            _hp.scale.set(7, 1.75, 1); scene.add(_hp);
          }
          _aim.position.copy(camera.position); _aim.lookAt(_cr.position.x, _cr.position.y + 2.6, _cr.position.z);
          camera.quaternion.slerp(_aim.quaternion, Math.min(1, dt * 5));
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_tot.creature.userData && _tot.creature.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0xFFB066); AudioFX.win(); }
            _prevE = _cfx.ehp; _prevP = _cfx.php; _prevOver = _cfx.over;
          }
          const pk = Math.max(0, 1 - (now - _punchT) / 220);
          camera.fov = 74 - 7 * pk; camera.updateProjectionMatrix();
          _flash.position.set(_cr.position.x, _cr.position.y + 2.2, _cr.position.z);
          _flash.intensity = 2.8 * Math.max(0, 1 - (now - _flashT) / 170);
          const sk = Math.max(0, 1 - (now - _shakeT) / 320);
          if (sk > 0) { camera.position.x += (Math.random() - 0.5) * 0.55 * sk; camera.position.y += (Math.random() - 0.5) * 0.45 * sk; }
          if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.7 * Math.max(0, 1 - (now - _vigT) / 380));
        } else {
          _prevE = null; _prevP = null; _prevOver = null; _prevPhase = 1; _lastBar = -1;
          camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
          if (_hp) _hp.visible = false;
          if (_flash) _flash.intensity = 0;
          if (camera.fov !== 74) { camera.fov = 74; camera.updateProjectionMatrix(); }
          if (vignetteRef.current && vignetteRef.current.style.opacity !== '0') vignetteRef.current.style.opacity = '0';
        }
        lamp.position.set(player.x, 1.78 + elevation, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, elevation + 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefM.current.gear && saveRefM.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      if (alive) setFailed(true);
      teardown();
    }
    return teardown;
  }, []); // eslint-disable-line

  // ---------- overlay router ----------
  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, 1, 30, overlay.id === 'b6', 'engineer', false);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = (LESSONS[1] || []).find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 720 }}>
          <NoteTerminal lesson={L} depth={LESSON_DEPTH[L.id]} worldLabel="The Bit Mines"
            accent="#F5B14C" collected={read} recallRecord={save.noteRecall?.[L.id]}
            onRecall={correct => cb.onLessonRecall(L.id, correct)} />
        </div>
      ) : <div style={{ marginTop: 20, color: '#76849A' }}>The pages have rotted away.</div>;
    } else if (overlay.name === 'lore') {
      label = 'CHIP HISTORY ARCHIVE';
      body = (
        <div className="card" style={{ padding: '20px', marginTop: 16, maxWidth: 680 }}>
          <div className="eyebrow" style={{ color: '#A3E635' }}>optional recovered history</div>
          <h2 style={{ margin: '8px 0' }}>{overlay.feature.title}</h2>
          <div style={{ color: '#B9C6D6', lineHeight: 1.65 }}>{overlay.feature.body}</div>
        </div>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'gauntlet' ? 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)' : 'rgba(3,5,9,0.93)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: overlay.name === 'note' || overlay.name === 'lore' ? '#9FB2C9' : '#FF8B82', letterSpacing: '0.14em' }}>{overlay.name === 'note' || overlay.name === 'lore' ? '✦ ' : '⚔ '}{label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#FFC76B', fontVariantNumeric: 'tabular-nums' }}><Coins size={13} /> {save.scrap || 0}</span>
            {overlay.name !== 'note' && <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(v => !v); }}><BookOpen size={12} /> field notes</button>}
            <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(false); setOverlay(null); }}>
              {overlay.name === 'note' || overlay.name === 'lore' ? 'close' : 'flee'} <X size={12} />
            </button>
          </div>
          {body}
        </div>
        {notesOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,5,9,0.97)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — THE BIT MINES</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[1] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the mine to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    const model = mineModel(lessonIds);
    const gateOpen = mineGateOpen(save);
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
          <button className="lnk" onClick={() => setMapOpen(true)}><MapIcon size={13} /> map</button>
        </div>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the mine in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.ord).sort((a, b) => a.ord - b.ord).map(it => {
              if (it.kind === 'fight') {
                const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
                const g = GAUNTLETS.find(x => x.id === it.id);
                const sealed = it.boss && !gateOpen;
                const done = !!activeDone(save)[it.id];
                return (
                  <button key={it.id} className="card" disabled={sealed}
                    style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                    onClick={() => openOverlay({ ...it.target })}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>
                      {it.boss ? '★ FINAL · ' : '#' + it.ord + ' · '}{en.name}{done ? ' ✓' : ''}
                    </span>
                    <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the outer galleries' : (g ? g.title : it.id)}</div>
                  </button>
                );
              }
              const lesson = (LESSONS[1] || []).find(item => item.id === it.lid);
              return (
                <button key={it.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                  onClick={() => openOverlay({ name: 'note', id: it.lid })}>
                  <span style={{ fontSize: 13, color: '#7DEFFF' }}>#{it.ord} · FIELD NOTE — {lesson ? lesson.title : it.lid}{save.lessons && save.lessons[it.lid] ? ' ✓' : ''}</span>
                </button>
              );
            })}
            {model.exploration.features.map(feature => {
              const complete = featureComplete(save, feature);
              return (
                <button key={feature.id} className="card"
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', borderColor: complete ? '#2E6F52' : '#273245' }}
                  onClick={() => {
                    cb.onExploreFeature(feature);
                    if (feature.kind === 'lore') openOverlay({ name: 'lore', feature });
                  }}>
                  <span style={{ fontSize: 12.5, color: feature.kind === 'cache' ? '#FFC76B' : feature.kind === 'lore' ? '#A3E635' : '#7DEFFF' }}>
                    {feature.kind === 'cache' ? 'SECRET CACHE' : feature.kind === 'lore' ? feature.title : 'TRACE GRACE'} {complete ? '✓' : ''}
                  </span>
                </button>
              );
            })}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
        {mapOpen && <WorldMap model={model} save={save} world={1} accent="#FFC76B" onClose={() => setMapOpen(false)} />}
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#04050A' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FFC76B" />
      <DevPerfHUD ctxRef={ctxRef} />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 92, zIndex: 25 }}
        onClick={() => { AudioFX.click(); setMapOpen(true); }}>
        <MapIcon size={12} /> map
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FFC76B', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FFB066' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A2014', borderRadius: 8, background: 'rgba(10,8,4,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FFC76B' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,8,4,0.88)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#7A6310'), color: prompt.locked ? '#FF8B82' : '#FFC76B', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FFC76B', marginBottom: 8 }}>shaft access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. The wyrm sleeps at the bottom of the shaft — clear the five galleries to unseal its gate.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
      {mapOpen && <WorldMap model={mineModel(lessonIds)} save={save} world={1} accent="#FFC76B" onClose={() => setMapOpen(false)} />}
    </div>
  );
}

export { MineScreen };
