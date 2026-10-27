import React, { useState } from 'react';
import { Play, Pause, CheckCircle, XCircle, Flame, Sparkles, Timer, Hourglass, FastForward } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import { useCountdown } from '../../context/CountdownContext';
import { TimerRing } from '../TimerRing';

export const FloorControl: React.FC = () => {
  const {
    queue,
    activeSpeaker,
    speakerBuffer,
    settings,
    startSpeaker,
    skipBuffer,
    cancelBuffer,
    pauseTimer,
    resumeTimer,
    addTime,
    setSpeakerTimer,
    finishCurrentSpeaker,
    getParticipantTotalSpokenSeconds,
    getParticipantTurnCount,
  } = useMeeting();
  const { speakerSeconds, bufferSeconds } = useCountdown();

  const [customActiveMins, setCustomActiveMins] = useState<string>('2');
  const [customActiveSecs, setCustomActiveSecs] = useState<string>('0');
  const [showCustomActiveInput, setShowCustomActiveInput] = useState<boolean>(false);

  const handleApplyCustomActiveTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customActiveMins, 10) || 0;
    const secs = parseInt(customActiveSecs, 10) || 0;
    const totalSecs = mins * 60 + secs;
    if (totalSecs > 0) {
      setSpeakerTimer(totalSecs);
      setShowCustomActiveInput(false);
    }
  };

  // Active speaker, transition buffer or open floor, with the timer controls.
  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Flame className="w-64 h-64 text-indigo-400" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">

        {/* TRANSITION BUFFER HERO CARD */}
        {speakerBuffer ? (
          <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-between gap-6 animate-fadeIn">
            <div className="text-center md:text-left space-y-3">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-500/30 animate-pulse">
                  <Hourglass className="w-4 h-4 animate-spin" /> Transition Buffer (10s)
                </span>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-4">
                <span className="text-4xl p-3 bg-slate-900 rounded-2xl border border-amber-500/40 shadow-2xl">
                  {speakerBuffer.queueItem.participant.avatar}
                </span>
                <div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {speakerBuffer.queueItem.participant.name}
                  </h2>
                  <p className="text-xs text-indigo-300 font-mono mt-1">
                    Total Session Spoken:{' '}
                    {Math.floor(
                      getParticipantTotalSpokenSeconds(
                        speakerBuffer.queueItem.participant.id,
                        speakerBuffer.queueItem.participant.name
                      ) / 60
                    )}
                    m{' '}
                    {getParticipantTotalSpokenSeconds(
                      speakerBuffer.queueItem.participant.id,
                      speakerBuffer.queueItem.participant.name
                    ) % 60}
                    s
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="w-32 h-32 rounded-full border-4 border-amber-500/40 flex items-center justify-center bg-slate-950/80 shadow-2xl shadow-amber-500/20 animate-pulse">
                <span className="font-mono font-black text-4xl text-amber-400">
                  {bufferSeconds}s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={skipBuffer}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-colors"
                >
                  <FastForward className="w-4 h-4" /> Start Now
                </button>
                <button
                  onClick={cancelBuffer}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD ACTIVE SPEAKER OR OPEN FLOOR CARD */
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
                <Sparkles className="w-4 h-4" /> Live Floor Control
              </span>
              {settings.autoAdvance && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-500/30">
                  ⚡ Auto-Advance ON
                </span>
              )}
              {settings.bufferSeconds > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold border border-amber-500/30">
                  ⏳ {settings.bufferSeconds}s Buffer ON
                </span>
              )}
            </div>

            {activeSpeaker ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <span className="text-4xl p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
                    {activeSpeaker.queueItem.participant.avatar}
                  </span>
                  <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">
                      {activeSpeaker.queueItem.participant.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs">
                      {activeSpeaker.queueItem.note && (
                        <span className="text-slate-300 italic">"{activeSpeaker.queueItem.note}"</span>
                      )}
                      <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 rounded-md font-mono border border-indigo-500/30">
                        Total Session Spoken:{' '}
                        {Math.floor(
                          getParticipantTotalSpokenSeconds(
                            activeSpeaker.queueItem.participant.id,
                            activeSpeaker.queueItem.participant.name
                          ) / 60
                        )}
                        m{' '}
                        {getParticipantTotalSpokenSeconds(
                          activeSpeaker.queueItem.participant.id,
                          activeSpeaker.queueItem.participant.name
                        ) % 60}
                        s (
                        {getParticipantTurnCount(
                          activeSpeaker.queueItem.participant.id,
                          activeSpeaker.queueItem.participant.name
                        )}{' '}
                        prior turns)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-slate-400 font-semibold mr-1">Quick Add:</span>
                    <button
                      onClick={() => addTime(30)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                    >
                      +30s
                    </button>
                    <button
                      onClick={() => addTime(60)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                    >
                      +1 min
                    </button>
                    <button
                      onClick={() => addTime(-30)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                    >
                      -30s
                    </button>
                    <button
                      onClick={() => setShowCustomActiveInput(!showCustomActiveInput)}
                      className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-500/40 transition-colors flex items-center gap-1"
                    >
                      <Timer className="w-3.5 h-3.5" /> Custom Timer
                    </button>
                  </div>

                  {showCustomActiveInput && (
                    <form
                      onSubmit={handleApplyCustomActiveTimer}
                      className="flex items-center justify-center md:justify-start gap-2 p-3 bg-slate-900/90 rounded-2xl border border-indigo-500/30 animate-fadeIn max-w-md"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={customActiveMins}
                          onChange={(e) => setCustomActiveMins(e.target.value)}
                          className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-center text-sm text-white font-mono"
                        />
                        <span className="text-xs text-slate-400">m</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={customActiveSecs}
                          onChange={(e) => setCustomActiveSecs(e.target.value)}
                          className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-center text-sm text-white font-mono"
                        />
                        <span className="text-xs text-slate-400">s</span>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow"
                      >
                        Set Timer
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-slate-300">No Active Speaker Right Now</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {queue.length > 0
                    ? `Click "Start Speaker" to transition to ${queue[0].participant.name}`
                    : 'Queue is currently empty. Invite participants using the QR code.'}
                </p>
                {queue.length > 0 && (
                  <button
                    onClick={() => startSpeaker()}
                    className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" /> Start Next Speaker ({queue[0].participant.name})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeSpeaker && !speakerBuffer && (
          <div className="flex flex-col items-center gap-4 shrink-0">
            <TimerRing
              remainingSeconds={speakerSeconds}
              totalSeconds={activeSpeaker.totalDurationSeconds}
              isPaused={activeSpeaker.isPaused}
              size={210}
            />

            <div className="flex items-center gap-2">
              {activeSpeaker.isPaused ? (
                <button
                  onClick={resumeTimer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/30 transition-colors"
                >
                  <Pause className="w-4 h-4 fill-current" /> Pause
                </button>
              )}

              <button
                onClick={() => finishCurrentSpeaker('completed', settings.autoAdvance)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Next Turn
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
