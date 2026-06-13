import React, { useState, useEffect } from 'react';
import App from './App';
import LandingPage from './components/LandingPage';
import { AnimatePresence, motion } from 'framer-motion';

export default function Root() {
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    // If we're visiting a specific roll, skip the landing page
    if (window.location.pathname.match(/^\/roll\/([a-z0-9-]+)$/)) {
      setShowLanding(false);
    }
  }, []);

  const handleEnter = () => {
    setShowLanding(false);
  };

  return (
    <div className="w-full min-h-screen relative overflow-x-hidden">
      <AnimatePresence mode="wait">
        {showLanding ? (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="w-full relative z-50 bg-[#0a0806]"
          >
            <LandingPage onEnter={handleEnter} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="min-h-screen relative z-0"
          >
            <App />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
