import React, { useState } from 'react';
import { Clock, History, QrCode, Sliders } from 'lucide-react';
import { useMeeting } from '../context/MeetingContext';
import { QRCodeModal } from './QRCodeModal';
import { FloorControl } from './moderator/FloorControl';
import { HistoryPanel } from './moderator/HistoryPanel';
import { QueuePanel } from './moderator/QueuePanel';
import { SettingsPanel } from './moderator/SettingsPanel';

// The moderator screen: live floor control on top, then queue, history and settings tabs.
export const ModeratorView: React.FC = () => {
  const { queue, history, loadDemoData } = useMeeting();

  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'settings'>('queue');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <FloorControl />

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

      {activeTab === 'queue' && <QueuePanel />}
      {activeTab === 'history' && <HistoryPanel />}
      {activeTab === 'settings' && <SettingsPanel />}

      {/* QR Code Modal */}
      <QRCodeModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
    </div>
  );
};
