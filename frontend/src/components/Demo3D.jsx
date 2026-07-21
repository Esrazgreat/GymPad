import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * A low-poly 3D athlete demonstrating an exercise.
 *
 * Built rather than loaded: a rigged GLTF human would be several megabytes, and
 * this app targets mid-range Android phones on metered data. A procedural figure
 * is a few kilobytes of code, needs no CDN, and can be posed analytically —
 * every animation below is just a function from phase (0→1) to joint rotations.
 *
 * Proportions follow standard artistic canon (head = 1/7.5 of height) so the
 * figure reads as a person rather than a mannequin.
 *
 * Two things this component must get right, and does:
 *  • FULL CLEANUP on unmount — cancelAnimationFrame, dispose every geometry,
 *    material and the renderer itself. WebGL contexts are a limited resource;
 *    leaking one per exercise would kill the session screen after a dozen swaps.
 *  • REDUCED MOTION — if the user asked the OS for less motion, we render a
 *    single held pose instead of looping, and never start the RAF loop.
 */

// ─── Rig ─────────────────────────────────────────────────────────────────────

const PROPORTIONS = {
  headRadius: 0.42,
  neck: 0.18,
  torso: 3.0,
  torsoWidth: 1.1,
  torsoDepth: 0.55,
  upperArm: 1.3,
  forearm: 1.1,
  thigh: 1.7,
  shin: 1.6,
  limbRadius: 0.17,
};

const COLORS = {
  skin: 0x9c6b43,
  shirt: 0xff6b35,
  shorts: 0x2b2140,
  shoes: 0xf5f0ff,
  joint: 0x8a5c3a,
};

/** Eased 0→1→0 travel. Human movement accelerates and decelerates; linear looks robotic. */
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
/** Ping-pong a 0→1 clock into a 0→1→0 rep cycle. */
const pingPong = (t) => (t < 0.5 ? ease(t * 2) : ease((1 - t) * 2));

const deg = THREE.MathUtils.degToRad;

/**
 * Animations. Each returns joint rotations for a normalised rep phase `p`
 * (0 = start, 1 = full contraction). Keeping them as pure functions makes them
 * trivial to tweak and impossible to leak state between exercises.
 */
const ANIMATIONS = {
  squat: (p) => ({
    hipY: -1.5 * p, kneeBend: deg(95) * p, hipBend: deg(70) * p,
    torsoLean: deg(28) * p, shoulder: deg(75) * p, elbow: deg(10),
  }),
  chair_squat: (p) => ({
    hipY: -1.1 * p, kneeBend: deg(75) * p, hipBend: deg(55) * p,
    torsoLean: deg(22) * p, shoulder: deg(80) * p, elbow: deg(15),
  }),
  pushup: (p) => ({
    prone: true, hipY: -0.15 * p, elbow: deg(85) * p,
    shoulder: deg(88), torsoLean: deg(90),
  }),
  lunge: (p) => ({
    hipY: -1.2 * p, kneeBend: deg(85) * p, kneeBendBack: deg(95) * p,
    split: 1.1 * p, torsoLean: deg(8) * p, shoulder: deg(12), elbow: deg(15),
  }),
  plank: () => ({ prone: true, hipY: 0, elbow: deg(90), shoulder: deg(88), torsoLean: deg(90), hold: true }),
  jack: (p) => ({ shoulder: deg(165) * p, armSpread: deg(28) * p, legSpread: deg(22) * p, hipY: -0.08 * p, elbow: deg(6) }),
  run: (p) => ({ run: true, cycle: p, hipY: -0.1 + 0.1 * Math.sin(p * Math.PI * 2), shoulder: deg(45), elbow: deg(80) }),
  climber: (p) => ({ prone: true, torsoLean: deg(90), shoulder: deg(88), elbow: deg(10), kneeDrive: p }),
  burpee: (p) => {
    if (p < 0.5) { const q = p * 2; return { hipY: -1.6 * q, kneeBend: deg(100) * q, hipBend: deg(75) * q, torsoLean: deg(35) * q, shoulder: deg(60) * q, elbow: deg(20) }; }
    const q = (p - 0.5) * 2;
    return { prone: true, hipY: -0.1, elbow: deg(80) * q, shoulder: deg(88), torsoLean: deg(90) };
  },
  bridge: (p) => ({ supine: true, hipLift: 0.9 * p, kneeBend: deg(80), shoulder: deg(10), elbow: deg(5) }),
  glute_bridge: (p) => ({ supine: true, hipLift: 0.9 * p, kneeBend: deg(80), shoulder: deg(10), elbow: deg(5) }),
  crunch: (p) => ({ supine: true, crunch: deg(38) * p, kneeBend: deg(70), shoulder: deg(70), elbow: deg(75) }),
  benchPress: (p) => ({ supine: true, benchPress: true, elbow: deg(88) * (1 - p), shoulder: deg(88), kneeBend: deg(80) }),
  deadlift: (p) => {
    const q = 1 - p; // starts bent, finishes tall
    return { hipY: -0.9 * q, kneeBend: deg(55) * q, hipBend: deg(80) * q, torsoLean: deg(72) * q, shoulder: deg(4), elbow: deg(4), barInHands: true };
  },
  barbellCurl: (p) => ({ shoulder: deg(8), elbow: deg(140) * p, barInHands: true }),
  latPulldown: (p) => ({ seated: true, shoulder: deg(160) - deg(78) * p, elbow: deg(20) + deg(70) * p, barInHands: true }),
  overheadPress: (p) => ({ shoulder: deg(55) + deg(120) * p, elbow: deg(95) * (1 - p), barInHands: true }),
  lateralRaise: (p) => ({ shoulder: deg(8) + deg(82) * p, armSpread: deg(88) * p, elbow: deg(10) }),
  calfRaise: (p) => ({ hipY: 0.34 * p, heelLift: p, shoulder: deg(6), elbow: deg(6) }),
  legPress: (p) => ({ seated: true, recline: true, kneeBend: deg(88) * p, hipBend: deg(72), shoulder: deg(14), elbow: deg(70) }),
  pullup: (p) => ({ hang: true, shoulder: deg(172) - deg(52) * p, elbow: deg(15) + deg(120) * p, hipY: 1.5 * p, barInHands: true }),
  barbellRow: (p) => ({ hipBend: deg(62), torsoLean: deg(58), kneeBend: deg(22), hipY: -0.35, shoulder: deg(12), elbow: deg(105) * p, barInHands: true }),
};

const resolveAnimation = (key) => ANIMATIONS[key] ?? ANIMATIONS.squat;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Demo3D({ animation = 'squat', height = 280, speed = 1 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const width = mount.clientWidth || 320;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.6, 12.5);
    camera.lookAt(0, 0.4, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      // No WebGL (old device, blocked context). ExerciseDemo shows a fallback.
      return undefined;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Browsers cap concurrent WebGL contexts (Chromium allows ~16) and drop the
    // OLDEST when the cap is exceeded — the canvas then silently renders white.
    // The app only mounts one or two demos at a time so this is rare, but a
    // blank white box in a workout is a bad failure. Surface it instead.
    const onContextLost = (event) => {
      event.preventDefault();
      mount.dataset.webglLost = 'true';
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // ── Lighting: warm key, cool rim, soft ambient ──────────────────────────
    scene.add(new THREE.HemisphereLight(0xffd9c0, 0x2b2140, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x35e0d0, 30, 26);
    rim.position.set(-5, 3.5, -4);
    scene.add(rim);
    const warm = new THREE.PointLight(0xff6b35, 22, 24);
    warm.position.set(5, 1.5, 3);
    scene.add(warm);

    // ── Stage: glow ring + shadow blob ──────────────────────────────────────
    const disposables = [];
    const track = (obj) => { disposables.push(obj); return obj; };

    const ringGeo = track(new THREE.RingGeometry(2.4, 3.0, 48));
    const ringMat = track(new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -4.3;
    scene.add(ring);

    const blobGeo = track(new THREE.CircleGeometry(1.7, 32));
    const blobMat = track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }));
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -4.28;
    scene.add(blob);

    // ── Materials ───────────────────────────────────────────────────────────
    const mat = (color, extra = {}) =>
      track(new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05, ...extra }));
    const skinMat = mat(COLORS.skin);
    const shirtMat = mat(COLORS.shirt, { roughness: 0.6 });
    const shortsMat = mat(COLORS.shorts);
    const shoeMat = mat(COLORS.shoes, { roughness: 0.45 });
    const jointMat = mat(COLORS.joint);
    const barMat = mat(0xcfd3dc, { metalness: 0.75, roughness: 0.3 });

    const P = PROPORTIONS;

    const limb = (length, material, radius = P.limbRadius) => {
      const geo = track(new THREE.CapsuleGeometry(radius, length, 4, 10));
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = -length / 2;
      return mesh;
    };

    const joint = (radius = 0.2) => {
      const geo = track(new THREE.SphereGeometry(radius, 12, 10));
      return new THREE.Mesh(geo, jointMat);
    };

    /** A pivot whose children hang downward, so rotating the pivot swings the limb. */
    const pivot = (x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      return g;
    };

    // ── Build the figure ────────────────────────────────────────────────────
    const athlete = new THREE.Group();
    scene.add(athlete);

    const hips = pivot(0, 0, 0);
    athlete.add(hips);

    // Torso (from hips upward)
    const torsoGeo = track(new THREE.CapsuleGeometry(P.torsoWidth * 0.5, P.torso * 0.62, 4, 12));
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.scale.set(1, 1, P.torsoDepth / (P.torsoWidth * 0.5) * 1.15);
    torso.position.y = P.torso * 0.5;
    const chest = pivot(0, 0, 0);
    chest.add(torso);
    hips.add(chest);

    // Pelvis
    const pelvisGeo = track(new THREE.CapsuleGeometry(P.torsoWidth * 0.44, 0.5, 4, 10));
    const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
    pelvis.position.y = -0.12;
    hips.add(pelvis);

    // Head + neck
    const neckGeo = track(new THREE.CylinderGeometry(0.16, 0.18, P.neck, 8));
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = P.torso * 0.86;
    chest.add(neck);

    const headGeo = track(new THREE.SphereGeometry(P.headRadius, 16, 14));
    const head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(0.92, 1.1, 0.95);
    head.position.y = P.torso * 0.86 + P.neck + P.headRadius * 0.82;
    chest.add(head);

    // Arms
    const makeArm = (side) => {
      const shoulderPivot = pivot(side * P.torsoWidth * 0.52, P.torso * 0.74, 0);
      shoulderPivot.add(joint(0.21));
      shoulderPivot.add(limb(P.upperArm, skinMat));

      const elbowPivot = pivot(0, -P.upperArm - P.limbRadius, 0);
      elbowPivot.add(joint(0.16));
      elbowPivot.add(limb(P.forearm, skinMat, P.limbRadius * 0.88));

      const handGeo = track(new THREE.SphereGeometry(0.19, 10, 8));
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -P.forearm - P.limbRadius;
      elbowPivot.add(hand);

      shoulderPivot.add(elbowPivot);
      chest.add(shoulderPivot);
      return { shoulderPivot, elbowPivot, hand };
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    // Legs
    const makeLeg = (side) => {
      const hipPivot = pivot(side * P.torsoWidth * 0.28, -0.3, 0);
      hipPivot.add(joint(0.23));
      hipPivot.add(limb(P.thigh, shortsMat, P.limbRadius * 1.15));

      const kneePivot = pivot(0, -P.thigh - P.limbRadius, 0);
      kneePivot.add(joint(0.19));
      kneePivot.add(limb(P.shin, skinMat));

      const footGeo = track(new THREE.BoxGeometry(0.42, 0.24, 0.86));
      const foot = new THREE.Mesh(footGeo, shoeMat);
      foot.position.set(0, -P.shin - P.limbRadius - 0.06, 0.22);
      const anklePivot = pivot(0, -P.shin - P.limbRadius, 0);
      anklePivot.add(foot);
      foot.position.set(0, -0.06, 0.22);
      kneePivot.add(anklePivot);

      hipPivot.add(kneePivot);
      hips.add(hipPivot);
      return { hipPivot, kneePivot, anklePivot };
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    // Barbell — shown only for lifts that hold one.
    const barGeo = track(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 10));
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.rotation.z = Math.PI / 2; // cylinder's axis is +Y by default; lay it along X

    // Plates are CHILDREN of the bar, so they already inherit that rotation.
    // Re-applying it here rotated them a full 90° too far and they rendered as
    // flat discs floating in mid-air. For the same reason their offset is along
    // the bar's LOCAL +Y (its cylinder axis), not world X.
    const plateGeo = track(new THREE.CylinderGeometry(0.62, 0.62, 0.17, 16));
    for (const s of [-1, 1]) {
      const plate = new THREE.Mesh(plateGeo, barMat);
      plate.position.y = s * 1.95;
      bar.add(plate);
    }
    bar.visible = false;
    scene.add(bar);

    // Ground the whole figure so the feet rest on the stage.
    const STANDING_Y = -4.3 + P.thigh + P.shin + 0.55;
    athlete.position.y = STANDING_Y;

    // ── Pose application ────────────────────────────────────────────────────
    const animate3D = resolveAnimation(animation);

    function applyPose(p) {
      const s = animate3D(p);

      // Reset transforms each frame — poses are absolute, not incremental, so
      // there is no drift over a long session.
      athlete.rotation.set(0, 0, 0);
      athlete.position.set(0, STANDING_Y, 0);
      hips.rotation.set(0, 0, 0);
      chest.rotation.set(0, 0, 0);
      for (const a of [armL, armR]) { a.shoulderPivot.rotation.set(0, 0, 0); a.elbowPivot.rotation.set(0, 0, 0); }
      for (const l of [legL, legR]) { l.hipPivot.rotation.set(0, 0, 0); l.kneePivot.rotation.set(0, 0, 0); l.anklePivot.rotation.set(0, 0, 0); }
      bar.visible = Boolean(s.barInHands);

      // Whole-body orientation.
      //
      // Lying poses need TWO rotations, not one. Rotating only about X lays the
      // body along the camera axis, so the figure points at the lens and
      // collapses into an unreadable blob (this was a real bug). Instead:
      //   Rz(-90°) lays the long axis horizontally across the screen, and
      //   Rx(±90°) rolls the body so the limb-swing plane faces the camera —
      // which together give the side-on profile these lifts are always filmed
      // from. Three.js Euler order 'XYZ' composes as Rx · Ry · Rz, so setting
      // both components in one call produces exactly that.
      if (s.prone) {
        athlete.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
        athlete.position.set(0, -3.15 + (s.hipY ?? 0), 0);
      } else if (s.supine) {
        athlete.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
        athlete.position.set(0, -3.15 + (s.hipLift ?? 0), 0);
      } else if (s.hang) {
        athlete.position.y = STANDING_Y + 1.9 + (s.hipY ?? 0);
      } else if (s.seated) {
        athlete.position.y = STANDING_Y - 1.5;
      } else {
        athlete.position.y = STANDING_Y + (s.hipY ?? 0);
      }

      if (s.torsoLean && !s.prone && !s.supine) chest.rotation.x = s.torsoLean;
      if (s.crunch) chest.rotation.x = -s.crunch;
      if (s.hipBend && !s.prone && !s.supine) hips.rotation.x = -s.hipBend * 0.25;

      // Arms
      const shoulder = s.shoulder ?? 0;
      const elbow = s.elbow ?? 0;
      const spread = s.armSpread ?? 0;
      for (const [side, arm] of [[-1, armL], [1, armR]]) {
        if (s.run) {
          const phase = side > 0 ? s.cycle : (s.cycle + 0.5) % 1;
          arm.shoulderPivot.rotation.x = Math.sin(phase * Math.PI * 2) * deg(48);
          arm.elbowPivot.rotation.x = elbow;
        } else {
          arm.shoulderPivot.rotation.x = -shoulder;
          arm.shoulderPivot.rotation.z = side * spread;
          arm.elbowPivot.rotation.x = elbow;
        }
      }

      // Legs
      const knee = s.kneeBend ?? 0;
      const legSpread = s.legSpread ?? 0;
      for (const [side, leg] of [[-1, legL], [1, legR]]) {
        if (s.run) {
          const phase = side > 0 ? s.cycle : (s.cycle + 0.5) % 1;
          leg.hipPivot.rotation.x = Math.sin(phase * Math.PI * 2) * deg(38);
          leg.kneePivot.rotation.x = Math.max(0, Math.sin(phase * Math.PI * 2 + 1)) * deg(72);
        } else if (s.split) {
          // Lunge: front leg forward, back leg trailing.
          const front = side > 0;
          leg.hipPivot.rotation.x = front ? -deg(38) * (s.split / 1.1) : deg(30) * (s.split / 1.1);
          leg.kneePivot.rotation.x = front ? knee : (s.kneeBendBack ?? knee);
        } else if (s.kneeDrive !== undefined) {
          const drive = side > 0 ? s.kneeDrive : 1 - s.kneeDrive;
          leg.hipPivot.rotation.x = -deg(58) * drive;
          leg.kneePivot.rotation.x = deg(82) * drive;
        } else {
          leg.hipPivot.rotation.x = (s.hipBend ?? 0) ? -(s.hipBend) * 0.85 : 0;
          leg.hipPivot.rotation.z = side * legSpread;
          leg.kneePivot.rotation.x = knee;
          if (s.heelLift) leg.anklePivot.rotation.x = -deg(34) * s.heelLift;
        }
      }

      // Park the barbell in the hands.
      if (s.barInHands) {
        const handWorld = new THREE.Vector3();
        armR.hand.getWorldPosition(handWorld);
        bar.position.set(0, handWorld.y, handWorld.z);
      }
    }

    // ── Loop ────────────────────────────────────────────────────────────────
    let rafId = null;
    const clock = new THREE.Clock();
    const REP_SECONDS = 2.4 / Math.max(0.25, speed);

    if (reduceMotion) {
      // Hold a readable mid-rep pose and render exactly once.
      applyPose(0.62);
      renderer.render(scene, camera);
    } else {
      const tick = () => {
        rafId = requestAnimationFrame(tick);
        const elapsed = clock.getElapsedTime();
        applyPose(pingPong((elapsed % REP_SECONDS) / REP_SECONDS));
        // Gentle ±15° orbit so the pose is readable from more than one angle.
        const orbit = Math.sin(elapsed * 0.42) * deg(15);
        camera.position.x = Math.sin(orbit) * 12.5;
        camera.position.z = Math.cos(orbit) * 12.5;
        camera.lookAt(0, 0.2, 0);
        renderer.render(scene, camera);
      };
      tick();
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth || 320;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    // ── Teardown ────────────────────────────────────────────────────────────
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      // Release the GPU context immediately rather than waiting for GC —
      // without this, swapping through a dozen exercises exhausts the browser's
      // context pool and later demos render blank.
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [animation, height, speed]);

  return (
    <div
      ref={mountRef}
      style={{ height }}
      className="w-full flex items-center justify-center"
      role="img"
      aria-label="3D exercise demonstration"
    />
  );
}
