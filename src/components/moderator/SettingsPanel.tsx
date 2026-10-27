import React, { useState } from 'react';
import { Sliders, Trash2 } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import type { SpeakingTimeScope } from '../../../shared/protocol';

export const SettingsPanel: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetSession,
  } = useMeeting();

  const [customDefaultMins, setCustomDefaultMins] = useState<string>(
    Math.floor(settings.defaultTimerSeconds / 60).toString()
  );
  const [customDefaultSecs, setCustomDefaultSecs] = useState<string>(
    (settings.defaultTimerSeconds % 60).toString()
  );

  const [pendingDefaultSeconds, setPendingDefaultSeconds] = useState<number | null>(null);

  const handleSaveDefaultTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customDefaultMins, 10) || 0;
    const secs = parseInt(customDefaultSecs, 10) || 0;
    const totalSecs = mins * 60 + secs;
    if (totalSecs > 0) {
      setPendingDefaultSeconds(Math.min(10_800, totalSecs));
    }
  };

  const applyDefaultTimer = (scope: SpeakingTimeScope) => {
    if (pendingDefaultSeconds === null) return;
    updateSettings({ defaultTimerSeconds: pendingDefaultSeconds }, scope);
    setPendingDefaultSeconds(null);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 max-w-2xl">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Sliders className="w-5 h-5 text-indigo-400" /> Moderator Meeting & Timer Settings
      </h3>

      <div className="space-y-6">
        <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
          <label className="block text-xs font-bold text-white flex items-center gap-2">
            <span>Transition Buffer Duration</span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">
              {settings.bufferSeconds}s ACTIVE
            </span>
          </label>
          <p className="text-xs text-slate-400">
            Grace period buffer before the speaker's main timer starts counting down
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[0, 5, 10, 15, 30].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => updateSettings({ bufferSeconds: sec })}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  settings.bufferSeconds === sec
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {sec === 0 ? 'Disabled (0s)' : `${sec} Secs`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
          <label className="block text-xs font-bold text-white">Default Speaker Timer</label>
          <p className="text-xs text-slate-400">Choose a duration, then choose who it applies to. The active speaker’s timer stays unchanged.</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[60, 120, 180, 300, 600].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setPendingDefaultSeconds(sec);
                  setCustomDefaultMins(Math.floor(sec / 60).toString());
                  setCustomDefaultSecs((sec % 60).toString());
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  settings.defaultTimerSeconds === sec
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {sec < 60 ? `${sec}s` : `${sec / 60} Min`}
              </button>
            ))}
          </div>

          <form onSubmit={handleSaveDefaultTimer} className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-xs text-slate-300 font-medium shrink-0">Custom Duration:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="180"
                aria-label="Default speaking time minutes"
                value={customDefaultMins}
                onChange={(e) => setCustomDefaultMins(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400 font-medium">mins</span>
              <input
                type="number"
                min="0"
                max="59"
                aria-label="Default speaking time seconds"
                value={customDefaultSecs}
                onChange={(e) => setCustomDefaultSecs(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400 font-medium">secs</span>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-colors"
            >
              Choose Duration
            </button>
          </form>

          {pendingDefaultSeconds !== null && (
            <div role="group" aria-label="Apply speaking time" className="space-y-3 p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10">
              <p className="text-sm font-semibold text-white" aria-live="polite">
                Apply {Math.floor(pendingDefaultSeconds / 60)}m {pendingDefaultSeconds % 60}s speaking time
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => applyDefaultTimer('existing-queue')} className="p-3 text-left rounded-xl border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white">
                  <span className="block text-sm font-bold">Apply to existing queue</span>
                  <span className="block text-xs mt-1">Update everyone waiting and future raised hands.</span>
                </button>
                <button type="button" onClick={() => applyDefaultTimer('from-now-on')} className="p-3 text-left rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 text-white">
                  <span className="block text-sm font-bold">Apply only from now on</span>
                  <span className="block text-xs mt-1">Keep current queue times. Update only future raised hands.</span>
                </button>
              </div>
              <p className="text-xs text-slate-300">The active speaker and anyone already called during the transition buffer keep their time.</p>
              <button type="button" onClick={() => setPendingDefaultSeconds(null)} className="text-xs text-slate-300 hover:text-white underline">Cancel</button>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="space-y-0.5">
            <span className="block text-xs font-bold text-white flex items-center gap-2">
              <span>Auto-Advance Next Speaker</span>
              {settings.autoAdvance && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">
                  ACTIVE
                </span>
              )}
            </span>
            <span className="text-xs text-slate-400 block max-w-md">
              Automatically start next speaker transition buffer when active speaker timer expires
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(e) => updateSettings({ autoAdvance: e.target.checked })}
            className="w-6 h-6 accent-indigo-600 rounded cursor-pointer shrink-0"
          />
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={resetSession}
            className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-bold border border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear Queue & Reset Session
          </button>
        </div>
      </div>
    </div>
  );
};
