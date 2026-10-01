import React, { useRef, useState } from 'react';
import { Flame, Navigation } from 'lucide-react';

interface VirtualJoystickProps {
  onMove: (vector: { x: number; y: number }) => void;
  variant?: 'normal' | 'gamepad';
  screenRotation?: 0 | 90 | -90;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  variant = 'normal',
  screenRotation = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const navIconRef = useRef<SVGSVGElement | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sprintLocked, setSprintLocked] = useState(false);
  const [isSprintingState, setIsSprintingState] = useState(false);
  const isSprintingRef = useRef(false);
  const sprintLockedRef = useRef(false);
  sprintLockedRef.current = sprintLocked;
  const activePointerId = useRef<number | null>(null);

  const maxRadius = variant === 'gamepad' ? 44 : 38;

  const updateVectorFromPoint = (clientX: number, clientY: number) => {
    const rect = cachedRectRef.current || containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;

    // Transform pointer delta into local landscape coordinates if screen is rotated 90° or -90°
    let dx = rawDx;
    let dy = rawDy;
    if (screenRotation === 90) {
      dx = rawDy;
      dy = -rawDx;
    } else if (screenRotation === -90) {
      dx = -rawDy;
      dy = rawDx;
    }

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    const rawMag = clampedDist / maxRadius;
    const isOuterSprint = variant === 'gamepad' && (rawMag > 0.78 || sprintLockedRef.current);
    const effectiveScale = isOuterSprint ? 1.35 : rawMag;

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
    }
    if (navIconRef.current && variant === 'gamepad') {
      const deg = clampedDist > 3 ? (angle * 180) / Math.PI + 45 : -45;
      navIconRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    }
    if (isOuterSprint !== isSprintingRef.current) {
      isSprintingRef.current = isOuterSprint;
      setIsSprintingState(isOuterSprint);
    }

    onMove({
      x: Math.cos(angle) * effectiveScale,
      y: Math.sin(angle) * effectiveScale,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (containerRef.current) {
      cachedRectRef.current = containerRef.current.getBoundingClientRect();
    }
    setIsActive(true);
    updateVectorFromPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateVectorFromPoint(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerId.current = null;
    cachedRectRef.current = null;
    setIsActive(false);
    isSprintingRef.current = false;
    setIsSprintingState(false);
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    if (navIconRef.current) {
      navIconRef.current.style.transform = 'rotate(-45deg)';
    }
    onMove({ x: 0, y: 0 });
  };

  // 1. Original Clean Normal Control (Straight Phone Screen View)
  if (variant === 'normal') {
    return (
      <div className="flex flex-col items-center gap-1.5 select-none pointer-events-auto">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-label="Movement Joystick"
          tabIndex={0}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-150 touch-none cursor-grab active:cursor-grabbing ${
            isActive
              ? 'bg-slate-900/75 border-2 border-amber-400/80 shadow-lg shadow-amber-500/10'
              : 'bg-slate-950/55 border border-white/20 hover:border-white/35'
          } backdrop-blur-md`}
        >
          <span className="absolute top-2 w-1 h-1.5 rounded-full bg-white/25" />
          <span className="absolute bottom-2 w-1 h-1.5 rounded-full bg-white/25" />
          <span className="absolute left-2 w-1.5 h-1 rounded-full bg-white/25" />
          <span className="absolute right-2 w-1.5 h-1 rounded-full bg-white/25" />

          <div className="w-12 h-12 rounded-full border border-white/10 pointer-events-none" />

          <div
            ref={knobRef}
            style={{
              transform: 'translate3d(0px, 0px, 0)',
              willChange: 'transform',
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center pointer-events-none ${
              isActive
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40'
                : 'bg-white/90 text-slate-900 shadow-sm'
            }`}
          >
            <Navigation className="w-4 h-4 -rotate-45" />
          </div>
        </div>
        <span className="text-[11px] font-medium text-white/75 tracking-tight drop-shadow">
          Walk · Tap Ground
        </span>
      </div>
    );
  }

  // 2. Full Gameplay View — Left-Thumb Gamepad Analog Stick
  const isSprinting = isActive && (isSprintingState || sprintLocked);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSprintLocked((prev) => !prev);
        }}
        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight border flex items-center gap-1 transition active:scale-95 ${
          sprintLocked || isSprinting
            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30'
            : 'bg-slate-950/80 text-slate-200 border-white/20 hover:border-white/35'
        }`}
      >
        <Flame className="w-3 h-3" />
        <span>{isSprinting ? 'SPRINTING ⚡' : sprintLocked ? 'SPRINT LOCK' : 'AUTO-SPRINT'}</span>
      </button>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="Gamepad Analog Thumbstick"
        tabIndex={0}
        className={`relative w-30 h-30 rounded-full flex items-center justify-center transition-colors duration-150 touch-none cursor-grab active:cursor-grabbing ${
          isSprinting
            ? 'bg-slate-900/85 border-2 border-amber-400 shadow-xl shadow-amber-500/30'
            : isActive
            ? 'bg-slate-900/80 border-2 border-sky-400 shadow-lg shadow-sky-500/20'
            : 'bg-slate-950/70 border-2 border-white/25 hover:border-white/40'
        } backdrop-blur-md`}
      >
        {/* Outer Sprint Zone Ring */}
        <div
          className={`absolute inset-2 rounded-full border border-dashed pointer-events-none transition-colors ${
            isSprinting ? 'border-amber-400/80' : 'border-white/20'
          }`}
        />

        <span className="absolute top-2 text-[9px] font-bold text-white/45 pointer-events-none">
          ▲
        </span>
        <span className="absolute bottom-2 text-[9px] font-bold text-white/45 pointer-events-none">
          ▼
        </span>
        <span className="absolute left-2 text-[9px] font-bold text-white/45 pointer-events-none">
          ◀
        </span>
        <span className="absolute right-2 text-[9px] font-bold text-white/45 pointer-events-none">
          ▶
        </span>

        {/* Inner Walk Ring */}
        <div className="w-14 h-14 rounded-full border border-white/15 bg-white/[0.04] pointer-events-none" />

        {/* Thumb Analog Stick Cap */}
        <div
          ref={knobRef}
          style={{
            transform: 'translate3d(0px, 0px, 0)',
            willChange: 'transform',
          }}
          className={`w-13 h-13 rounded-full flex items-center justify-center pointer-events-none ${
            isSprinting
              ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-400/50'
              : isActive
              ? 'bg-sky-400 text-slate-950 shadow-md shadow-sky-400/40'
              : 'bg-white/95 text-slate-900 shadow-md'
          }`}
        >
          <Navigation
            ref={navIconRef}
            className="w-4.5 h-4.5"
            style={{
              transform: 'rotate(-45deg)',
            }}
          />
        </div>
      </div>

      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200/90 drop-shadow">
        Left Thumb · Analog Move
      </span>
    </div>
  );
};
