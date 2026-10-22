// The takeoff horizon: a real 3D planet limb in Xavier gold, with a
// navigational graticule and an orbit of small beacons (the deck's ring dots).
// Its limb is solved to sit on the CSS horizon (--horizon, --lx on the stage),
// so L always stands on it, never behind it. Scroll turns it; the pointer
// leans the camera. The CSS disc is the poster when WebGL or motion is off.
import * as THREE from 'three';

const section = document.querySelector('.takeoff');
const stage = section.querySelector('.takeoff__stage');
const canvas = document.querySelector('[data-planet]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function webgl() {
  try { return !!canvas.getContext('webgl2') || !!canvas.getContext('webgl'); } catch { return false; }
}

if (!reduce && webgl()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  const R = 8;
  const planet = new THREE.Group();
  scene.add(planet);

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 96),
    new THREE.MeshStandardMaterial({ color: 0xe7b744, roughness: 0.82, metalness: 0.12 })
  );
  planet.add(globe);

  // Graticule: meridians and parallels, a hair above the surface.
  const grid = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xb8891e, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 18; i++) {
    const pts = [];
    for (let j = 0; j <= 96; j++) {
      const t = (j / 96) * Math.PI;
      pts.push(new THREE.Vector3(Math.sin(t) * Math.cos(0), Math.cos(t), Math.sin(t) * Math.sin(0)).multiplyScalar(R * 1.002));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, lineMat); l.rotation.y = (i / 18) * Math.PI; grid.add(l);
  }
  for (let k = 1; k < 9; k++) {
    const lat = (k / 9) * Math.PI - Math.PI / 2, r = Math.cos(lat) * R * 1.002, y = Math.sin(lat) * R * 1.002;
    const g = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, j) => new THREE.Vector3(Math.cos((j / 128) * Math.PI * 2) * r, y, Math.sin((j / 128) * Math.PI * 2) * r))
    );
    grid.add(new THREE.Line(g, lineMat));
  }
  planet.add(grid);

  // Orbit of beacons, tilted, like the deck's scattered ring dots.
  const orbit = new THREE.Group();
  const beaconGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, b = new THREE.Mesh(beaconGeo, beaconMat);
    b.position.set(Math.cos(a) * R * 1.35, 0, Math.sin(a) * R * 1.35); orbit.add(b);
  }
  orbit.rotation.x = 0.32; orbit.rotation.z = -0.12;
  planet.add(orbit);

  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x083350, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-4, 7, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x518db7, 0.9);
  rim.position.set(5, 1, -6); scene.add(rim);

  const CAM_Y = 0.2, CAM_Z = 9, PLANET_Z = -2;
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  let w = 0, h = 0, baseX = 0, baseY = -R;
  // Place the sphere so its silhouette top lands on the CSS horizon, under L.
  function solve() {
    const cs = getComputedStyle(stage);
    const horizon = parseFloat(cs.getPropertyValue('--horizon')) || 0.8;
    const lx = parseFloat(cs.getPropertyValue('--lx')) || 0.5;
    const target = 1 - 2 * horizon; // NDC y of the limb
    const depth = CAM_Z - PLANET_Z;
    const ndcOf = (y) => {
      const dy = y - CAM_Y, d = Math.hypot(dy, depth);
      return Math.tan(Math.atan2(dy, depth) + Math.asin(R / d)) / Math.tan(halfV);
    };
    let lo = -R * 6, hi = 0;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ndcOf(mid) > target) hi = mid; else lo = mid; }
    baseY = (lo + hi) / 2;
    // The tangent point sits nearer the camera than the centre; aim x at that depth.
    const tDepth = depth - R * R / depth;
    baseX = (2 * lx - 1) * Math.tan(halfV) * camera.aspect * tDepth;
  }
  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    solve();
  }
  addEventListener('resize', resize); resize();

  // Render only while the hero is on screen; the loop stops entirely otherwise.
  let visible = true, looping = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !looping) { looping = true; requestAnimationFrame(tick); }
  }, { rootMargin: '10%' }).observe(section);

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let px = 0, tpx = 0;
  if (fine) section.addEventListener('pointermove', (e) => { tpx = (e.clientX / innerWidth) * 2 - 1; });

  const clock = new THREE.Clock();
  let first = true;
  function tick() {
    if (!visible) { looping = false; return; }
    requestAnimationFrame(tick);
    const p = parseFloat(section.style.getPropertyValue('--sc-p')) || 0;
    const t = clock.getElapsedTime();
    px += (tpx - px) * 0.05;
    planet.position.set(baseX, baseY, PLANET_Z);
    planet.rotation.y = t * 0.03 + p * 0.6;
    planet.rotation.x = 0.18;
    planet.rotation.z = 0.55; // keeps the graticule's pole out of the centre of the frame
    orbit.rotation.y = t * 0.05;
    // The camera only slides (no tilt), so the solved horizon stays put.
    camera.position.set(px * 0.12, CAM_Y, CAM_Z);
    renderer.render(scene, camera);
    if (first) { first = false; section.classList.add('is-3d'); }
  }
  looping = true;
  tick();
}
