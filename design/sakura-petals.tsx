"use client"

import { useState, useCallback, useEffect } from "react"

// Different petal shape variations
const PETAL_SHAPES = [
  // Classic - original shape
  {
    viewBox: "0 0 40 48",
    path: "M20 2C22 10 30 18 28 28C26 38 20 40 18 36C16 32 14 22 16 14C18 6 19 2 20 2Z",
    gradientCx: "40%",
    gradientCy: "35%",
    gradientR: "60%",
  },
  // Wind curl - slightly wider sweep
  {
    viewBox: "0 0 40 48",
    path: "M18 2C22 10 32 20 28 32C24 44 16 46 12 38C8 30 8 16 14 8C17 4 17 2 18 2Z",
    gradientCx: "35%",
    gradientCy: "30%",
    gradientR: "65%",
  },
  // Folded - with inner highlight
  {
    viewBox: "0 0 40 48",
    path: "M22 2C28 12 36 24 30 36C24 48 14 46 10 36C6 26 10 10 18 4C20 2 21 2 22 2Z",
    gradientCx: "38%",
    gradientCy: "30%",
    gradientR: "62%",
    innerPath: "M18 6C22 16 28 26 24 36C20 46 14 44 12 36",
  },
  // Veined - with delicate vein lines
  {
    viewBox: "0 0 40 48",
    path: "M20 2C24 10 34 20 30 32C26 44 18 44 14 36C10 28 12 12 18 4C19 2 19.5 2 20 2Z",
    gradientCx: "42%",
    gradientCy: "32%",
    gradientR: "58%",
    veins: [
      { d: "M19 8C19 8 18 22 17 34", strokeWidth: 0.8, opacity: 0.6 },
      { d: "M19 16L14 26", strokeWidth: 0.5, opacity: 0.4 },
      { d: "M19 16L24 28", strokeWidth: 0.5, opacity: 0.4 },
    ],
  },
]

interface PetalConfig {
  id: number
  startX: number
  size: number
  fallDuration: number
  swayAmplitude: number
  rotationSpeed: number
  startDelay: number
  opacity: number
  rotateXStart: number
  rotateYStart: number
  rotateZStart: number
  shapeIndex: number
}

function generatePetalConfig(id: number): PetalConfig {
  return {
    id,
    startX: Math.random() * 100,
    size: 16 + Math.random() * 16,
    fallDuration: 6 + Math.random() * 6,
    swayAmplitude: 40 + Math.random() * 80,
    rotationSpeed: 0.5 + Math.random() * 1.5,
    startDelay: Math.random() * 5,
    opacity: 0.4 + Math.random() * 0.4,
    rotateXStart: Math.random() * 360,
    rotateYStart: Math.random() * 360,
    rotateZStart: Math.random() * 360,
    shapeIndex: Math.floor(Math.random() * PETAL_SHAPES.length),
  }
}

function Petal({ config, onAnimationEnd }: { config: PetalConfig; onAnimationEnd: () => void }) {
  const shape = PETAL_SHAPES[config.shapeIndex]
  
  const cssVars = {
    "--start-x": `${config.startX}vw`,
    "--size": `${config.size}px`,
    "--fall-duration": `${config.fallDuration}s`,
    "--sway-amplitude": `${config.swayAmplitude}px`,
    "--rotation-speed": config.rotationSpeed,
    "--start-delay": `${config.startDelay}s`,
    "--opacity": config.opacity,
    "--rotate-x-start": `${config.rotateXStart}deg`,
    "--rotate-y-start": `${config.rotateYStart}deg`,
    "--rotate-z-start": `${config.rotateZStart}deg`,
  } as React.CSSProperties

  return (
    <div
      className="petal-wrapper"
      style={cssVars}
      onAnimationEnd={onAnimationEnd}
    >
      <svg
        className="petal"
        viewBox={shape.viewBox}
        style={{ width: "var(--size)", height: "var(--size)" }}
      >
        <defs>
          <radialGradient 
            id={`petalGradient-${config.id}`} 
            cx={shape.gradientCx} 
            cy={shape.gradientCy} 
            r={shape.gradientR}
          >
            <stop offset="0%" stopColor="#FFD4DE" />
            <stop offset="100%" stopColor="#FFB7C5" />
          </radialGradient>
          <radialGradient 
            id={`petalGradientBack-${config.id}`} 
            cx={shape.gradientCx} 
            cy={shape.gradientCy} 
            r={shape.gradientR}
          >
            <stop offset="0%" stopColor="#FFB7C5" />
            <stop offset="100%" stopColor="#FFA8B8" />
          </radialGradient>
          {shape.innerPath && (
            <radialGradient 
              id={`petalInnerGradient-${config.id}`} 
              cx="38%" 
              cy="30%" 
              r="60%"
            >
              <stop offset="0%" stopColor="#FFE8EE" />
              <stop offset="100%" stopColor="#FFCCD6" />
            </radialGradient>
          )}
        </defs>
        {/* Front face */}
        <path
          d={shape.path}
          fill={`url(#petalGradient-${config.id})`}
          className="petal-front"
        />
        {/* Inner highlight for folded petal */}
        {shape.innerPath && (
          <path
            d={shape.innerPath}
            fill={`url(#petalInnerGradient-${config.id})`}
            opacity="0.5"
          />
        )}
        {/* Vein lines for veined petal */}
        {shape.veins?.map((vein, i) => (
          <path
            key={i}
            d={vein.d}
            stroke="#FFD4DE"
            strokeWidth={vein.strokeWidth}
            opacity={vein.opacity}
            fill="none"
          />
        ))}
        {/* Back face - slightly darker */}
        <path
          d={shape.path}
          fill={`url(#petalGradientBack-${config.id})`}
          className="petal-back"
        />
      </svg>
    </div>
  )
}

export default function SakuraPetals() {
  const [petals, setPetals] = useState<PetalConfig[]>([])

  useEffect(() => {
    const petalCount = 3 + Math.floor(Math.random() * 3) // 3-5 petals
    const initialPetals = Array.from({ length: petalCount }, (_, i) =>
      generatePetalConfig(i)
    )
    setPetals(initialPetals)
  }, [])

  const handleAnimationEnd = useCallback((id: number) => {
    setPetals((prev) =>
      prev.map((petal) =>
        petal.id === id ? generatePetalConfig(id) : petal
      )
    )
  }, [])

  return (
    <div className="sakura-container">
      <style>{`
        .sakura-container {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          perspective: 800px;
          perspective-origin: 50% 50%;
          z-index: 50;
        }

        .petal-wrapper {
          position: absolute;
          left: var(--start-x);
          top: -50px;
          transform-style: preserve-3d;
          backface-visibility: visible;
          animation: petalFall var(--fall-duration) linear var(--start-delay) forwards;
        }

        .petal {
          transform-style: preserve-3d;
          backface-visibility: visible;
          animation: petalTumble calc(var(--fall-duration) / var(--rotation-speed)) linear var(--start-delay) infinite;
        }

        .petal-front {
          backface-visibility: visible;
        }

        .petal-back {
          backface-visibility: visible;
        }

        @keyframes petalFall {
          0% {
            transform: 
              translateY(0)
              translateX(0)
              rotateX(var(--rotate-x-start))
              rotateY(var(--rotate-y-start))
              rotateZ(var(--rotate-z-start));
            opacity: var(--opacity);
          }
          10% {
            transform: 
              translateY(10vh)
              translateX(calc(sin(36deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 36deg))
              rotateY(calc(var(--rotate-y-start) + 72deg))
              rotateZ(calc(var(--rotate-z-start) + 36deg));
            opacity: var(--opacity);
          }
          20% {
            transform: 
              translateY(20vh)
              translateX(calc(sin(72deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 72deg))
              rotateY(calc(var(--rotate-y-start) + 144deg))
              rotateZ(calc(var(--rotate-z-start) + 72deg));
            opacity: var(--opacity);
          }
          30% {
            transform: 
              translateY(30vh)
              translateX(calc(sin(108deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 108deg))
              rotateY(calc(var(--rotate-y-start) + 216deg))
              rotateZ(calc(var(--rotate-z-start) + 108deg));
            opacity: var(--opacity);
          }
          40% {
            transform: 
              translateY(40vh)
              translateX(calc(sin(144deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 144deg))
              rotateY(calc(var(--rotate-y-start) + 288deg))
              rotateZ(calc(var(--rotate-z-start) + 144deg));
            opacity: var(--opacity);
          }
          50% {
            transform: 
              translateY(50vh)
              translateX(calc(sin(180deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 180deg))
              rotateY(calc(var(--rotate-y-start) + 360deg))
              rotateZ(calc(var(--rotate-z-start) + 180deg));
            opacity: var(--opacity);
          }
          60% {
            transform: 
              translateY(60vh)
              translateX(calc(sin(216deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 216deg))
              rotateY(calc(var(--rotate-y-start) + 432deg))
              rotateZ(calc(var(--rotate-z-start) + 216deg));
            opacity: var(--opacity);
          }
          70% {
            transform: 
              translateY(70vh)
              translateX(calc(sin(252deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 252deg))
              rotateY(calc(var(--rotate-y-start) + 504deg))
              rotateZ(calc(var(--rotate-z-start) + 252deg));
            opacity: var(--opacity);
          }
          80% {
            transform: 
              translateY(80vh)
              translateX(calc(sin(288deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 288deg))
              rotateY(calc(var(--rotate-y-start) + 576deg))
              rotateZ(calc(var(--rotate-z-start) + 288deg));
            opacity: var(--opacity);
          }
          100% {
            transform: 
              translateY(110vh)
              translateX(calc(sin(360deg) * var(--sway-amplitude)))
              rotateX(calc(var(--rotate-x-start) + 360deg))
              rotateY(calc(var(--rotate-y-start) + 720deg))
              rotateZ(calc(var(--rotate-z-start) + 360deg));
            opacity: 0;
          }
        }

        @keyframes petalTumble {
          0% {
            transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          25% {
            transform: rotateX(90deg) rotateY(180deg) rotateZ(45deg);
          }
          50% {
            transform: rotateX(180deg) rotateY(360deg) rotateZ(90deg);
          }
          75% {
            transform: rotateX(270deg) rotateY(540deg) rotateZ(135deg);
          }
          100% {
            transform: rotateX(360deg) rotateY(720deg) rotateZ(180deg);
          }
        }
      `}</style>
      {petals.map((petal) => (
        <Petal
          key={petal.id}
          config={petal}
          onAnimationEnd={() => handleAnimationEnd(petal.id)}
        />
      ))}
    </div>
  )
}
