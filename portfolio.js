/* =====================================================
   ELIOR NISSIM PORTFOLIO - JAVASCRIPT
   Renders CONTENT_DATA (content.js) into project strips,
   accordion, lightbox, edit mode (text / tags / reorder),
   header scroll, mobile nav.
   ===================================================== */

// Set to false before publishing - hides the Edit button entirely.
const EDIT_MODE_ENABLED = false;

const OVERRIDES_KEY = 'elior_content_overrides';

// ---- Software icon definitions ----
const SW_ICONS = {
  unity:      { label: 'Unity',      img: 'media/icons/unity.svg' },
  maya:       { label: 'Maya',       img: 'media/icons/maya.svg' },
  zbrush:     { label: 'ZBrush',     img: 'media/icons/zbrush.svg' },
  substance:  { label: 'Substance',  img: 'media/icons/substance-painter.svg' },
  figma:      { label: 'Figma',      img: 'media/icons/figma.svg' },
  photoshop:  { label: 'Photoshop',  img: 'media/icons/photoshop.svg' },
  illustrator:{ label: 'Illustrator',img: 'media/icons/illustrator.svg' },
  davinci:    { label: 'DaVinci',    img: 'media/icons/davinci-resolve.svg' },
  blender:    { label: 'Blender',    img: 'media/icons/blender.svg' },
  unreal:     { label: 'Unreal',     img: 'media/icons/unreal.svg' },
  // `note` renders a small tooltip: hover on desktop, tap on touch devices
  procreate:  { label: 'Procreate',  img: 'media/icons/procreate.svg',
                note: 'Hand textured by Ofek Saroya' },
  xd: {
    label: 'Adobe XD',
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="4" fill="#470137" opacity="0.9"/><text x="16" y="22" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="14" fill="#FF61F6" letter-spacing="0.5">XD</text></svg>`
  },
};

/* =====================================================
   CONTENT STORE - base data + localStorage overrides
   ===================================================== */

let editMode = false;

function _readOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); }
  catch (e) { return {}; }
}

const _saveTimers = {};
function saveOverride(kind, id, patch) {
  // Debounced read-modify-write per kind:id
  const key = kind + ':' + id;
  clearTimeout(_saveTimers[key]);
  _saveTimers[key] = setTimeout(() => {
    const ov = _readOverrides();
    ov[kind] = ov[kind] || {};
    ov[kind][id] = { ...(ov[kind][id] || {}), ...patch };
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(ov)); } catch (e) {}
  }, 250);
}

// Base data + overrides merged. Returns a deep clone - safe to mutate.
function loadContent() {
  const base = JSON.parse(JSON.stringify(window.CONTENT_DATA || { projects: [] }));
  const ov = _readOverrides();
  const pOv = ov.projects || {}, sOv = ov.sections || {}, iOv = ov.items || {};

  base.projects.forEach(project => {
    const po = pOv[project.id];
    if (po) {
      if (po.title != null) project.title = po.title;
      if (po.desc != null) project.desc = po.desc;
    }
    project.sections.forEach(section => {
      const so = sOv[section.id];
      if (so) {
        if (so.title != null) section.title = so.title;
        if (so.desc != null) section.desc = so.desc;
      }
      section.items.forEach(item => {
        const io = iOv[item.id];
        if (io) {
          if (io.desc != null) item.desc = io.desc;
          if (io.software != null) item.software = io.software.slice();
        }
      });
      // Reorder items: ids in `order` first (in that order), unknown ids ignored,
      // ids missing from `order` appended in base order.
      if (so && Array.isArray(so.order)) {
        const byId = {};
        section.items.forEach(it => { byId[it.id] = it; });
        const ordered = [];
        so.order.forEach(id => { if (byId[id]) { ordered.push(byId[id]); delete byId[id]; } });
        section.items.forEach(it => { if (byId[it.id]) ordered.push(it); });
        section.items = ordered;
      }
    });
  });
  // Site-wide texts (hero, footer)
  base.site = base.site || {};
  if (ov.site && ov.site.main) Object.assign(base.site, ov.site.main);

  // CV page texts, keyed by selector+index (see CV_EDIT_SELECTORS)
  base.cv = base.cv || {};
  if (ov.cv) Object.entries(ov.cv).forEach(([key, patch]) => {
    if (patch && patch.html != null) base.cv[key] = patch.html;
  });
  return base;
}

/* =====================================================
   BADGES / MADE-WITH ROW
   ===================================================== */

function makeBadge(swKey) {
  const sw = SW_ICONS[swKey];
  if (!sw) return document.createTextNode('');
  const badge = document.createElement('span');
  badge.className = 'sw-badge';
  badge.dataset.sw = swKey;

  const iconWrap = document.createElement('span');
  iconWrap.className = 'sw-badge-icon';
  iconWrap.setAttribute('aria-hidden', 'true');

  if (sw.img) {
    const img = document.createElement('img');
    img.src = sw.img;
    img.alt = '';
    img.width = 20;
    img.height = 20;
    img.style.cssText = 'display:block;width:20px;height:20px;';
    iconWrap.appendChild(img);
  } else if (sw.svg) {
    const tmp = document.createElement('div');
    tmp.innerHTML = sw.svg;
    const svgEl = tmp.querySelector('svg');
    if (svgEl) {
      svgEl.setAttribute('width', '20');
      svgEl.setAttribute('height', '20');
      svgEl.style.cssText = 'display:block;width:20px;height:20px;flex-shrink:0;';
      iconWrap.appendChild(svgEl);
    }
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = 'sw-badge-label';
  labelSpan.textContent = sw.label;

  badge.appendChild(iconWrap);
  badge.appendChild(labelSpan);

  // Optional note tooltip (e.g. Procreate credit)
  if (sw.note) {
    badge.classList.add('sw-badge--note');
    const tip = document.createElement('span');
    tip.className = 'sw-badge-tip';
    tip.textContent = sw.note;
    badge.appendChild(tip);
    // Touch devices have no hover - tap toggles the tooltip
    badge.addEventListener('click', e => {
      if (window.matchMedia('(hover: hover)').matches) return;
      e.stopPropagation();
      const wasOpen = badge.classList.contains('tip-open');
      document.querySelectorAll('.sw-badge.tip-open').forEach(b => b.classList.remove('tip-open'));
      if (!wasOpen) {
        badge.classList.add('tip-open');
        const close = ev => {
          if (!badge.contains(ev.target)) {
            badge.classList.remove('tip-open');
            document.removeEventListener('pointerdown', close, true);
          }
        };
        document.addEventListener('pointerdown', close, true);
      }
    });
  }

  return badge;
}

// "Made with" row; in edit mode adds remove buttons + an add-tag picker.
function makeMadeWithRow(item) {
  const madeWith = document.createElement('div');
  madeWith.className = 'made-with-row';
  const mwLabel = document.createElement('span');
  mwLabel.className = 'made-with-label';
  mwLabel.textContent = 'Made with:';
  madeWith.appendChild(mwLabel);

  item.software.forEach(swKey => {
    const badge = makeBadge(swKey);
    if (editMode && badge.nodeType === 1) {
      const rm = document.createElement('button');
      rm.className = 'sw-badge-remove';
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove tag');
      rm.textContent = '×';
      rm.addEventListener('click', e => {
        e.stopPropagation();
        item.software = item.software.filter(k => k !== swKey);
        saveOverride('items', item.id, { software: item.software.slice() });
        rebuildRow();
      });
      badge.appendChild(rm);
    }
    madeWith.appendChild(badge);
  });

  if (editMode) {
    const addBtn = document.createElement('button');
    addBtn.className = 'sw-add-btn';
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', 'Add tag');
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const existing = madeWith.querySelector('.sw-picker');
      if (existing) { existing.remove(); return; }
      const picker = document.createElement('div');
      picker.className = 'sw-picker';
      const remaining = Object.keys(SW_ICONS).filter(k => !item.software.includes(k));
      if (remaining.length === 0) {
        const none = document.createElement('span');
        none.className = 'sw-picker-empty';
        none.textContent = 'All tags added';
        picker.appendChild(none);
      }
      remaining.forEach(k => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'sw-picker-opt';
        opt.appendChild(makeBadge(k));
        opt.addEventListener('click', ev => {
          ev.stopPropagation();
          item.software.push(k);
          saveOverride('items', item.id, { software: item.software.slice() });
          rebuildRow();
        });
        picker.appendChild(opt);
      });
      madeWith.appendChild(picker);
      // Close on outside click
      const close = ev => {
        if (!picker.contains(ev.target) && ev.target !== addBtn) {
          picker.remove();
          document.removeEventListener('pointerdown', close, true);
        }
      };
      document.addEventListener('pointerdown', close, true);
    });
    madeWith.appendChild(addBtn);
  }

  function rebuildRow() {
    const fresh = makeMadeWithRow(item);
    madeWith.replaceWith(fresh);
  }

  return madeWith;
}

/* =====================================================
   MEDIA CARDS
   ===================================================== */

// One shared observer: card videos play only while the thumbnail is
// fully on screen - saves CPU/data for anything partially visible.
const _videoObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const vid = entry.target;
    if (entry.intersectionRatio >= 0.95) vid.play().catch(() => {});
    else vid.pause();
  });
}, { threshold: [0, 0.95] });

function isVideoSrc(src) {
  return /\.(mp4|webm|mov)$/i.test(src);
}

function makeMediaCard(item, section, hoverPlay) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.itemId = item.id;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'View');

  const thumb = document.createElement('div');
  thumb.className = 'media-thumb';

  const url = encodeURI(item.src);
  if (isVideoSrc(item.src)) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.setAttribute('muted', '');
    vid.loop = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.preload = 'metadata';
    vid.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    if (item.poster) {
      vid.poster = encodeURI(item.poster);
      vid.preload = 'none';
    }
    thumb.appendChild(vid);
    if (hoverPlay || item.poster) {
      // Plays only while the pointer is over the card
      card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
      card.addEventListener('mouseleave', () => {
        vid.pause();
        if (item.poster) vid.load(); // reset so the poster shows again
      });
    } else {
      _videoObserver.observe(vid);
    }
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    thumb.appendChild(img);
  }

  const badge = document.createElement('span');
  badge.className = 'media-type-badge';
  badge.textContent = item.type === 'video' ? '▶ Video' : '⬛ Image';
  thumb.appendChild(badge);

  if (!editMode) {
    const hoverOverlay = document.createElement('div');
    hoverOverlay.className = 'media-thumb-hover';
    const hoverText = document.createElement('span');
    hoverText.className = 'media-thumb-hover-text';
    hoverText.textContent = 'View';
    hoverOverlay.appendChild(hoverText);
    thumb.appendChild(hoverOverlay);
  }

  const info = document.createElement('div');
  info.className = 'media-info';

  const desc = document.createElement('div');
  desc.className = 'media-desc';
  desc.innerHTML = item.desc;
  makeEditable(desc, 'items', item.id, 'desc');

  info.appendChild(desc);
  info.appendChild(makeMadeWithRow(item));

  card.appendChild(thumb);
  card.appendChild(info);

  if (!editMode) {
    card.addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(section.items, section.items.indexOf(item));
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(section.items, section.items.indexOf(item));
      }
    });
  } else {
    initCardDrag(card, section);
  }

  return card;
}

/* =====================================================
   RENDER
   ===================================================== */

let _content = null; // current merged content (live-mutated by edit mode)

function renderAll() {
  _content = loadContent();
  _collapseWraps = [];
  _content.projects.forEach(project => {
    const bar = document.querySelector('.acc-bar[data-bar="' + project.id + '"]');
    if (!bar) return;

    const barTitle = bar.querySelector('.acc-bar-title');
    barTitle.textContent = _plainText(project.title);

    const inner = bar.querySelector('.acc-content-inner');
    inner.innerHTML = '';

    const h2 = document.createElement('h2');
    h2.className = 'acc-section-title';
    h2.innerHTML = project.title;
    makeEditable(h2, 'projects', project.id, 'title', () => {
      barTitle.textContent = _plainText(h2.innerHTML);
    });
    inner.appendChild(h2);

    const pDesc = document.createElement('div');
    pDesc.className = 'acc-section-desc';
    pDesc.innerHTML = project.desc;
    makeEditable(pDesc, 'projects', project.id, 'desc');
    inner.appendChild(pDesc);

    project.sections.forEach(section => {
      const sub = document.createElement('div');
      sub.className = 'acc-subsection';

      const h3 = document.createElement('h3');
      h3.className = 'acc-sub-title';
      h3.innerHTML = section.title;
      makeEditable(h3, 'sections', section.id, 'title');
      sub.appendChild(h3);

      const sDesc = document.createElement('div');
      sDesc.className = 'acc-sub-desc';
      sDesc.innerHTML = section.desc;
      makeEditable(sDesc, 'sections', section.id, 'desc');
      sub.appendChild(sDesc);

      // "Other Projects": videos play on hover only, and long galleries
      // collapse to one row + a faded second row behind a See more button.
      const hoverPlay = project.id === 'other';

      const grid = document.createElement('div');
      grid.className = 'media-grid' + (section.items.length > 9 ? ' media-grid--dense' : '');
      grid.dataset.sectionId = section.id;
      section.items.forEach(item => grid.appendChild(makeMediaCard(item, section, hoverPlay)));

      if (hoverPlay && !editMode && section.items.length > 3) {
        const wrap = document.createElement('div');
        wrap.className = 'grid-collapse';
        wrap.appendChild(grid);
        sub.appendChild(wrap);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'see-more-btn';
        btn.textContent = 'See more';
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const expanded = wrap.classList.toggle('expanded');
          btn.textContent = expanded ? 'See less' : 'See more';
          if (expanded) wrap.style.maxHeight = 'none';
          else { _applyCollapseHeight(wrap); wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
          refreshOpenBarHeight();
        });
        sub.appendChild(btn);
        _collapseWraps.push(wrap);
      } else {
        sub.appendChild(grid);
      }

      inner.appendChild(sub);
    });
  });
  _collapseWraps.forEach(w => _applyCollapseHeight(w));
  renderSiteTexts();
  renderCvTexts();
  applyPortrait();
  refreshOpenBarHeight();
}

/* =====================================================
   SITE TEXTS (hero + footer) - editable, saved as
   overrides kind 'site', id 'main'
   ===================================================== */

const SITE_FIELDS = {
  heroName:  '.hero-name',
  titleMain: '.hero-titles-main',
  titleSub:  '.hero-titles-sub',
  bio1:      '.hero-bio-main',
  bio2:      '.hero-bio-secondary',
  bio3:      '.hero-bio-closing',
  footer:    '.site-footer p'
};

function renderSiteTexts() {
  const site = (_content && _content.site) || {};
  Object.entries(SITE_FIELDS).forEach(([field, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    // The static HTML is the default when no saved text exists
    if (el.dataset.defaultHtml == null) el.dataset.defaultHtml = el.innerHTML;
    el.innerHTML = site[field] != null ? site[field] : el.dataset.defaultHtml;
    if (editMode) {
      el.setAttribute('contenteditable', 'true');
      el.classList.add('editable');
      el.dataset.edit = 'site:main:' + field;
      if (!el.dataset.editWired) {
        el.dataset.editWired = '1';
        el.addEventListener('input', () => saveOverride('site', 'main', { [field]: el.innerHTML }));
        el.addEventListener('click', e => e.stopPropagation());
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('keydown', e => e.stopPropagation());
      }
    } else {
      el.removeAttribute('contenteditable');
      el.classList.remove('editable');
    }
  });
}

/* =====================================================
   CV PAGE TEXTS - editable, saved as overrides kind 'cv'
   keyed by "<selector>#<index>" so keys stay stable.
   ===================================================== */

const CV_EDIT_SELECTORS = [
  '.cv-name',
  '.cv-subtitle-main',
  '.cv-subtitle-sub',
  '.cv-contacts span',
  '.cv-section-label',
  '.cv-summary-text',
  '.skill-group-title',
  '.skill-tag',
  '.cv-entry-title',
  '.cv-entry-org',
  '.cv-entry-date',
  '.cv-entry-bullets li',
  '.cv-entry-desc',
  '.sw-item span'
];

function renderCvTexts() {
  if (!document.querySelector('.cv-main')) return;
  const saved = (_content && _content.cv) || {};

  CV_EDIT_SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      const key = sel + '#' + i;
      if (el.dataset.defaultHtml == null) el.dataset.defaultHtml = el.innerHTML;
      el.innerHTML = saved[key] != null ? saved[key] : el.dataset.defaultHtml;

      // Company logos live inside .cv-entry-org - keep them out of editing
      el.querySelectorAll('img').forEach(img => img.setAttribute('contenteditable', 'false'));

      if (editMode) {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('editable');
        el.dataset.edit = 'cv:' + key + ':html';
        if (!el.dataset.cvWired) {
          el.dataset.cvWired = '1';
          el.addEventListener('input', () => saveOverride('cv', key, { html: el.innerHTML }));
          el.addEventListener('click', e => e.stopPropagation());
        }
      } else {
        el.removeAttribute('contenteditable');
        el.classList.remove('editable');
      }
    });
  });
}

/* =====================================================
   HERO PORTRAIT - size/position stored in site.portrait,
   draggable + resizable in edit mode
   ===================================================== */

let _portraitHandle = null;
let _portraitCanvas = null;

// True when the click lands on a visible (non-transparent) pixel of the PNG
function _portraitAlphaHit(img, cx, cy) {
  try {
    if (!_portraitCanvas) {
      _portraitCanvas = document.createElement('canvas');
      _portraitCanvas.width = img.naturalWidth;
      _portraitCanvas.height = img.naturalHeight;
      _portraitCanvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
    }
    const r = img.getBoundingClientRect();
    const x = Math.floor((cx - r.left) / r.width * img.naturalWidth);
    const y = Math.floor((cy - r.top) / r.height * img.naturalHeight);
    if (x < 0 || y < 0 || x >= img.naturalWidth || y >= img.naturalHeight) return false;
    return _portraitCanvas.getContext('2d').getImageData(x, y, 1, 1).data[3] > 12;
  } catch (e) {
    return true; // canvas unavailable - treat the whole image as solid
  }
}

// While a text box is being edited, the portrait yields all pointer events;
// clicking outside the text box hands priority back to the portrait.
document.addEventListener('focusin', e => {
  if (!editMode) return;
  const img = document.querySelector('.cv-portrait');
  if (!img) return;
  if (e.target.closest && e.target.closest('[contenteditable="true"]')) {
    img.classList.add('portrait-yield');
  }
});
document.addEventListener('focusout', () => {
  setTimeout(() => {
    const img = document.querySelector('.cv-portrait');
    if (!img) return;
    const a = document.activeElement;
    if (!a || !a.closest || !a.closest('[contenteditable="true"]')) {
      img.classList.remove('portrait-yield');
    }
  }, 0);
});

// The CV portrait is the editable one; the hero portrait is retired.
// Desktop position/size is stored in site.cvPortrait {top, right, h};
// on mobile the CSS placement is left alone.
function _portraitEl() {
  return document.querySelector('.cv-portrait');
}

function _portraitIsEditable() {
  return window.matchMedia('(min-width: 769px)').matches;
}

function applyPortrait() {
  const img = _portraitEl();
  if (!img) return;
  if (!_portraitIsEditable()) {
    // Mobile: clear inline styles so the stylesheet's placement wins
    img.style.height = '';
    img.style.top = '';
    img.style.right = '';
    return;
  }
  const p = (_content && _content.site && _content.site.cvPortrait) || {};
  if (p.h != null)     img.style.height = p.h + 'px';
  if (p.top != null)   img.style.top = p.top + 'px';
  if (p.right != null) img.style.right = p.right + 'px';
  _positionPortraitHandle();
}

function _portraitState() {
  return { ...((_content.site && _content.site.cvPortrait) || {}) };
}

function _savePortrait(next) {
  _content.site = _content.site || {};
  _content.site.cvPortrait = next;
  applyPortrait();
}

function _positionPortraitHandle() {
  if (!_portraitHandle) return;
  const img = _portraitEl();
  const host = document.querySelector('.cv-hero');
  if (!img || !host) return;
  const ir = img.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  _portraitHandle.style.left = (ir.left - hr.left - 9) + 'px';
  _portraitHandle.style.top = (ir.bottom - hr.top - 9) + 'px';
}

function initPortraitEdit(on) {
  const img = _portraitEl();
  const host = document.querySelector('.cv-hero');
  if (!img || !host) return;
  const active = on && _portraitIsEditable();
  img.classList.toggle('portrait-editable', active);

  if (!active) {
    if (_portraitHandle) { _portraitHandle.remove(); _portraitHandle = null; }
    return;
  }

  if (!_portraitHandle) {
    const h = document.createElement('div');
    h.className = 'portrait-resize-handle';
    h.title = 'Drag to resize';
    host.appendChild(h);
    _portraitHandle = h;

    h.addEventListener('pointerdown', e => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      const start = _portraitState();
      const startH = img.getBoundingClientRect().height;
      const sy = e.clientY;
      const move = ev => {
        const nh = Math.max(60, Math.round(startH + (ev.clientY - sy)));
        _savePortrait({ ...start, h: nh });
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        saveOverride('site', 'main', { cvPortrait: _content.site.cvPortrait });
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }
  _positionPortraitHandle();

  if (!img.dataset.portraitWired) {
    img.dataset.portraitWired = '1';
    img.addEventListener('pointerdown', e => {
      if (!editMode || !_portraitIsEditable()) return;
      // Transparent pixel? Let the click fall through to the text underneath.
      if (!_portraitAlphaHit(img, e.clientX, e.clientY)) {
        img.style.pointerEvents = 'none';
        const below = document.elementFromPoint(e.clientX, e.clientY);
        img.style.pointerEvents = '';
        const ed = below && below.closest && below.closest('[contenteditable="true"]');
        if (ed) {
          ed.focus();
          if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
        return;
      }
      e.preventDefault();
      const start = _portraitState();
      const rect = img.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const baseTop = start.top != null ? start.top : Math.round(rect.top - hostRect.top);
      const baseRight = start.right != null ? start.right : Math.round(hostRect.right - rect.right);
      const sx = e.clientX, sy = e.clientY;
      const move = ev => {
        _savePortrait({
          ...start,
          top: Math.round(baseTop + (ev.clientY - sy)),
          right: Math.round(baseRight - (ev.clientX - sx))
        });
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        saveOverride('site', 'main', { cvPortrait: _content.site.cvPortrait });
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }
}

/* =====================================================
   HERO BACKGROUND VIDEO - pause when scrolled off screen
   ===================================================== */

/* =====================================================
   DOWNLOAD PDF - prints the CV through the browser's
   "Save as PDF", styled by the @media print rules
   ===================================================== */

// The deployed site ships a PDF pre-rendered by headless Chrome at build time
// (build-site.sh flips this flag), so every device downloads the same one-page
// file instead of relying on its own print engine. Locally it falls back to print.
const CV_PDF_STATIC = true;
const CV_PDF_URL = 'Elior_Nissim_CV.pdf?b=1791135845';

function initDownloadPdf() {
  const btn = document.getElementById('download-pdf');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Leave edit mode first so outlines/handles never land in the PDF
    if (editMode) setEditMode(false);
    if (CV_PDF_STATIC) {
      const a = document.createElement('a');
      a.href = CV_PDF_URL;
      a.download = 'Elior_Nissim_CV.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.print();
  });
}

// Showreel width: full page width, but never wider than a 16:9 frame at the
// monitor's height. Only on screens wider than 16:9 (ultrawide) is the video
// narrower than the page - then its sides fade to black. Uses the monitor's
// shape, not the window's (a maximised window is always wider than 16:9).
function sizeHeroReel() {
  const bg = document.querySelector('.hero-bg');
  if (!bg) return;
  const maxW = Math.round(screen.height * 16 / 9);
  bg.style.setProperty('--reel-max-w', maxW + 'px');
  bg.classList.toggle('reel-faded', bg.clientWidth > maxW + 1);
}

function initHeroVideo() {
  const vid = document.querySelector('.hero-bg-video');
  if (!vid) return;
  sizeHeroReel();
  window.addEventListener('resize', sizeHeroReel);
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) vid.play().catch(() => {});
      else vid.pause();
    });
  }, { threshold: 0 });
  io.observe(vid);
}

// ---- Collapsed gallery height: one full row + a peek of the second ----
let _collapseWraps = [];

function _applyCollapseHeight(wrap) {
  const grid = wrap.querySelector('.media-grid');
  const card = grid && grid.querySelector('.media-card');
  if (!card) return;
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 24;
  wrap.style.maxHeight = (card.offsetHeight + gap + card.offsetHeight * 0.45) + 'px';
}

window.addEventListener('resize', () => {
  _collapseWraps.forEach(w => { if (!w.classList.contains('expanded')) _applyCollapseHeight(w); });
});

function _plainText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').trim();
}

/* =====================================================
   LIGHTBOX - single item enlarge, prev/next across the
   sub-section. Closing never touches accordion/scroll.
   ===================================================== */

let _lightboxEl = null;
let _lbState = { items: [], idx: 0 };

function _buildLightbox() {
  if (_lightboxEl) return;

  const overlay = document.createElement('div');
  overlay.id = 'gallery-lightbox';
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&#x2715;</button>
    <button class="lightbox-prev" aria-label="Previous">&#8249;</button>
    <div class="lightbox-stage">
      <div class="lightbox-media"></div>
      <div class="lightbox-caption">
        <div class="lightbox-desc"></div>
        <div class="lightbox-made-with"></div>
      </div>
    </div>
    <button class="lightbox-next" aria-label="Next">&#8250;</button>
  `;
  document.body.appendChild(overlay);
  _lightboxEl = overlay;

  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  overlay.querySelector('.lightbox-prev').addEventListener('click', () => _navigateLb(-1));
  overlay.querySelector('.lightbox-next').addEventListener('click', () => _navigateLb(1));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!_lightboxEl || !_lightboxEl.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') _navigateLb(-1);
    if (e.key === 'ArrowRight') _navigateLb(1);
  });
}

function openLightbox(items, idx) {
  _buildLightbox();
  _lbState.items = items;
  _lbState.idx = Math.max(0, idx);
  _renderLbSlide();
  _lightboxEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!_lightboxEl) return;
  _lightboxEl.classList.remove('open');
  document.body.style.overflow = '';
  // Clear media so looping videos actually stop
  const mediaEl = _lightboxEl.querySelector('.lightbox-media');
  mediaEl.querySelectorAll('video').forEach(v => v.pause());
  mediaEl.innerHTML = '';
}

function _navigateLb(dir) {
  _lbState.idx = Math.max(0, Math.min(_lbState.items.length - 1, _lbState.idx + dir));
  _renderLbSlide();
}

function _renderLbSlide() {
  const item = _lbState.items[_lbState.idx];
  if (!item) return;

  const mediaEl = _lightboxEl.querySelector('.lightbox-media');
  const descEl  = _lightboxEl.querySelector('.lightbox-desc');
  const mwEl    = _lightboxEl.querySelector('.lightbox-made-with');
  const prevBtn = _lightboxEl.querySelector('.lightbox-prev');
  const nextBtn = _lightboxEl.querySelector('.lightbox-next');

  mediaEl.innerHTML = '';
  const url = encodeURI(item.src);
  if (isVideoSrc(item.src)) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.controls = true;
    vid.autoplay = true;
    vid.muted = true;
    vid.setAttribute('muted', '');
    vid.loop = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    if (item.poster) vid.poster = encodeURI(item.poster);
    mediaEl.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.alt = _plainText(item.desc);
    mediaEl.appendChild(img);
  }

  descEl.innerHTML = item.desc;
  mwEl.innerHTML = '';
  item.software.forEach(swKey => mwEl.appendChild(makeBadge(swKey)));

  const showNav = _lbState.items.length > 1;
  prevBtn.style.display = showNav ? '' : 'none';
  nextBtn.style.display = showNav ? '' : 'none';
  prevBtn.disabled = _lbState.idx === 0;
  nextBtn.disabled = _lbState.idx === _lbState.items.length - 1;
}

/* =====================================================
   ACCORDION
   ===================================================== */

const COLLAPSED_H = 80;
const CLOSE_STRIP_H = 15;   // top band of an open strip that closes it
let _openBar = null;

function _setOpenHeight(bar) {
  const content = bar.querySelector('.acc-bar-content');
  if (!content) return;
  // The open content sits closer to the top than the collapsed header does,
  // so measure its actual offset rather than assuming COLLAPSED_H.
  const top = parseFloat(getComputedStyle(content).top) || 0;
  bar.style.height = (top + content.scrollHeight) + 'px';
}

function refreshOpenBarHeight() {
  if (_openBar) _setOpenHeight(_openBar);
}

function initAccordion() {
  const bars = document.querySelectorAll('.acc-bar');

  function openBar(bar) {
    // aria-expanded first: it drives the CSS that sets the content offset
    bar.setAttribute('aria-expanded', 'true');
    _openBar = bar;
    _setOpenHeight(bar);
  }

  function closeBar(bar) {
    bar.style.height = COLLAPSED_H + 'px';
    bar.setAttribute('aria-expanded', 'false');
    if (_openBar === bar) _openBar = null;
  }

  // Content that changes size (videos loading metadata, edit-mode text growth,
  // drag reflow) re-syncs the open bar's height.
  const ro = new ResizeObserver(() => refreshOpenBarHeight());
  bars.forEach(bar => {
    const inner = bar.querySelector('.acc-content-inner');
    if (inner) ro.observe(inner);
  });

  bars.forEach(bar => {
    bar.addEventListener('mouseenter', () => {
      if (bar.getAttribute('aria-expanded') !== 'true') {
        bar.style.height = (COLLAPSED_H * 2) + 'px';
      }
    });
    bar.addEventListener('mouseleave', () => {
      if (bar.getAttribute('aria-expanded') !== 'true') {
        bar.style.height = COLLAPSED_H + 'px';
      }
    });

    bar.addEventListener('click', e => {
      // On an open strip, the top 15px acts as a close bar
      if (bar.getAttribute('aria-expanded') === 'true') {
        const fromTop = e.clientY - bar.getBoundingClientRect().top;
        if (fromTop >= 0 && fromTop <= CLOSE_STRIP_H) {
          closeBar(bar);
          return;
        }
      }
      // Clicks inside the open content must never toggle the strip
      if (e.target.closest('.acc-bar-content')) return;
      const isOpen = bar.getAttribute('aria-expanded') === 'true';
      bars.forEach(b => closeBar(b));
      if (!isOpen) {
        openBar(bar);
        setTimeout(() => {
          const top = bar.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }, 60);
      }
    });

    bar.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.acc-bar-content')) {
        e.preventDefault();
        bar.click();
      }
    });
  });
}

/* =====================================================
   EDIT MODE - text editing, tags, drag reorder, save
   ===================================================== */

const _editDebounce = {};

// Makes an element contenteditable in edit mode and wires override saving.
function makeEditable(el, kind, id, field, onInput) {
  if (!editMode) return;
  el.setAttribute('contenteditable', 'true');
  el.classList.add('editable');
  el.dataset.edit = kind + ':' + id + ':' + field;
  el.addEventListener('input', () => {
    saveOverride(kind, id, { [field]: el.innerHTML });
    if (onInput) onInput();
  });
  // Don't let editing clicks bubble into card/lightbox behavior
  el.addEventListener('click', e => e.stopPropagation());
  el.addEventListener('keydown', e => e.stopPropagation());
  el.addEventListener('pointerdown', e => e.stopPropagation());
}

// ---- Rich text mini toolbar ----
let _toolbarEl = null;

function _buildToolbar() {
  if (_toolbarEl) return;
  const tb = document.createElement('div');
  tb.id = 'rich-toolbar';
  tb.innerHTML = `
    <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
    <button type="button" data-cmd="smaller" title="Smaller text">A&#8722;</button>
    <button type="button" data-cmd="bigger" title="Bigger text">A+</button>
  `;
  document.body.appendChild(tb);
  _toolbarEl = tb;

  // Keep the text selection alive when clicking toolbar buttons
  tb.addEventListener('mousedown', e => e.preventDefault());

  const SIZES = ['1', '2', '3', '4', '5', '6', '7'];
  tb.addEventListener('click', e => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd === 'bold' || cmd === 'italic') {
      document.execCommand(cmd);
    } else {
      // Current size of selection (default 3), step up/down
      let cur = parseInt(document.queryCommandValue('fontSize') || '3', 10) || 3;
      cur = cmd === 'bigger' ? Math.min(7, cur + 1) : Math.max(1, cur - 1);
      document.execCommand('fontSize', false, SIZES[cur - 1]);
    }
    // Persist the edited element after formatting
    const sel = window.getSelection();
    const host = sel && sel.anchorNode &&
      (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const editable = host && host.closest('[data-edit]');
    if (editable) {
      const [kind, id, field] = editable.dataset.edit.split(':');
      saveOverride(kind, id, { [field]: editable.innerHTML });
      if (kind === 'projects' && field === 'title') {
        const bar = document.querySelector('.acc-bar[data-bar="' + id + '"] .acc-bar-title');
        if (bar) bar.textContent = _plainText(editable.innerHTML);
      }
    }
  });

  document.addEventListener('selectionchange', () => {
    if (!editMode) { tb.classList.remove('show'); return; }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { tb.classList.remove('show'); return; }
    const node = sel.anchorNode;
    const host = node && (node.nodeType === 1 ? node : node.parentElement);
    const editable = host && host.closest('[contenteditable="true"]');
    if (!editable) { tb.classList.remove('show'); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    tb.style.left = Math.max(8, rect.left + rect.width / 2 - tb.offsetWidth / 2) + 'px';
    tb.style.top = Math.max(8, rect.top - tb.offsetHeight - 10) + 'px';
    tb.classList.add('show');
  });
}

// ---- Drag & drop reorder (pointer events + FLIP) ----
function initCardDrag(card, section) {
  card.addEventListener('pointerdown', downEv => {
    if (downEv.button !== 0) return;
    // Don't start drags from text fields, tag buttons or pickers
    if (downEv.target.closest('[contenteditable], .sw-badge, .sw-add-btn, .sw-picker, button')) return;

    const grid = card.parentElement;
    const startX = downEv.clientX, startY = downEv.clientY;
    let dragging = false;
    let ghost = null;
    let offX = 0, offY = 0;

    function startDrag() {
      dragging = true;
      const rect = card.getBoundingClientRect();
      offX = startX - rect.left;
      offY = startY - rect.top;
      ghost = card.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.style.left = rect.left + 'px';
      ghost.style.top = rect.top + 'px';
      // Ghost videos: keep them still
      ghost.querySelectorAll('video').forEach(v => { v.autoplay = false; v.pause && v.pause(); });
      document.body.appendChild(ghost);
      card.classList.add('drag-placeholder');
      document.body.classList.add('dragging');
    }

    function onMove(moveEv) {
      if (!dragging) {
        if (Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY) < 6) return;
        startDrag();
      }
      ghost.style.left = (moveEv.clientX - offX) + 'px';
      ghost.style.top = (moveEv.clientY - offY) + 'px';

      // Find the sibling under the pointer and reposition the placeholder
      const siblings = Array.from(grid.children).filter(c => c !== card);
      for (const sib of siblings) {
        const r = sib.getBoundingClientRect();
        if (moveEv.clientX >= r.left && moveEv.clientX <= r.right &&
            moveEv.clientY >= r.top && moveEv.clientY <= r.bottom) {
          const after = (moveEv.clientX - r.left) > r.width / 2;
          const ref = after ? sib.nextSibling : sib;
          if (ref !== card && (ref !== card.nextSibling || after)) {
            _flipMove(grid, () => grid.insertBefore(card, ref));
          }
          break;
        }
      }
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if (!dragging) return;
      ghost.remove();
      card.classList.remove('drag-placeholder');
      document.body.classList.remove('dragging');
      // Persist new order + sync the in-memory section
      const order = Array.from(grid.children).map(c => c.dataset.itemId);
      const byId = {};
      section.items.forEach(it => { byId[it.id] = it; });
      section.items = order.map(id => byId[id]).filter(Boolean);
      saveOverride('sections', section.id, { order });
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

// FLIP-animate grid children across a DOM mutation
function _flipMove(grid, mutate) {
  const cards = Array.from(grid.children);
  const first = cards.map(c => c.getBoundingClientRect());
  mutate();
  cards.forEach((c, i) => {
    const last = c.getBoundingClientRect();
    const dx = first[i].left - last.left;
    const dy = first[i].top - last.top;
    if (dx || dy) {
      c.style.transition = 'none';
      c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(() => {
        c.style.transition = 'transform 0.22s ease';
        c.style.transform = '';
        setTimeout(() => { c.style.transition = ''; }, 260);
      });
    }
  });
}

// ---- Save to site (File System Access API, Chrome/Edge) ----
async function saveToSite() {
  const merged = loadContent();
  const text = '/* Generated by Edit Mode - ' + new Date().toISOString() + ' */\n' +
    'window.CONTENT_DATA = ' + JSON.stringify(merged, null, 2) + ';\n';
  if (!window.showSaveFilePicker) {
    alert('Save to site needs Chrome or Edge (File System Access API).');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'content.js',
      types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }]
    });
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
    // Base file now contains the edits - overrides are redundant
    localStorage.removeItem(OVERRIDES_KEY);
    location.reload();
  } catch (e) {
    if (e && e.name !== 'AbortError') {
      alert('Save failed: ' + e.message);
    }
  }
}

// ---- Edit mode toggle ----
function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
  const toggle = document.getElementById('edit-toggle');
  if (toggle) {
    toggle.classList.toggle('on', on);
    toggle.textContent = on ? 'Editing…' : 'Edit';
  }
  let saveBtn = document.getElementById('save-site-btn');
  if (on) {
    _buildToolbar();
    if (!saveBtn) {
      saveBtn = document.createElement('button');
      saveBtn.id = 'save-site-btn';
      saveBtn.type = 'button';
      saveBtn.innerHTML = '&#x1f4be; Save to site';
      saveBtn.addEventListener('click', saveToSite);
      document.body.appendChild(saveBtn);
    }
    saveBtn.hidden = false;
  } else if (saveBtn) {
    saveBtn.hidden = true;
    if (_toolbarEl) _toolbarEl.classList.remove('show');
  }
  renderAll();
  initPortraitEdit(on);
}

function initEditMode() {
  const toggle = document.getElementById('edit-toggle');
  if (!toggle) return;
  if (!EDIT_MODE_ENABLED) return; // stays hidden
  toggle.hidden = false;
  toggle.addEventListener('click', () => setEditMode(!editMode));
}

/* =====================================================
   HEADER / NAV / HERO / REVEAL
   ===================================================== */

function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

function initMobileNav() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobile-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    const spans = btn.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });
}

function styleHeroName() {
  const el = document.querySelector('.hero-name');
  if (!el) return;
  const text = el.textContent.trim();
  const parts = text.split(' ');
  if (parts.length >= 2) {
    el.innerHTML = parts.slice(0, -1).join(' ') + ' <span class="last">' + parts[parts.length - 1] + '</span>';
  }
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('animate-ready');
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.acc-bar').forEach(el => {
    el.classList.add('reveal-target');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('animate-ready');
        observer.observe(el);
      });
    });
  });
}

/* =====================================================
   INIT
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  initAccordion();
  initEditMode();
  initHeader();
  initMobileNav();
  styleHeroName();
  initScrollReveal();
  initHeroVideo();
  initDownloadPdf();
});
