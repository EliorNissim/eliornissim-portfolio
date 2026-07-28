/* =====================================================
   TWEAKS SYNC — shared across all pages
   Reads localStorage 'elior_tweaks' and applies globally
   ===================================================== */

(function() {
  const TWEAK_DEFAULTS = {
    accentCyan: '#00d4c8',
    heroLayout: 'center',
    grain: true,
    glow: true,
    cols: 'auto'
  };

  function getTweaks() {
    try {
      return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('elior_tweaks') || '{}') };
    } catch(e) { return { ...TWEAK_DEFAULTS }; }
  }

  function applyAccent(hex) {
    document.documentElement.style.setProperty('--accent-cyan', hex);
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    document.documentElement.style.setProperty('--accent-cyan-dim', `rgba(${r},${g},${b},0.15)`);
  }

  function applyGrain(on) {
    document.body.classList.toggle('no-grain', !on);
  }

  function applyGlow(on) {
    document.body.classList.toggle('no-glow', !on);
  }

  function applyCols(val) {
    document.querySelectorAll('.media-grid:not(.media-grid--dense)').forEach(grid => {
      if (val === 'auto') {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(380px, 1fr))';
      } else if (val === '1') {
        grid.style.gridTemplateColumns = '1fr';
      } else if (val === '2') {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      } else if (val === '4') {
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    const t = getTweaks();
    applyAccent(t.accentCyan);
    applyGrain(t.grain);
    applyGlow(t.glow);
    applyCols(t.cols);
  });

  // Apply accent immediately before DOMContentLoaded for no-flash
  const t = getTweaks();
  applyAccent(t.accentCyan);

  window.eliorTweaks = { getTweaks, applyAccent, applyGrain, applyGlow, applyCols };
})();
