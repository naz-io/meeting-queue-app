import React, { useEffect, useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { Hand, HandMetal, CheckCircle2, Clock, Sparkles, MessageSquare, AlertCircle, Hourglass, Mic } from 'lucide-react';
import { TimerRing } from './TimerRing';


export const ParticipantView: React.FC = () => {
  const {
    currentUserId,
    currentUserName,
    currentUserAvatar,
    queue,
    activeSpeaker,
    speakerBuffer,
    settings,
    raiseHand,
    lowerHand,
    isUserInQueue,
    userQueuePosition,
    finishCurrentSpeaker,
    getParticipantTotalSpokenSeconds,
    getParticipantTurnCount,
  } = useMeeting();

  const [topicNote, setTopicNote] = useState('');
  const [, setClockTick] = useState(0);
  const isCurrentActiveSpeaker = activeSpeaker?.queueItem.participant.id === currentUserId;
  const isCurrentBufferSpeaker = speakerBuffer?.queueItem.participant.id === currentUserId;

  useEffect(() => {
    if (!isUserInQueue) return;
    const interval = window.setInterval(() => setClockTick((tick) => tick + 1), 15_000);
    return () => window.clearInterval(interval);
  }, [isUserInQueue]);

  const totalPreviousSpokenSecs = getParticipantTotalSpokenSeconds(currentUserId, currentUserName);
  const previousTurns = getParticipantTurnCount(currentUserId, currentUserName);

  const prevMins = Math.floor(totalPreviousSpokenSecs / 60);
  const prevSecs = totalPreviousSpokenSecs % 60;

  const handleRaiseHandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    raiseHand(topicNote.trim());
    setTopicNote('');
  };

  const speakersAhead = isUserInQueue ? queue.slice(0, Math.max(0, userQueuePosition - 1)) : [];
  const estimatedWaitSeconds = isUserInQueue
    ? (activeSpeaker?.remainingSeconds ?? 0)
      + (speakerBuffer
        ? speakerBuffer.remainingBufferSeconds + speakerBuffer.allocatedSpeakerSeconds
        : 0)
      + speakersAhead.reduce((total, item) => total + item.allocatedSeconds, 0)
      + settings.bufferSeconds * userQueuePosition
    : 0;

  const formatEstimatedWait = (totalSeconds: number) => {
    if (totalSeconds < 60) return 'less than 1 min';
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `about ${totalMinutes} min`;
    if (minutes === 0) return `about ${hours} hr`;
    return `about ${hours} hr ${minutes} min`;
  };

  const estimatedTurnTime = new Date(Date.now() + estimatedWaitSeconds * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* CUMULATIVE SPEAKING STATS BANNER FOR PARTICIPANT */}
      <div className="glass-panel p-4 rounded-2xl border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
              Your Speaking History (This Session)
            </span>
            <p className="text-xs text-slate-300 font-medium">
              {previousTurns === 0 ? (
                'You haven\'t spoken yet in this session'
              ) : (
                <span>
                  Total Spoken: <strong className="text-white font-mono">{prevMins}m {prevSecs}s</strong> across{' '}
                  <strong className="text-white font-mono">{previousTurns}</strong> turn{previousTurns > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        {previousTurns > 0 && (
          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-mono font-bold shrink-0 border border-indigo-500/30">
            {prevMins}m {prevSecs}s
          </span>
        )}
      </div>

      {/* 1. YOU ARE IN 10-SECOND TRANSITION BUFFER BANNER */}
      {isCurrentBufferSpeaker && speakerBuffer && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-amber-500 shadow-2xl shadow-amber-500/20 text-center animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-500/30 animate-pulse">
            <Hourglass className="w-4 h-4 animate-spin" /> Get Ready — Next Speaker!
          </div>

          <h2 className="text-3xl font-extrabold text-white mb-2">Step Up to the Stage</h2>
          <p className="text-sm text-slate-300 mb-6">Your speaking timer starts automatically when buffer ends</p>

          <div className="flex justify-center my-4">
            <div className="relative flex flex-col items-center justify-center rounded-full p-2">
              <div className="w-44 h-44 rounded-full border-4 border-amber-500/30 flex items-center justify-center bg-slate-900/90 shadow-2xl shadow-amber-500/20 animate-pulse">
                <span className="font-mono font-black text-5xl text-amber-400">
                  {speakerBuffer.remainingBufferSeconds}s
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mt-2">
            Transition Buffer
          </span>
        </div>
      )}

      {/* 2. YOU ARE THE ACTIVE SPEAKER BANNER */}
      {isCurrentActiveSpeaker && activeSpeaker && (
        <div className="glass-panel p-6 rounded-3xl border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 text-center animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
            <Sparkles className="w-4 h-4 animate-spin" /> You Have the Floor!
          </div>

          <h2 className="text-2xl font-black text-white mb-2">It's Your Turn to Speak</h2>
          <p className="text-sm text-slate-300 mb-6">Address the room. The timer is running live on stage.</p>

          <div className="flex justify-center my-4">
            <TimerRing
              remainingSeconds={activeSpeaker.remainingSeconds}
              totalSeconds={activeSpeaker.totalDurationSeconds}
              isPaused={activeSpeaker.isPaused}
              size={240}
            />
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => finishCurrentSpeaker('completed')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" /> Done Speaking
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN RAISE HAND CONTROLLER */}
      {!isCurrentActiveSpeaker && !isCurrentBufferSpeaker && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-4xl p-2 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-inner">
              {currentUserAvatar}
            </span>
            <div className="text-left">
              <h2 className="text-xl font-bold text-white leading-tight">{currentUserName}</h2>
              <span className="text-xs text-slate-400">Connected to Live Session</span>
            </div>
          </div>

          {isUserInQueue ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 bg-gradient-to-br from-indigo-950/60 to-purple-950/60 rounded-3xl border border-indigo-500/30 shadow-lg">
                <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  Hand Raised ✋
                </span>

                <div className="text-5xl font-black text-white my-2 tracking-tight">
                  #{userQueuePosition} <span className="text-lg font-normal text-slate-400">in line</span>
                </div>

                <p className="text-xs text-slate-300 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 mt-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Estimated turn in {formatEstimatedWait(estimatedWaitSeconds)}</span>
                  <span className="text-slate-500" aria-hidden="true">•</span>
                  <span>around {estimatedTurnTime}</span>
                </p>
              </div>

              <button
                onClick={lowerHand}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 rounded-2xl font-bold text-sm border border-rose-500/20 hover:border-rose-500/40 transition-all active:scale-98 shadow-md"
              >
                <HandMetal className="w-5 h-5 rotate-180" />
                Lower My Hand
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleRaiseHandSubmit} className="space-y-4">
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={topicNote}
                    onChange={(e) => setTopicNote(e.target.value)}
                    placeholder="Optional: What topic would you like to speak about?"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 sm:gap-3 px-3 py-5 sm:py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-3xl font-extrabold text-lg sm:text-xl shadow-2xl shadow-indigo-600/40 transition-all transform hover:-translate-y-0.5 active:scale-95 group"
                >
                  <Hand className="w-8 h-8 transition-transform group-hover:scale-110 group-hover:rotate-12" />
                  <span>Raise Hand to Speak</span>
                </button>
              </form>

              <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                The moderator will call upon speakers in order.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. SOMEONE ELSE IS IN BUFFER */}
      {speakerBuffer && !isCurrentBufferSpeaker && (
        <div className="glass-card p-5 rounded-2xl border border-amber-500/40 bg-amber-950/20 flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-slate-900 rounded-xl border border-amber-500/30">
              {speakerBuffer.queueItem.participant.avatar}
            </span>
            <div>
              <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider block">
                Next Up Buffer
              </span>
              <h3 className="font-bold text-white text-base">{speakerBuffer.queueItem.participant.name}</h3>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono font-bold text-2xl text-amber-400">
              {speakerBuffer.remainingBufferSeconds}s
            </span>
            <span className="block text-[10px] text-slate-400 uppercase">Starting soon</span>
          </div>
        </div>
      )}

      {/* 5. CURRENT ACTIVE SPEAKER DISPLAY */}
      {activeSpeaker && !isCurrentActiveSpeaker && (
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-slate-900 rounded-xl border border-slate-800">
              {activeSpeaker.queueItem.participant.avatar}
            </span>
            <div>
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block">
                Now Speaking
              </span>
              <h3 className="font-bold text-white text-base">{activeSpeaker.queueItem.participant.name}</h3>
              {activeSpeaker.queueItem.note && (
                <p className="text-xs text-slate-400 italic">"{activeSpeaker.queueItem.note}"</p>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono font-bold text-2xl text-indigo-300">
              {Math.floor(activeSpeaker.remainingSeconds / 60)}:
              {activeSpeaker.remainingSeconds % 60 < 10 ? '0' : ''}
              {activeSpeaker.remainingSeconds % 60}
            </span>
            <span className="block text-xs text-slate-500">Remaining</span>
          </div>
        </div>
      )}

      {/* 6. UPCOMING QUEUE PREVIEW */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800/80">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center justify-between">
          <span>Upcoming Speakers ({queue.length})</span>
          {queue.length > 0 && <span className="text-xs text-indigo-400 font-normal">Live Queue</span>}
        </h3>

        {queue.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No hands raised yet. Be the first to raise your hand!
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {queue.map((item, idx) => {
              const isMe = item.participant.id === currentUserId;
              const prevSpoken = getParticipantTotalSpokenSeconds(item.participant.id, item.participant.name);


              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                    isMe
                      ? 'bg-indigo-950/40 border-indigo-500/40 text-white'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center font-mono text-xs font-bold text-slate-500">
                      #{idx + 1}
                    </span>
                    <span className="text-xl shrink-0">{item.participant.avatar}</span>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{item.participant.name}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      {item.note && <p className="text-xs text-slate-400 truncate italic">{item.note}</p>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-slate-300 block">
                      {Math.round(item.allocatedSeconds / 60)} min
                    </span>
                    {prevSpoken > 0 && (
                      <span className="text-[10px] text-indigo-400 font-mono block">
                        Spoke: {Math.floor(prevSpoken / 60)}m {prevSpoken % 60}s
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
