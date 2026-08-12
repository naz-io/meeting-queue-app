import React from 'react';
import { useMeeting } from '../context/MeetingContext';
import { QRCodeSVG } from 'qrcode.react';
import { TimerRing } from './TimerRing';
import { Sparkles, Users, QrCode, Hourglass } from 'lucide-react';
import { getJoinUrl } from '../utils/joinUrl';

export const StageView: React.FC = () => {
  const { roomName, roomCode, activeSpeaker, speakerBuffer, queue } = useMeeting();

  const joinUrl = getJoinUrl(roomCode);

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

        {/* UPCOMING QUEUE + CORNER QR CODE SIDEBAR */}
        <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex-1 flex flex-col">
            <h3 className="text-base font-bold text-white mb-4 flex items-center justify-between">
              <span>Next Up ({queue.length})</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </h3>

            {queue.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                No speakers currently in queue.
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[340px] pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                      idx === 0
                        ? 'bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border-indigo-500/50 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center font-mono font-bold text-xs text-slate-400">
                        #{idx + 1}
                      </span>
                      <span className="text-2xl shrink-0">{item.participant.avatar}</span>
                      <div className="truncate">
                        <h4 className="font-bold text-sm truncate">{item.participant.name}</h4>
                        {item.note && <p className="text-xs text-slate-400 truncate italic">{item.note}</p>}
                      </div>
                    </div>

                    {idx === 0 && (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Up Next
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
