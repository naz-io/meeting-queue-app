import React, { useState } from 'react';
import { ArrowRight, Sparkles, UserRound } from 'lucide-react';
import { AVATAR_OPTIONS, useMeeting } from '../context/MeetingContext';

export const JoinRoomView: React.FC = () => {
  const { roomCode, currentUserName, currentUserAvatar, joinRoom } = useMeeting();
  const [name, setName] = useState(currentUserName === 'Guest Participant' ? '' : currentUserName);
  const [avatar, setAvatar] = useState(currentUserAvatar);
  const safeName = name.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (safeName) joinRoom(safeName, avatar);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-md glass-panel rounded-3xl border border-indigo-500/20 shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8 text-center border-b border-slate-800 bg-gradient-to-br from-indigo-950/50 to-purple-950/30">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-3">
            ROOM {roomCode}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Join the meeting</h1>
          <p className="text-sm text-slate-400 mt-2">Choose the name and avatar other participants will see.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="participant-name" className="block text-sm font-bold text-white mb-2">
              Your name <span className="text-rose-400" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="participant-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={60}
                autoComplete="name"
                autoFocus
                required
                className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">A name is required before you can enter this room.</p>
          </div>

          <fieldset>
            <legend className="block text-sm font-bold text-white mb-3">Choose an avatar</legend>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  aria-label={`Use ${emoji} avatar`}
                  aria-pressed={avatar === emoji}
                  className={`aspect-square flex items-center justify-center text-xl rounded-xl border transition-all ${
                    avatar === emoji
                      ? 'bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-500/30 scale-105'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!safeName}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-extrabold shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
          >
            Enter Meeting
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </section>
    </main>
  );
};
