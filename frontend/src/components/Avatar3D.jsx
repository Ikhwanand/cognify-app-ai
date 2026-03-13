/**
 * Avatar3D — 3D Animated AI Avatar using Three.js
 * Features:
 * - Reactive morphing sphere that responds to AI state
 * - Orbital particles
 * - Glow effects and color transitions
 * - States: idle, thinking, speaking, listening
 */

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  MeshDistortMaterial,
  Sphere,
  Float,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";

// =============  Core Avatar Orb  ===============
function AvatarOrb({ aiStatus = "idle", isMuted = false, visionEnabled = false }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const ringRef = useRef();

  // Smooth color interpolation
  const colorRef = useRef(new THREE.Color("#8b5cf6"));
  const emissiveRef = useRef(new THREE.Color("#4c1d95"));

  // Target colors based on state
  const stateColors = useMemo(
    () => ({
      idle: { main: "#8b5cf6", emissive: "#4c1d95", glow: "#a78bfa" },
      thinking: { main: "#f59e0b", emissive: "#92400e", glow: "#fbbf24" },
      speaking: { main: "#10b981", emissive: "#065f46", glow: "#34d399" },
      muted: { main: "#ef4444", emissive: "#7f1d1d", glow: "#f87171" },
      vision: { main: "#3b82f6", emissive: "#1e3a8a", glow: "#60a5fa" },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const t = state.clock.elapsedTime;

    // Determine current state key
    let stateKey = "idle";
    if (isMuted) stateKey = "muted";
    else if (visionEnabled && aiStatus === "idle") stateKey = "vision";
    else if (aiStatus !== "idle") stateKey = aiStatus;

    const target = stateColors[stateKey] || stateColors.idle;

    // Smooth color transition
    colorRef.current.lerp(new THREE.Color(target.main), delta * 3);
    emissiveRef.current.lerp(new THREE.Color(target.emissive), delta * 3);

    if (meshRef.current.material) {
      meshRef.current.material.color.copy(colorRef.current);
      meshRef.current.material.emissive.copy(emissiveRef.current);
    }

    // Rotation
    meshRef.current.rotation.y += delta * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;

    // Scale pulsing based on state
    let scalePulse = 1;
    if (aiStatus === "thinking") {
      scalePulse = 1 + Math.sin(t * 4) * 0.08;
    } else if (aiStatus === "speaking") {
      scalePulse = 1 + Math.sin(t * 8) * 0.12 + Math.sin(t * 13) * 0.06;
    } else {
      scalePulse = 1 + Math.sin(t * 1.5) * 0.03;
    }
    meshRef.current.scale.setScalar(scalePulse);

    // Glow ring
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5;
      ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.3;
      const ringScale = aiStatus === "speaking" ? 1.6 + Math.sin(t * 6) * 0.15 : 1.5;
      ringRef.current.scale.setScalar(ringScale);
    }

    // Outer glow
    if (glowRef.current) {
      const glowPulse =
        aiStatus === "speaking"
          ? 1.8 + Math.sin(t * 5) * 0.2
          : aiStatus === "thinking"
            ? 1.6 + Math.sin(t * 3) * 0.15
            : 1.4 + Math.sin(t * 1) * 0.05;
      glowRef.current.scale.setScalar(glowPulse);
      glowRef.current.material.opacity =
        aiStatus === "speaking" ? 0.15 : aiStatus === "thinking" ? 0.12 : 0.08;
    }
  });

  const distortSpeed =
    aiStatus === "speaking" ? 4 : aiStatus === "thinking" ? 2 : 0.8;
  const distortAmount =
    aiStatus === "speaking" ? 0.5 : aiStatus === "thinking" ? 0.35 : 0.2;

  return (
    <group>
      {/* Main orb */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <Sphere ref={meshRef} args={[1, 64, 64]}>
          <MeshDistortMaterial
            color="#8b5cf6"
            emissive="#4c1d95"
            emissiveIntensity={0.5}
            roughness={0.2}
            metalness={0.8}
            distort={distortAmount}
            speed={distortSpeed}
            transparent
            opacity={0.95}
          />
        </Sphere>
      </Float>

      {/* Outer glow sphere */}
      <Sphere ref={glowRef} args={[1, 32, 32]}>
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Orbital ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ============= Orbital Particles ===============
function OrbitalParticles({
  count = 60,
  aiStatus = "idle",
}) {
  const meshRef = useRef();

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const radii = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      radii[i] = 2 + Math.random() * 1.5;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.3 + Math.random() * 0.7;

      // Initial positions on orbit
      positions[i * 3] = Math.cos(phases[i]) * radii[i];
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = Math.sin(phases[i]) * radii[i];
    }

    return { positions, speeds, radii, phases };
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = meshRef.current.geometry.attributes.position;

    const speedMultiplier = aiStatus === "speaking" ? 3 : aiStatus === "thinking" ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const angle = particles.phases[i] + t * particles.speeds[i] * speedMultiplier;
      const radius = particles.radii[i];

      posAttr.array[i * 3] = Math.cos(angle) * radius;
      posAttr.array[i * 3 + 1] = Math.sin(t * particles.speeds[i] * 0.5 + particles.phases[i]) * 0.8;
      posAttr.array[i * 3 + 2] = Math.sin(angle) * radius;
    }

    posAttr.needsUpdate = true;
  });

  const particleColor =
    aiStatus === "speaking"
      ? "#34d399"
      : aiStatus === "thinking"
        ? "#fbbf24"
        : "#c4b5fd";

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={particleColor}
        size={0.04}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

// ============= Status Indicator Ring ===============
function StatusRing({ aiStatus = "idle" }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    ref.current.rotation.z = t * 0.2;
    ref.current.rotation.y = Math.sin(t * 0.4) * 0.3;

    // Visibility pulse
    if (aiStatus === "thinking") {
      ref.current.material.opacity = 0.3 + Math.sin(t * 4) * 0.2;
    } else if (aiStatus === "speaking") {
      ref.current.material.opacity = 0.5;
    } else {
      ref.current.material.opacity = 0.15;
    }
  });

  const color =
    aiStatus === "speaking"
      ? "#10b981"
      : aiStatus === "thinking"
        ? "#f59e0b"
        : "#8b5cf6";

  return (
    <mesh ref={ref}>
      <torusGeometry args={[2.2, 0.015, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} />
    </mesh>
  );
}

// ============= Main 3D Scene ===============
function AvatarScene({
  aiStatus = "idle",
  isMuted = false,
  visionEnabled = false,
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#a78bfa" />
      <pointLight position={[-10, -5, 5]} intensity={0.5} color="#60a5fa" />
      <pointLight position={[0, -10, -10]} intensity={0.3} color="#34d399" />

      {/* Avatar */}
      <AvatarOrb
        aiStatus={aiStatus}
        isMuted={isMuted}
        visionEnabled={visionEnabled}
      />

      {/* Particles */}
      <OrbitalParticles count={60} aiStatus={aiStatus} />

      {/* Status rings */}
      <StatusRing aiStatus={aiStatus} />

      {/* Camera controls - disabled rotation for cleaner UX */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        autoRotate={false}
      />
    </>
  );
}

// ============= Exported Component ===============
export default function Avatar3D({
  aiStatus = "idle",
  isMuted = false,
  isInCall = false,
  visionEnabled = false,
  className = "",
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ width: "100%", height: "100%", minHeight: "200px" }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        style={{
          background: "transparent",
          borderRadius: "1rem",
        }}
        gl={{ alpha: true, antialias: true }}
      >
        <AvatarScene
          aiStatus={isInCall ? aiStatus : "idle"}
          isMuted={isMuted}
          visionEnabled={visionEnabled}
        />
      </Canvas>

      {/* Overlay gradient for blending with background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background:
            "radial-gradient(circle at center, transparent 40%, hsl(var(--background)) 85%)",
        }}
      />
    </div>
  );
}
