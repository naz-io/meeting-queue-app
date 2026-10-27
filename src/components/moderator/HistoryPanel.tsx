import React from 'react';
import { Download } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import { historyToCsv } from '../../utils/csv';

export const HistoryPanel: React.FC = () => {
  const {
    history,
    getParticipantTotalSpokenSeconds,
  } = useMeeting();

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
  );
};
