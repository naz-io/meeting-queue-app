import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Smartphone, Tv } from 'lucide-react';
import { useMeeting } from '../context/MeetingContext';
import { getJoinUrl } from '../utils/joinUrl';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
  const { roomCode, publicBaseUrl } = useMeeting();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);


  if (!isOpen) return null;

  // Dynamic meeting URL encoded in QR Code
  const joinUrl = getJoinUrl(roomCode, publicBaseUrl);

  const copyToClipboard = async () => {
    setCopyFailed(false);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = joinUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(input);
        if (!successful) throw new Error('Copy command was rejected');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md glass-panel p-4 sm:p-6 rounded-3xl border border-indigo-500/20 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-3">
            <QrCode className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white">Join Meeting Queue</h3>
          <p className="text-sm text-slate-400 mt-1">Scan QR code with smartphone to raise your hand</p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-3 sm:p-6 bg-white rounded-2xl shadow-inner mb-6">
          <QRCodeSVG
            value={joinUrl}
            size={220}
            className="w-full max-w-[220px] h-auto"
            level="H"
            includeMargin={true}
            imageSettings={{
              src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-4.5a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0z"/></svg>',
              x: undefined,
              y: undefined,
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
          <span className="text-xs font-semibold text-slate-700 mt-2 font-mono tracking-wider">
            ROOM CODE: {roomCode}
          </span>
        </div>

        {/* Info & Copy Link */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl text-xs text-slate-300 border border-slate-800">
            <span className="truncate pr-2 font-mono">{joinUrl}</span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium text-xs shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {copyFailed && (
            <p className="text-xs text-amber-400 text-center">Copy is unavailable in this browser. Press and hold the link to copy it manually.</p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Mobile Phone Ready</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <Tv className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Projector TV View</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
