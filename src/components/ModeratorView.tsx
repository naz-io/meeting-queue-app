import React, { useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  Clock,
  History,
  QrCode,
  Sliders,
  Trash2,
  Download,
  Flame,
  Sparkles,
  Timer,
  Hourglass,
  FastForward,
  Mic,
} from 'lucide-react';

import { TimerRing } from './TimerRing';
import { QRCodeModal } from './QRCodeModal';
import type { SpeakingTimeScope } from '../../shared/protocol';
import { historyToCsv } from '../utils/csv';

export const ModeratorView: React.FC = () => {
  const {
    queue,
    activeSpeaker,
    speakerBuffer,
    history,
    settings,
    moveQueueItem,
    dismissQueueItem,
    startSpeaker,
    skipBuffer,
    cancelBuffer,
    pauseTimer,
    resumeTimer,
    addTime,
    setSpeakerTimer,
    finishCurrentSpeaker,
    updateSettings,
    resetSession,
    loadDemoData,
    getParticipantTotalSpokenSeconds,
    getParticipantTurnCount,
  } = useMeeting();

  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'settings'>('queue');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [customActiveMins, setCustomActiveMins] = useState<string>('2');
  const [customActiveSecs, setCustomActiveSecs] = useState<string>('0');
  const [showCustomActiveInput, setShowCustomActiveInput] = useState<boolean>(false);

  const [customDefaultMins, setCustomDefaultMins] = useState<string>(
    Math.floor(settings.defaultTimerSeconds / 60).toString()
  );
  const [customDefaultSecs, setCustomDefaultSecs] = useState<string>(
    (settings.defaultTimerSeconds % 60).toString()
  );

  const [pendingDefaultSeconds, setPendingDefaultSeconds] = useState<number | null>(null);

  const [targetCallItem, setTargetCallItem] = useState<string | null>(null);
  const [callMins, setCallMins] = useState<string>('2');
  const [callSecs, setCallSecs] = useState<string>('0');

  // History is newest-first. Mark only the newest entry for each participant
  // so cumulative totals are not repeated on all of their previous turns.
  const latestHistoryEntryIds = new Set<string>();
  const seenParticipantKeys = new Set<string>();
  history.forEach((item) => {
    const participantKeys = [
      item.participantId ? `id:${item.participantId}` : null,
      `name:${item.participantName.toLowerCase()}`,
    ].filter((key): key is string => key !== null);

    if (!participantKeys.some((key) => seenParticipantKeys.has(key))) {
      latestHistoryEntryIds.add(item.id);
    }
    participantKeys.forEach((key) => seenParticipantKeys.add(key));
  });

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

  const handleExportCSV = () => {
    if (history.length === 0) return;
    // The byte-order mark makes Excel read names with emoji or accents as UTF-8.
    const blob = new Blob(['﻿', historyToCsv(history)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting_speakers_log_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. ACTIVE / BUFFER SPEAKER HERO PANEL */}
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
                    {speakerBuffer.remainingBufferSeconds}s
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
                remainingSeconds={activeSpeaker.remainingSeconds}
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

      {/* 2. NAVIGATION TABS */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="grid grid-cols-3 sm:flex items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Speaker Queue ({queue.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Past Speakers ({history.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Settings & Buffer</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700"
          >
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span>Show QR Code</span>
          </button>

          {queue.length === 0 && (
            <button
              onClick={loadDemoData}
              className="px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 rounded-xl text-xs font-medium border border-indigo-500/30"
            >
              Load Demo Participants
            </button>
          )}
        </div>
      </div>

      {/* 3. QUEUE TAB CONTENT WITH CUMULATIVE STATS BADGES */}
      {activeTab === 'queue' && (
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
      )}

      {/* 4. HISTORY TAB CONTENT WITH CUMULATIVE TOTALS */}
      {activeTab === 'history' && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Meeting Speaker Analytics & History Log</h3>
            {history.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No completed speakers yet in this session.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3">Speaker</th>
                    <th className="pb-3">Time Spoken</th>
                    <th className="pb-3">Turn Duration</th>
                    <th className="pb-3">Cumulative Spoken</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((h) => {
                    const isLatestParticipantTurn = latestHistoryEntryIds.has(h.id);
                    const totalCumulative = isLatestParticipantTurn
                      ? getParticipantTotalSpokenSeconds(h.participantId, h.participantName)
                      : 0;
                    return (
                      <tr key={h.id} className="text-slate-300 hover:bg-slate-900/40">
                        <td className="py-3 font-semibold text-white flex items-center gap-2">
                          <span>{h.avatar}</span>
                          <span>{h.participantName}</span>
                        </td>
                        <td className="py-3 font-mono text-slate-400">
                          {new Date(h.spokenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-mono text-indigo-300">
                          {Math.floor(h.actualDurationSeconds / 60)}m {h.actualDurationSeconds % 60}s
                        </td>
                        <td className={`py-3 font-mono font-bold ${isLatestParticipantTurn ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isLatestParticipantTurn
                            ? `${Math.floor(totalCumulative / 60)}m ${totalCumulative % 60}s`
                            : '—'}
                        </td>
                        <td className="py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {h.endedReason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. SETTINGS TAB CONTENT */}
      {activeTab === 'settings' && (
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
      )}

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

      {/* QR Code Modal */}
      <QRCodeModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
    </div>
  );
};
