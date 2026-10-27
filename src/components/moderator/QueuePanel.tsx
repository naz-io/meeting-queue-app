import React, { useState } from 'react';
import { Play, XCircle, ArrowUp, ArrowDown, ChevronsUp, Clock, Timer, Mic } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';

export const QueuePanel: React.FC = () => {
  const {
    queue,
    moveQueueItem,
    dismissQueueItem,
    startSpeaker,
    getParticipantTotalSpokenSeconds,
    getParticipantTurnCount,
  } = useMeeting();

  const [targetCallItem, setTargetCallItem] = useState<string | null>(null);
  const [callMins, setCallMins] = useState<string>('2');
  const [callSecs, setCallSecs] = useState<string>('0');

  return (
    <>
      <div className="space-y-4">
        {queue.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">Queue is empty</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No participants currently waiting to speak. Participants can raise hand on their phone by scanning the
              QR code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, idx) => {
              const totalSpoken = getParticipantTotalSpokenSeconds(item.participant.id, item.participant.name);
              const turns = getParticipantTurnCount(item.participant.id, item.participant.name);
              const minsSpoken = Math.floor(totalSpoken / 60);
              const secsSpoken = totalSpoken % 60;

              return (
                <div
                  key={item.id}
                  className="glass-card glass-card-hover p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-indigo-400 font-mono font-bold text-sm border border-slate-800 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-3xl shrink-0 p-1 bg-slate-900 rounded-xl border border-slate-800">
                      {item.participant.avatar}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white text-base truncate">{item.participant.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                          {Math.floor(item.allocatedSeconds / 60)}m {item.allocatedSeconds % 60}s timer
                        </span>

                        {/* CUMULATIVE STAT BADGE FOR MODERATOR */}
                        {totalSpoken > 0 ? (
                          <span className="text-[10px] font-mono bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
                            <Mic className="w-3 h-3 text-indigo-400" />
                            Spoke Before: {minsSpoken}m {secsSpoken}s ({turns} {turns === 1 ? 'turn' : 'turns'})
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            First Turn
                          </span>
                        )}
                      </div>
                      {item.note && <p className="text-xs text-slate-400 truncate italic mt-0.5">"{item.note}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => startSpeaker(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-bold border border-emerald-500/30 transition-colors"
                      title="Call speaker (with transition buffer)"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Call Speaker
                    </button>

                    <button
                      onClick={() => {
                        setTargetCallItem(item.id);
                        setCallMins(Math.floor(item.allocatedSeconds / 60).toString());
                        setCallSecs((item.allocatedSeconds % 60).toString());
                      }}
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-indigo-300 rounded-xl border border-slate-800 transition-colors"
                      title="Set Custom Timer for this Speaker"
                    >
                      <Timer className="w-4 h-4" />
                    </button>

                    <button
                      disabled={idx === 0}
                      onClick={() => moveQueueItem(item.id, 'up')}
                      className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    <button
                      disabled={idx === queue.length - 1}
                      onClick={() => moveQueueItem(item.id, 'down')}
                      className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <button
                      disabled={idx === 0}
                      onClick={() => moveQueueItem(item.id, 'top')}
                      className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-indigo-400 rounded-xl border border-slate-800 transition-colors"
                      title="Move to Top"
                    >
                      <ChevronsUp className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => dismissQueueItem(item.id)}
                      className="p-2 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 hover:border-rose-500/30 transition-colors"
                      title="Dismiss from Queue"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Timer Launch Modal */}
      {targetCallItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-indigo-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Timer className="w-5 h-5 text-indigo-400" /> Set Speaker Custom Timer
            </h3>
            <p className="text-xs text-slate-400 mb-4">Set specific time limit before giving floor to speaker</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const total = (parseInt(callMins, 10) || 0) * 60 + (parseInt(callSecs, 10) || 0);
                if (total > 0) {
                  startSpeaker(targetCallItem, total);
                  setTargetCallItem(null);
                }
              }}
              className="space-y-4"
            >
              <div className="flex justify-center gap-2 items-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={callMins}
                  onChange={(e) => setCallMins(e.target.value)}
                  className="w-16 py-2 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg text-white font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-bold">MIN</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={callSecs}
                  onChange={(e) => setCallSecs(e.target.value)}
                  className="w-16 py-2 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg text-white font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-bold">SEC</span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTargetCallItem(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Start Speaker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
