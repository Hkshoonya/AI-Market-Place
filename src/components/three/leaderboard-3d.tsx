"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

interface LeaderboardModel {
  name: string;
  quality: number;
  provider: string;
  rank: number;
}

interface LeaderboardBarProps {
  model: LeaderboardModel;
  index: number;
  total: number;
  onHover: (model: LeaderboardModel | null) => void;
  isHovered: boolean;
}

function LeaderboardBar({ model, index, total, onHover, isHovered }: LeaderboardBarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const targetHeight = useRef(0);
  const currentHeight = useRef(0);

  // Position bars in a curved arc
  const position = useMemo(() => {
    const angle = ((index - total / 2) / total) * Math.PI * 0.8;
    const radius = 6;
    return new THREE.Vector3(
      Math.sin(angle) * radius,
      0,
      Math.cos(angle) * radius - radius
    );
  }, [index, total]);

  // Height based on quality score (normalized 0-100 to 0-4)
  const height = model.quality / 25;
  targetHeight.current = height;

  // Color based on rank
  const color = useMemo(() => {
    if (model.rank === 1) return "#FFD700"; // Gold
    if (model.rank === 2) return "#C0C0C0"; // Silver
    if (model.rank === 3) return "#CD7F32"; // Bronze
    return "#00d4aa"; // Neon green
  }, [model.rank]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Spring animation for height
    currentHeight.current += (targetHeight.current - currentHeight.current) * delta * 3;
    meshRef.current.scale.y = Math.max(currentHeight.current, 0.01);
    meshRef.current.position.y = currentHeight.current / 2;

    // Glow pulse on hover
    if (glowRef.current) {
      const glowScale = isHovered ? 1.3 : 1.0;
      glowRef.current.scale.x += (glowScale - glowRef.current.scale.x) * delta * 5;
      glowRef.current.scale.z += (glowScale - glowRef.current.scale.z) * delta * 5;
      glowRef.current.scale.y = meshRef.current.scale.y;
      glowRef.current.position.y = meshRef.current.position.y;
    }
  });

  return (
    <group position={position}>
      {/* Glow effect behind bar */}
      <mesh ref={glowRef}>
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isHovered ? 0.15 : 0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main bar */}
      <mesh
        ref={meshRef}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(model); }}
        onPointerLeave={() => onHover(null)}
      >
        <boxGeometry args={[0.35, 1, 0.35]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.4 : 0.15}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Rank number on top */}
      <Text
        position={[0, height + 0.3, 0]}
        fontSize={0.2}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        #{model.rank}
      </Text>

      {/* Model name below */}
      <Text
        position={[0, -0.3, 0]}
        fontSize={0.12}
        color="#888"
        anchorX="center"
        anchorY="middle"
        maxWidth={1}
      >
        {model.name.length > 12 ? model.name.slice(0, 12) + "\u2026" : model.name}
      </Text>
    </group>
  );
}

function Scene({ data, onHover, hoveredModel }: {
  data: LeaderboardModel[];
  onHover: (model: LeaderboardModel | null) => void;
  hoveredModel: LeaderboardModel | null;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && !hoveredModel) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 8, 20]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 8, 5]} intensity={1} color="#00d4aa" />
      <pointLight position={[-5, 6, -5]} intensity={0.5} color="#ffffff" />

      <group ref={groupRef}>
        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial
            color="#050505"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>

        {/* Grid lines on the ground */}
        <gridHelper args={[14, 14, "#111111", "#0a0a0a"]} position={[0, 0, 0]} />

        {data.map((model, i) => (
          <LeaderboardBar
            key={model.name}
            model={model}
            index={i}
            total={data.length}
            onHover={onHover}
            isHovered={hoveredModel?.name === model.name}
          />
        ))}
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        autoRotate={!hoveredModel}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

export function Leaderboard3D({ data }: { data: LeaderboardModel[] }) {
  const [hoveredModel, setHoveredModel] = useState<LeaderboardModel | null>(null);

  if (!data || data.length === 0) return null;

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-border/30">
      <Canvas
        camera={{ position: [0, 5, 8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <Scene data={data} onHover={setHoveredModel} hoveredModel={hoveredModel} />
      </Canvas>

      {/* Tooltip overlay */}
      {hoveredModel && (
        <div className="absolute top-4 right-4 rounded-lg border border-border/50 bg-black/80 backdrop-blur-md px-4 py-3 pointer-events-none">
          <p className="text-sm font-bold text-white">{hoveredModel.name}</p>
          <p className="text-xs text-muted-foreground">{hoveredModel.provider}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold text-neon tabular-nums">
              {hoveredModel.quality.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">quality score</span>
          </div>
        </div>
      )}

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
}
