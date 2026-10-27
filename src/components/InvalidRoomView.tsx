import React from 'react';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { DEFAULT_ROOM_CODE } from '../../shared/roomCode';

export const InvalidRoomView: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const defaultRoomUrl = `${window.location.pathname}?room=${DEFAULT_ROOM_CODE}`;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-md glass-panel rounded-3xl border border-rose-500/20 shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8 text-center border-b border-slate-800 bg-gradient-to-br from-rose-950/40 to-slate-950/30">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-rose-600/20 border border-rose-500/30">
            <TriangleAlert className="w-7 h-7 text-rose-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Invalid room code</h1>
          <p className="text-sm text-slate-400 mt-2">
            <span className="font-mono text-rose-300 break-all">{roomCode.trim() || '(empty)'}</span> is not a meeting room.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <p className="text-sm text-slate-300">
            Room codes use 4 to 24 letters, numbers or dashes, for example <span className="font-mono">{DEFAULT_ROOM_CODE}</span>.
            Check the link or scan the QR code again.
          </p>
          <a
            href={defaultRoomUrl}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-extrabold shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
          >
            Go to room {DEFAULT_ROOM_CODE}
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>
    </main>
  );
};
