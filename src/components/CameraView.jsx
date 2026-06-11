import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Sparkles } from 'lucide-react';

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
  const [readyToSnap, setReadyToSnap] = useState(() => {
    return localStorage.getItem('flashback_ready_to_snap') !== 'false';
  });
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
    localStorage.setItem('flashback_ready_to_snap', readyToSnap);
  }, [filmCounter, readyToSnap]);

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
      const formData = new FormData();
      formData.append('photo', photoBlob, `snapshot-${Date.now()}.jpg`);
      formData.append('author_name', nickname);
      formData.append('session_id', sessionId);
      if (rollId) formData.append('roll_id', rollId);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      // Wait for developer bar to finish
      setTimeout(() => {
        clearInterval(interval);
        setDevelopingProgress(100);
        
        setTimeout(() => {
          setIsDeveloping(false);
          setDevelopingPhoto(null);
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
          // Decrement film roll
          setFilmCounter(prev => prev - 1);
          setReadyToSnap(false);
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

    if (filmCounter <= 0) {
      alert("Roll finished! You'll need to drop off this roll first.");
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo is too large! Maximum limit is 10MB.');
      return;
    }

    setFilmCounter(prev => prev - 1);
    setReadyToSnap(false);
    developPhoto(file);
  };

  // Reset roll counter
  const resetRoll = () => {
    setFilmCounter(27);
    setReadyToSnap(true);
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

      {/* RETAIL SHOT / ROLL FINISHED PANEL */}
      {filmCounter <= 0 && !isDeveloping ? (
        <div className="bg-retro-dark text-retro-bg p-8 rounded-xl border-4 border-retro-accent shadow-2xl text-center w-full my-8">
          <div className="text-6xl mb-4">🎞️</div>
          <h2 className="font-handwritten text-5xl mb-4 text-retro-accent">Roll finished!</h2>
          <p className="font-mono text-xs text-retro-bg/60 uppercase tracking-widest mb-6">
            Drop it off to process the negative film.
          </p>
          <button
            onClick={resetRoll}
            className="w-full bg-retro-accent text-retro-dark font-mono uppercase font-bold py-3 px-6 rounded-md hover:bg-retro-accent/90 border-2 border-retro-dark transition-all active:translate-y-0.5"
          >
            Insert New Film Roll
          </button>
        </div>
      ) : (
        <>
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

              {/* Status LED Light */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[7px] text-zinc-400 uppercase tracking-wider">Ready LED</span>
                <div 
                  className={`w-3 h-3 rounded-full border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] ${
                    readyToSnap && !isWinding ? 'bg-green-500 shadow-[0_0_8px_#10b981]' : 'bg-red-600 shadow-[0_0_4px_#ef4444]'
                  }`}
                />
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

              {/* Unwound Viewfinder shade */}
              {!readyToSnap && !isDeveloping && (
                <div className="absolute inset-0 bg-[#3b0000]/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
                  <p className="text-retro-bg font-handwritten text-4xl rotate-[-4deg] drop-shadow-md">
                    WIND FILM! ↺
                  </p>
                  <p className="font-mono text-[9px] uppercase text-zinc-300 mt-2 tracking-wider">
                    Spin Winding Wheel in Top Right
                  </p>
                </div>
              )}
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

              {/* Camera Lens Circle Graphic */}
              <div className="w-12 h-12 bg-gradient-to-br from-zinc-700 to-zinc-900 border-[3px] border-retro-dark rounded-full shadow-inner flex items-center justify-center relative">
                <div className="w-7 h-7 bg-zinc-950 rounded-full border border-zinc-800 flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-900 rounded-full shadow-[0_0_3px_rgba(59,130,246,0.6)]" />
                </div>
              </div>

              {/* Front/Rear Lens Switcher */}
              {hasCamera && (
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={toggleCamera}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 rounded-lg border-2 border-retro-dark transition-all active:translate-y-0.5"
                    title="Switch Camera View"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-[8px] text-zinc-400 uppercase tracking-wider">Flip</span>
                </div>
              )}
            </div>
          </div>

          {/* PHYSICAL CAMERA BODY PARTS OUTSIDE (Top Shutter & Winding Wheel) */}
          <div className="w-full flex justify-between items-start px-8 -mt-[258px] mb-[215px] pointer-events-none relative z-10">
            {/* Shutter Button (Clickable, but visually floats above the body) */}
            <div className="pointer-events-auto flex flex-col items-center">
              <button
                onClick={takePhoto}
                disabled={!readyToSnap || isWinding || isDeveloping}
                className={`w-14 h-6 rounded-t-lg border-x-4 border-t-4 border-retro-dark transition-all duration-75 relative shadow-[0_-4px_6px_rgba(0,0,0,0.3)] ${
                  readyToSnap && !isDeveloping
                    ? 'bg-retro-shutter active:h-2 active:mt-4 hover:brightness-105'
                    : 'bg-zinc-700 opacity-60 h-3 mt-3'
                }`}
                title="Shutter Button"
              />
              <span className="font-mono text-[8px] font-bold text-retro-dark uppercase tracking-widest mt-1">
                SHUTTER
              </span>
            </div>

            <div className="flex gap-4 items-end">
              {/* LCD SHOTS REMAINING COUNTER */}
              <div className="bg-[#100c0a] border-4 border-retro-dark p-2 rounded flex flex-col items-center justify-center text-center shadow-inner select-none pointer-events-auto min-w-[54px]">
                <div className="font-mono text-red-600 text-sm font-black tracking-widest lcd-glow leading-none">
                  {String(filmCounter).padStart(2, '0')}
                </div>
                <div className="font-mono text-[6px] text-zinc-500 uppercase mt-0.5 tracking-wider font-bold">
                  S. Left
                </div>
              </div>

              {/* Tactile Winding Wheel */}
              <div className="pointer-events-auto flex flex-col items-center">
                <button
                  onClick={windFilm}
                  disabled={readyToSnap || isWinding || isDeveloping}
                  className={`w-14 h-8 bg-zinc-900 border-x-4 border-t-4 border-retro-dark rounded-t shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] relative overflow-hidden transition-all active:brightness-95 ${
                    readyToSnap || isDeveloping ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                  } ${isWinding ? 'animate-spin [animation-duration:0.2s]' : ''}`}
                  title="Wind Film"
                >
                  {/* Wheel Grooves */}
                  <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="w-1 h-full bg-zinc-800 border-x border-zinc-950" />
                    ))}
                  </div>
                </button>
                <span className="font-mono text-[8px] font-bold text-retro-dark uppercase tracking-widest mt-1">
                  WIND ↺
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
