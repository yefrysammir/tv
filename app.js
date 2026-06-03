/**
 * Salem TV v2.2 - Ultra optimizado
 * Agrupacion por groupName | Player 100% | Scroll fluido | Cache local
 * Sin CSS inline - todas las clases en styles.css
 */

const state = {
  rawChannels: [],
  banners: [],
  templates: {},
  groups: {},
  subGroups: {},
  currentGroupKey: null,
  currentChannel: null,
  isPlaying: false,
  searchQuery: ''
};

const CACHE_KEY = 'salem_cache_v22';
const CACHE_TTL = 1000 * 60 * 30;

const $ = id => document.getElementById(id);

// Elementos DOM
const preloader = $('preloader');
const homeView = $('homeView');
const playerView = $('playerView');
const searchInput = $('searchInput');
const searchClear = $('searchClear');
const resultsCount = $('resultsCount');
const sectionsWrap = $('sectionsWrap');
const emptyState = $('emptyState');
const playerBack = $('playerBack');
const playerTitle = $('playerTitle');
const playerVideo = $('playerVideo');
const playerFrame = $('playerFrame');
const playerLoader = $('playerLoader');
const iframeErrorOverlay = $('iframeErrorOverlay');
const optionsBtn = $('optionsBtn');
const refreshBtn = $('refreshBtn');
const sheetOverlay = $('sheetOverlay');
const optionsSheet = $('optionsSheet');
const sheetTitle = $('sheetTitle');
const sheetSubtitle = $('sheetSubtitle');
const sheetBody = $('sheetBody');
const sheetCancel = $('sheetCancel');
const infoBtn = $('infoBtn');
const qrBtn = $('qrBtn');
const infoOverlay = $('infoOverlay');
const infoSheet = $('infoSheet');
const infoCloseBtn = $('infoCloseBtn');
const qrContent = $('qrSheetContent');
const osBannerAndroid = $('osBannerAndroid');
const osBannerIOS = $('osBannerIOS');

// ===== UTILITY FUNCTIONS =====

const isDirectStream = url => {
  if (!url) return false;
  return ['.m3u8', '.mp4', '.webm', '.ts', '.m3u'].some(e => url.toLowerCase().includes(e));
};

const resolveUrl = ch => {
  if (ch.id && state.templates[ch.id]) {
    return state.templates[ch.id].replace(/\{DATAVALUE\}/gi, ch.dataValue);
  }
  return ch.url || ch.dataValue;
};

const norm = str => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ===== VISIBILITY HELPERS =====

const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');
const toggleVisible = (el, showIt) => el && el.classList.toggle('visible', showIt);
const openEl = el => el && el.classList.add('open');
const closeEl = el => el && el.classList.remove('open');

// ===== ANTI-INSPECCION =====

(function () {
  document.addEventListener('contextmenu', e => e.preventDefault(), true);
  document.addEventListener('selectstart', e => e.preventDefault(), true);
  ['copy', 'cut', 'paste'].forEach(evt => document.addEventListener(evt, e => e.preventDefault(), true));
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || e.keyCode === 123) e.preventDefault();
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) e.preventDefault();
    if (e.ctrlKey && e.key === 'U') e.preventDefault();
  }, true);
  let last = 0;
  document.addEventListener('touchend', e => {
    const n = Date.now();
    if (n - last <= 300) e.preventDefault();
    last = n;
  }, false);
  document.addEventListener('touchmove', e => {
    if (e.scale !== 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
})();

// ===== CACHE =====

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts < CACHE_TTL) return data;
  } catch (e) { }
  return null;
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      templates: state.templates,
      banners: state.banners,
      rawChannels: state.rawChannels,
      ts: Date.now()
    }));
  } catch (e) { }
}

// ===== DATA =====

function buildGroups() {
  const sections = {};
  const subGroups = {};

  state.rawChannels.forEach(ch => {
    const sectionKey = ch.groupName || ch.group || ch.dataValue;
    if (!sections[sectionKey]) sections[sectionKey] = [];
    sections[sectionKey].push(ch);
  });

  Object.entries(sections).forEach(([sectionKey, channels]) => {
    const subs = {};
    channels.forEach(ch => {
      const gk = ch.group || ch.dataValue;
      if (!subs[gk]) subs[gk] = [];
      subs[gk].push(ch);
    });
    subGroups[sectionKey] = subs;
  });

  state.groups = sections;
  state.subGroups = subGroups;
}

async function loadChannels() {
  const cached = loadCache();
  if (cached) {
    state.templates = cached.templates || {};
    state.banners = cached.banners || [];
    state.rawChannels = (cached.rawChannels || []).map(ch => ({ ...ch, resolvedUrl: resolveUrl(ch) }));
    buildGroups();
    renderHome();
  }

  try {
    const res = await fetch('channels.json', { cache: 'no-store' });
    const data = await res.json();
    state.templates = data.templates || {};
    state.banners = data.banners || [];
    state.rawChannels = (data.channels || []).map(ch => ({ ...ch, resolvedUrl: resolveUrl(ch) }));
    buildGroups();
    saveCache();
    renderHome();
  } catch (e) {
    if (!cached) {
      sectionsWrap.innerHTML = '';
      emptyState.querySelector('.empty-text').textContent = 'Error al cargar canales';
      emptyState.classList.add('visible');
    }
  } finally {
    setTimeout(() => preloader.classList.add('done'), cached ? 400 : 600);
  }
}

// ===== RENDER HOME =====

function renderHome() {
  const q = norm(state.searchQuery);
  const sections = Object.entries(state.subGroups);

  const filteredSections = q ? sections.filter(([, subs]) => {
    return Object.values(subs).some(group => group.some(ch =>
      norm(ch.name).includes(q) || norm(ch.description).includes(q) || norm(ch.dataValue).includes(q)
    ));
  }) : sections;

  const filteredBanners = q ? state.banners.filter(b =>
    norm(b.title).includes(q) || norm(b.description).includes(q)
  ) : state.banners;

  const totalSignals = filteredSections.reduce((s, [, subs]) =>
    s + Object.values(subs).reduce((a, g) => a + g.length, 0), 0);

  if (q) {
    resultsCount.textContent = `${filteredSections.length} secciones, ${filteredBanners.length} noticias, ${totalSignals} señales`;
    resultsCount.classList.add('visible');
  } else {
    resultsCount.classList.remove('visible');
  }

  sectionsWrap.innerHTML = '';

  if (filteredSections.length === 0 && filteredBanners.length === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  const frag = document.createDocumentFragment();
  let delay = 0;

  // Banners destacados
  if (filteredBanners.length) {
    const sec = document.createElement('section');
    sec.className = 'group-section';
    sec.style.animationDelay = `${delay * 0.05}s`;
    delay++;
    const bg = filteredBanners[0].image || '';
    sec.innerHTML = `<div class="section-bg" style="background-image:url('${bg}')"></div>
      <h2 class="section-title">Destacados</h2>
      <div class="carousel"><div class="carousel-track" id="bannerTrack"></div></div>`;
    const track = sec.querySelector('#bannerTrack');
    filteredBanners.forEach(b => {
      const card = document.createElement('div');
      card.className = 'banner-card';
      card.innerHTML = `<img src="${b.image || ''}" alt="${b.title}" loading="lazy" onerror="this.style.display='none'">
        <div class="card-overlay">
          <div class="card-badge">Noti</div>
          <div class="card-title">${b.title}</div>
          <div class="card-desc">${b.description || ''}</div>
        </div>`;
      card.addEventListener('click', () => openGenericSheet(b.title, b.description || 'Informacion', b.content || '<p>Sin contenido</p>'));
      track.appendChild(card);
    });
    frag.appendChild(sec);
  }

  // Secciones de canales
  filteredSections.forEach(([sectionName, subs]) => {
    const sec = document.createElement('section');
    sec.className = 'group-section';
    sec.style.animationDelay = `${delay * 0.05}s`;
    delay++;

    let bgImg = '';
    for (const group of Object.values(subs)) {
      const first = group[0];
      if (first.groupImage || first.image) { bgImg = first.groupImage || first.image; break; }
    }

    sec.innerHTML = `<div class="section-bg" style="background-image:url('${bgImg}')"></div>
      <h2 class="section-title">${sectionName}</h2>
      <div class="carousel"><div class="carousel-track" id="track-${sectionName.replace(/\s+/g, '-')}"></div></div>`;

    const track = sec.querySelector('.carousel-track');

    Object.entries(subs).forEach(([groupKey, group]) => {
      const primary = group[0];
      const count = group.length;
      const meta = count > 1
        ? `<span class="material-symbols-outlined">playlist_play</span> ${count} opciones`
        : `<span class="material-symbols-outlined">play_arrow</span> Canal`;

      const card = document.createElement('div');
      card.className = 'channel-card';
      card.innerHTML = `<img src="${primary.image || primary.groupImage || ''}" alt="${primary.name}" loading="lazy" onerror="this.style.display='none'">
        <div class="card-overlay">
          <div class="card-title">${primary.name}</div>
          <div class="card-meta">${meta}</div>
        </div>`;
      card.addEventListener('click', () => {
        if (group.length > 1) {
          showOptionsSheet(group, null, sel => openPlayer(sel, group));
        } else {
          openPlayer(group[0], group);
        }
      });
      track.appendChild(card);
    });

    frag.appendChild(sec);
  });

  sectionsWrap.appendChild(frag);
}

// ===== PLAYER =====

function openPlayer(channel, group) {
  state.currentChannel = channel;
  state.currentGroupKey = channel.group || channel.dataValue;
  state.isPlaying = true;

  hide(iframeErrorOverlay);
  playerTitle.textContent = channel.name;
  homeView.classList.remove('active');
  playerView.classList.add('active');

  if (group && group.length > 1) {
    show(optionsBtn);
  } else {
    hide(optionsBtn);
  }

  loadMedia(channel.resolvedUrl);
}

function loadMedia(url) {
  show(playerLoader);
  hide(iframeErrorOverlay);

  if (isDirectStream(url)) {
    hide(playerFrame);
    playerFrame.src = '';
    show(playerVideo);
    playerVideo.src = url;
    playerVideo.load();
    const p = playerVideo.play();
    if (p) p.then(() => hide(playerLoader)).catch(() => setTimeout(() => hide(playerLoader), 600));
    else hide(playerLoader);
  } else {
    hide(playerVideo);
    playerVideo.pause();
    playerVideo.src = '';
    playerVideo.load();
    show(playerFrame);
    playerFrame.src = url;

    let loaded = false;
    let t1 = setTimeout(() => { if (!loaded) { hide(playerLoader); showIframeError(); } }, 8000);
    let t2 = setTimeout(() => checkIframeError(), 4000);

    playerFrame.onload = () => { loaded = true; clearTimeout(t1); clearTimeout(t2); hide(playerLoader); };
    playerFrame.onerror = () => { loaded = true; clearTimeout(t1); clearTimeout(t2); showIframeError(); };
  }
}

function checkIframeError() {
  try {
    const d = playerFrame.contentDocument || playerFrame.contentWindow?.document;
    if (d) {
      const txt = (d.body?.innerText || '') + (d.title || '');
      const href = d.location?.href || '';
      if (href.includes('chrome-error') || href.includes('chromewebdata') || txt.includes('ERR_') || txt.includes('No se puede')) {
        showIframeError();
        return;
      }
    }
  } catch (e) {
    const src = playerFrame.src || '';
    if (src.includes('chrome-error') || src.includes('chromewebdata')) showIframeError();
  }
}

function showIframeError() {
  show(iframeErrorOverlay);
  hide(playerLoader);
}

function hideIframeError() {
  hide(iframeErrorOverlay);
}

function refreshPlayer() {
  if (!state.currentChannel) return;
  hideIframeError();
  const url = state.currentChannel.resolvedUrl;
  show(playerLoader);
  if (isDirectStream(url)) {
    playerVideo.pause();
    playerVideo.currentTime = 0;
    playerVideo.src = '';
    playerVideo.load();
    setTimeout(() => loadMedia(url), 100);
  } else {
    const old = playerFrame.src;
    playerFrame.src = '';
    setTimeout(() => { playerFrame.src = old; setTimeout(() => hide(playerLoader), 1200); }, 100);
  }
}

function goBack() {
  hideIframeError();
  playerVideo.pause();
  playerVideo.src = '';
  playerVideo.load();
  playerFrame.src = '';
  hide(playerLoader);
  closeSheet();
  closeInfo();
  state.currentChannel = null;
  state.currentGroupKey = null;
  state.isPlaying = false;
  playerView.classList.remove('active');
  homeView.classList.add('active');
}

// ===== SHEETS =====

let sheetCb = null;

function showOptionsSheet(group, current, cb) {
  sheetCb = cb;
  const primary = group[0];
  sheetTitle.textContent = primary.name || 'Opciones';
  sheetSubtitle.textContent = `${group.length} señal${group.length !== 1 ? 'es' : ''}`;
  sheetBody.innerHTML = '';
  group.forEach((ch, i) => {
    const el = document.createElement('div');
    el.className = 'sheet-item' + (current === ch ? ' active' : '');
    el.innerHTML = `<img class="sheet-item-img" src="${ch.image || primary.image || ''}" alt="" loading="lazy">
      <div class="sheet-item-info">
        <div class="sheet-item-name">${ch.name}</div>
        <div class="sheet-item-desc">${ch.description || `Opcion ${i + 1}`}</div>
      </div>
      <div class="sheet-item-check">${current === ch ? '<span class="material-symbols-outlined" style="font-size:14px">check</span>' : ''}</div>`;
    el.addEventListener('click', () => { if (sheetCb) sheetCb(ch); closeSheet(); });
    sheetBody.appendChild(el);
  });
  openEl(sheetOverlay);
  openEl(optionsSheet);
}

function openGenericSheet(title, subtitle, htmlContent) {
  sheetTitle.textContent = title;
  sheetSubtitle.textContent = subtitle;
  sheetBody.innerHTML = `<div class="info-content">${htmlContent}</div>`;
  openEl(sheetOverlay);
  openEl(optionsSheet);
  sheetCb = null;
}

function closeSheet() {
  closeEl(sheetOverlay);
  closeEl(optionsSheet);
  sheetCb = null;
}

function openInfo() {
  openEl(infoOverlay);
  openEl(infoSheet);
}

function closeInfo() {
  closeEl(infoOverlay);
  closeEl(infoSheet);
}

// ===== SEARCH =====

let searchTimer = null;

function onSearch() {
  const v = searchInput.value.trim();
  state.searchQuery = v;
  searchClear.classList.toggle('visible', v.length > 0);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderHome(), v.length ? 150 : 0);
}

function clearSearch() {
  searchInput.value = '';
  state.searchQuery = '';
  searchClear.classList.remove('visible');
  resultsCount.classList.remove('visible');
  renderHome();
  searchInput.focus();
}

// ===== QR SHEET =====

function openQrSheet() {
  const html = `
    <img class="qr-image" src="i/yape.heic" alt="Yape QR" onerror="this.style.display='none'">
    <a class="qr-download-btn" href="i/yape.heic" download="yape.heic">
      <span class="material-symbols-outlined">download</span>Descargar QR
    </a>
    <p class="qr-text">Escanea el codigo para donar via Yape.<br>Todas las donaciones nos ayudan a mantener y mejorar este proyecto.</p>
  `;
  openGenericSheet('Donar via Yape', 'Escanea el codigo QR', html);
}

// ===== EVENTS =====

searchInput.addEventListener('input', onSearch);
searchClear.addEventListener('click', clearSearch);
playerBack.addEventListener('click', goBack);
refreshBtn.addEventListener('click', refreshPlayer);
infoBtn.addEventListener('click', openInfo);
qrBtn.addEventListener('click', openQrSheet);
infoCloseBtn.addEventListener('click', closeInfo);
infoOverlay.addEventListener('click', closeInfo);

optionsBtn.addEventListener('click', () => {
  if (!state.currentGroupKey) return;
  const sectionName = state.currentChannel?.groupName || state.currentChannel?.group || state.currentGroupKey;
  const subs = state.subGroups[sectionName];
  if (!subs) return;
  const group = subs[state.currentGroupKey];
  if (!group || group.length <= 1) return;
  showOptionsSheet(group, state.currentChannel, sel => {
    state.currentChannel = sel;
    playerTitle.textContent = sel.name;
    hideIframeError();
    loadMedia(sel.resolvedUrl);
  });
});

sheetOverlay.addEventListener('click', closeSheet);
sheetCancel.addEventListener('click', closeSheet);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'Backspace') {
    if (infoSheet.classList.contains('open')) closeInfo();
    else if (optionsSheet.classList.contains('open')) closeSheet();
    else if (playerView.classList.contains('active')) goBack();
  }
});

window.addEventListener('popstate', () => {
  if (playerView.classList.contains('active')) {
    goBack();
    history.pushState({ view: 'home' }, '');
  }
});

document.addEventListener('touchstart', () => { }, { passive: true });

// ===== OS BADGES =====

(function () {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua) && osBannerAndroid) osBannerAndroid.classList.add('visible');
  else if (/iPad|iPhone|iPod/i.test(ua) && osBannerIOS) osBannerIOS.classList.add('visible');
})();

// ===== SERVICE WORKER =====

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}

// ===== INIT =====

function init() {
  loadChannels();
  history.pushState({ view: 'home' }, '');
}

init();
