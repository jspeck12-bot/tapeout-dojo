import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChevronLeft, Settings } from 'lucide-react';
import {
  applyGfx,
  disposeScene,
  installEnvironment,
  makePostFX,
  tuneRenderer,
} from '../../graphics/cinematic.js';
import { buildStyleGuideScene } from '../../graphics/style-guide.js';
import { DevPerfHUD, GfxPanel } from '../world-shared.jsx';

function StyleGuideScreen({ gfx, setGfx, go, onSettings }) {
  const mountRef = useRef(null);
  const ctxRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    let scene;
    let post;
    let raf = 0;
    let alive = true;
    const teardown = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      try { post?.dispose(); } catch (error) { }
      disposeScene(scene);
      try { renderer?.dispose(); } catch (error) { }
      try { renderer?.forceContextLoss?.(); } catch (error) { }
      try { renderer?.domElement?.remove(); } catch (error) { }
      ctxRef.current = null;
    };

    try {
      if (!mount) throw new Error('style guide mount unavailable');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, gfx?.preset || 'high');
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 300);
      camera.position.set(0, 5.4, 22);
      camera.lookAt(0, 3.6, -24);
      const api = buildStyleGuideScene(scene);
      installEnvironment(renderer, scene, 0, gfx?.preset || 'high');
      post = makePostFX(renderer, scene, camera, width, height, {
        preset: gfx?.preset || 'high',
        bloom: gfx?.bloom,
        grade: api.worldArt.grade,
      });
      ctxRef.current = { renderer, scene, camera, post, world: 'style-guide' };
      applyGfx(ctxRef.current, gfx);

      const onResize = () => {
        const nextWidth = mount.clientWidth || window.innerWidth;
        const nextHeight = mount.clientHeight || window.innerHeight;
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        post.resize(nextWidth, nextHeight);
      };
      window.addEventListener('resize', onResize);
      scene.userData.disposers = scene.userData.disposers || [];
      scene.userData.disposers.push(() => window.removeEventListener('resize', onResize));

      const clock = new THREE.Timer();
      clock.connect(document);
      scene.userData.disposers.push(() => clock.dispose());
      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        clock.update();
        const delta = Math.min(0.05, clock.getDelta());
        const time = clock.getElapsed();
        (scene.userData.anims || []).forEach(animate => animate(time, delta));
        camera.position.x = Math.sin(time * 0.08) * 1.8;
        camera.lookAt(0, 3.6, -24);
        post.setMoving(false);
        post.render(scene, camera, delta);
      };
      loop();
    } catch (error) {
      setFailed(true);
      teardown();
    }
    return teardown;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]);

  if (failed) {
    return (
      <div className="card" style={{ margin: '10vh auto', maxWidth: 560, padding: 24 }}>
        <div className="eyebrow" style={{ color: '#ff8b82' }}>STYLE GUIDE · NO WEBGL SIGNAL</div>
        <p style={{ color: '#9fb4c8' }}>The Silicon Gothic scene needs a WebGL2-capable browser.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#03060c' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <DevPerfHUD ctxRef={ctxRef} />
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 28 }}
        onClick={() => go({ name: 'menu' })}>
        <ChevronLeft size={12} /> menu
      </button>
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 92, zIndex: 28 }}
        onClick={onSettings}>
        <Settings size={12} /> controls
      </button>
      <GfxPanel gfx={gfx} setGfx={setGfx} accent="#FFC76B" />
      <div style={{
        position: 'absolute',
        left: 18,
        bottom: 18,
        zIndex: 26,
        maxWidth: 520,
        padding: '12px 15px',
        background: 'rgba(3,6,12,.78)',
        border: '1px solid #33404d',
        borderRadius: 8,
        pointerEvents: 'none',
      }}>
        <div className="eyebrow" style={{ color: '#ffc76b' }}>SILICON GOTHIC · MATERIAL &amp; LIGHTING LAB</div>
        <div style={{ marginTop: 5, color: '#aebdca', fontSize: 12 }}>
          Wet rock · worn steel · concrete · brass · silicon · PMREM IBL · GTAO · restrained bloom · LUT grade · SMAA
        </div>
      </div>
    </div>
  );
}

export { StyleGuideScreen };
