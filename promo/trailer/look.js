// Trailer look: golden-hour light, bloom, depth of field, floating dust. Runs inside the game page.
window.__look = async function () {
  const T = __T, THREE = T.THREE;
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { BokehPass } = await import('three/addons/postprocessing/BokehPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const r = T.renderer, scene = T.scene, cam = T.camera;
  r.setPixelRatio(1); r.setSize(1280, 720, false); cam.aspect = 16 / 9; cam.updateProjectionMatrix();
  r.toneMappingExposure = 1.0; r.shadowMap.type = THREE.PCFSoftShadowMap;
  // light
  T.sun.color.set(0xffc690); T.sun.intensity = 3.6; T.sun.position.set(-0.62, 0.24, -0.75).normalize().multiplyScalar(40);
  T.sun.shadow.camera.left = -22; T.sun.shadow.camera.right = 22; T.sun.shadow.camera.top = 22; T.sun.shadow.camera.bottom = -22; T.sun.shadow.camera.far = 90; T.sun.shadow.camera.updateProjectionMatrix();
  scene.traverse(o => { if (o.isHemisphereLight) { o.color.set(0xb9c6ee); o.groundColor.set(0x6b4a2e); o.intensity = 0.8; } });
  scene.fog.color.set(0xd6ae86); scene.fog.near = 28; scene.fog.far = 130;
  scene.environmentIntensity = 0.45;
  // floating dust catching the light
  const n = 420, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * 16; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.random() * 4.5 + 0.2; pos[i * 3 + 2] = Math.sin(a) * rr; seed[i] = Math.random() * 100; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dx = dc.getContext('2d'); const gr = dx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,230,190,1)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); dx.fillStyle = gr; dx.fillRect(0, 0, 32, 32);
  const motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 }));
  scene.add(motes); T.motes = { mesh: motes, base: pos.slice(), seed };
  // post: render -> depth of field -> bloom -> tone map
  const composer = new EffectComposer(r); composer.setSize(1280, 720);
  composer.addPass(new RenderPass(scene, cam));
  const bokeh = new BokehPass(scene, cam, { focus: 8, aperture: 0.0, maxblur: 0.008 }); composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.32, 0.55, 0.82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  T.post = { composer, bokeh, bloom };
  const raw = r.render.bind(r); let inside = false;
  r.render = (s, c) => { if (T.noRender) return; if (inside || !T.postOn) return raw(s, c); inside = true; try { composer.render(); } finally { inside = false; } };
  T.postOn = true;
  // output canvas (1920x1080): the 3D frame plus overlays
  const out = document.createElement('canvas'); out.width = 1920; out.height = 1080; T.out = out; T.octx = out.getContext('2d');
  return 'look ok';
};
window.__dof = function (focus, aperture, maxblur = 0.01) { const u = __T.post.bokeh.uniforms; u.focus.value = focus; u.aperture.value = aperture; u.maxblur.value = maxblur; };
window.__motes = function (t) { const M = __T.motes; if (!M) return; const a = M.mesh.geometry.attributes.position; for (let i = 0; i < M.seed.length; i++) { const s = M.seed[i]; a.array[i * 3] = M.base[i * 3] + Math.sin(t * 0.3 + s) * 0.6; a.array[i * 3 + 1] = M.base[i * 3 + 1] + Math.sin(t * 0.21 + s * 1.7) * 0.35; a.array[i * 3 + 2] = M.base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 0.6; } a.needsUpdate = true; };
