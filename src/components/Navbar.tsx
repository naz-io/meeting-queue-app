import React, { useState } from 'react';
import { useMeeting, AVATAR_OPTIONS } from '../context/MeetingContext';
import { QrCode, Shield, Users, Tv, Volume2, VolumeX, User, Sparkles } from 'lucide-react';
import { QRCodeModal } from './QRCodeModal';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    queue,
    activeSpeaker,
    roomCode,
    roomName,
    settings,
    updateSettings,
    currentUserName,
    currentUserAvatar,
    setCurrentUserInfo,
    isModerator,
    authorizeModerator,
  } = useMeeting();

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(currentUserName);
  const [editAvatar, setEditAvatar] = useState(currentUserAvatar);
  const [isModeratorModalOpen, setIsModeratorModalOpen] = useState(false);
  const [moderatorPin, setModeratorPin] = useState('');
  const [moderatorError, setModeratorError] = useState('');
  const [moderatorLoading, setModeratorLoading] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      setCurrentUserInfo(editName.trim(), editAvatar);
      setIsProfileModalOpen(false);
    }
  };

  const handleModeratorClick = () => {
    if (isModerator) {
      setActiveView('moderator');
    } else {
      setIsModeratorModalOpen(true);
      setModeratorError('');
    }
  };

  const handleModeratorLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setModeratorLoading(true);
    const result = await authorizeModerator(moderatorPin);
    setModeratorLoading(false);
    if (result.ok) {
      setModeratorPin('');
      setIsModeratorModalOpen(false);
    } else {
      setModeratorError(result.error || 'Could not authorize moderator access.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-3 sm:px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Meeting Title */}
          <div className="order-1 flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h1 className="font-bold text-sm sm:text-lg text-white tracking-tight leading-tight sm:leading-none truncate">{roomName}</h1>
                <span className="hidden min-[360px]:inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                  {roomCode}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 sm:gap-2 truncate">
                <span>{queue.length} in queue</span>
                <span>•</span>
                <span className={activeSpeaker ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {activeSpeaker ? `Active: ${activeSpeaker.queueItem.participant.name}` : 'No active speaker'}
                </span>
              </p>
            </div>
          </div>

          {/* Center Navigation Switcher */}
          <div className="order-3 sm:order-2 w-full sm:w-auto grid grid-cols-3 sm:flex items-stretch sm:items-center bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveView('participant')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all min-w-0 ${
                activeView === 'participant'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Participant</span>
            </button>

            <button
              onClick={handleModeratorClick}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all relative min-w-0 ${
                activeView === 'moderator'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Moderator</span>
              {queue.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveView('stage')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all min-w-0 ${
                activeView === 'stage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Stage TV</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="order-2 sm:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* QR Code Trigger */}
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700/50 transition-colors"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">Join QR</span>
            </button>

            {/* Mute/Unmute Sound */}
            {isModerator && (
              <button
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`p-2 rounded-xl text-xs border transition-colors ${
                  settings.soundEnabled
                    ? 'bg-slate-800/80 text-indigo-400 border-slate-700/50 hover:bg-slate-800'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
                }`}
                title={settings.soundEnabled ? 'Mute Chimes' : 'Enable Sound'}
              >
                {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            {/* Profile Avatar Button */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 p-1.5 sm:pl-2 sm:pr-3 sm:py-1 bg-slate-800/60 hover:bg-slate-800 text-slate-200 rounded-xl text-xs border border-slate-700/50 transition-colors"
            >
              <span className="text-base">{currentUserAvatar}</span>
              <span className="font-medium max-w-[100px] truncate hidden md:inline">{currentUserName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* QR Code Modal */}
      <QRCodeModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />

      {isModeratorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-indigo-500/30 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" /> Moderator Access
            </h3>
            <p className="text-xs text-slate-400 mb-4">Enter the PIN configured on the meeting server.</p>
            <form onSubmit={handleModeratorLogin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={moderatorPin}
                onChange={(event) => setModeratorPin(event.target.value)}
                placeholder="Moderator PIN"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {moderatorError && <p className="text-xs text-rose-400">{moderatorError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModeratorModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moderatorLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold"
                >
                  {moderatorLoading ? 'Checking…' : 'Enter Moderator View'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" /> Edit Your Identity
            </h3>
            <p className="text-xs text-slate-400 mb-4">Choose how you appear when raising your hand</p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Select Avatar</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditAvatar(emoji)}
                      className={`p-2 text-xl rounded-xl border transition-all ${
                        editAvatar === emoji
                          ? 'bg-indigo-600/30 border-indigo-500 scale-110'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/30"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
