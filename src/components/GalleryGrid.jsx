import React, { useState, useEffect, useRef } from 'react';
import { Heart, Maximize2, Loader, Image as ImageIcon, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function GalleryGrid({ nickname, sessionId, rollId }) {
  const [photos, setPhotos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [likedPhotos, setLikedPhotos] = useState(() => {
    try {
      const saved = localStorage.getItem('flashback_liked_photos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeLightbox, setActiveLightbox] = useState(null);
  const wsRef = useRef(null);

  // Load initial photos
  const fetchPhotos = async (pageNum, replace = false) => {
    setLoading(true);
    try {
      const limit = 16;
      const offset = (pageNum - 1) * limit;
      
      let query = supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (rollId) {
        query = query.eq('roll_id', rollId);
      } else {
        query = query.is('roll_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (replace) {
        setPhotos(data || []);
      } else {
        // Prevent duplicate IDs when appending
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = (data || []).filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
      }
      
      setHasMore((data || []).length === limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPhotos([]);
    setPage(1);
    setHasMore(true);
    fetchPhotos(1, true);
  }, [rollId]);

  // Supabase Real-time
  useEffect(() => {
    const channel = supabase.channel('public:photos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' }, (payload) => {
        const photo = payload.new;
        if ((photo.roll_id || null) !== (rollId || null)) return;
        setPhotos(prev => {
          if (prev.some(p => p.id === photo.id)) return prev;
          return [photo, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'photos' }, (payload) => {
        const photo = payload.new;
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likes: photo.likes } : p));
        setActiveLightbox(prev => (prev && prev.id === photo.id) ? { ...prev, likes: photo.likes } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync liked list with local storage
  useEffect(() => {
    localStorage.setItem('flashback_liked_photos', JSON.stringify(likedPhotos));
  }, [likedPhotos]);

  // Load more pagination
  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPhotos(nextPage);
  };

  // Toggle photo like
  const handleLike = async (photoId, e) => {
    e.stopPropagation(); // Stop from opening lightbox
    
    const isLiked = likedPhotos.includes(photoId);
    
    // Optimistic local state update
    if (isLiked) {
      setLikedPhotos(prev => prev.filter(id => id !== photoId));
    } else {
      setLikedPhotos(prev => [...prev, photoId]);
    }

    try {
      if (isLiked) {
        // Delete like
        await supabase.from('photo_likes').delete().match({ photo_id: photoId, session_id: sessionId });
        // Fetch current photo and update likes count
        const { data: photoData } = await supabase.from('photos').select('likes').eq('id', photoId).single();
        const currentLikes = Math.max(0, (photoData?.likes || 0) - 1);
        await supabase.from('photos').update({ likes: currentLikes }).eq('id', photoId);
      } else {
        // Add like
        await supabase.from('photo_likes').insert([{ photo_id: photoId, session_id: sessionId }]);
        // Fetch current photo and update likes count
        const { data: photoData } = await supabase.from('photos').select('likes').eq('id', photoId).single();
        const currentLikes = (photoData?.likes || 0) + 1;
        await supabase.from('photos').update({ likes: currentLikes }).eq('id', photoId);
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic update on failure
      if (isLiked) {
        setLikedPhotos(prev => [...prev, photoId]);
      } else {
        setLikedPhotos(prev => prev.filter(id => id !== photoId));
      }
    }
  };

  // Consistent ID-seeded random rotation so cards tilt nicely
  const getTiltAngle = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const angle = (hash % 35) / 10; // keep tilt between -3.5 and +3.5 deg
    return angle;
  };

  const getFormatDate = (dateString) => {
    const d = new Date(dateString);
    const year = String(d.getFullYear()).slice(-2);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `'${year}/${month}/${day}`;
  };

  const handleDownload = async (photoUrl, photoName) => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `flashback-${photoName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* GALLERY STATUS BAR */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-retro-dark/10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-retro-dark/60">
          🎞️ Photo Roll — {photos.length} Captured
        </h2>
        <div className="flex items-center gap-1.5 font-mono text-xs text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full animate-pulse">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          <span>Real-time Live</span>
        </div>
      </div>

      {photos.length === 0 && !loading ? (
        <div className="text-center py-20 bg-white/40 border-2 border-dashed border-retro-dark/20 rounded-xl">
          <ImageIcon className="w-12 h-12 text-retro-dark/30 mx-auto mb-3" />
          <h3 className="font-handwritten text-3xl text-retro-dark/70 mb-1">Gallery is empty</h3>
          <p className="font-mono text-[10px] text-retro-dark/50 uppercase tracking-wider">
            Be the first to wind the camera and snap a photo!
          </p>
        </div>
      ) : (
        /* POLAROID MASONRY GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 justify-items-center">
          {photos.map(photo => {
            const tilt = getTiltAngle(photo.id);
            const isLiked = likedPhotos.includes(photo.id);
            const photoUrl = photo.thumbnail || photo.url;
            
            return (
              <div
                key={photo.id}
                onClick={() => setActiveLightbox(photo)}
                style={{ transform: `rotate(${tilt}deg)` }}
                className="polaroid-card bg-white border border-zinc-200 p-3 pb-5 cursor-pointer rounded-sm flex flex-col w-full max-w-[240px]"
              >
                {/* Photo frame */}
                <div className="relative aspect-[4/3] bg-zinc-950 border border-zinc-300 overflow-hidden shadow-inner flex items-center justify-center">
                  <img
                    src={photoUrl}
                    alt={`Photo by ${photo.author_name}`}
                    loading="lazy"
                    className="w-full h-full object-cover filter brightness-[1.02] contrast-[1.02] developed-bloom"
                  />
                  {/* Subtle grain overlay inside photo frame */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle,_transparent_60%,_rgba(0,0,0,0.15)_100%)] pointer-events-none" />
                </div>
                
                {/* Polaroid Bottom caption (Handwritten) */}
                <div className="mt-4 flex flex-col justify-between h-12 relative">
                  <div className="flex justify-between items-start">
                    <span className="font-handwritten text-2xl text-retro-dark/85 leading-none tracking-wide truncate max-w-[150px]" title={photo.author_name}>
                      {photo.author_name}
                    </span>
                    <span className="font-mono text-[9px] text-[#e76f51] leading-none mt-1.5 font-bold tracking-tighter">
                      {getFormatDate(photo.created_at)}
                    </span>
                  </div>

                  {/* Reaction panel */}
                  <div className="flex justify-end items-center mt-2">
                    <button
                      onClick={(e) => handleLike(photo.id, e)}
                      className={`flex items-center gap-1 group transition-all duration-100 hover:scale-110 active:scale-95 px-2 py-0.5 rounded ${
                        isLiked 
                          ? 'text-red-500 bg-red-50' 
                          : 'text-retro-dark/40 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title={isLiked ? 'Unlike' : 'Like photo'}
                    >
                      <Heart 
                        className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : 'group-hover:fill-current'}`} 
                      />
                      <span className="font-mono text-[10px] font-bold">
                        {photo.likes || 0}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader className="w-6 h-6 text-retro-accent animate-spin" />
        </div>
      )}

      {/* PAGINATION PAGELOAD BUTTON */}
      {hasMore && !loading && photos.length > 0 && (
        <div className="flex justify-center mt-12">
          <button
            onClick={handleLoadMore}
            className="bg-transparent hover:bg-retro-dark hover:text-retro-bg text-retro-dark border-2 border-retro-dark font-mono text-xs uppercase tracking-wider py-3 px-8 rounded-md transition-all active:translate-y-0.5"
          >
            Load Older Photos 🎞️
          </button>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {activeLightbox && (
        <div
          className="fixed inset-0 bg-retro-dark/95 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setActiveLightbox(null)}
        >
          {/* Polaroid card styled modal */}
          <div
            className="bg-white border-2 border-zinc-300 p-4 pb-6 rounded-md max-w-lg w-full shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close indicator */}
            <button
              onClick={() => setActiveLightbox(null)}
              className="absolute top-2 right-2 bg-retro-dark/10 hover:bg-retro-dark/25 w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs text-retro-dark font-black transition-all"
            >
              ✕
            </button>

            {/* Photo */}
            <div className="relative w-full aspect-[4/3] bg-zinc-950 border border-zinc-300 overflow-hidden shadow-inner flex items-center justify-center">
              <img
                src={activeLightbox.url}
                alt={`Lightbox view by ${activeLightbox.author_name}`}
                className="w-full h-full object-contain filter brightness-[1.02] contrast-[1.02]"
              />
              {/* Subtle vignette inside lightbox photo */}
              <div className="absolute inset-0 bg-[radial-gradient(circle,_transparent_50%,_rgba(0,0,0,0.35)_100%)] pointer-events-none" />
            </div>

            {/* Polaroid Label details */}
            <div className="mt-6 flex justify-between items-end">
              <div>
                <span className="font-handwritten text-4xl text-retro-dark/90 block leading-tight">
                  By {activeLightbox.author_name}
                </span>
                <span className="font-mono text-xs text-zinc-500 block mt-1">
                  Captured at {new Date(activeLightbox.created_at).toLocaleString()}
                </span>
              </div>

              {/* Actions on Lightbox */}
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(activeLightbox.url, activeLightbox.author_name);
                  }}
                  className="flex items-center gap-1.5 transition-all duration-100 hover:scale-105 active:scale-95 py-2 px-3 rounded-md border text-retro-dark/60 border-zinc-200 hover:text-retro-dark hover:bg-zinc-100"
                  title="Download photo"
                >
                  <Download className="w-4 h-4" />
                  <span className="font-mono text-xs font-bold">Save</span>
                </button>

                <button
                  onClick={(e) => handleLike(activeLightbox.id, e)}
                  className={`flex items-center gap-1.5 transition-all duration-100 hover:scale-105 active:scale-95 py-2 px-3 rounded-md border ${
                    likedPhotos.includes(activeLightbox.id)
                      ? 'text-red-500 bg-red-50 border-red-200'
                      : 'text-retro-dark/60 border-zinc-200 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${likedPhotos.includes(activeLightbox.id) ? 'fill-current' : ''}`} />
                  <span className="font-mono text-xs font-bold">
                    {activeLightbox.likes || 0}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
