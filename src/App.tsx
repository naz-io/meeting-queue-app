import React, { useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting } from './context/MeetingContext';
import { Navbar } from './components/Navbar';
import { ParticipantView } from './components/ParticipantView';
import { ModeratorView } from './components/ModeratorView';
import { StageView } from './components/StageView';
import { JoinRoomView } from './components/JoinRoomView';
import { ArrowRight, ExternalLink, Info, LogOut, Wifi, WifiOff } from 'lucide-react';

const BACK_GUARD_KEY = 'meetingQueueParticipantGuard';

const MainContent: React.FC = () => {
  const {
    activeView,
    connected,
    reconnecting,
    connectionError,
    hasJoinedRoom,
    roomCode,
    roomName,
    currentUserId,
    activeSpeaker,
    speakerBuffer,
    isUserInQueue,
    userQueuePosition,
    leaveRoom,
  } = useMeeting();
  const [showMeetingExit, setShowMeetingExit] = useState(false);
  const isLeavingRef = useRef(false);

  useEffect(() => {
    if (!hasJoinedRoom || activeView !== 'participant') return;

    if (window.history.state?.[BACK_GUARD_KEY] !== roomCode) {
      window.history.pushState({ ...window.history.state, [BACK_GUARD_KEY]: roomCode }, '', window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isLeavingRef.current) return;
      setShowMeetingExit(event.state?.[BACK_GUARD_KEY] !== roomCode);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, hasJoinedRoom, roomCode]);

  const returnToMeeting = () => {
    window.history.pushState({ ...window.history.state, [BACK_GUARD_KEY]: roomCode }, '', window.location.href);
    setShowMeetingExit(false);
  };

  const exitMeeting = () => {
    isLeavingRef.current = true;
    leaveRoom();
    window.history.back();
  };

  if (!hasJoinedRoom) return <JoinRoomView />;

  if (showMeetingExit && activeView === 'participant') {
    const isSpeaking = activeSpeaker?.queueItem.participant.id === currentUserId;
    const isGettingReady = speakerBuffer?.queueItem.participant.id === currentUserId;
    const exitImpact = isSpeaking
      ? 'You are currently speaking. Leaving will end your turn.'
      : isGettingReady
        ? 'You are next to speak. Leaving will cancel your turn.'
        : isUserInQueue
          ? `You are #${userQueuePosition} in line. Leaving will lower your hand.`
          : 'You can return without losing your place in the meeting.';

    return (
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-md glass-panel rounded-3xl border border-indigo-500/20 shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8 text-center border-b border-slate-800 bg-gradient-to-br from-indigo-950/50 to-purple-950/30">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-4">
              STILL CONNECTED
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Stay in {roomName}?</h1>
            <p className="text-sm text-slate-400 mt-2">
              The Back button brought you here so you don&apos;t accidentally leave the meeting.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <p className="text-sm text-slate-300 text-center">{exitImpact}</p>
            <button
              type="button"
              onClick={returnToMeeting}
              autoFocus
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-extrabold shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
            >
              Return to Meeting
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={exitMeeting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-rose-300 rounded-2xl font-bold border border-rose-500/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Leave Meeting
            </button>
            <p className="text-xs text-slate-500 text-center">Leaving returns you to the app or camera you came from.</p>
          </div>
        </section>
      </main>
    );
  }

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
