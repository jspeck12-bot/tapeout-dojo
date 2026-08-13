import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChevronLeft, Settings, SlidersHorizontal } from 'lucide-react';
import { disposeScene } from '../../graphics/cinematic.js';
import { buildStyleGuideScene } from '../../graphics/style-guide.js';
import {
  STYLE_GUIDE_QUALITY,
  configureStyleGuideRenderer,
  installStyleGuideEnvironment,
  makeStyleGuidePostFX,
} from '../../graphics/style-guide-renderer.js';

const DEFAULT_TUNING = {
  exposure: 0.92,
  lights: 0.86,
  fog: 1,
  normal: 0.86,
  bloom: 0.34,
};

function applyTuning(ctx, tuning, quality) {
  if (!ctx) return;
  const { renderer, scene, post } = ctx;
  renderer.toneMappingExposure = tuning.exposure;
  post?.setBloom(tuning.bloom);
  post?.setQuality(quality);
  if (scene.fog?.isFogExp2) {
    scene.fog.density = (scene.userData.baseFogDensity || 0.014) * tuning.fog;
  }
  scene.traverse(object => {
    if (object.isLight) {
      if (object.userData.baseIntensity == null) {
        object.userData.baseIntensity = object.intensity;
      }
      object.intensity = object.userData.baseIntensity * tuning.lights;
    }
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      if (material?.normalScale) material.normalScale.setScalar(tuning.normal);
    });
  });
}

function PerfHUD({ stats, stage }) {
  const text = stats
    ? `${stats.fps} FPS · ${stats.calls} calls · ${stats.triangles.toLocaleString()} tris · ${stats.quality} @${stats.renderScale}`
    : `RENDERER · ${stage.toUpperCase()}`;
  return (
    <div
      data-style-guide-status={stage}
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 31,
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(2,5,10,.86)',
        border: '1px solid #293746',
        color: stage === 'ready' ? '#7defff' : '#ffc76b',
        fontSize: 10.5,
        letterSpacing: '.06em',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

function StyleGuideControls({
  quality,
  setQuality,
  tuning,
  setTuning,
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        className="btn sm"
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 32 }}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={12} /> graphics
      </button>
    );
  }
  const rows = [
    ['exposure', 0.72, 1.4, 0.01],
    ['lights', 0.45, 1.6, 0.05],
    ['fog', 0.45, 1.8, 0.05],
    ['normal', 0.35, 1.5, 0.05],
    ['bloom', 0, 0.9, 0.05],
  ];
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 32,
        width: 268,
        padding: '14px 15px',
        borderRadius: 9,
        background: 'rgba(3,7,12,.94)',
        border: '1px solid #304050',
        boxShadow: '0 18px 50px rgba(0,0,0,.42)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 11 }}>
        <span className="eyebrow" style={{ color: '#ffc76b' }}>
          quality · tune live
        </span>
        <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
          close
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 14 }}>
        {Object.keys(STYLE_GUIDE_QUALITY).map(name => (
          <button
            key={name}
            className="btn sm"
            onClick={() => setQuality(name)}
            style={{
              minWidth: 0,
              padding: '6px 4px',
              color: quality === name ? '#061017' : '#9fb4c8',
              background: quality === name ? '#7defff' : 'rgba(20,30,40,.7)',
              borderColor: quality === name ? '#7defff' : '#2b3947',
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {rows.map(([name, min, max, step]) => (
        <label key={name} style={{ display: 'block', marginBottom: 9 }}>
          <span style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 3,
            color: '#9fb4c8',
            fontSize: 11,
          }}>
            <span>{name}</span>
            <span style={{ color: '#e3ebf3' }}>{tuning[name].toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={tuning[name]}
            onChange={event => {
              const value = Number(event.target.value);
              setTuning(current => ({ ...current, [name]: value }));
            }}
            style={{ width: '100%', accentColor: '#ffc76b' }}
          />
        </label>
      ))}
    </div>
  );
}

function StyleGuideScreen({ go, onSettings }) {
  const mountRef = useRef(null);
  const ctxRef = useRef(null);
  const qualityRef = useRef('high');
  const tuningRef = useRef(DEFAULT_TUNING);
  const [quality, setQuality] = useState('high');
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [stage, setStage] = useState('booting');
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(null);
  qualityRef.current = quality;
  tuningRef.current = tuning;

  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    let scene;
    let post;
    let raf = 0;
    let alive = true;
    let announcedReady = false;
    let onResize;
    const perf = { frames: 0, last: performance.now() };

    const teardown = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener('resize', onResize);
      try {
        post?.dispose();
      } catch (error) {
        // Best-effort cleanup when a browser loses its context.
      }
      disposeScene(scene);
      try {
        renderer?.dispose();
      } catch (error) {
        // Renderer construction may have failed before a context existed.
      }
      try {
        renderer?.forceContextLoss?.();
      } catch (error) {
        // Context loss is optional in constrained artifact runtimes.
      }
      renderer?.domElement?.remove();
      ctxRef.current = null;
    };

    const start = async () => {
      try {
        if (!mount) throw new Error('style guide mount unavailable');
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
        });
        configureStyleGuideRenderer(renderer, qualityRef.current);
        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;
        renderer.setSize(width, height);
        renderer.domElement.dataset.engine = 'silicon-gothic';
        renderer.domElement.style.display = 'block';
        mount.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 260);
        camera.position.set(0, 6.4, 24);
        camera.lookAt(0, 5.3, -30);
        const api = buildStyleGuideScene(scene);
        ctxRef.current = {
          renderer,
          scene,
          camera,
          post: null,
          world: 'style-guide',
        };
        applyTuning(ctxRef.current, tuningRef.current, qualityRef.current);

        renderer.render(scene, camera);
        if (!alive) return;
        setStage('environment');
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!alive) return;

        installStyleGuideEnvironment(renderer, scene, qualityRef.current);
        setStage('compiling');
        if (
          renderer.compileAsync &&
          renderer.extensions?.has('KHR_parallel_shader_compile')
        ) {
          try {
            await renderer.compileAsync(scene, camera);
          } catch (error) {
            // The first real render remains the compatibility test.
          }
        }
        if (!alive) return;

        try {
          post = makeStyleGuidePostFX(renderer, scene, camera, width, height, {
            preset: qualityRef.current,
            bloom: tuningRef.current.bloom,
            grade: api.worldArt.grade,
            focus: 44,
          });
        } catch (error) {
          post = null;
        }
        ctxRef.current.post = post;
        applyTuning(ctxRef.current, tuningRef.current, qualityRef.current);

        onResize = () => {
          const nextWidth = mount.clientWidth || window.innerWidth;
          const nextHeight = mount.clientHeight || window.innerHeight;
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight, false);
          post?.resize(nextWidth, nextHeight);
        };
        window.addEventListener('resize', onResize);

        const clock = new THREE.Timer();
        clock.connect(document);
        (scene.userData.disposers = scene.userData.disposers || [])
          .push(() => clock.dispose());
        const loop = () => {
          if (!alive) return;
          clock.update();
          const delta = Math.min(0.05, clock.getDelta());
          const time = clock.getElapsed();
          (scene.userData.anims || []).forEach(animate => animate(time, delta));
          camera.position.x = Math.sin(time * 0.055) * 0.46;
          camera.lookAt(0, 5.3, -30);
          let renderStats;
          if (post) {
            post.setMoving(false);
            renderStats = post.render(delta);
          } else {
            renderer.render(scene, camera);
            renderStats = {
              calls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              quality: 'fallback',
              renderScale: 1,
            };
          }
          if (!announcedReady) {
            announcedReady = true;
            setStage('ready');
          }
          perf.frames++;
          const now = performance.now();
          if (now - perf.last >= 1000) {
            setStats({
              ...renderStats,
              fps: Math.max(0, Math.round(perf.frames * 1000 / (now - perf.last))),
            });
            perf.frames = 0;
            perf.last = now;
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (error) {
        if (!alive) return;
        setFailed(error?.message || 'WebGL initialization failed');
        setStage('failed');
        teardown();
      }
    };

    start();
    return teardown;
  }, []); // The renderer owns live tuning through ctxRef.

  useEffect(() => {
    applyTuning(ctxRef.current, tuning, quality);
  }, [quality, tuning]);

  if (failed) {
    return (
      <div className="card" style={{ margin: '10vh auto', maxWidth: 620, padding: 24 }}>
        <div className="eyebrow" style={{ color: '#ff8b82' }}>
          STYLE GUIDE · NO WEBGL SIGNAL
        </div>
        <p style={{ color: '#9fb4c8' }}>
          The Silicon Gothic scene needs a WebGL2-capable browser.
        </p>
        <div style={{ color: '#5f7183', fontSize: 11 }}>{failed}</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'hidden', background: '#02050a' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <PerfHUD stats={stats} stage={stage} />
      {stage !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 27,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 42%, rgba(11,26,36,.2), rgba(2,5,10,.72))',
          }}
        >
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            color: '#aebdca',
            background: 'rgba(2,5,10,.82)',
            border: '1px solid #283747',
            fontSize: 11,
            letterSpacing: '.16em',
          }}>
            CALIBRATING OPTICS · {stage.toUpperCase()}
          </div>
        </div>
      )}
      <button
        className="btn sm"
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 32 }}
        onClick={() => go({ name: 'menu' })}
      >
        <ChevronLeft size={12} /> menu
      </button>
      <button
        className="btn sm"
        style={{ position: 'absolute', top: 12, left: 92, zIndex: 32 }}
        onClick={onSettings}
      >
        <Settings size={12} /> controls
      </button>
      <StyleGuideControls
        quality={quality}
        setQuality={setQuality}
        tuning={tuning}
        setTuning={setTuning}
      />
      <div
        style={{
          position: 'absolute',
          left: 18,
          bottom: 18,
          zIndex: 29,
          maxWidth: 580,
          padding: '12px 15px',
          background: 'rgba(2,5,10,.82)',
          border: '1px solid #33404d',
          borderRadius: 8,
          pointerEvents: 'none',
        }}
      >
        <div className="eyebrow" style={{ color: '#ffc76b' }}>
          SILICON GOTHIC · MATERIAL &amp; LIGHTING LAB
        </div>
        <div style={{ marginTop: 5, color: '#aebdca', fontSize: 12, lineHeight: 1.5 }}>
          Monumental silicon · worn PBR surfaces · warm signal path · cool atmospheric depth
        </div>
        <div style={{ marginTop: 4, color: '#63778a', fontSize: 10.5 }}>
          STYLE GUIDE ONLY · CAMPAIGN WORLDS UNCHANGED PENDING APPROVAL
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_TUNING, applyTuning, StyleGuideScreen };
