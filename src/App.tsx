import React from 'react';
import { MeetingProvider, useMeeting } from './context/MeetingContext';
import { Navbar } from './components/Navbar';
import { ParticipantView } from './components/ParticipantView';
import { ModeratorView } from './components/ModeratorView';
import { StageView } from './components/StageView';
import { JoinRoomView } from './components/JoinRoomView';
import { ExternalLink, Info, Wifi, WifiOff } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeView, connected, reconnecting, connectionError, hasJoinedRoom } = useMeeting();

  if (!hasJoinedRoom) return <JoinRoomView />;

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Navbar />

      {(!connected || connectionError) && (
        <div className={`w-full px-4 py-2 text-center text-xs font-semibold border-b ${
          connected ? 'bg-amber-950/70 text-amber-300 border-amber-800' : 'bg-rose-950/70 text-rose-300 border-rose-800'
        }`}>
          <span className="inline-flex items-center gap-2">
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {connectionError || (reconnecting ? 'Connecting to the meeting server…' : 'Meeting server unavailable.')}
          </span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {activeView === 'participant' && <ParticipantView />}
        {activeView === 'moderator' && <ModeratorView />}
        {activeView === 'stage' && <StageView />}
      </main>

      {/* Footer Info & Multi-Tab Testing Tip */}
      <footer className="w-full glass-panel border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>{connected ? 'Live:' : 'Offline:'}</strong>{' '}
              {connected ? 'This device is synchronized with the meeting server.' : 'Actions are disabled until the server reconnects.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <span>Open 2nd Window</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <MeetingProvider>
      <MainContent />
    </MeetingProvider>
  );
}

export default App;
