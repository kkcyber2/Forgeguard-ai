// @ts-nocheck
"use client";
/**
 * NeuralCore — 3D Acid-Green Particle Sphere (R3F / three.js).
 */

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import * as THREE from "three";

const PARTICLE_COUNT = 1000;
const SPHERE_RADIUS = 2.2;
const ACID_GREEN = new THREE.Color("#D1FF00");
const ELECTRIC_PURPLE = new THREE.Color("#8B5CF6");
const MOUSE_INFLUENCE_RADIUS = 0.9;
const REPEL_STRENGTH = 0.18;

function buildSphereParticles(count, radius) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    scales[i] = 0.6 + Math.random() * 0.8;
    phases[i] = Math.random() * Math.PI * 2;
  }
  return { positions, scales, phases };
}

function ParticleSphere() {
  const pointsRef = React.useRef(null);
  const { camera, size } = useThree();

  const { positions, scales, phases } = React.useMemo(
    () => buildSphereParticles(PARTICLE_COUNT, SPHERE_RADIUS),
    [],
  );

  const mouse = React.useRef({ x: 0, y: 0 });
  React.useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / size.width) * 2 - 1;
      mouse.current.y = -((e.clientY / size.height) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [size]);

  const geometry = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions.slice(), 3));
    const cols = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      cols[i * 3 + 0] = ACID_GREEN.r;
      cols[i * 3 + 1] = ACID_GREEN.g;
      cols[i * 3 + 2] = ACID_GREEN.b;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }, [positions]);

  const raycaster = React.useRef(new THREE.Raycaster());
  const mouseVec = React.useRef(new THREE.Vector2());
  const tempVec = React.useRef(new THREE.Vector3());
  const closestPoint = React.useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.getAttribute("position");
    const colAttr = pts.geometry.getAttribute("color");
    const arr = posAttr.array;
    const col = colAttr.array;

    mouseVec.current.set(mouse.current.x, mouse.current.y);
    raycaster.current.setFromCamera(mouseVec.current, camera);
    const ray = raycaster.current.ray;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ox = positions[i * 3 + 0];
      const oy = positions[i * 3 + 1];
      const oz = positions[i * 3 + 2];

      const pulse = 1 + 0.08 * Math.sin(t * 1.4 + phases[i]) * scales[i];
      let nx = ox * pulse;
      let ny = oy * pulse;
      let nz = oz * pulse;

      tempVec.current.set(nx, ny, nz);
      const dist = ray.distanceToPoint(tempVec.current);
      if (dist < MOUSE_INFLUENCE_RADIUS) {
        const strength = (1 - dist / MOUSE_INFLUENCE_RADIUS) * REPEL_STRENGTH;
        const cp = ray.closestPointToPoint(tempVec.current, closestPoint.current);
        const dx = nx - cp.x;
        const dy = ny - cp.y;
        const dz = nz - cp.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        nx += (dx / len) * strength;
        ny += (dy / len) * strength;
        nz += (dz / len) * strength;

        const blend = 1 - dist / MOUSE_INFLUENCE_RADIUS;
        col[i * 3 + 0] = THREE.MathUtils.lerp(ACID_GREEN.r, ELECTRIC_PURPLE.r, blend);
        col[i * 3 + 1] = THREE.MathUtils.lerp(ACID_GREEN.g, ELECTRIC_PURPLE.g, blend);
        col[i * 3 + 2] = THREE.MathUtils.lerp(ACID_GREEN.b, ELECTRIC_PURPLE.b, blend);
      } else {
        col[i * 3 + 0] = ACID_GREEN.r;
        col[i * 3 + 1] = ACID_GREEN.g;
        col[i * 3 + 2] = ACID_GREEN.b;
      }

      arr[i * 3 + 0] = nx;
      arr[i * 3 + 1] = ny;
      arr[i * 3 + 2] = nz;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    pts.rotation.y = t * 0.06;
    pts.rotation.x = Math.sin(t * 0.04) * 0.15;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.028}
        sizeAttenuation
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function NeuralCore({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <React.Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <ParticleSphere />
        </Canvas>
      </React.Suspense>
    </div>
  );
}
