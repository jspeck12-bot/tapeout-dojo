import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, Settings, X,
} from "lucide-react";
import * as THREE from "three";
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../../audio/index.js';
import { FR } from '../../telemetry/flight-recorder.js';
import { disposeScene } from '../../graphics/cinematic.js';
import {
  configureStyleGuideRenderer,
  installStyleGuideEnvironment,
  makeStyleGuidePostFX,
} from '../../graphics/style-guide-renderer.js';
import { stepCamera, createAmbience } from '../../graphics/immersion.js';
import { buildArcadeWorld } from '../../graphics/world-builders.js';
import { resolveCollisions, nearestInteractable } from '../../world/collision.js';
import { mineZoneAt } from '../../world/mine.js';
import { arcadeModel } from '../../world/arcade.js';
import {
  BlitzScreen, BugScreen, AchScreen, ManualScreen,
} from '../challenges.jsx';
import {
  ForgeScreen, TrainingScreen, ProfilesScreen,
} from '../meta.jsx';
import { ShopScreen } from '../combat.jsx';
import { TouchControls, CinematicFX, EnterFade, DevPerfHUD } from '../world-shared.jsx';

function applyArcadeGfx(ctx, gfx, quality) {
  if (!ctx) return;
  const { renderer, scene, post } = ctx;
  try {
    renderer.toneMappingExposure = (scene.userData.baseExposure || 0.88) * (gfx.exposure ?? 1.08);
    post?.setBloom?.(Math.min(0.48, 0.2 + (gfx.bloom ?? 0.58) * 0.2));
    post?.setQuality?.(quality);
    if (scene.fog?.isFogExp2) {
      const base = scene.userData.baseFogDensity || 0.018;
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

function ArcadeScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('tapeline'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState('THE ARCADE');
  const [showHelp, setShowHelp] = useState(true);
  const [quality] = useState(() => (
    typeof window !== 'undefined' && 'ontouchstart' in window ? 'low' : 'high'
  ));
  const [stage, setStage] = useState('booting');
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRefA = useRef(save); saveRefA.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKeyA = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'arcade') { setOverlay(null); return; }
    if (sc.name === 'menu') { setOverlay(null); go({ name: 'menu' }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []); // eslint-disable-line

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
      const camera = new THREE.PerspectiveCamera(74, (width || 1) / (height || 1), 0.1, 220);
      scene.add(camera);
      camera.rotation.order = 'YXZ';

      const model = arcadeModel();
      const api = buildArcadeWorld(scene, model);
      ctxRef.current = { renderer, scene, post: null, camera };
      try { renderer.render(scene, camera); } catch (error) { /* first frame probes the context */ }
      setStage('environment');
      try {
        installStyleGuideEnvironment(renderer, scene, qualityRef.current);
      } catch (error) {
        // PMREM IBL needs a real GPU; the hall still plays with local lights.
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
            bloom: 0.3,
            grade: api.worldArt?.grade,
            focus: 14,
            dof: false,
          });
        }
      } catch (error) {
        post = null;
      }
      ctxRef.current.post = post;
      applyArcadeGfx(ctxRef.current, gfx, qualityRef.current);

      const lamp = new THREE.SpotLight(0xffd6f5, 1.55, 28, 0.5, 0.55, 1.3);
      lamp.userData.lightRole = 'headlamp';
      lamp.userData.baseIntensity = lamp.intensity;
      if (!isTouch) {
        try {
          lamp.castShadow = true;
          lamp.shadow.mapSize.set(1024, 1024);
          lamp.shadow.camera.near = 0.6;
          lamp.shadow.camera.far = 36;
          lamp.shadow.bias = -0.0025;
        } catch (e) { /* SwiftShader may reject shadow maps */ }
      }
      scene.add(lamp);
      scene.add(lamp.target);
      ambRef.current = createAmbience(scene, 'arcade');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.08 };
      let announcedReady = false;
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'THE ARCADE', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

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

      let last = performance.now();
      const tick = () => {
        if (!alive) return;
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        (scene.userData.anims || []).forEach(animate => animate(now / 1000, dt));
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
          const res = resolveCollisions(nx, nz, 0.55, model.colliders);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else if (it.kind === 'exit') setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'MAIN MENU' });
            else setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'PLAY — ' + it.label });
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        lamp.position.set(player.x, 1.78, player.z);
        {
          const fx2 = -Math.sin(player.yaw);
          const fz2 = -Math.cos(player.yaw);
          lamp.target.position.set(player.x + fx2 * 7, 1.0 + player.pitch * 4, player.z + fz2 * 7);
        }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        FR.tick(post ? 1 : 0);
        if (post) {
          post.setMoving?.(_moving);
          post.render(scene, camera);
        } else renderer.render(scene, camera);
        if (!announcedReady) {
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

  useEffect(() => { applyArcadeGfx(ctxRef.current, gfx, quality); }, [gfx, quality]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={save} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={save} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={save} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={save} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={save} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={save} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') {
      label = 'SAVE TERMINAL';
      body = <ProfilesScreen save={save} activeSlot={cb.activeSlot} go={oGo}
        onLoadSlot={async (slot) => { await cb.onLoadSlot(slot); setOverlay(null); }}
        onNewSlot={(slot) => { cb.onNewSlot(slot); setOverlay(null); }}
        onDeleteSlot={async (slot) => { await cb.onDeleteSlot(slot); setOverlay(null); }}
        onImport={(raw) => { cb.onImport(raw); setOverlay(null); }}
        readSlot={cb.readSlot} />;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(4,5,12,0.94)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: '#FF7DF0' }}>arcade cabinet · {label}</span>
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              step away <X size={12} />
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  if (failed) {
    const model = arcadeModel();
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>THE ARCADE</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the arcade floor. Direct cabinet links below — same modes, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.kind === 'arcade').map(it => (
              <button key={it.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', borderColor: '#273245' }}
                onClick={() => openOverlay({ ...it.target })}>
                <span style={{ fontSize: 13, fontWeight: 600, color: it.accent }}>{it.label}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sg-world" data-arcade-status={stage} style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#06040c' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FF7DF0" />
      <DevPerfHUD ctxRef={ctxRef} />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      {stage !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, displayEvents: 'none', display: 'grid', placeItems: 'center', background: 'rgba(6,4,12,0.55)' }}>
          <div style={{ letterSpacing: '.22em', fontSize: 12, color: '#FF7DF0' }}>
            NEON HALL · {stage.toUpperCase()}
          </div>
        </div>
      )}

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> main menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FF7DF0', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FF7DF0' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A1430', borderRadius: 8, background: 'rgba(10,4,12,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FF7DF0' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,4,12,0.88)', border: '1px solid #6A2A63', color: '#FF7DF0', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && stage === 'ready' && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>arcade floor</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ plays a cabinet.'
                : 'Click to capture the mouse. WASD walks, E plays a cabinet. The lift by the entrance takes you back to the main menu.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

export { ArcadeScreen };
