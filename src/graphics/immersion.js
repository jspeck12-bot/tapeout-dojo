import { AudioFX } from '../audio/index.js';

function stepCamera(camera, eyeY, dt, moving, sprint, st) {
  const targetFov = (sprint && moving) ? 81 : 74;
  if (st.fov == null) st.fov = 74;
  st.fov += (targetFov - st.fov) * Math.min(1, dt * 6);
  camera.fov = st.fov;
  camera.updateProjectionMatrix();

  if (st.phase == null) { st.phase = 0; st.stepIdx = 0; }
  let stepped = false;
  if (moving) {
    const freq = sprint ? 12.5 : 8.5;
    st.phase += dt * freq;
    const amp = sprint ? 0.10 : 0.065;
    // abs(sin) -> classic double-bounce-per-stride foot strike
    camera.position.y = eyeY + Math.abs(Math.sin(st.phase)) * amp - amp * 0.5;
    camera.position.x += Math.sin(st.phase) * (sprint ? 0.045 : 0.03);
    camera.rotation.z = Math.sin(st.phase) * (sprint ? 0.016 : 0.011);
    const idx = Math.floor(st.phase / Math.PI);
    if (idx !== st.stepIdx) { st.stepIdx = idx; stepped = true; }
  } else {
    // settle bob + roll back toward neutral
    camera.position.y = eyeY + (camera.position.y - eyeY) * (1 - Math.min(1, dt * 9));
    camera.rotation.z += (0 - camera.rotation.z) * Math.min(1, dt * 9);
  }
  return stepped;
}

function createAmbience(scene, kind) {
  // collect flicker-able point lights once (lanterns / torches / held fill light)
  const pls = [];
  try {
    scene.traverse((o) => { if (o.isPointLight) pls.push({ l: o, base: o.intensity, ph: Math.random() * 6.28 }); });
  } catch (e) { }

  let audio = null;
  try {
    AudioFX.ensure();
    const ctx = AudioFX.ctx;
    if (ctx) {
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      // --- drone: 3 detuned oscillators -> lowpass ---
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kind === 'arcade' ? 320 : 220;
      lp.Q.value = 0.7;
      lp.connect(master);
      const baseFreq = kind === 'foundry' ? 70 : kind === 'canyon' ? 58 : kind === 'arcade' ? 96 : 62;
      const oscs = [];
      [[baseFreq, 'sine', 0.5], [baseFreq * 1.5, 'triangle', 0.26], [baseFreq * 0.5, 'sine', 0.42]].forEach((spec) => {
        const o = ctx.createOscillator();
        o.type = spec[1];
        o.frequency.value = spec[0];
        o.detune.value = (Math.random() - 0.5) * 8;
        const og = ctx.createGain();
        og.gain.value = spec[2];
        o.connect(og); og.connect(lp);
        o.start();
        oscs.push(o);
      });

      // --- air: looped filtered noise ---
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const dch = buf.getChannelData(0);
      for (let i = 0; i < dch.length; i++) dch[i] = (Math.random() * 2 - 1) * 0.5;
      const noise = ctx.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = kind === 'arcade' ? 1400 : 600;
      bp.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.value = kind === 'arcade' ? 0.06 : 0.1;
      noise.connect(bp); bp.connect(ng); ng.connect(master);
      noise.start();

      audio = {
        ctx, master, oscs, noise,
        target: kind === 'arcade' ? 0.42 : 0.5,
        crackle: (kind === 'mine' || kind === 'cave' || kind === 'fortress'),
        tAcc: 0, next: 0.5,
      };
    }
  } catch (e) { audio = null; }

  return {
    update(dt, t, moving, sprint) {
      // torch flicker (composes with GfxPanel lights slider via gfxIntensity)
      for (let i = 0; i < pls.length; i++) {
        const p = pls[i];
        const steady = (p.l.userData && p.l.userData.gfxIntensity != null) ? p.l.userData.gfxIntensity : p.base;
        const f = 0.82 + 0.11 * Math.sin(t * 6.5 + p.ph) + 0.06 * Math.sin(t * 21 + p.ph * 2.3) + 0.03 * Math.sin(t * 47 + p.ph);
        p.l.intensity = steady * f;
      }
      if (audio) {
        try {
          const want = AudioFX.enabled ? audio.target : 0;
          audio.master.gain.setTargetAtTime(want, audio.ctx.currentTime, 0.4);
          if (audio.crackle && AudioFX.enabled) {
            audio.tAcc += dt;
            if (audio.tAcc >= audio.next) { audio.tAcc = 0; audio.next = 0.5 + Math.random() * 2.5; this._crackle(); }
          }
        } catch (e) { }
      }
    },
    _crackle() {
      if (!audio) return;
      try {
        const ctx = audio.ctx, t0 = ctx.currentTime;
        const n = Math.floor(ctx.sampleRate * 0.08);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
        const s = ctx.createBufferSource(); s.buffer = b;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const g = ctx.createGain(); g.gain.value = 0.04;
        s.connect(hp); hp.connect(g); g.connect(ctx.destination);
        s.start(t0); s.stop(t0 + 0.1);
      } catch (e) { }
    },
    footstep() {
      if (!audio || !AudioFX.enabled) return;
      try {
        const ctx = audio.ctx, t0 = ctx.currentTime;
        const n = Math.floor(ctx.sampleRate * 0.09);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.4);
        const s = ctx.createBufferSource(); s.buffer = b;
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 320 + Math.random() * 120;
        const g = ctx.createGain(); g.gain.value = 0.05;
        s.connect(flt); flt.connect(g); g.connect(ctx.destination);
        s.start(t0); s.stop(t0 + 0.12);
      } catch (e) { }
    },
    dispose() {
      try {
        if (audio) {
          audio.oscs.forEach((o) => { try { o.stop(); } catch (e) { } });
          try { audio.noise.stop(); } catch (e) { }
          try { audio.master.disconnect(); } catch (e) { }
        }
      } catch (e) { }
      pls.forEach((p) => { try { p.l.intensity = p.base; } catch (e) { } });
    },
  };
}

export {
  stepCamera, createAmbience,
};
