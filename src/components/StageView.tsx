import React from 'react';
import { useMeeting } from '../context/MeetingContext';
import { QRCodeSVG } from 'qrcode.react';
import { TimerRing } from './TimerRing';
import { Sparkles, Users, QrCode, Hourglass, Mic, ArrowRight, ListOrdered } from 'lucide-react';
import { getJoinUrl } from '../utils/joinUrl';

export const StageView: React.FC = () => {
  const { roomName, roomCode, activeSpeaker, speakerBuffer, queue } = useMeeting();

  const joinUrl = getJoinUrl(roomCode);
  const upNext = speakerBuffer?.queueItem ?? queue[0] ?? null;
  const remainingQueue = speakerBuffer ? queue : queue.slice(upNext ? 1 : 0);
  const waitingCount = remainingQueue.length + (upNext ? 1 : 0);

  return (
    <div className="min-h-[85vh] flex flex-col justify-between p-0 sm:p-4 lg:p-8 space-y-4 sm:space-y-8 max-w-7xl mx-auto">
      {/* 1. STAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 sm:p-6 rounded-3xl border border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight break-words">{roomName}</h1>
          </div>
          <p className="text-xs lg:text-sm text-slate-400 mt-1">Live Presentation Display & Speaker Stage</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left sm:text-right">
            <span className="text-xs uppercase tracking-widest text-slate-400 block font-semibold">Session ID</span>
            <span className="font-mono text-lg font-bold text-indigo-400">{roomCode}</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN STAGE CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* ACTIVE / BUFFER SPEAKER MAIN COLUMN (8 COLS) */}
        <div className="lg:col-span-8 glass-panel p-4 sm:p-8 rounded-3xl border border-indigo-500/20 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* 10-SECOND TRANSITION BUFFER ON STAGE */}
          {speakerBuffer ? (
            <div className="space-y-6 w-full max-w-lg animate-fadeIn">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 text-amber-300 rounded-full text-sm font-bold uppercase tracking-wider border border-amber-500/30 animate-pulse">
                <Hourglass className="w-5 h-5 animate-spin" /> Get Ready — Transition Buffer
              </div>

              <div className="space-y-2">
                <span className="inline-block text-7xl p-5 bg-slate-900/90 rounded-3xl border border-amber-500/30 shadow-2xl">
                  {speakerBuffer.queueItem.participant.avatar}
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight break-words">
                  {speakerBuffer.queueItem.participant.name}
                </h2>
                {speakerBuffer.queueItem.note && (
                  <p className="text-lg text-slate-300 italic font-serif">"{speakerBuffer.queueItem.note}"</p>
                )}
              </div>

              {/* Giant Buffer Countdown Ring */}
              <div className="flex justify-center my-6">
                <div className="w-56 h-56 rounded-full border-8 border-amber-500/30 flex items-center justify-center bg-slate-950/80 shadow-2xl shadow-amber-500/20 animate-pulse">
                  <div className="text-center">
                    <span className="font-mono font-black text-7xl text-amber-400">
                      {speakerBuffer.remainingBufferSeconds}
                    </span>
                    <span className="block text-xs uppercase tracking-widest text-slate-400 mt-1 font-bold">
                      Seconds
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-400">Please take the microphone. Speech starts automatically.</p>
            </div>
          ) : activeSpeaker ? (
            /* ACTIVE SPEAKER ON STAGE */
            <div className="space-y-6 w-full max-w-lg">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-bold uppercase tracking-wider border border-emerald-500/20 animate-pulse">
                Current Floor Speaker
              </div>

              <div className="space-y-2">
                <span className="inline-block text-6xl p-4 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl">
                  {activeSpeaker.queueItem.participant.avatar}
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight break-words">
                  {activeSpeaker.queueItem.participant.name}
                </h2>
                {activeSpeaker.queueItem.note && (
                  <p className="text-lg text-slate-300 italic font-serif">"{activeSpeaker.queueItem.note}"</p>
                )}
              </div>

              <div className="flex justify-center my-4">
                <TimerRing
                  remainingSeconds={activeSpeaker.remainingSeconds}
                  totalSeconds={activeSpeaker.totalDurationSeconds}
                  isPaused={activeSpeaker.isPaused}
                  size={300}
                  strokeWidth={16}
                />
              </div>
            </div>
          ) : (
            /* OPEN FLOOR */
            <div className="space-y-4 max-w-md">
              <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Users className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-white">Floor is Open</h2>
              <p className="text-slate-400 text-sm">
                Scan the QR code on screen to raise your hand and speak during the session.
              </p>
            </div>
          )}
        </div>

        {/* SPEAKING ORDER + CORNER QR CODE SIDEBAR */}
        <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-slate-800 flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 px-1" aria-live="polite">
              <h2 className="text-sm font-bold text-white">Speaking Order</h2>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
                {waitingCount} {waitingCount === 1 ? 'person' : 'people'} waiting to speak
              </span>
            </div>

            <section
              className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-950/30 p-4 shadow-lg shadow-emerald-950/30"
              aria-labelledby="speaking-now-heading"
              aria-live="polite"
            >
              <h3
                id="speaking-now-heading"
                className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300"
              >
                <span className="relative flex h-2.5 w-2.5">
                  {activeSpeaker && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <Mic className="h-4 w-4" /> Speaking Now
              </h3>

              {activeSpeaker ? (
                <div className="flex items-center gap-3">
                  <span className="shrink-0 rounded-xl border border-emerald-500/30 bg-slate-950/70 p-2 text-3xl">
                    {activeSpeaker.queueItem.participant.avatar}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-white">
                      {activeSpeaker.queueItem.participant.name}
                    </p>
                    {activeSpeaker.queueItem.note && (
                      <p className="truncate text-xs italic text-slate-300">{activeSpeaker.queueItem.note}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-slate-300">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
                    <Mic className="h-5 w-5 text-slate-500" />
                  </span>
                  <div>
                    <p className="font-bold text-white">No one is speaking</p>
                    <p className="text-xs text-slate-400">
                      {speakerBuffer ? 'The next speaker is getting ready.' : 'The floor is currently open.'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section
              className="rounded-2xl border-2 border-amber-500/60 bg-amber-950/25 p-4"
              aria-labelledby="up-next-heading"
              aria-live="polite"
            >
              <h3
                id="up-next-heading"
                className="mb-3 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-300"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" /> {speakerBuffer ? 'Starting Next' : 'Up Next'}
                </span>
                {speakerBuffer && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] tracking-normal">
                    {speakerBuffer.remainingBufferSeconds}s
                  </span>
                )}
              </h3>

              {upNext ? (
                <div className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-amber-300">
                    #1
                  </span>
                  <span className="shrink-0 rounded-xl border border-amber-500/30 bg-slate-950/70 p-2 text-3xl">
                    {upNext.participant.avatar}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold text-white">{upNext.participant.name}</p>
                    {upNext.note && <p className="truncate text-xs italic text-slate-300">{upNext.note}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Waiting for someone to raise their hand.</p>
              )}
            </section>

            <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="queue-heading">
              <h3 id="queue-heading" className="mb-3 flex items-center justify-between text-sm font-bold text-white">
                <span className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-indigo-400" /> Later in Queue
                </span>
              </h3>

              {remainingQueue.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                  No additional speakers waiting.
                </div>
              ) : (
                <div className="max-h-[250px] flex-1 space-y-2 overflow-y-auto pr-1">
                  {remainingQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-slate-300"
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-slate-400">
                        #{idx + 2}
                      </span>
                      <span className="shrink-0 text-2xl">{item.participant.avatar}</span>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold">{item.participant.name}</h4>
                        {item.note && <p className="truncate text-xs italic text-slate-400">{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-indigo-500/20 flex items-center gap-4">
            <div className="bg-white p-2.5 rounded-2xl shrink-0 shadow-lg">
              <QRCodeSVG value={joinUrl} size={90} level="M" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 mb-1">
                <QrCode className="w-4 h-4" /> Scan to Join
              </div>
              <h4 className="text-sm font-bold text-white leading-tight">Raise Hand via Phone</h4>
              <p className="text-xs text-slate-400 mt-1 font-mono">{roomCode}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
