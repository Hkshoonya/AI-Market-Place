"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneContent } from "./scene-content";
import { getScenePerformanceProfile } from "./scene-performance";

function getInitialQualityBias() {
  if (typeof navigator === "undefined") {
    return 1;
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const hardware = navigator.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;

  if (hardware >= 8 && memory >= 8) return 1;
  if (hardware >= 6 && memory >= 4) return 0.85;
  return 0.65;
}

export function NeuralNetworkScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const scrollingRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const qualityBias = useMemo(() => getInitialQualityBias(), []);

  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0.18),
      { threshold: [0, 0.18, 0.35, 0.6] }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollingRef.current) {
        scrollingRef.current = true;
        setIsScrolling(true);
      }
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollingRef.current = false;
        setIsScrolling(false);
        scrollTimeoutRef.current = null;
      }, 140);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const profile = getScenePerformanceProfile({
    isVisible,
    isScrolling,
    prefersReducedMotion,
    qualityBias,
  });

  if (!profile.shouldAnimate) {
    return (
      <div
        ref={containerRef}
        data-testid="neural-network-scene"
        className="absolute inset-0 z-0 overflow-hidden bg-[#000000]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,170,0.16),rgba(0,0,0,0)_70%)]" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-0" data-testid="neural-network-scene">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 100 }}
        dpr={[1, profile.targetDpr]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "default",
        }}
        style={{ background: "#000000" }}
      >
        <Suspense fallback={null}>
          <SceneContent
            connectionBudget={profile.connectionBudget}
            connectionRefreshStride={profile.connectionRefreshStride}
            simulationStride={profile.simulationStride}
            isScrolling={isScrolling}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
