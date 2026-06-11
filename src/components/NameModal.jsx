import React, { useState } from 'react';

export default function NameModal({ onSave }) {
  const [nickname, setNickname] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const trimmedName = nickname.trim().slice(0, 20); // Limit name length
    const sessionId = window.crypto?.randomUUID 
      ? window.crypto.randomUUID() 
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    localStorage.setItem('flashback_nickname', trimmedName);
    localStorage.setItem('flashback_session_id', sessionId);
    
    onSave(trimmedName, sessionId);
  };

  return (
    <div className="fixed inset-0 bg-retro-dark/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-retro-bg border-4 border-retro-dark p-8 rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Cardboard edge pattern */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-retro-accent via-retro-shutter to-retro-accent"></div>
        
        <div className="text-center relative">
          {/* Logo/Doodle */}
          <div className="inline-block bg-retro-dark text-retro-bg font-mono px-3 py-1 text-xs uppercase tracking-widest mb-6">
            🎞️ Roll #27
          </div>
          
          <h2 className="font-handwritten text-5xl mb-4 text-retro-dark leading-tight">
            What's your name on this roll?
          </h2>
          
          <p className="font-mono text-[10px] text-retro-dark/70 mb-8 uppercase tracking-wider">
            No signup, no emails. Just your nickname for the gallery.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter a nickname..."
                maxLength={20}
                required
                className="w-full bg-white border-2 border-retro-dark px-4 py-3 font-mono text-center text-lg placeholder-retro-dark/30 focus:outline-none focus:border-retro-accent rounded-md"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-retro-shutter hover:bg-red-700 text-white font-mono uppercase tracking-wider text-sm font-bold py-4 px-6 border-b-4 border-retro-dark border-r-2 active:border-b-0 active:border-r-0 active:translate-y-1 rounded-md transition-all shadow-md"
            >
              Grab a Camera
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
