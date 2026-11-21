// Clear Sohrai afternoon: deeper blue sky, sun higher, less haze, so titles read against the sky.
window.__day = function () {
  const T = __T, THREE = T.THREE, scene = T.scene;
  const sky = scene.children.find(o => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide);
  const dir = new THREE.Vector3(-0.5, 0.55, -0.67).normalize();
  sky.material.uniforms.sun.value = dir;
  sky.material.fragmentShader = `varying vec3 vP; uniform vec3 sun;
    void main(){
      float h = clamp(vP.y, -0.2, 1.0);
      vec3 top = vec3(0.10,0.27,0.60), mid = vec3(0.42,0.60,0.86), hor = vec3(0.93,0.86,0.74);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
      c = mix(c, top, smoothstep(0.18, 0.85, h));
      float s = max(dot(normalize(vP), sun), 0.0);
      c += vec3(1.0,0.86,0.62) * pow(s, 10.0) * 0.45 + vec3(1.0,0.95,0.85) * pow(s, 400.0) * 3.0;
      if (h < 0.0) c = mix(vec3(0.55,0.58,0.55), hor, smoothstep(-0.2,0.0,h));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  sky.material.needsUpdate = true;
  T.sun.color.set(0xffe2b8); T.sun.intensity = 3.4; T.sun.position.copy(dir).multiplyScalar(40);
  scene.traverse(o => { if (o.isHemisphereLight) { o.color.set(0xbcd2ff); o.groundColor.set(0x6b4a2e); o.intensity = 0.9; } });
  scene.fog.color.set(0xc8d2dc); scene.fog.near = 40; scene.fog.far = 170;
  T.renderer.toneMappingExposure = 0.95;
  T.post.bloom.strength = 0.28; T.post.bloom.threshold = 0.86;
  return 'day ok';
};
