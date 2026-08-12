import React from 'react';

interface TimerRingProps {
  remainingSeconds: number;
  totalSeconds: number;
  isPaused?: boolean;
  size?: number; // Size in pixels
  strokeWidth?: number;
}

export const TimerRing: React.FC<TimerRingProps> = ({
  remainingSeconds,
  totalSeconds,
  isPaused = false,
  size = 220,
  strokeWidth = 12,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Determine color based on time left
  let colorClass = 'text-indigo-500 stroke-indigo-500';
  let glowClass = 'timer-active-glow';

  if (remainingSeconds <= 10) {
    colorClass = 'text-red-500 stroke-red-500';
    glowClass = 'timer-urgent-glow';
  } else if (remainingSeconds <= 30) {
    colorClass = 'text-amber-400 stroke-amber-400';
  }

  return (
    <div className={`relative flex flex-col items-center justify-center rounded-full p-2 max-w-full ${glowClass}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 max-w-full h-auto">
        {/* Background Track Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-800"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`transition-all duration-1000 ease-linear ${colorClass}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Center Digital Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-mono font-bold tracking-tight ${size > 250 ? 'text-6xl' : 'text-4xl'} ${remainingSeconds <= 10 ? 'text-red-400 animate-pulse' : 'text-slate-100'}`}>
          {formattedTime}
        </span>
        <span className="text-xs uppercase tracking-widest text-slate-400 mt-1">
          {isPaused ? 'Paused' : remainingSeconds === 0 ? 'Time Up!' : 'Speaking'}
        </span>
      </div>
    </div>
  );
};
