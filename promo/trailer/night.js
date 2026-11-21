// "Night of Sohrai": blue-hour sky with a last orange band, torch light around the ring, rising embers.
window.__night = function () {
  const T = __T, THREE = T.THREE, scene = T.scene;
  // sky: deep navy overhead, violet middle, a thin burning horizon and a moon
  const sky = scene.children.find(o => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide);
  sky.material.fragmentShader = `varying vec3 vP; uniform vec3 sun;
    void main(){
      float h = clamp(vP.y, -0.2, 1.0);
      vec3 top = vec3(0.015,0.025,0.075), mid = vec3(0.10,0.08,0.20), hor = vec3(1.0,0.42,0.16);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.12, h));
      c = mix(c, top, smoothstep(0.12, 0.75, h));
      float s = max(dot(normalize(vP), sun), 0.0);
      c += vec3(1.0,0.45,0.18) * pow(s, 8.0) * 0.6;
      vec3 moonDir = normalize(vec3(0.55, 0.42, 0.72));
      float m = max(dot(normalize(vP), moonDir), 0.0);
      c += vec3(0.85,0.9,1.0) * smoothstep(0.9993, 0.9996, m) * 2.4 + vec3(0.35,0.42,0.7) * pow(m, 60.0) * 0.35;
      float st = fract(sin(dot(floor(vP.xz * 420.0), vec2(12.9898, 78.233))) * 43758.5453);
      c += vec3(0.9) * step(0.9985, st) * smoothstep(0.25, 0.6, h) * 0.8;
      if (h < 0.0) c = mix(vec3(0.05,0.05,0.08), hor * 0.6, smoothstep(-0.2,0.0,h));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  sky.material.needsUpdate = true;
  // light: low ember sun as a rim, cool moon fill, dim blue sky
  T.sun.color.set(0xff6a2a); T.sun.intensity = 2.2;
  scene.traverse(o => { if (o.isHemisphereLight) { o.color.set(0x5a6aa8); o.groundColor.set(0x2a1a12); o.intensity = 0.85; } });
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.7); moon.position.set(0.55, 0.42, 0.72).multiplyScalar(40); scene.add(moon);
  scene.fog.color.set(0x1a1b30); scene.fog.near = 16; scene.fog.far = 92;
  scene.environmentIntensity = 0.18;
  T.renderer.toneMappingExposure = 1.15;
  // torches around the ring: a pole, a big flickering flame, and a warm light for three of them
  const glow = T.flames[0].material;
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 1 });
  T.torches = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2, r = 12.6, g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), poleM); pole.position.y = 1.1; pole.castShadow = true; g.add(pole);
    const f = new THREE.Sprite(glow.clone()); f.material.color.set(0xffa040); f.position.y = 2.35; f.scale.setScalar(0.9); g.add(f);
    const halo = new THREE.Sprite(glow.clone()); halo.material.color.set(0xff6a20); halo.material.opacity = 0.45; halo.position.y = 2.3; halo.scale.setScalar(2.6); g.add(halo);
    if (i % 3 === 0) { const L = new THREE.PointLight(0xff8a3a, 9, 15, 1.6); L.position.y = 2.3; g.add(L); g.userData.light = L; }
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(g); T.torches.push({ g, f, halo, p: Math.random() * 10 });
  }
  // embers instead of dust
  const M = T.motes; M.mesh.material.color.set(0xff8a3a); M.mesh.material.size = 0.075; M.mesh.material.opacity = 0.9;
  window.__motes = function (t) { const a = M.mesh.geometry.attributes.position; for (let i = 0; i < M.seed.length; i++) { const s = M.seed[i];
    a.array[i * 3] = M.base[i * 3] + Math.sin(t * 0.7 + s) * 0.5; a.array[i * 3 + 1] = 0.2 + ((M.base[i * 3 + 1] + t * (0.35 + (s % 1) * 0.4)) % 5.5); a.array[i * 3 + 2] = M.base[i * 3 + 2] + Math.cos(t * 0.6 + s) * 0.5; } a.needsUpdate = true;
    for (const tc of T.torches) { tc.p += 0.33; const k = 1 + Math.sin(tc.p) * 0.08 + Math.sin(tc.p * 2.7) * 0.06; tc.f.scale.setScalar(0.9 * k); tc.halo.scale.setScalar(2.6 * k); if (tc.g.userData.light) tc.g.userData.light.intensity = 9 * k; }
    for (const f of T.flames) f.scale.multiplyScalar(1.6); };
  T.post.bloom.strength = 0.55; T.post.bloom.threshold = 0.72; T.post.bloom.radius = 0.6;
  return 'night ok';
};
