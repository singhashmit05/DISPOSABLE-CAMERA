import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CameraView({ nickname, sessionId, onPhotoUploaded, rollId }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // default to rear camera on mobile
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  // Retro features
  const [filmCounter, setFilmCounter] = useState(() => {
    const saved = localStorage.getItem('flashback_film_counter');
    return saved !== null ? parseInt(saved, 10) : 27;
  });
  const [readyToSnap, setReadyToSnap] = useState(true);
  const [isWinding, setIsWinding] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [developingProgress, setDevelopingProgress] = useState(0);
  const [developingPhoto, setDevelopingPhoto] = useState(null);
  const [cameraAspect, setCameraAspect] = useState('aspect-[4/3]');

  // Initialize camera stream
  const startCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      setCameraError(null);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setHasCamera(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      setCameraError(err.message || 'Could not access device camera');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Save film states
  useEffect(() => {
    localStorage.setItem('flashback_film_counter', filmCounter);
  }, [filmCounter]);

  // Audio Synthesizers (Web Audio API)
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Shutter slide noise
      const bufferSize = ctx.sampleRate * 0.12; // 120ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      // Mechanical click
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.04);

      oscGain.gain.setValueAtTime(0.4, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.start();
      osc.start();
      noise.stop(ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) {
      console.warn('Audio Context failed', e);
    }
  };

  const playWindSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Chain of clicks for winding sprocket teeth
      const clickCount = 10;
      const duration = 0.8; // 800ms
      for (let i = 0; i < clickCount; i++) {
        const time = ctx.currentTime + (i * (duration / clickCount));
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.linearRampToValueAtTime(300, time + 0.03);

        oscGain.gain.setValueAtTime(0.18, time);
        oscGain.gain.exponentialRampToValueAtTime(0.005, time + 0.035);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.04);
      }
    } catch (e) {
      console.warn('Audio Context failed', e);
    }
  };

  // Turn front/back
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Perform film winding
  const windFilm = () => {
    if (readyToSnap || isWinding || filmCounter <= 0) return;
    
    setIsWinding(true);
    playWindSound();

    setTimeout(() => {
      setIsWinding(false);
      setReadyToSnap(true);
    }, 1000);
  };

  // Trigger developer overlay & send photo to backend
  const developPhoto = async (photoBlob) => {
    setIsDeveloping(true);
    setDevelopingProgress(0);

    // Make local object URL to display fading preview in dark room
    const previewUrl = URL.createObjectURL(photoBlob);
    setDevelopingPhoto(previewUrl);

    // Progress counter (3 seconds)
    const interval = setInterval(() => {
      setDevelopingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 150);

    try {
      const fileExt = 'jpg';
      const fileName = `snapshot-${Date.now()}.${fileExt}`;
      const filePath = `${sessionId}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, photoBlob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      const fileId = crypto.randomUUID();

      // Insert record to database
      const photoRecord = {
        id: fileId,
        url: publicUrl,
        thumbnail: publicUrl, // Using the same URL for simplicity
        author_name: nickname,
        session_id: sessionId,
        roll_id: rollId || null
      };

      const { data: photo, error: dbError } = await supabase
        .from('photos')
        .insert([photoRecord])
        .select()
        .single();

      if (dbError) throw dbError;

      // Increment roll photo_count
      if (rollId) {
        const { data: rollData } = await supabase.from('rolls').select('photo_count').eq('id', rollId).single();
        const newCount = (rollData?.photo_count || 0) + 1;
        await supabase.from('rolls').update({ photo_count: newCount }).eq('id', rollId);
      }
      
      const result = { photo };
      
      // Wait for developer bar to finish
      setTimeout(() => {
        clearInterval(interval);
        setDevelopingProgress(100);
        
        setTimeout(() => {
          setIsDeveloping(false);
          setDevelopingPhoto(null);
          setReadyToSnap(true);
          // Callback to switch to gallery
          if (onPhotoUploaded) onPhotoUploaded(result.photo);
        }, 500);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert('Developing failed! Please try again.');
      setIsDeveloping(false);
      setDevelopingPhoto(null);
      clearInterval(interval);
    }
  };

  // Shutter action
  const takePhoto = () => {
    if (!readyToSnap || isWinding || filmCounter <= 0 || !stream || isDeveloping) return;

    // Flash screen
    setIsFlashActive(true);
    playShutterSound();
    
    setTimeout(() => {
      setIsFlashActive(false);
    }, 600);

    // Draw frame to canvas
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = (1200 * video.videoHeight) / video.videoWidth;
      const ctx = canvas.getContext('2d');

      // Mirror if front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Restore transform if mirrored so watermark writes correctly
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // Add retro timestamp watermark
      const now = new Date();
      const year = String(now.getFullYear()).slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dateStr = `'${year} ${month} ${day} ${hours}:${minutes}`;

      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = 'rgba(235, 94, 40, 0.85)'; // retro orange
      ctx.shadowColor = 'rgba(235, 94, 40, 0.5)';
      ctx.shadowBlur = 6;
      
      const textWidth = ctx.measureText(dateStr).width;
      // Bottom right watermark
      ctx.fillText(dateStr, canvas.width - textWidth - 45, canvas.height - 45);

      canvas.toBlob((blob) => {
        if (blob) {
          // Decrement film roll (loops back to 27 automatically)
          setFilmCounter(prev => prev <= 1 ? 27 : prev - 1);
          setReadyToSnap(false);
          setIsWinding(true);
          playWindSound();
          setTimeout(() => setIsWinding(false), 1000);
          // Develop!
          developPhoto(blob);
        }
      }, 'image/jpeg', 0.85);
    }
  };

  // Local file upload fallback
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;



    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo is too large! Maximum limit is 10MB.');
      return;
    }

    setFilmCounter(prev => prev <= 1 ? 27 : prev - 1);
    setReadyToSnap(false);
    setIsWinding(true);
    playWindSound();
    setTimeout(() => setIsWinding(false), 1000);
    developPhoto(file);
  };



  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-lg mx-auto select-none">
      {/* FLASH OVERLAY */}
      {isFlashActive && (
        <div className="fixed inset-0 bg-white z-50 animate-flash pointer-events-none" />
      )}

      {/* DEVELOPING OVERLAY */}
      {isDeveloping && (
        <div className="fixed inset-0 bg-retro-developing z-50 flex flex-col items-center justify-center p-6 text-red-500">
          <div className="w-full max-w-sm border-2 border-red-800 p-8 rounded-lg bg-black/40 text-center relative overflow-hidden">
            {/* Darkroom glowing light indicator */}
            <div className="w-3 h-3 bg-red-600 rounded-full animate-ping mx-auto mb-6 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            
            <h3 className="font-handwritten text-4xl text-retro-bg mb-2">Developing...</h3>
            <p className="font-mono text-xs tracking-wider uppercase mb-8 text-red-400">Do not close this tab</p>
            
            {/* Image Bloom Container */}
            {developingPhoto && (
              <div className="w-48 h-36 bg-zinc-950 border border-red-900 mx-auto mb-8 rounded overflow-hidden shadow-inner flex items-center justify-center">
                <img 
                  src={developingPhoto} 
                  alt="Developing preview" 
                  className="w-full h-full object-cover filter sepia brightness-[0.25] saturate-150 contrast-125 select-none"
                />
              </div>
            )}

            {/* Developing Progress Bar */}
            <div className="w-full bg-red-950 h-2 rounded overflow-hidden">
              <div 
                className="bg-red-600 h-full transition-all duration-150"
                style={{ width: `${developingProgress}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-red-400 mt-2 text-right">
              {developingProgress}% STAMPED
            </div>
          </div>
        </div>
      )}

          {/* CAMERA BODY FRONT */}
          <div className="w-full bg-[#1e1a17] plastic-texture border-[6px] border-retro-dark rounded-3xl p-5 shadow-2xl relative overflow-hidden">
            {/* Cardboard Card Overlay Sticker */}
            <div className="absolute inset-x-0 top-0 h-4 bg-yellow-500 border-b-2 border-retro-dark"></div>
            <div className="absolute inset-x-0 bottom-0 h-3 bg-retro-accent border-t border-retro-dark"></div>
            
            {/* Branding Details */}
            <div className="flex justify-between items-start mt-2 mb-4">
              <div>
                <h1 className="font-mono font-black italic text-lg tracking-tight text-white flex items-center gap-1 leading-none">
                  FLASHBACK <span className="text-yellow-500 text-xs not-italic font-bold">🎞️</span>
                </h1>
                <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-400">
                  Single-Use Cardboard Camera
                </span>
              </div>

              {/* Status & Counter */}
              <div className="flex items-center gap-4">
                {hasCamera && (
                  <button
                    onClick={toggleCamera}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 p-1.5 rounded border border-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] transition-all active:scale-95 pointer-events-auto"
                    title="Switch Camera View"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}

                <div className="bg-[#100c0a] border-2 border-retro-dark px-2 py-0.5 rounded flex items-center justify-center shadow-inner select-none pointer-events-auto">
                  <div className="font-mono text-red-600 text-[10px] font-black tracking-widest lcd-glow leading-none mr-1">
                    {String(filmCounter).padStart(2, '0')}
                  </div>
                  <div className="font-mono text-[5px] text-zinc-500 uppercase tracking-wider font-bold">
                    Left
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[7px] text-zinc-400 uppercase tracking-wider">Ready</span>
                  <div 
                    className={`w-2.5 h-2.5 rounded-full border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] ${
                      readyToSnap && !isWinding ? 'bg-green-500 shadow-[0_0_8px_#10b981]' : 'bg-red-600 shadow-[0_0_4px_#ef4444]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* VIEWFINDER CHAMBER */}
            <div className="relative bg-[#0d0a08] border-4 border-retro-dark rounded-xl overflow-hidden shadow-inner aspect-[4/3] flex items-center justify-center group">
              {hasCamera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover filter sepia-[0.15] brightness-[1.05] contrast-[1.05] ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                  <p className="font-mono text-xs text-zinc-500">{cameraError || 'No camera access'}</p>
                </div>
              )}

              {/* Cardboard Border Frame Overlay */}
              <div className="absolute inset-0 border-[12px] border-retro-dark/15 pointer-events-none vignette" />

              {/* Small HUD specs */}
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-mono text-zinc-300 uppercase tracking-widest">
                ISO 400 • F/8 • {facingMode === 'user' ? 'FRONT' : 'REAR'}
              </div>


            </div>

            {/* LOWER CONTROLS & CAMERA BACK DETAILS */}
            <div className="flex justify-between items-center mt-4 pt-2 border-t border-zinc-800">
              
              {/* Secondary Local Upload Button */}
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 rounded-lg border-2 border-retro-dark transition-all active:translate-y-0.5"
                  title="Upload from Local Gallery"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="font-mono text-[8px] text-zinc-400 uppercase tracking-wider">Import</span>
              </div>

              {/* Shutter Button (In place of Lens Graphic) */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={takePhoto}
                  disabled={!readyToSnap || isWinding || isDeveloping}
                  className={`w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-950 border-[4px] border-retro-dark rounded-full shadow-xl flex items-center justify-center relative transition-all active:scale-95 active:shadow-inner ${
                    readyToSnap && !isDeveloping ? 'cursor-pointer hover:border-zinc-700' : 'opacity-50 cursor-not-allowed'
                  }`}
                  title="Take Photo"
                >
                  <div className={`w-12 h-12 rounded-full border border-black flex items-center justify-center transition-colors shadow-inner ${
                    readyToSnap && !isDeveloping ? 'bg-retro-shutter hover:bg-red-600' : 'bg-zinc-800'
                  }`} />
                </button>
                <span className="font-mono text-[9px] font-bold text-retro-shutter uppercase tracking-widest">Snap</span>
              </div>


              {/* Empty placeholder to balance flex-between */}
              <div className="w-12 h-12" />
            </div>
          </div>
    </div>
  );
}
