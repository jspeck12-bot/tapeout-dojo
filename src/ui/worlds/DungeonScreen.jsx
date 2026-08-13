import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, ChevronLeft, Coins, Map as MapIcon, X,
} from "lucide-react";
import * as THREE from "three";
import {
  AudioFX, trackForWorld, musicEnsure, musicSetState,
  musicSetTrack, musicCycleTrack,
} from '../../audio/index.js';
import { FR } from '../../telemetry/flight-recorder.js';
import { WORLDS, LESSONS, LESSON_DEPTH } from '../../game/content.js';
import { enemyFor } from '../../game/rpg.js';
import { bossSpec } from '../../game/bosses.js';
import { disposeScene, tuneRenderer, makePostFX, applyGfx } from '../../graphics/cinematic.js';
import {
  STYLE_GUIDE_QUALITY,
  configureStyleGuideRenderer,
  installStyleGuideEnvironment,
  makeStyleGuidePostFX,
} from '../../graphics/style-guide-renderer.js';
import { spawnShatter } from '../../graphics/rock.js';
import { updateCreature, makeViewModel, updateViewModel } from '../../graphics/creatures.js';
import { stepCamera, createAmbience } from '../../graphics/immersion.js';
import {
  buildDungeonWorld, applyDungeonProgress,
} from '../../graphics/world-builders.js';
import { resolveCollisions, nearestInteractable } from '../../world/collision.js';
import { challengesOf, activeDone } from '../../world/challenges.js';
import { DUNGEON_CFG } from '../../world/dungeon-config.js';
import { mineZoneAt } from '../../world/mine.js';
import { dungeonModel, dungeonGateOpen } from '../../world/dungeon.js';
import { elevationAt, featureComplete } from '../../world/exploration.js';
import {
  GauntletScreen, TruthScreen, CodeScreen,
} from '../challenges.jsx';
import { NoteTerminal } from '../codex/NoteTerminal.jsx';
import { Paragraphs } from '../foundations.jsx';
import { TouchControls, CinematicFX, EnterFade, DevPerfHUD } from '../world-shared.jsx';
import { ExploreHud } from '../hud/ExploreHud.jsx';
import { WorldMap } from './WorldMap.jsx';
import { BossIntro } from '../BossIntro.jsx';

const GOTHIC_DUNGEONS = {
  2: {
    status: 'valley',
    label: 'GATE VALLEY',
    gfxTitle: 'quality · gate valley',
    qualityAccent: '#a3e635',
    lamp: 0xe8ffd4,
    lampI: 1.95,
    lampAngle: 0.5,
    far: 500,
    pitch: -0.08,
    ambience: 'canyon',
    bloom: 0.3,
    focus: 22,
    exposure: 0.9,
  },
  3: {
    status: 'foundry',
    label: 'MODULE FOUNDRY',
    gfxTitle: 'quality · module foundry',
    qualityAccent: '#ff8c3a',
    lamp: 0xffe0c4,
    lampI: 1.75,
    lampAngle: 0.5,
    far: 320,
    pitch: -0.06,
    ambience: 'cave',
    bloom: 0.36,
    focus: 16,
    exposure: 0.84,
  },
  4: {
    status: 'canyon',
    label: 'COMBINATIONAL CANYON',
    gfxTitle: 'quality · combinational canyon',
    qualityAccent: '#fb923c',
    lamp: 0xffe2c4,
    lampI: 1.85,
    lampAngle: 0.52,
    far: 420,
    pitch: -0.16,
    ambience: 'canyon',
    bloom: 0.32,
    focus: 28,
    exposure: 0.88,
  },
  5: {
    status: 'clock',
    label: 'CLOCK TOWER',
    gfxTitle: 'quality · clock tower',
    qualityAccent: '#a78bfa',
    lamp: 0xe8d8ff,
    lampI: 1.7,
    lampAngle: 0.5,
    far: 280,
    pitch: -0.14,
    ambience: 'cave',
    bloom: 0.34,
    focus: 14,
    exposure: 0.86,
  },
  6: {
    status: 'fortress',
    label: 'FSM FORTRESS',
    gfxTitle: 'quality · fsm fortress',
    qualityAccent: '#fb7185',
    lamp: 0xffd0d6,
    lampI: 1.65,
    lampAngle: 0.48,
    far: 320,
    pitch: -0.22,
    ambience: 'cave',
    bloom: 0.32,
    focus: 22,
    exposure: 0.84,
  },
  7: {
    status: 'tapeout',
    label: 'TAPEOUT',
    gfxTitle: 'quality · tapeout',
    qualityAccent: '#facc15',
    lamp: 0xffe9a8,
    lampI: 1.45,
    lampAngle: 0.46,
    far: 300,
    pitch: -0.26,
    ambience: 'cave',
    bloom: 0.22,
    focus: 18,
    exposure: 0.78,
  },
};

function applyGothicGfx(ctx, gfx, quality) {
  if (!ctx) return;
  const { renderer, scene, post } = ctx;
  try {
    renderer.toneMappingExposure = (scene.userData.baseExposure || 0.9) * (gfx.exposure ?? 1.08);
    post?.setBloom?.(Math.min(0.5, 0.18 + (gfx.bloom ?? 0.58) * 0.22));
    post?.setQuality?.(quality);
    if (scene.fog?.isFogExp2) {
      const base = scene.userData.baseFogDensity || 0.0066;
      scene.fog.density = base * ((gfx.fog ?? 0.032) / 0.032);
    }
    scene.traverse(object => {
      if (object.isLight) {
        if (object.userData.baseIntensity == null) {
          object.userData.baseIntensity = object.intensity;
        }
        const role = object.userData.lightRole;
        const ambient = role === 'ambient' || role === 'fill' || object.isAmbientLight || object.isHemisphereLight;
        object.intensity = object.userData.baseIntensity * (ambient ? (gfx.ambient ?? 0.92) : (gfx.lights ?? 1.1));
      }
      if (object.isSprite && object.material?.blending === THREE.AdditiveBlending) {
        object.material.opacity = gfx.glow ?? 0.7;
      }
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (material?.normalScale) material.normalScale.setScalar(gfx.normal ?? 0.95);
      });
    });
  } catch (error) {
    // Live tuning must never tear down the world.
  }
}

function DungeonScreen({ w, save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack(trackForWorld(w)); musicSetState('explore'); } catch (e) { } }, [w]);
  const world = WORLDS.find(x => x.id === w);
  const fights = challengesOf(w);
  const lessonList = LESSONS[w] || [];
  const lessonIds = lessonList.map(L => L.id);
  const cfg = DUNGEON_CFG[w];
  const accHex = '#' + cfg.theme.accent.toString(16).padStart(6, '0');

  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState(cfg.zone);
  const [showHelp, setShowHelp] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [bossIntro, setBossIntro] = useState(null);
  const gothicSpec = GOTHIC_DUNGEONS[w];
  const gothic = !!gothicSpec;
  const [quality, setQuality] = useState(() => (
    typeof window !== 'undefined' && 'ontouchstart' in window ? 'low' : 'high'
  ));
  const [stage, setStage] = useState('booting');
  const [gfxOpen, setGfxOpen] = useState(false);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefD = useRef(save); saveRefD.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  useEffect(() => { cb.onWorldDiscovered(w); }, [w]); // eslint-disable-line

  const modelMemo = useMemo(() => dungeonModel(w, fights, lessonIds), [w]); // eslint-disable-line
  const activeMode = save.ngplus ? 'architect' : save.mode;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    combatFxRef.current = null;
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'dungeon' || sc.name === 'world' || sc.name === 'surface') { setOverlay(null); return; }
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
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      if (gothic) {
        configureStyleGuideRenderer(renderer, qualityRef.current);
        renderer.setSize(width, height);
        if (renderer.domElement.dataset) renderer.domElement.dataset.engine = 'silicon-gothic';
      } else {
        tuneRenderer(renderer, isTouch);
        renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
        renderer.setSize(width, height);
      }
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(74, (width || 1) / (height || 1), 0.1, gothicSpec ? gothicSpec.far : 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = modelMemo;
      const api = buildDungeonWorld(scene, model, model.theme);
      ctxRef.current = { renderer, scene, post: null, camera };
      if (gothic) {
        try { renderer.render(scene, camera); } catch (error) { /* first frame probes the context */ }
        setStage('environment');
        try {
          installStyleGuideEnvironment(renderer, scene, qualityRef.current);
        } catch (error) {
          // PMREM IBL needs a real GPU; the valley still plays with local lights.
        }
        if (
          renderer.compileAsync
          && renderer.extensions?.has('KHR_parallel_shader_compile')
        ) {
          renderer.compileAsync(scene, camera).catch(() => {});
        }
        setStage('compiling');
        try {
          if (!isTouch) {
            post = makeStyleGuidePostFX(renderer, scene, camera, width, height, {
              preset: qualityRef.current,
              bloom: gothicSpec.bloom,
              grade: api.worldArt?.grade,
              focus: gothicSpec.focus,
              dof: false,
            });
          }
        } catch (error) {
          post = null;
        }
        ctxRef.current.post = post;
        scene.userData.baseExposure = gothicSpec.exposure;
        applyGothicGfx(ctxRef.current, gfx, qualityRef.current);
      } else {
        try { if (!isTouch) post = makePostFX(renderer, width, height); } catch (e) { post = null; }
        ctxRef.current.post = post;
        if (post && api.worldArt) post.setGrade(api.worldArt.grade);
      }
      const lamp = new THREE.SpotLight(
        gothicSpec ? gothicSpec.lamp : 0xfff0d8,
        gothicSpec ? gothicSpec.lampI : 2.2,
        42 * (model.worldScale || 1),
        gothicSpec ? gothicSpec.lampAngle : 0.56,
        0.5,
        1.3,
      );
      lamp.userData.lightRole = 'headlamp';
      lamp.userData.baseIntensity = lamp.intensity;
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 46; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      const fillLight = gothic ? null : new THREE.PointLight(model.theme.accent, 0.45, 26, 1.6);
      if (fillLight) scene.add(fillLight);
      ambRef.current = createAmbience(scene, gothicSpec ? gothicSpec.ambience : 'cave');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const grace = model.exploration?.features.find(feature =>
        feature.kind === 'grace' && saveRefD.current.exploration?.graces?.[feature.id]);
      const graceDistance = grace
        ? Math.hypot(model.spawn.x - grace.x, model.spawn.z - grace.z) || 1
        : 1;
      const player = {
        x: grace ? grace.x + (model.spawn.x - grace.x) / graceDistance * 3.2 : model.spawn.x,
        z: grace ? grace.z + (model.spawn.z - grace.z) / graceDistance * 3.2 : model.spawn.z,
        yaw: model.spawn.yaw,
        pitch: gothicSpec ? gothicSpec.pitch : -0.03,
      };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = cfg.zone, frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !dungeonGateOpen(saveRefD.current, model)) return 'SEALED — clear the ' + cfg.zone.toLowerCase();
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (it.kind === 'fog') {
          if (!dungeonGateOpen(saveRefD.current, model)) { AudioFX.bad(); return; }
          try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
          setBossIntro({ spec: bossSpec(it.bossId), target: it.target });
          return;
        }
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'fight' && it.boss) {
          try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
          setBossIntro({ spec: bossSpec(it.id), target: it.target });
          return;
        }
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

      const onClick = () => { if (overlayRef.current || isTouch) return; try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { } };
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

      const onTS = (e) => { const t = e.touches[0]; if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; } };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0]; if (!t) return;
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
        const ww = mount.clientWidth || window.innerWidth, hh = mount.clientHeight || window.innerHeight;
        camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh); if (post) post.resize(ww, hh);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyDungeonProgress(api, model, saveRefD.current);
      let last = performance.now();
      let announcedReady = false;
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
        last = now; frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const worldPace = Math.min(1.25, Math.sqrt(model.worldScale || 1));
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 15 : 9.4) * worldPace * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = dungeonGateOpen(saveRefD.current, model) ? model.colliders : model.collidersClosed;
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
              else if (it.kind === 'fog') {
                text = dungeonGateOpen(saveRefD.current, model)
                  ? (isTouch ? '⏎ ' : '[E] ') + 'ENTER THE FOG — ' + it.title
                  : 'SEALED — clear the ' + cfg.zone.toLowerCase();
              } else if (it.kind === 'fight') {
                const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (it.title ? ' · ' + it.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefD.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = lessonList.find(l => l.id === it.lid);
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
        if (frame % 30 === 0) applyDungeonProgress(api, model, saveRefD.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        const elevation = elevationAt(model, player.x, player.z);
        camera.position.set(player.x, 1.7 + elevation, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _fight = _ov && (_ov.name === 'gauntlet' || _ov.name === 'truth' || _ov.name === 'code');
        const _tot = _fight && api && api.totems ? api.totems[_ov.id] : null;
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
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_cr.userData && _cr.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0x9fe6ff); AudioFX.win(); }
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
        if (fillLight) fillLight.position.set(player.x, 2.6 + elevation, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, elevation + 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefD.current.gear && saveRefD.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) {
          post.setMoving?.(_moving);
          post.render(scene, camera);
        } else renderer.render(scene, camera);
        if (gothic && !announcedReady) {
          announcedReady = true;
          setStage('ready');
        }
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      if (alive) setFailed(true);
      teardown();
    }
    return teardown;
  }, []); // eslint-disable-line

  useEffect(() => {
    if (gothic) applyGothicGfx(ctxRef.current, gfx, quality);
    else applyGfx(ctxRef.current, gfx);
  }, [gfx, quality, gothic]);

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, w, 30, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'truth') {
      const en = enemyFor(overlay.id, w, 35, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <TruthScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'code') {
      const en = enemyFor(overlay.id, w, 50, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <CodeScreen key={overlay.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = lessonList.find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 720 }}>
          <NoteTerminal lesson={L} depth={LESSON_DEPTH[L.id]} worldLabel={world.name}
            accent={accHex} collected={read} recallRecord={save.noteRecall?.[L.id]}
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'note' ? 'rgba(3,5,9,0.93)' : 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)', overflowY: 'auto' }}>
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
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — {(world && world.name) || ''}</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[w] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the world to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (failed) {
    const model = modelMemo;
    const gateOpen = dungeonGateOpen(save, model);
    const stationsOrdered = model.interactables.filter(i => i.ord).slice().sort((a, b) => a.ord - b.ord);
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
            This device can't render {world.name} in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stationsOrdered.map(it => {
              if (it.kind === 'fight') {
                const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
                const sealed = it.boss && !gateOpen;
                const done = !!activeDone(save)[it.id];
                return (
                  <button key={it.id} className="card" disabled={sealed}
                    style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                    onClick={() => it.boss
                      ? setBossIntro({ spec: bossSpec(it.id), target: it.target })
                      : openOverlay({ ...it.target })}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>{it.boss ? '★ FINAL · ' : '#' + it.ord + ' · '}{en.name}{done ? ' ✓' : ''}</span>
                    <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the hall first' : (it.title || it.id)}</div>
                  </button>
                );
              }
              const lesson = lessonList.find(item => item.id === it.lid);
              return (
                <button key={it.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                  onClick={() => openOverlay({ name: 'note', id: it.lid })}>
                  <span style={{ fontSize: 13, color: accHex }}>#{it.ord} · FIELD NOTE — {lesson ? lesson.title : it.lid}{save.lessons && save.lessons[it.lid] ? ' ✓' : ''}</span>
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
        {mapOpen && <WorldMap model={model} save={save} world={w} accent={accHex} onClose={() => setMapOpen(false)} />}
        {bossIntro && <BossIntro spec={bossIntro.spec} onCancel={() => setBossIntro(null)}
          onEnter={() => { const target = bossIntro.target; setBossIntro(null); openOverlay({ ...target }); }} />}
      </div>
    );
  }

  return (
    <div
      className={gothic ? 'sg-world' : undefined}
      data-valley-status={w === 2 ? stage : undefined}
      data-foundry-status={w === 3 ? stage : undefined}
      data-canyon-status={w === 4 ? stage : undefined}
      data-clock-status={w === 5 ? stage : undefined}
      data-fortress-status={w === 6 ? stage : undefined}
      data-tapeout-status={w === 7 ? stage : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#' + cfg.theme.bg.toString(16).padStart(6, '0') }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {gothic && <div className="sg-corners" />}

      <CinematicFX accent={accHex} />
      <DevPerfHUD ctxRef={ctxRef} />
      {gothic && stage !== 'ready' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 27, display: 'grid', placeItems: 'center',
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 42%, rgba(16,28,18,.18), rgba(5,7,11,.7))',
        }}>
          <div className="eyebrow" style={{
            padding: '12px 16px', color: '#d7e4d8', background: 'rgba(5,7,11,.84)',
            border: '1px solid #2a3340', letterSpacing: '.16em',
          }}>
            {gothicSpec.label} · {stage.toUpperCase()}
          </div>
        </div>
      )}
      {gothic && gfxOpen && (
        <div className="card" style={{
          position: 'absolute', top: 48, right: 12, zIndex: 34, width: 248,
          padding: '12px 14px', background: 'rgba(5,7,11,.94)', borderColor: '#2a3340',
        }}>
          <div className="eyebrow" style={{ color: gothicSpec.qualityAccent, marginBottom: 10 }}>{gothicSpec.gfxTitle}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {Object.keys(STYLE_GUIDE_QUALITY).map(name => (
              <button
                key={name}
                className="btn sm"
                onClick={() => { AudioFX.click(); setQuality(name); }}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  color: quality === name ? '#061017' : '#cbb79a',
                  background: quality === name ? gothicSpec.qualityAccent : 'rgba(20,16,12,.7)',
                  borderColor: quality === name ? gothicSpec.qualityAccent : '#2a3340',
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button className="lnk" style={{ paddingLeft: 0 }} onClick={() => setGfxOpen(false)}>close</button>
        </div>
      )}
      <EnterFade />

      <ExploreHud
        injectTokens
        accentColor={accHex}
        save={save}
        zone={banner && !overlay ? banner : null}
        prompt={!overlay ? prompt : null}
        showHelp={showHelp && !overlay}
        helpTitle={`${cfg.zone.toLowerCase()} · access granted`}
        helpBody={isTouch
          ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
          : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. Clear the hall to unseal the gate — the boss waits beyond it.'}
        onDismissHelp={() => { AudioFX.click(); setShowHelp(false); }}
        showReticle={!overlay}
        showMap
        isTouch={isTouch}
        hidden={!!overlay}
        onMenu={() => {
          try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
          AudioFX.click();
          go({ name: 'menu' });
        }}
        onMap={() => { AudioFX.click(); setMapOpen(true); }}
        onSettings={onSettings ? () => { AudioFX.click(); onSettings(); } : null}
        onGraphics={gothic ? () => { AudioFX.click(); setGfxOpen(open => !open); } : null}
      />

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
      {mapOpen && <WorldMap model={modelMemo} save={save} world={w} accent={accHex} onClose={() => setMapOpen(false)} />}
      {bossIntro && <BossIntro spec={bossIntro.spec} onCancel={() => setBossIntro(null)}
        onEnter={() => { const target = bossIntro.target; setBossIntro(null); openOverlay({ ...target }); }} />}
    </div>
  );
}

export { DungeonScreen };
