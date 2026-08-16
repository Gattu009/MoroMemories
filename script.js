(() => {
  'use strict';

  /* ══════════════════════════════
     STATE
     albums = [{ id, title, items: [{ file, url, name, tags }] }]
  ══════════════════════════════ */
  let albums = [];
  let activeAlbumIdx = -1;   // which album is open in the album-view screen

  // Temp state while building a new album in the upload screen
  let files = [];            // [{ file, url, name, tags }]

  // Lightbox / slideshow
  let lbIndex  = 0;
  let ssIndex  = 0;
  let ssTimer  = null;
  const SS_INTERVAL = 3000;

  // Pending delete index (for confirm dialog)
  let pendingDeleteIdx = -1;

  /* ── Active album items shorthand ── */
  function activeItems() { return albums[activeAlbumIdx]?.items ?? []; }

  /* ══════════════════════════════
     ELEMENT REFS
  ══════════════════════════════ */
  const homeScreen        = document.getElementById('home-screen');
  const uploadScreen      = document.getElementById('upload-screen');
  const albumScreen       = document.getElementById('album-screen');

  const newAlbumBtn       = document.getElementById('new-album-btn');
  const albumsGrid        = document.getElementById('albums-grid');
  const homeEmpty         = document.getElementById('home-empty');

  const uploadBackBtn     = document.getElementById('upload-back-btn');
  const albumTitleInput   = document.getElementById('album-title');
  const albumTitleErr     = document.getElementById('album-title-err');
  const dropZone          = document.getElementById('drop-zone');
  const fileInput         = document.getElementById('file-input');
  const previewArea       = document.getElementById('preview-area');
  const previewGrid       = document.getElementById('preview-grid');
  const photoCount        = document.getElementById('photo-count');
  const clearBtn          = document.getElementById('clear-btn');
  const createAlbumBtn    = document.getElementById('create-album-btn');

  const backBtn           = document.getElementById('back-btn');
  const albumDisplayTitle = document.getElementById('album-display-title');
  const albumGrid         = document.getElementById('album-grid');
  const slideshowBtn      = document.getElementById('slideshow-btn');
  const searchInput       = document.getElementById('search-input');
  const searchClearBtn    = document.getElementById('search-clear-btn');
  const noResults         = document.getElementById('no-results');
  const noResultsQuery    = document.getElementById('no-results-query');

  const lightbox   = document.getElementById('lightbox');
  const lbImg      = document.getElementById('lb-img');
  const lbClose    = document.getElementById('lb-close');
  const lbPrev     = document.getElementById('lb-prev');
  const lbNext     = document.getElementById('lb-next');
  const lbTagsList = document.getElementById('lb-tags-list');
  const lbTagInput = document.getElementById('lb-tag-input');
  const lbCaption  = document.getElementById('lb-caption');

  const ssOverlay  = document.getElementById('slideshow-overlay');
  const ssImg      = document.getElementById('ss-img');
  const ssClose    = document.getElementById('ss-close');
  const ssPrev     = document.getElementById('ss-prev');
  const ssNext     = document.getElementById('ss-next');
  const ssCounter  = document.getElementById('ss-counter');

  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmMsg     = document.getElementById('confirm-msg');
  const confirmCancel  = document.getElementById('confirm-cancel');
  const confirmOk      = document.getElementById('confirm-ok');

  /* ══════════════════════════════
     SCREEN NAVIGATION
  ══════════════════════════════ */
  function showScreen(screen) {
    [homeScreen, uploadScreen, albumScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ══════════════════════════════
     HOME SCREEN
  ══════════════════════════════ */
  function renderHome() {
    albumsGrid.innerHTML = '';
    const hasAlbums = albums.length > 0;
    homeEmpty.hidden = hasAlbums;
    albumsGrid.hidden = !hasAlbums;

    albums.forEach((album, idx) => {
      const card = document.createElement('div');
      card.className = 'album-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Open album ${album.title}`);

      // Cover photo
      const coverWrap = document.createElement('div');
      coverWrap.className = 'album-card-cover';
      if (album.items.length > 0) {
        const img = document.createElement('img');
        img.src = album.items[0].url;
        img.alt = album.title;
        img.loading = 'lazy';
        coverWrap.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'cover-placeholder';
        ph.textContent = '🖼️';
        coverWrap.appendChild(ph);
      }

      // Info
      const info = document.createElement('div');
      info.className = 'album-card-info';

      const title = document.createElement('div');
      title.className = 'album-card-title';
      title.textContent = album.title;

      const count = document.createElement('div');
      count.className = 'album-card-count';
      count.textContent = `${album.items.length} photo${album.items.length !== 1 ? 's' : ''}`;

      const actions = document.createElement('div');
      actions.className = 'album-card-actions';

      const openBtn = document.createElement('button');
      openBtn.className = 'icon-btn';
      openBtn.textContent = '▶ Open';
      openBtn.addEventListener('click', e => { e.stopPropagation(); openAlbum(idx); });

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn danger';
      delBtn.textContent = '🗑 Delete';
      delBtn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(idx); });

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      info.appendChild(title);
      info.appendChild(count);
      info.appendChild(actions);

      card.appendChild(coverWrap);
      card.appendChild(info);

      card.addEventListener('click', () => openAlbum(idx));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openAlbum(idx); });

      albumsGrid.appendChild(card);
    });
  }

  newAlbumBtn.addEventListener('click', () => {
    resetUploadForm();
    showScreen(uploadScreen);
    albumTitleInput.focus();
  });

  /* ── Confirm delete ── */
  function confirmDelete(idx) {
    pendingDeleteIdx = idx;
    confirmMsg.textContent = `Delete "${albums[idx].title}"? This cannot be undone.`;
    confirmOverlay.hidden = false;
  }

  confirmCancel.addEventListener('click', () => {
    confirmOverlay.hidden = true;
    pendingDeleteIdx = -1;
  });

  confirmOk.addEventListener('click', () => {
    if (pendingDeleteIdx >= 0) {
      const album = albums[pendingDeleteIdx];
      albums.splice(pendingDeleteIdx, 1);
      pendingDeleteIdx = -1;
      deleteAlbumFromDB(album).catch(e => console.warn('Delete error:', e));
    }
    confirmOverlay.hidden = true;
    renderHome();
  });

  confirmOverlay.addEventListener('click', e => {
    if (e.target === confirmOverlay) { confirmOverlay.hidden = true; pendingDeleteIdx = -1; }
  });

  /* ══════════════════════════════
     OPEN ALBUM (home → album view)
  ══════════════════════════════ */
  function openAlbum(idx) {
    activeAlbumIdx = idx;
    const album = albums[idx];
    albumDisplayTitle.textContent = album.title;
    searchInput.value = '';
    searchClearBtn.hidden = true;
    noResults.hidden = true;
    buildAlbumGrid();
    showScreen(albumScreen);
  }

  /* ── Back from album view → home ── */
  backBtn.addEventListener('click', () => {
    renderHome();
    showScreen(homeScreen);
  });

  /* ── Back from upload → home ── */
  uploadBackBtn.addEventListener('click', () => {
    renderHome();
    showScreen(homeScreen);
  });

  /* ══════════════════════════════
     UPLOAD / FILE HANDLING
  ══════════════════════════════ */
  function resetUploadForm() {
    files.forEach(f => URL.revokeObjectURL(f.url));
    files = [];
    previewGrid.innerHTML = '';
    albumTitleInput.value = '';
    albumTitleErr.hidden = true;
    updatePreviewState();
  }

  function addFiles(newFiles) {
    const imageFiles = [...newFiles].filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    imageFiles.forEach(file => {
      const isDupe = files.some(f => f.name === file.name && f.size === file.size);
      if (isDupe) return;
      const url = URL.createObjectURL(file);
      files.push({ file, url, name: file.name, size: file.size, tags: [] });
      renderThumb(files.length - 1);
    });
    updatePreviewState();
  }

  function removeFile(index) {
    URL.revokeObjectURL(files[index].url);
    files.splice(index, 1);
    rebuildPreviewGrid();
    updatePreviewState();
  }

  function clearAll() {
    files.forEach(f => URL.revokeObjectURL(f.url));
    files = [];
    previewGrid.innerHTML = '';
    updatePreviewState();
  }

  function updatePreviewState() {
    const count = files.length;
    photoCount.textContent = `${count} photo${count !== 1 ? 's' : ''} selected`;
    createAlbumBtn.disabled = count === 0;
    previewArea.hidden = count === 0;
  }

  /* ── Thumbnail with inline tag editor ── */
  function renderThumb(index) {
    const { url, name } = files[index];
    const wrap = document.createElement('div');
    wrap.className = 'preview-thumb';
    wrap.dataset.index = index;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'thumb-img-wrap';

    const img = document.createElement('img');
    img.src = url; img.alt = name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', `Remove ${name}`);
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      removeFile(Number(wrap.dataset.index));
    });

    imgWrap.appendChild(img);
    imgWrap.appendChild(removeBtn);
    wrap.appendChild(imgWrap);
    wrap.appendChild(buildTagEditor(index));
    previewGrid.appendChild(wrap);
  }

  function buildTagEditor(index) {
    const row = document.createElement('div');
    row.className = 'tag-row';

    function refresh() {
      row.innerHTML = '';
      files[index].tags.forEach((tag, ti) => {
        const chip = makeChip(tag, () => { files[index].tags.splice(ti, 1); refresh(); });
        row.appendChild(chip);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tag-input-small';
      input.placeholder = files[index].tags.length ? '+ tag' : '🏷 add tags…';
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = input.value.trim().replace(/,+$/, '');
          if (val && !files[index].tags.includes(val)) files[index].tags.push(val);
          input.value = ''; refresh();
        }
        if (e.key === 'Backspace' && input.value === '' && files[index].tags.length) {
          files[index].tags.pop(); refresh();
        }
      });
      input.addEventListener('blur', () => {
        const val = input.value.trim();
        if (val && !files[index].tags.includes(val)) { files[index].tags.push(val); input.value = ''; refresh(); }
      });
      row.appendChild(input);
    }

    refresh();
    return row;
  }

  function rebuildPreviewGrid() {
    previewGrid.innerHTML = '';
    files.forEach((_, i) => renderThumb(i));
    [...previewGrid.children].forEach((el, i) => (el.dataset.index = i));
  }

  /* ── Drop zone events ── */
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over'); addFiles(e.dataTransfer.files);
  });
  clearBtn.addEventListener('click', clearAll);

  /* ══════════════════════════════
     CREATE ALBUM
  ══════════════════════════════ */
  createAlbumBtn.addEventListener('click', async () => {
    const title = albumTitleInput.value.trim();
    if (!title) {
      albumTitleErr.hidden = false;
      albumTitleInput.focus();
      return;
    }
    albumTitleErr.hidden = true;
    if (!files.length || !currentUser) return;

    createAlbumBtn.disabled = true;
    createAlbumBtn.textContent = 'Uploading…';

    try {
      const albumId = Date.now();
      const uploadedItems = await Promise.all(
        files.map(async f => {
          const formData = new FormData();
          formData.append('file', f.file);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          formData.append('folder', `photo_album/${currentUser.uid}/${albumId}`);
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
          );
          if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.statusText}`);
          const data = await res.json();
          URL.revokeObjectURL(f.url);
          return { url: data.secure_url, name: f.name, tags: [...f.tags] };
        })
      );

      const newAlbum = { id: albumId, title, items: uploadedItems };
      albums.push(newAlbum);
      await saveNewAlbum(newAlbum);

      files = [];
      previewGrid.innerHTML = '';
      albumTitleInput.value = '';
      updatePreviewState();

      renderHome();
      showScreen(homeScreen);
    } catch (e) {
      console.error('Upload failed:', e);
      alert('Upload failed: ' + e.message);
    } finally {
      createAlbumBtn.disabled = false;
      createAlbumBtn.textContent = 'Create Album';
    }
  });

  /* ══════════════════════════════
     ALBUM GRID (view screen)
  ══════════════════════════════ */
  function buildAlbumGrid() {
    albumGrid.innerHTML = '';
    activeItems().forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'album-item';
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `View ${item.name}`);

      const img = document.createElement('img');
      img.src = item.url; img.alt = item.name; img.loading = 'lazy';

      const overlay = document.createElement('div');
      overlay.className = 'overlay';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'overlay-name';
      nameSpan.textContent = item.name;
      overlay.appendChild(nameSpan);
      overlay.appendChild(buildAlbumTagChips(i));

      div.appendChild(img);
      div.appendChild(overlay);
      albumGrid.appendChild(div);

      div.addEventListener('click', () => openLightbox(i));
      div.addEventListener('keydown', e => { if (e.key === 'Enter') openLightbox(i); });
    });
  }

  function buildAlbumTagChips(index) {
    const wrap = document.createElement('div');
    wrap.className = 'item-tags';
    (activeItems()[index]?.tags || []).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip album-chip';
      chip.textContent = tag;
      chip.addEventListener('click', e => {
        e.stopPropagation();
        searchInput.value = tag;
        applySearch(tag);
      });
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function refreshAlbumItemTags(index) {
    const el = albumGrid.children[index];
    if (!el) return;
    const overlay = el.querySelector('.overlay');
    const existing = overlay.querySelector('.item-tags');
    const fresh = buildAlbumTagChips(index);
    if (existing) overlay.replaceChild(fresh, existing);
    else overlay.appendChild(fresh);
  }

  /* ══════════════════════════════
     SEARCH / FILTER
  ══════════════════════════════ */
  function applySearch(query) {
    const q = (typeof query === 'string' ? query : searchInput.value).toLowerCase().trim();
    let visibleCount = 0;
    [...albumGrid.children].forEach((el, i) => {
      const item = activeItems()[i];
      const matchesName = item.name.toLowerCase().includes(q);
      const matchesTag  = (item.tags || []).some(t => t.toLowerCase().includes(q));
      const visible = !q || matchesName || matchesTag;
      el.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });
    noResults.hidden = visibleCount > 0 || !q;
    noResultsQuery.textContent = q;
    searchClearBtn.hidden = !q;
  }

  searchInput.addEventListener('input', () => applySearch(searchInput.value));
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = ''; applySearch(''); searchInput.focus();
  });

  /* ══════════════════════════════
     LIGHTBOX
  ══════════════════════════════ */
  function openLightbox(index) {
    lbIndex = index;
    showLbImage();
    lightbox.hidden = false;
    lbImg.focus();
  }

  function showLbImage() {
    const items = activeItems();
    const item = items[lbIndex];
    lbImg.src = item.url;
    lbImg.alt = item.name;
    lbCaption.textContent = `${item.name}  (${lbIndex + 1} / ${items.length})`;
    lbTagInput.value = '';
    renderLbTags();
  }

  function renderLbTags() {
    const item = activeItems()[lbIndex];
    lbTagsList.innerHTML = '';
    (item?.tags || []).forEach((tag, ti) => {
      const chip = makeChip(tag, () => {
        item.tags.splice(ti, 1);
        renderLbTags();
        refreshAlbumItemTags(lbIndex);
        applySearch(searchInput.value);
        updateAlbumInDB(activeAlbumIdx).catch(e => console.warn(e));
      });
      lbTagsList.appendChild(chip);
    });
  }

  lbTagInput.addEventListener('keydown', e => {
    const item = activeItems()[lbIndex];
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = lbTagInput.value.trim().replace(/,+$/, '');
      if (!item.tags) item.tags = [];
      if (val && !item.tags.includes(val)) {
        item.tags.push(val);
        renderLbTags();
        refreshAlbumItemTags(lbIndex);
        updateAlbumInDB(activeAlbumIdx).catch(e => console.warn(e));
      }
      lbTagInput.value = '';
    }
    if (e.key === 'Backspace' && lbTagInput.value === '' && (item?.tags || []).length) {
      item.tags.pop(); renderLbTags(); refreshAlbumItemTags(lbIndex); updateAlbumInDB(activeAlbumIdx).catch(e => console.warn(e));
    }
  });

  lbClose.addEventListener('click', () => { lightbox.hidden = true; });
  lbPrev.addEventListener('click', () => {
    const len = activeItems().length;
    lbIndex = (lbIndex - 1 + len) % len; showLbImage();
  });
  lbNext.addEventListener('click', () => {
    lbIndex = (lbIndex + 1) % activeItems().length; showLbImage();
  });
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.hidden = true; });

  document.addEventListener('keydown', e => {
    if (!lightbox.hidden) {
      if (document.activeElement === lbTagInput) return;
      const len = activeItems().length;
      if (e.key === 'Escape') lightbox.hidden = true;
      if (e.key === 'ArrowLeft')  { lbIndex = (lbIndex - 1 + len) % len; showLbImage(); }
      if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % len; showLbImage(); }
    }
    if (!ssOverlay.hidden) {
      if (e.key === 'Escape') stopSlideshow();
      if (e.key === 'ArrowLeft')  stepSlideshow(-1);
      if (e.key === 'ArrowRight') stepSlideshow(1);
    }
  });

  /* ══════════════════════════════
     SLIDESHOW
  ══════════════════════════════ */
  function startSlideshow() {
    if (!activeItems().length) return;
    ssIndex = 0; showSsImage();
    ssOverlay.hidden = false;
    ssTimer = setInterval(() => stepSlideshow(1), SS_INTERVAL);
  }

  function stopSlideshow() {
    clearInterval(ssTimer); ssTimer = null;
    ssOverlay.hidden = true;
  }

  function stepSlideshow(dir) {
    ssIndex = (ssIndex + dir + activeItems().length) % activeItems().length;
    showSsImage();
  }

  function showSsImage() {
    const item = activeItems()[ssIndex];
    ssImg.style.animation = 'none'; void ssImg.offsetWidth; ssImg.style.animation = '';
    ssImg.src = item.url; ssImg.alt = item.name;
    ssCounter.textContent = `${ssIndex + 1} / ${activeItems().length}`;
  }

  slideshowBtn.addEventListener('click', startSlideshow);
  ssClose.addEventListener('click', stopSlideshow);
  ssPrev.addEventListener('click', () => { stepSlideshow(-1); resetSsTimer(); });
  ssNext.addEventListener('click', () => { stepSlideshow(1);  resetSsTimer(); });

  function resetSsTimer() {
    clearInterval(ssTimer);
    ssTimer = setInterval(() => stepSlideshow(1), SS_INTERVAL);
  }

  ssOverlay.addEventListener('click', e => { if (e.target === ssOverlay) stopSlideshow(); });

  /* ══════════════════════════════
     SHARED HELPER
  ══════════════════════════════ */
  function makeChip(label, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = label;
    if (onRemove) {
      const x = document.createElement('button');
      x.className = 'chip-remove';
      x.textContent = '×';
      x.setAttribute('aria-label', `Remove tag ${label}`);
      x.addEventListener('click', e => { e.stopPropagation(); onRemove(); });
      chip.appendChild(x);
    }
    return chip;
  }

  /* ══════════════════════════════
     FIREBASE (Auth + Firestore) + CLOUDINARY (image storage)

     FIREBASE SETUP:
     1. console.firebase.google.com → create project → add Web app
     2. Authentication → Sign-in method → enable Email/Password
     3. Firestore Database → create → add rule:
           allow read, write: if request.auth != null;
     4. Paste the config below

     CLOUDINARY SETUP (FREE — 25 GB, no card):
     1. cloudinary.com → sign up (free)
     2. Dashboard → note your Cloud Name
     3. Settings → Upload → Add upload preset → set Signing Mode to "Unsigned"
     4. Note the preset name and paste both values below
  ══════════════════════════════ */
  const firebaseConfig = {
  apiKey: "AIzaSyAGxvwUVXKgF3WUfWnB7fukBR8DradmgG0",
  authDomain: "sample-7f9a3.firebaseapp.com",
  projectId: "sample-7f9a3",
  storageBucket: "sample-7f9a3.firebasestorage.app",
  messagingSenderId: "462507717103",
  appId: "1:462507717103:web:5cf4d57458ecca0a86061a",
  measurementId: "G-J2Z1JX30N1"
};

  const CLOUDINARY_CLOUD_NAME  = 'q5p7afdx';
  const CLOUDINARY_UPLOAD_PRESET = 'sample';

  firebase.initializeApp(firebaseConfig);
  const auth   = firebase.auth();
  const fstore = firebase.firestore();

  let currentUser = null;

  /* ── Firestore / Storage helpers ── */
  function albumsRef() {
    return fstore.collection('users').doc(currentUser.uid).collection('albums');
  }

  async function loadAlbums() {
    const snap = await albumsRef().orderBy('createdAt').get();
    albums = snap.docs.map(doc => {
      const d = doc.data();
      return { id: d.id, title: d.title, items: d.items || [] };
    });
  }

  async function saveNewAlbum(album) {
    await albumsRef().doc(String(album.id)).set({
      id:        album.id,
      title:     album.title,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      items:     album.items.map(({ url, name, tags }) => ({ url, name, tags }))
    });
  }

  async function updateAlbumInDB(albumIdx) {
    const album = albums[albumIdx];
    if (!album || !currentUser) return;
    await albumsRef().doc(String(album.id)).update({
      items: album.items.map(({ url, name, tags }) => ({ url, name, tags }))
    });
  }

  async function deleteAlbumFromDB(album) {
    // Cloudinary unsigned presets don’t support browser-side delete — only the Firestore record is removed.
    await albumsRef().doc(String(album.id)).delete();
  }

  /* ── Auth screen element refs ── */
  const authScreen        = document.getElementById('auth-screen');
  const authEmailInput    = document.getElementById('auth-email');
  const authPasswordInput = document.getElementById('auth-password');
  const authSubmitBtn     = document.getElementById('auth-submit-btn');
  const authSwitchBtn     = document.getElementById('auth-switch-btn');
  const authError         = document.getElementById('auth-error');
  const authSubtitle      = document.getElementById('auth-subtitle');
  const signOutBtn        = document.getElementById('sign-out-btn');

  let isSignUpMode = false;

  authSwitchBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    authSubmitBtn.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
    authSubtitle.textContent  = isSignUpMode ? 'Create a new account' : 'Sign in to your account';
    authSwitchBtn.textContent = isSignUpMode ? 'Sign In' : 'Sign Up';
    authError.hidden = true;
  });

  authPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') authSubmitBtn.click(); });

  authSubmitBtn.addEventListener('click', async () => {
    const email    = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) {
      authError.textContent = 'Please enter your email and password.';
      authError.hidden = false;
      return;
    }
    authSubmitBtn.disabled = true;
    authError.hidden = true;
    try {
      if (isSignUpMode) {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    } catch (err) {
      authError.textContent = err.message;
      authError.hidden = false;
      authSubmitBtn.disabled = false;
    }
  });

  signOutBtn.addEventListener('click', () => auth.signOut());

  /* ── Auth state observer — drives all screen transitions ── */
  auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (user) {
      try { await loadAlbums(); } catch (e) { console.warn('Failed to load albums:', e); albums = []; }
      authScreen.classList.remove('active');
      uploadScreen.classList.remove('active');
      albumScreen.classList.remove('active');
      renderHome();
      homeScreen.classList.add('active');
    } else {
      albums = [];
      activeAlbumIdx = -1;
      homeScreen.classList.remove('active');
      uploadScreen.classList.remove('active');
      albumScreen.classList.remove('active');
      authScreen.classList.add('active');
    }
  });

})();
