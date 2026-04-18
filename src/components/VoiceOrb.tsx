'use client';

import { useEffect, useState } from 'react';

interface VoiceOrbProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  volume: number;
}

export default function VoiceOrb({ status, volume }: VoiceOrbProps) {
  const [glowScale, setGlowScale] = useState(1);

  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      const targetScale = 1 + (volume / 255) * 1.5;
      setGlowScale(targetScale);
    } else {
      setGlowScale(1);
    }
  }, [volume, status]);

  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'from-indigo-600 via-purple-500 to-cyan-400';
      case 'speaking': return 'from-orange-600 via-red-500 to-amber-400';
      case 'processing': return 'from-amber-600 via-yellow-500 to-orange-400';
      default: return 'from-slate-700 via-slate-600 to-slate-800';
    }
  };

  const getGlowColor = () => {
    switch (status) {
      case 'listening': return 'bg-indigo-400';
      case 'speaking': return 'bg-orange-400';
      case 'processing': return 'bg-amber-400';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <style jsx>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        .anim-rotate {
          animation: rotate 10s linear infinite;
        }
        .anim-rotate-fast {
          animation: rotate 2s linear infinite;
        }
        .anim-pulse {
          animation: pulse 3s ease-in-out infinite;
        }
        .waveform-bar {
          transition: height 0.1s ease-out;
        }
      `}</style>

      {/* Background Glow Layer */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${getGlowColor()} ${status === 'idle' ? 'anim-pulse' : ''}`}
        style={{ 
          transform: `scale(${glowScale})`,
          opacity: status === 'idle' ? 0.2 : 0.4
        }}
      />

      {/* Main Siri-style Orb */}
      <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-2xl border-4 border-white/5 transition-transform duration-500 hover:scale-105">
        {/* Colorful Gradient Rotating Background */}
        <div 
          className={`absolute -inset-[50%] bg-gradient-to-tr transition-colors duration-700 ${getStatusColor()} ${status === 'processing' ? 'anim-rotate-fast' : 'anim-rotate'}`}
        />

        {/* Dynamic Waveform Over Orb */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-8">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-white/80 waveform-bar"
              style={{
                height: status === 'listening' || status === 'speaking' 
                  ? `${Math.max(10, (volume / (i + 1)) * 3)}%` 
                  : '4px',
                opacity: status === 'idle' ? 0.2 : 1,
                transitionDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>

        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      </div>

      {/* Outer Rotating Ring (Processing Only) */}
      {status === 'processing' && (
        <div className="absolute -inset-4 border-2 border-dashed border-amber-400/40 rounded-full anim-rotate" />
      )}

      {/* Status Label */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 opacity-60">
          {status === 'idle' ? 'Ready' : 
           status === 'listening' ? 'Listening' : 
           status === 'processing' ? 'Thinking' : 'Speaking'}
        </p>
      </div>
    </div>
  );
}
