import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

interface HeroSceneProps {
  /** called after the first picture is drawn (so the page can fade the scene in) */
  onReady?: () => void;
  /** called when the browser cannot show 3D (the page then keeps its still background) */
  onFail?: () => void;
}

const GOLD = 0xd9a441;
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** A soft round glow, drawn once on a tiny canvas and used for the floor light and the floating dust. */
function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,224,150,1)');
    gradient.addColorStop(0.35, 'rgba(226,176,74,0.45)');
    gradient.addColorStop(1, 'rgba(226,176,74,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The armchair, built from rounded boxes (soft velvet) and gold metal. Faces +z. */
function buildChair(): THREE.Group {
  const chair = new THREE.Group();

  const gold = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const velvet = new THREE.MeshPhysicalMaterial({
    color: 0x18181b,
    roughness: 0.92,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x7a5c22),
  });
  const velvetSoft = velvet.clone();
  velvetSoft.color.set(0x242428);
  const pillow = new THREE.MeshPhysicalMaterial({
    color: 0xb48a30,
    roughness: 0.85,
    sheen: 1,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xf3d58a),
  });

  const box = (width: number, height: number, depth: number, radius: number, material: THREE.Material, segments = 5): THREE.Mesh => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, segments, radius), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // frame and seat
  const base = box(1.1, 0.3, 1.0, 0.06, velvet);
  base.position.set(0, 0.5, 0);
  const trim = box(1.14, 0.035, 1.04, 0.015, gold, 3);
  trim.position.set(0, 0.352, 0);
  const seat = box(0.92, 0.2, 0.84, 0.09, velvetSoft);
  seat.position.set(0, 0.74, 0.06);

  // back, with a tufted cushion and gold buttons
  const back = box(1.1, 0.95, 0.24, 0.1, velvet);
  back.position.set(0, 1.1, -0.42);
  back.rotation.x = -0.12;

  const cushion = new THREE.Group();
  cushion.position.set(0, 1.12, -0.26);
  cushion.rotation.x = -0.12;
  const cushionBody = box(0.84, 0.58, 0.17, 0.09, velvetSoft);
  cushion.add(cushionBody);
  for (const x of [-0.25, 0, 0.25]) {
    for (const y of [-0.14, 0.14]) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), gold);
      button.position.set(x, y, 0.088);
      cushion.add(button);
    }
  }

  // arms with gold caps
  for (const side of [-1, 1]) {
    const arm = box(0.2, 0.46, 0.92, 0.09, velvet);
    arm.position.set(side * 0.58, 0.86, 0);
    const cap = box(0.215, 0.025, 0.93, 0.01, gold, 3);
    cap.position.set(side * 0.58, 1.095, 0);
    chair.add(arm, cap);
  }

  // four tapered gold legs, splayed a little
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.022, 0.36, 24), gold);
      leg.position.set(sx * 0.46, 0.18, sz * 0.4);
      leg.rotation.z = sx * 0.1;
      leg.rotation.x = -sz * 0.1;
      leg.castShadow = true;
      chair.add(leg);
    }
  }

  // a gold throw pillow
  const throwPillow = box(0.38, 0.38, 0.12, 0.06, pillow);
  throwPillow.position.set(-0.27, 1.0, 0.12);
  throwPillow.rotation.set(0.12, 0.45, 0.18);

  chair.add(base, trim, seat, back, cushion, throwPillow);
  return chair;
}

export default function HeroScene({ onReady, onFail }: HeroSceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onFail });
  useEffect(() => {
    callbacks.current = { onReady, onFail };
  });

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smallScreen = window.matchMedia('(max-width: 767px)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !smallScreen, alpha: true, powerPreference: 'high-performance' });
    } catch {
      callbacks.current.onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);

    // ------------------------------------------------------------ scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    // reflections for the gold come from a plain studio room (no image files needed)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.55;

    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    const key = new THREE.DirectionalLight(0xfff0d4, 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 16;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(GOLD, 2.6);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const chair = buildChair();
    const stage = new THREE.Group(); // moves and turns as one piece
    stage.add(chair);
    scene.add(stage);

    // floor: only the shadow is visible, plus a warm gold glow and two thin rings
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.ShadowMaterial({ opacity: 0.5 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    stage.add(floor);

    const glow = glowTexture();
    const floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 64),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.004;
    stage.add(floorGlow);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8 });
    const ringFine = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35 });
    const ringNear = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.01, 12, 180), ringMaterial);
    const ringFar = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.006, 12, 180), ringFine);
    for (const ring of [ringNear, ringFar]) {
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.006;
      stage.add(ring);
    }

    // tall halo rings behind the chair
    const halo = new THREE.Group();
    const haloA = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.007, 12, 220), ringFine);
    const haloB = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.005, 12, 220), ringFine);
    haloB.rotation.x = 0.5;
    halo.add(haloA, haloB);
    halo.position.set(0, 1.05, -0.9);
    stage.add(halo);

    // floating gold dust
    const dustCount = smallScreen ? 150 : 360;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSpeed = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i += 1) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 9;
      dustPositions[i * 3 + 1] = Math.random() * 4.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      dustSpeed[i] = 0.05 + Math.random() * 0.14;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        map: glow,
        size: 0.11,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        color: 0xf0c868,
      }),
    );
    scene.add(dust);

    // ------------------------------------------------------------ layout (wide screens put the chair on the right)
    let anchorX = 0;
    let anchorY = 0;
    let baseScale = 1;
    let cameraX = 0;
    const layout = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const wide = camera.aspect > 1.15;
      camera.fov = wide ? 32 : 40;
      cameraX = 0;
      camera.position.set(0, wide ? 1.35 : 1.55, wide ? 5.4 : 6.6);
      anchorX = wide ? 1.25 : 0;
      anchorY = wide ? 0 : -0.55;
      baseScale = wide ? 1.12 : 0.95;
      camera.updateProjectionMatrix();
    };
    layout();
    const resizer = new ResizeObserver(layout);
    resizer.observe(host);

    // ------------------------------------------------------------ interaction
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // draw only while the hero is on screen and the tab is open
    let visible = true;
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    watcher.observe(host);

    // ------------------------------------------------------------ animation
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let intro = reduceMotion ? 1 : 0;
    let announced = false;
    const lookAt = new THREE.Vector3(0, 0.8, 0);

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible || document.hidden) return;
      elapsed += dt;

      intro = Math.min(1, intro + dt / 2.4);
      const e = easeOutCubic(intro);
      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;
      const scroll = Math.min(1, window.scrollY / Math.max(1, host.clientHeight));

      stage.position.set(anchorX, anchorY - scroll * 0.5, 0);
      stage.scale.setScalar(baseScale * (0.86 + 0.14 * e) * (1 - scroll * 0.18));
      stage.rotation.y = 0.55 + (reduceMotion ? 0 : elapsed * 0.16) + pointer.x * 0.45 + scroll * 1.3 - (1 - e) * 2.6;
      stage.rotation.x = pointer.y * 0.05;
      halo.rotation.z = reduceMotion ? 0 : elapsed * 0.07;
      ringMaterial.opacity = 0.6 + Math.sin(elapsed * 1.6) * 0.2;

      camera.position.x = cameraX + pointer.x * 0.35;
      camera.lookAt(lookAt);

      if (!reduceMotion) {
        for (let i = 0; i < dustCount; i += 1) {
          let y = dustPositions[i * 3 + 1] + dustSpeed[i] * dt;
          if (y > 4.5) y = 0;
          dustPositions[i * 3 + 1] = y;
          dustPositions[i * 3] += Math.sin(elapsed * 0.4 + i) * 0.0006;
        }
        dustGeometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      if (!announced) {
        announced = true;
        callbacks.current.onReady?.();
      }
    };
    frame = requestAnimationFrame(draw);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      callbacks.current.onFail?.();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    // ------------------------------------------------------------ clean up everything we created
    return () => {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      watcher.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      glow.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={mount} className="h-full w-full" aria-hidden="true" />;
}
