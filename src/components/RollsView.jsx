import React, { useState, useEffect } from 'react';
import { Plus, Link2, Copy, Check, Film, Users, ChevronRight, Loader, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function RollsView({ nickname, sessionId, onJoinRoll }) {
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);

  const fetchRolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rolls')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setRolls(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolls();
  }, []);

  const generateSlug = (name) => {
    const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 30);
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim() || creating) return;

    setCreating(true);
    try {
      const rollId = crypto.randomUUID();
      const slug = generateSlug(createName);

      const newRoll = {
        id: rollId,
        slug,
        name: createName.trim(),
        description: createDescription.trim(),
        created_by: nickname || 'Anonymous',
        session_id: sessionId
      };

      const { data, error } = await supabase
        .from('rolls')
        .insert([newRoll])
        .select()
        .single();

      if (error) throw error;

      setRolls(prev => [data, ...prev]);
      setCreateName('');
      setCreateDescription('');
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create roll. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const copyShareLink = (slug) => {
    const url = `${window.location.origin}/roll/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  };

  const getFormatDate = (dateString) => {
    const d = new Date(dateString);
    const month = d.toLocaleString('default', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-retro-dark/10">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-retro-dark/60 mb-1">
            🎞️ Film Rolls
          </h2>
          <p className="font-handwritten text-2xl text-retro-dark/80">
            Create a roll for any occasion — share the link, everyone shoots.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-retro-shutter hover:bg-red-700 text-white font-mono text-xs uppercase tracking-wider font-bold px-5 py-3 border-2 border-retro-dark rounded-lg transition-all active:translate-y-0.5 shadow-[2px_2px_0px_#1a1410] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Roll</span>
        </button>
      </div>

      {/* ROLLS LIST */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="w-6 h-6 text-retro-accent animate-spin" />
        </div>
      ) : rolls.length === 0 ? (
        <div className="text-center py-20 bg-white/40 border-2 border-dashed border-retro-dark/20 rounded-xl">
          <Film className="w-12 h-12 text-retro-dark/30 mx-auto mb-3" />
          <h3 className="font-handwritten text-3xl text-retro-dark/70 mb-1">No rolls yet</h3>
          <p className="font-mono text-[10px] text-retro-dark/50 uppercase tracking-wider mb-6">
            Create your first roll for an event, party, or weekend trip!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-retro-accent hover:bg-retro-accent/90 text-retro-dark font-mono text-xs uppercase tracking-wider font-bold px-6 py-3 border-2 border-retro-dark rounded-lg transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Create First Roll
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rolls.map(roll => (
            <div
              key={roll.id}
              className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden hover:border-retro-accent transition-all group shadow-sm hover:shadow-md"
            >
              <div className="flex items-stretch">
                {/* Film strip side decoration */}
                <div className="w-10 bg-retro-dark flex flex-col items-center justify-center shrink-0">
                  <div className="space-y-1.5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-4 h-2 bg-zinc-800 border border-zinc-700 rounded-sm" />
                    ))}
                  </div>
                </div>

                {/* Roll info */}
                <div className="flex-grow p-5 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-handwritten text-3xl text-retro-dark leading-tight truncate">
                        {roll.name}
                      </h3>
                      {roll.description && (
                        <p className="font-mono text-[11px] text-retro-dark/60 mt-1 line-clamp-2">
                          {roll.description}
                        </p>
                      )}
                    </div>
                    {/* Photo count badge */}
                    <div className="bg-retro-dark text-retro-bg font-mono text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {roll.photo_count || 0}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 mt-3 text-retro-dark/50 font-mono text-[9px] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      By {roll.created_by}
                    </span>
                    <span>{getFormatDate(roll.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyShareLink(roll.slug); }}
                      className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all ${
                        copiedSlug === roll.slug
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-zinc-50 border-zinc-200 text-retro-dark/60 hover:bg-retro-accent/10 hover:border-retro-accent hover:text-retro-dark'
                      }`}
                    >
                      {copiedSlug === roll.slug ? (
                        <><Check className="w-3 h-3" /> Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Share Link</>
                      )}
                    </button>

                    <button
                      onClick={() => onJoinRoll(roll)}
                      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md border border-retro-accent bg-retro-accent/10 text-retro-dark hover:bg-retro-accent hover:text-retro-dark transition-all font-bold"
                    >
                      Open Roll <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE ROLL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-retro-dark/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-retro-bg border-4 border-retro-dark p-8 rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-retro-shutter via-retro-accent to-retro-shutter"></div>

            {/* Close button */}
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 bg-retro-dark/10 hover:bg-retro-dark/25 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs text-retro-dark font-black transition-all"
            >
              ✕
            </button>

            <div className="text-center relative">
              <div className="inline-block bg-retro-dark text-retro-bg font-mono px-3 py-1 text-xs uppercase tracking-widest mb-5">
                🎞️ New Film Roll
              </div>

              <h2 className="font-handwritten text-4xl mb-2 text-retro-dark leading-tight">
                What's this roll for?
              </h2>
              <p className="font-mono text-[10px] text-retro-dark/60 mb-6 uppercase tracking-wider">
                Name the occasion. Share the link. Everyone shoots into the same roll.
              </p>

              <form onSubmit={handleCreate} className="space-y-4 text-left">
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest text-retro-dark/60 block mb-1.5">
                    Roll Name *
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Jake's Wedding 2026"
                    maxLength={60}
                    required
                    className="w-full bg-white border-2 border-retro-dark px-4 py-3 font-handwritten text-xl placeholder-retro-dark/25 focus:outline-none focus:border-retro-accent rounded-md"
                  />
                </div>

                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest text-retro-dark/60 block mb-1.5">
                    Description <span className="text-retro-dark/30">(optional)</span>
                  </label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Snap anything from the rehearsal dinner to the after-party!"
                    maxLength={200}
                    rows={2}
                    className="w-full bg-white border-2 border-retro-dark px-4 py-3 font-mono text-xs placeholder-retro-dark/25 focus:outline-none focus:border-retro-accent rounded-md resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="w-full bg-retro-shutter hover:bg-red-700 text-white font-mono uppercase tracking-wider text-sm font-bold py-4 px-6 border-b-4 border-retro-dark border-r-2 active:border-b-0 active:border-r-0 active:translate-y-1 rounded-md transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Film className="w-4 h-4" /> Create Roll</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
