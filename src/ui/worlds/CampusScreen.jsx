import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Terminal, X, Zap,
} from "lucide-react";
import * as THREE from "three";
import { AudioFX, musicEnsure, musicSetState, musicSetTrack } from '../../audio/index.js';
import { FR } from '../../telemetry/flight-recorder.js';
import { disposeScene } from '../../graphics/cinematic.js';
import {
  STYLE_GUIDE_QUALITY,
  configureStyleGuideRenderer,
  installStyleGuideEnvironment,
  makeStyleGuidePostFX,
} from '../../graphics/style-guide-renderer.js';
import { stepCamera, createAmbience } from '../../graphics/immersion.js';
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
import { TouchControls, CinematicFX, EnterFade, DevPerfHUD } from '../world-shared.jsx';
import { ExploreHud } from '../hud/ExploreHud.jsx';

function applyCampusGfx(ctx, gfx, quality) {
  if (!ctx) return;
  const { renderer, scene, post } = ctx;
  try {
    renderer.toneMappingExposure = 0.92 * (gfx.exposure ?? 1.08);
    post?.setBloom?.(Math.min(0.48, 0.18 + (gfx.bloom ?? 0.58) * 0.2));
    post?.setQuality?.(quality);
    if (scene.fog?.isFogExp2) {
      const base = scene.userData.baseFogDensity || 0.0072;
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

function campusZoneName(model, x, z) {
  for (const district of model.districts) {
    if (Math.abs(x - district.x) < COURT_HALF && Math.abs(z - district.z) < COURT_HALF) {
      return district.name;
    }
  }
  if (Math.hypot(x, z) < 48) return 'CENTRAL PLAZA';
  return 'ARRIVAL WALK';
}

function CampusScreen({ save, go, cb, gfx = {}, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('halogen'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const minimapRef = useRef(null);
  const ctxRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState('ARRIVAL WALK');
  const [showHelp, setShowHelp] = useState(!save.campusVisited);
  const [quality, setQuality] = useState(() => (
    typeof window !== 'undefined' && 'ontouchstart' in window ? 'low' : 'high'
  ));
  const [stage, setStage] = useState('booting');
  const [gfxOpen, setGfxOpen] = useState(false);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRef2 = useRef(save); saveRef2.current = save;
  const ambRef = useRef(null);
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
      ctxRef.current = null;
      ambRef.current = null;
    };
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      configureStyleGuideRenderer(renderer, qualityRef.current);
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      if (renderer.domElement.dataset) renderer.domElement.dataset.engine = 'silicon-gothic';
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(72, (width || 1) / (height || 1), 0.1, 500);
      camera.rotation.order = 'YXZ';
      scene.add(camera);

      const model = campusModel();
      const api = buildCampusWorld(scene, model);
      try { buildFabUltra(scene, model, api); } catch (e) { }
      ctxRef.current = { renderer, scene, post: null, camera };
      try { renderer.render(scene, camera); } catch (error) { /* first frame probes the context */ }
      setStage('environment');
      try {
        installStyleGuideEnvironment(renderer, scene, qualityRef.current);
      } catch (error) {
        // PMREM IBL needs a real GPU; the campus still plays with local lights.
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
            bloom: 0.28,
            grade: api.worldArt?.grade,
            focus: 28,
            dof: false,
          });
        }
      } catch (error) {
        post = null;
      }
      ctxRef.current.post = post;
      applyCampusGfx(ctxRef.current, gfx, qualityRef.current);

      const lamp = new THREE.SpotLight(0xd8f4ff, 1.85, 46, 0.52, 0.5, 1.3);
      lamp.userData.lightRole = 'headlamp';
      lamp.userData.baseIntensity = lamp.intensity;
      if (!isTouch) {
        try {
          lamp.castShadow = true;
          lamp.shadow.mapSize.set(1024, 1024);
          lamp.shadow.camera.near = 0.6;
          lamp.shadow.camera.far = 52;
          lamp.shadow.bias = -0.0025;
        } catch (e) { }
      }
      scene.add(lamp);
      scene.add(lamp.target);
      ambRef.current = createAmbience(scene, 'foundry');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.04 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0;
      let zoneNow = 'ARRIVAL WALK', promptKey = '', miniT = 0, helpDismissed = false;
      let announcedReady = false, _moving = false, _sprint = false;
      const _bob = {};

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

      let last = performance.now();
      const camVec = new THREE.Vector3();
      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now / 1000;
        const paused = !!overlayRef.current;
        _moving = false; _sprint = false;

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
            _moving = true; _sprint = !!sprint;
          }
          const it = nearestInteractable(player.x, player.z, model.interactables);
          const lock = it ? lockedTest(it) : null;
          const pk = it ? it.id + (lock ? '!' : '') : '';
          if (pk !== promptKey) {
            promptKey = pk;
            setPrompt(it ? { text: lock ? lock : (isTouch ? 'TAP ⏎ — ' : '[E] ') + it.prompt, locked: !!lock } : null);
          }
          const zn = campusZoneName(model, player.x, player.z);
          if (zn !== zoneNow) {
            zoneNow = zn;
            setBanner(zn);
          }
        }

        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        const stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        lamp.position.set(player.x, 1.78, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 8, 1.0 + player.pitch * 4, player.z + fz2 * 8);

        api.anims.forEach(f => f(t, dt));
        (scene.userData.anims || []).forEach(f => f(t, dt));
        camVec.set(player.x, 0, player.z);
        Object.values(api.kioskScreens).forEach(k => {
          k.screen.lookAt(camVec.x, k.screen.position.y, camVec.z);
        });
        if (ambRef.current) {
          ambRef.current.update(dt, t, _moving, _sprint);
          if (stepped) ambRef.current.footstep();
        }

        miniT += dt;
        if (miniT > 0.12 && minimapRef.current) {
          miniT = 0;
          drawMinimap(minimapRef.current, model, player, progress);
        }

        if (post) {
          post.setMoving?.(_moving);
          post.render(scene, camera);
        } else renderer.render(scene, camera);
        FR.tick(post ? 1 : 0);
        if (!announcedReady) {
          announcedReady = true;
          setStage('ready');
        }
      };
      loop();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      if (alive) setFailed(true);
      teardown();
    }
    return teardown;
  }, []); // eslint-disable-line

  useEffect(() => { applyCampusGfx(ctxRef.current, gfx, quality); }, [gfx, quality]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.applyProgress(campusProgress(save));
  }, [save]);

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

  return (
    <div className="sg-world" data-campus-status={stage} style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#05070b' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="sg-corners" />
      <CinematicFX accent="#7defff" />
      <DevPerfHUD ctxRef={ctxRef} />
      {stage !== 'ready' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 27, display: 'grid', placeItems: 'center',
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 42%, rgba(16,28,40,.18), rgba(5,7,11,.7))',
        }}>
          <div className="eyebrow" style={{
            padding: '12px 16px', color: '#d7e4f0', background: 'rgba(5,7,11,.84)',
            border: '1px solid #2a3340', letterSpacing: '.16em',
          }}>
            FAB FLOOR · {stage.toUpperCase()}
          </div>
        </div>
      )}
      {gfxOpen && (
        <div className="card" style={{
          position: 'absolute', top: 48, right: 12, zIndex: 34, width: 248,
          padding: '12px 14px', background: 'rgba(5,7,11,.94)', borderColor: '#2a3340',
        }}>
          <div className="eyebrow" style={{ color: '#7defff', marginBottom: 10 }}>quality · fab campus</div>
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
                  background: quality === name ? '#7defff' : 'rgba(20,16,12,.7)',
                  borderColor: quality === name ? '#7defff' : '#2a3340',
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
        accent="cyan"
        save={save}
        zone={banner && !overlay ? String(banner).toUpperCase() : null}
        prompt={!overlay ? prompt : null}
        showHelp={showHelp && !overlay}
        helpTitle="fab floor access granted"
        helpBody={isTouch
          ? 'Left stick walks. Drag the right side to look. ⏎ opens consoles.'
          : 'Click to capture the mouse. WASD walks, Shift sprints, E opens consoles. Follow the glowing traces — Bit Mines is southwest.'}
        onDismissHelp={() => { AudioFX.click(); setShowHelp(false); }}
        showReticle={!overlay}
        showMap={false}
        minimapRef={!overlay ? minimapRef : null}
        isTouch={isTouch}
        hidden={!!overlay}
        onMenu={() => {
          try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
          AudioFX.click();
          go({ name: 'menu' });
        }}
        onSettings={onSettings ? () => { AudioFX.click(); onSettings(); } : null}
        onGraphics={() => { AudioFX.click(); setGfxOpen(open => !open); }}
      />

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
  g.beginPath();
  g.arc(X(0), Z(0), 38 * S, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(125,239,255,0.5)';
  g.stroke();
  model.gates.forEach(gt => {
    const open = !gt.collider.off ? false : true;
    g.fillStyle = open ? '#2EA56A' : '#FF8B82';
    g.fillRect(X(gt.x) - 2, Z(gt.z) - 2, 4, 4);
  });
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
