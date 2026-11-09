import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

const FONT_CSS = `
  @keyframes svaraFloat {
    0%   { opacity:0; transform:translateY(0) translateX(0) scale(1); }
    15%  { opacity:0.85; }
    80%  { opacity:0.15; }
    100% { opacity:0; transform:translateY(-130px) translateX(var(--drift,0px)) scale(0.2); }
  }
  @keyframes svaraHeadlineIn {
    from { opacity:0; transform:translateY(-16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes svaraSubIn {
    from { opacity:0; letter-spacing:0.5em; }
    to   { opacity:1; letter-spacing:0.35em; }
  }
`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function Box3D({ isOpen, W, H, D }) {
  const faceBase = {
    position: 'absolute',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    boxSizing: 'border-box',
  };

  const colors = {
    boxFront: '#332729', // Charcoal / burgundy deep tone
    boxSide: '#201819',
    boxTop: '#423336',
    boxBottom: '#181213',
    gold: '#e6cdb5',
    goldDim: '#d8b88a',
  };

  return (
    <div style={{ position: 'relative', width: W, height: H + D, transformStyle: 'preserve-3d' }}>
      {/* BODY */}
      <div style={{ position: 'absolute', top: D, width: W, height: H, transformStyle: 'preserve-3d' }}>
        {/* Front */}
        <div
          style={{
            ...faceBase,
            width: W,
            height: H,
            background: `linear-gradient(160deg, ${colors.boxFront}, #1c1416)`,
            border: '1px solid rgba(230,205,181,0.3)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
            transform: `translateZ(${D / 2}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span className="font-serif italic text-champagne-300 font-bold" style={{ fontSize: W * 0.12 }}>SVARA</span>
          <span className="font-sans italic text-[9px] uppercase tracking-widest text-champagne-400 mt-1">wear your voice</span>
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              width: 32,
              height: 8,
              background: 'linear-gradient(135deg, #e6cdb5, #d8b88a)',
              borderRadius: 3,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}
          />
        </div>
        {/* Back */}
        <div style={{ ...faceBase, width: W, height: H, background: colors.boxSide, border: '1px solid rgba(230,205,181,0.1)', transform: `rotateY(180deg) translateZ(${D / 2}px)` }} />
        {/* Left */}
        <div style={{ ...faceBase, width: D, height: H, background: colors.boxSide, border: '1px solid rgba(230,205,181,0.1)', transform: `rotateY(-90deg) translateZ(${W / 2}px)` }} />
        {/* Right */}
        <div style={{ ...faceBase, width: D, height: H, background: colors.boxSide, border: '1px solid rgba(230,205,181,0.1)', transform: `rotateY(90deg) translateZ(${W / 2}px)` }} />
        {/* Bottom */}
        <div style={{ ...faceBase, width: W, height: D, background: colors.boxBottom, transform: `rotateX(-90deg) translateZ(${H}px)` }} />
        {/* Inner floor */}
        <div style={{ ...faceBase, width: W, height: D, background: 'linear-gradient(180deg, #2b1f21, #181213)', transform: 'rotateX(90deg) translateZ(0px)' }} />
      </div>

      {/* LID */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          width: W,
          height: D,
          transformStyle: 'preserve-3d',
          transformOrigin: `center ${D}px`,
          transform: isOpen ? 'rotateX(115deg)' : 'rotateX(0deg)',
          transition: 'transform 1.4s cubic-bezier(0.4,0,0.15,1), opacity 0.3s ease 1.1s',
          opacity: isOpen ? 0 : 1,
        }}
      >
        <div
          style={{
            ...faceBase,
            width: W,
            height: D,
            background: `linear-gradient(160deg, ${colors.boxTop}, #241a1c)`,
            border: '1px solid rgba(230,205,181,0.3)',
            transform: `rotateX(90deg) translateZ(${D / 2}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ position: 'absolute', width: '100%', height: 2, background: 'linear-gradient(90deg, transparent, rgba(230,205,181,0.6), transparent)', top: '50%', transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', height: '100%', width: 2, background: 'linear-gradient(180deg, transparent, rgba(230,205,181,0.6), transparent)', left: '50%', transform: 'translateX(-50%)' }} />
          <span className="font-serif italic text-champagne-300 text-xs font-bold z-10">✦ SVARA ✦</span>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ isOpen, label, delay, targetX, targetY, imgSrc, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: isOpen
          ? `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(1)`
          : 'translate(-50%, -50%) scale(0.05)',
        opacity: isOpen ? 1 : 0,
        transition: `transform 1.1s cubic-bezier(0.15,0.9,0.3,1.05) ${delay}s, opacity 0.7s ease ${delay}s`,
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: isOpen ? 'auto' : 'none',
        cursor: 'pointer',
      }}
    >
      <div className="relative group p-2 rounded-2xl glass bg-white/70 hover:bg-white hover:scale-110 transition-transform shadow-lg border border-champagne-200">
        <img
          src={imgSrc}
          alt={label}
          draggable={false}
          className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl"
        />
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-charcoal-700 text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm">
          {label}
        </span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-charcoal-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
        Tap to Curate
      </span>
    </div>
  );
}

export default function SvaraBox() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [particles, setParticles] = useState([]);
  const particleId = useRef(0);

  const W = isMobile ? 140 : 200;
  const H = isMobile ? 100 : 140;
  const D = isMobile ? 140 : 200;

  // Items floating around the box
  const items = isMobile
    ? [
        { key: 'dress', label: 'Dress', delay: 0.5, tx: -90, ty: -140, img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300' },
        { key: 'handbag', label: 'Handbag', delay: 0.6, tx: 90, ty: -140, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300' },
        { key: 'footwear', label: 'Footwear', delay: 0.7, tx: -90, ty: 140, img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300' },
        { key: 'earrings', label: 'Earrings', delay: 0.8, tx: 90, ty: 140, img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300' },
      ]
    : [
        { key: 'dress', label: 'Signature Dresses', delay: 0.5, tx: -190, ty: -120, img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300' },
        { key: 'handbag', label: 'Luxury Handbags', delay: 0.65, tx: 190, ty: -120, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300' },
        { key: 'footwear', label: 'Designer Footwear', delay: 0.8, tx: -190, ty: 110, img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300' },
        { key: 'earrings', label: 'Artisanal Earrings', delay: 0.95, tx: 190, ty: 110, img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300' },
      ];

  useEffect(() => {
    if (!document.querySelector('#svara-box-styles')) {
      const s = document.createElement('style');
      s.id = 'svara-box-styles';
      s.textContent = FONT_CSS;
      document.head.appendChild(s);
    }
  }, []);

  const burst = () => {
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const id = particleId.current++;
        setParticles(prev => [
          ...prev.slice(-25),
          {
            id,
            x: `${40 + Math.random() * 20}%`,
            y: `${35 + Math.random() * 30}%`,
            size: 2 + Math.random() * 3,
            duration: 2 + Math.random() * 2,
            drift: (Math.random() - 0.5) * 60,
          },
        ]);
      }, i * 50);
    }
  };

  const handleBoxClick = () => {
    burst();
    setIsOpen(prev => !prev);
  };

  const handleItemClick = (categoryKey) => {
    navigate(`/curate?stage=${categoryKey}`);
  };

  return (
    <div className="relative w-full min-h-[550px] sm:min-h-[600px] flex flex-col items-center justify-center overflow-hidden py-12">
      {/* Background glow bloom */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-champagne-300/20 blur-3xl pointer-events-none" />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: '#e6cdb5',
              animation: `svaraFloat ${p.duration}s ease-in forwards`,
              '--drift': `${p.drift}px`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div className="relative z-10 text-center space-y-2 mb-6 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-champagne-100 text-champagne-700 text-xs font-semibold tracking-widest uppercase">
          <Sparkles size={13} />
          Interactive Atelier Reveal
        </span>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-800">
          The SVARA Signature Experience
        </h2>
        <p className="text-xs text-charcoal-400 max-w-md mx-auto">
          {isOpen
            ? 'Tap any designer piece to launch its sequential styling stage.'
            : 'Click or hover the signature box to unlock our curated ensemble stages.'}
        </p>
      </div>

      {/* 3D Box Stage */}
      <div className="relative z-10 flex items-center justify-center w-full max-w-xl h-80">
        {/* Floating Product Cards */}
        {items.map((item) => (
          <ItemCard
            key={item.key}
            isOpen={isOpen}
            label={item.label}
            delay={item.delay}
            targetX={item.tx}
            targetY={item.ty}
            imgSrc={item.img}
            onClick={() => handleItemClick(item.key)}
          />
        ))}

        {/* 3D Box Element */}
        <div
          onClick={handleBoxClick}
          onMouseEnter={() => { if (!isMobile) { burst(); setIsOpen(true); } }}
          onMouseLeave={() => { if (!isMobile) { setIsOpen(false); } }}
          style={{
            perspective: isMobile ? 600 : 900,
            perspectiveOrigin: '50% 40%',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transform: isOpen
                ? 'rotateX(14deg) rotateY(-20deg) scale(1.04)'
                : 'rotateX(12deg) rotateY(-16deg)',
              transition: 'transform 0.5s ease',
            }}
          >
            <Box3D isOpen={isOpen} W={W} H={H} D={D} />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center z-10">
        <Button variant="outline" size="sm" onClick={() => navigate('/curate')}>
          <span>Explore Sequential Curations</span>
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
