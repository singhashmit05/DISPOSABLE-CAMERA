import React, { useState, useEffect, useCallback } from 'react';
import CameraView from './components/CameraView';
import GalleryGrid from './components/GalleryGrid';
import NameModal from './components/NameModal';
import GrainOverlay from './components/GrainOverlay';
import RollsView from './components/RollsView';
import { Camera, Image as ImageIcon, LogOut, User, Film, ArrowLeft, Link2, Copy, Check } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [currentTab, setCurrentTab] = useState('camera'); // 'camera' | 'gallery' | 'rolls'

  // Active roll context — null means the global public roll
  const [activeRoll, setActiveRoll] = useState(null);
  const [rollLoading, setRollLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load session from local storage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('flashback_nickname');
    const savedSession = localStorage.getItem('flashback_session_id');
    
    if (savedName && savedSession) {
      setNickname(savedName);
      setSessionId(savedSession);
    } else {
      setShowNameModal(true);
    }
  }, []);

  // URL-based roll routing: parse /roll/:slug from the URL path
  useEffect(() => {
    const handleRoute = async () => {
      const path = window.location.pathname;
      const match = path.match(/^\/roll\/([a-z0-9-]+)$/);
      if (match) {
        const slug = match[1];
        setRollLoading(true);
        try {
          const { data: roll, error } = await supabase
            .from('rolls')
            .select('*')
            .eq('slug', slug)
            .single();
            
          if (roll) {
            setActiveRoll(roll);
            setCurrentTab('camera');
          } else if (error) {
            console.error('Failed to load roll from URL:', error);
          }
        } catch (err) {
          console.error('Unexpected error loading roll:', err);
        } finally {
          setRollLoading(false);
        }
      }
    };
    handleRoute();

    // Handle browser back/forward
    window.addEventListener('popstate', handleRoute);
    return () => window.removeEventListener('popstate', handleRoute);
  }, []);

  const handleSaveName = (name, id) => {
    setNickname(name);
    setSessionId(id);
    setShowNameModal(false);
  };

  const handleResetName = () => {
    if (window.confirm("Do you want to switch identity? This won't delete your existing uploads.")) {
      localStorage.removeItem('flashback_nickname');
      localStorage.removeItem('flashback_session_id');
      setNickname('');
      setSessionId('');
      setShowNameModal(true);
    }
  };

  const handlePhotoUploaded = () => {
    setCurrentTab('gallery');
  };

  const handleJoinRoll = useCallback((roll) => {
    setActiveRoll(roll);
    setCurrentTab('camera');
    // Update the URL without full navigation
    window.history.pushState({}, '', `/roll/${roll.slug}`);
  }, []);

  const handleLeaveRoll = useCallback(() => {
    setActiveRoll(null);
    setCurrentTab('rolls');
    window.history.pushState({}, '', '/');
  }, []);

  const copyRollLink = () => {
    if (!activeRoll) return;
    const url = `${window.location.origin}/roll/${activeRoll.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col relative select-none">
      {/* Dynamic Jittery Film Grain */}
      <GrainOverlay />

      {/* TOP HEADER */}
      <header className="bg-retro-dark text-retro-bg py-4 px-6 border-b-4 border-retro-accent flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md z-20">
        <button onClick={() => window.location.href = '/'} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left cursor-pointer">
          <span className="text-2xl">🎞️</span>
          <div>
            <h1 className="font-mono text-xl font-black italic tracking-wider leading-none text-white">
              FLASHBACK
            </h1>
            <span className="font-mono text-[9px] uppercase tracking-widest text-retro-accent font-bold">
              Shared Film Roll Experience
            </span>
          </div>
        </button>

        {/* Identity Badge */}
        {nickname && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-lg">
            <div className="flex items-center gap-1.5 font-handwritten text-xl text-retro-accent">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span>{nickname}</span>
            </div>
            <button
              onClick={handleResetName}
              className="text-zinc-500 hover:text-retro-shutter transition-all p-1"
              title="Reset Identity"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* ACTIVE ROLL BANNER */}
      {activeRoll && (
        <div className="bg-retro-accent/15 border-b-2 border-retro-accent/30 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleLeaveRoll}
              className="shrink-0 bg-retro-dark/10 hover:bg-retro-dark/20 w-8 h-8 rounded-full flex items-center justify-center transition-all"
              title="Leave this roll"
            >
              <ArrowLeft className="w-4 h-4 text-retro-dark" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-retro-accent shrink-0" />
                <span className="font-handwritten text-2xl text-retro-dark truncate">{activeRoll.name}</span>
              </div>
              {activeRoll.description && (
                <p className="font-mono text-[9px] text-retro-dark/50 uppercase tracking-wider truncate mt-0.5">
                  {activeRoll.description}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={copyRollLink}
            className={`shrink-0 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all ${
              copiedLink
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-zinc-300 text-retro-dark/60 hover:bg-retro-accent/10 hover:border-retro-accent hover:text-retro-dark'
            }`}
          >
            {copiedLink ? (
              <><Check className="w-3 h-3" /> Copied!</>
            ) : (
              <><Copy className="w-3 h-3" /> Share Roll Link</>
            )}
          </button>
        </div>
      )}

      {/* VIEWPORT BODY */}
      <main className="flex-grow flex flex-col justify-start py-8">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center gap-3 mb-8 flex-wrap px-4">
          <button
            onClick={() => setCurrentTab('camera')}
            className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold px-5 py-3 border-2 border-retro-dark rounded-lg transition-all ${
              currentTab === 'camera'
                ? 'bg-retro-accent text-retro-dark shadow-[2px_2px_0px_#1a1410] translate-y-[-2px] translate-x-[-2px]'
                : 'bg-white text-retro-dark hover:bg-zinc-100 shadow-[0px_0px_0px_#1a1410]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>View Finder</span>
          </button>
          
          <button
            onClick={() => setCurrentTab('gallery')}
            className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold px-5 py-3 border-2 border-retro-dark rounded-lg transition-all ${
              currentTab === 'gallery'
                ? 'bg-retro-accent text-retro-dark shadow-[2px_2px_0px_#1a1410] translate-y-[-2px] translate-x-[-2px]'
                : 'bg-white text-retro-dark hover:bg-zinc-100 shadow-[0px_0px_0px_#1a1410]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{activeRoll ? 'Roll Photos' : 'Gallery'}</span>
          </button>

          {!activeRoll && (
            <button
              onClick={() => setCurrentTab('rolls')}
              className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-bold px-5 py-3 border-2 border-retro-dark rounded-lg transition-all ${
                currentTab === 'rolls'
                  ? 'bg-retro-accent text-retro-dark shadow-[2px_2px_0px_#1a1410] translate-y-[-2px] translate-x-[-2px]'
                  : 'bg-white text-retro-dark hover:bg-zinc-100 shadow-[0px_0px_0px_#1a1410]'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Rolls</span>
            </button>
          )}
        </div>

        {/* Roll loading state */}
        {rollLoading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-retro-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-mono text-xs text-retro-dark/60 uppercase tracking-wider">Loading roll...</p>
            </div>
          </div>
        ) : nickname && (
          <div className="w-full">
            {currentTab === 'camera' ? (
              <CameraView 
                nickname={nickname} 
                sessionId={sessionId} 
                onPhotoUploaded={handlePhotoUploaded}
                rollId={activeRoll?.id || null}
              />
            ) : currentTab === 'gallery' ? (
              <GalleryGrid 
                nickname={nickname} 
                sessionId={sessionId}
                rollId={activeRoll?.id || null}
              />
            ) : (
              <RollsView
                nickname={nickname}
                sessionId={sessionId}
                onJoinRoll={handleJoinRoll}
              />
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-retro-dark text-zinc-500 font-mono text-[9px] uppercase tracking-widest text-center py-6 border-t border-zinc-900 mt-12 z-20">
        <p className="mb-1">
          🎞️ FLASHBACK — Nostalgic Grain & Tactile Shutter Experience
        </p>
        <p className="text-zinc-600 font-sans normal-case">
          Made with love & vintage CSS code.
        </p>
      </footer>

      {/* NAME PROMPT MODAL */}
      {showNameModal && (
        <NameModal onSave={handleSaveName} />
      )}
    </div>
  );
}
