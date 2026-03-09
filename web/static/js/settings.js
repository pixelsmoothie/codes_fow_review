/* ─── SETTINGS / USER PROFILE ─── */

// Inject the profile modal HTML into the page
function injectProfileModal() {
  var html = `
    <!-- User Profile Modal -->
    <div id="profile-modal-overlay" class="profile-modal-overlay">
      <div class="profile-card themed-accent" style="width: 480px; max-width: 95vw; border: 2px solid var(--accent);">
        <div class="profile-card-header" style="background: var(--accent-glow); border-bottom: 1px solid var(--accent);">
          <div class="profile-card-title" style="color: var(--accent); font-family: var(--font-pixel); font-size: 1.1rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size:1.3rem;">👤</span> User Profile
          </div>
          <button id="profile-modal-close" class="profile-close-btn" style="color: var(--accent); opacity: 0.6;"></button>
        </div>
        <div class="profile-card-body" style="padding: 1rem; background: #0b0e14;">
          <div id="profile-status" style="margin-bottom: 0.6rem; font-family: var(--font-pixel); font-size: 0.7rem; text-align: center;"></div>
          
          <div class="profile-field" style="margin-bottom: 1rem;">
            <label style="display: block; font-family: var(--font-pixel); font-size: 0.75rem; color: #fff; margin-bottom: 0.35rem;">Display Name</label>
            <input type="text" id="profile-name" placeholder="" maxlength="32" 
                   style="width:100%; padding: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid var(--accent-glow); color: #fff; font-family: var(--font-main); font-size: 0.9rem;">
          </div>
          
          <div class="profile-field" style="margin-bottom: 1rem;">
            <label style="display: block; font-family: var(--font-pixel); font-size: 0.75rem; color: #fff; margin-bottom: 0.35rem;">Friend Code (Unique ID)</label>
            <div style="display: flex; gap: 0.6rem;">
              <input type="text" id="profile-unique-id" readonly 
                     style="flex: 1; padding: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid var(--accent-glow); color: var(--accent); font-family: var(--font-mono); font-size: 0.9rem; letter-spacing: 0.05em;">
              <button id="profile-copy-code-btn" class="btn" style="background: #fff; color: #000; font-family: var(--font-pixel); font-weight: 700; padding: 0 0.75rem; font-size: 0.7rem; border: none; min-width: 65px;">COPY</button>
            </div>
          </div>

          <div class="profile-field" style="margin-bottom: 1rem;">
            <label style="display: block; font-family: var(--font-pixel); font-size: 0.75rem; color: #fff; margin-bottom: 0.35rem;">Avatar</label>
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <div id="profile-avatar-display" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--accent); overflow: hidden; background: #000; padding: 2px;"></div>
              <button type="button" id="profile-change-avatar-btn" class="btn" style="background: none; border: 1.5px solid var(--accent); color: var(--accent); font-family: var(--font-pixel); padding: 0.4rem 0.8rem; font-size: 0.75rem;">Change ▼</button>
            </div>
            
            <!-- Inline Avatar Picker -->
            <div id="profile-avatar-picker-inline" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid var(--accent-glow); padding: 8px; border-radius: 6px; margin-top: 0.6rem;">
              <div id="profile-avatar-picker" class="avatar-grid" style="grid-template-columns: repeat(4, 1fr); gap:6px;"></div>
            </div>
          </div>

          <div class="profile-field" style="margin-bottom: 1.25rem;">
            <label style="display: block; font-family: var(--font-pixel); font-size: 0.75rem; color: #fff; margin-bottom: 0.35rem;">About Me</label>
            <textarea id="profile-about" rows="2" placeholder="Tell contacts about yourself..." maxlength="120" 
                      style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid var(--accent-glow); color: var(--text-muted); font-family: var(--font-main); font-size: 0.9rem; resize: none;"></textarea>
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <button id="profile-save-btn" class="btn" style="flex: 1; padding: 0.7rem; background: var(--accent); color: #000; font-family: var(--font-pixel); font-size: 0.8rem; font-weight: 700;">SAVE CHANGES</button>
            <button id="profile-cancel-btn" class="btn" style="flex: 1; padding: 0.7rem; background: none; border: 1px solid rgba(255,255,255,0.15); font-family: var(--font-pixel); font-size: 0.8rem; color: var(--text-muted);">CANCEL</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Legacy Avatar Picker Modal (keeping for potential references, but hidden) -->
    <div id="avatar-picker-overlay" class="avatar-picker-modal-overlay" style="display:none;"></div>

    `;

  var reqModal = `
    <div id="requests-modal-overlay" class="settings-overlay" style="z-index: 10001;">
      <div class="profile-card themed-accent" style="width: 380px; background: #0b0e14; border: 2px solid var(--accent); box-shadow: 0 0 20px rgba(0,0,0,0.5);">
        <div class="profile-card-header">
          <div class="profile-card-title">Friend Requests</div>
          <button id="requests-modal-close" class="profile-close-btn" style="filter: brightness(0) invert(1); opacity: 0.5;"></button>
        </div>
        <div id="requests-modal-list" class="profile-card-body" style="max-height: 400px; overflow-y: auto;">
          <div style="text-align:center; color:var(--text-muted); padding:20px;">No pending requests</div>
        </div>
      </div>
    </div>
    `;

  var settingsModal = `
    <div id="settings-overlay" class="settings-overlay">
      <div class="profile-card themed-green" id="settings-panel" style="width: 560px; max-width: 95vw; height: 630px; max-height: 90vh; display:flex; flex-direction:column;">
        <div class="profile-card-header">
          <div class="profile-card-title">
             <span style="font-size:1.1rem; opacity:0.8;">⚙️</span> App Settings
          </div>
          <button id="settings-close-btn" class="profile-close-btn" style="filter: brightness(0) invert(1); opacity: 0.5;"></button>
        </div>
        <div class="profile-card-body settings-body" style="overflow-y:auto; flex:1; padding:1rem 1.25rem;">
          <!-- Content injected via populateSettingsBody -->
        </div>
      </div>
    </div>
    `;

  var logoutModal = `
    <div id="logout-modal-overlay" class="settings-overlay" style="z-index: 12000;">
      <div class="profile-card themed-red" style="width: 400px; border: 2px solid #ef4444; box-shadow: 0 0 30px rgba(239, 68, 68, 0.15);">
        <div class="profile-card-header" style="background: rgba(239, 68, 68, 0.15); border-bottom: 1px solid #ef4444;">
          <div class="profile-card-title" style="color: #ef4444; font-family: var(--font-pixel); font-size: 1.1rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.75rem;">
            ⚠️ TERMINATE SESSION
          </div>
        </div>
        <div class="profile-card-body" style="padding: 2rem; background: #0b0e14; text-align: center;">
          <p style="font-family: var(--font-main); color: #fff; margin-bottom: 2rem; font-size: 1rem; line-height: 1.6;">
            Logout of your secure session?<br>
            <span style="color: var(--text-muted); font-size: 0.85rem;">Encryption keys and local cache will be purged.</span>
          </p>
          <div style="display: flex; gap: 1.25rem;">
            <button id="logout-confirm-btn" class="btn" style="flex: 1; padding: 1rem; background: #ef4444; color: #fff; font-family: var(--font-pixel); font-size: 0.9rem; font-weight: 700; border: none;">YES, LOGOUT</button>
            <button id="logout-cancel-btn" class="btn" style="flex: 1; padding: 1rem; background: none; border: 1px solid rgba(255,255,255,0.15); font-family: var(--font-pixel); font-size: 0.9rem; color: var(--text-muted);">CANCEL</button>
          </div>
        </div>
      </div>
    </div>
    `;

  var container = document.createElement('div');
  container.innerHTML = html + reqModal + settingsModal + logoutModal;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
}

function openSettingsPanel() {
  var overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.classList.add('is-visible');
    populateSettingsBody();
  }
}

function closeSettingsPanel() {
  var overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.remove('is-visible');
}


function setupStaticSidebar() {
  // Wire up the new static icons in the chat sidebar header
  var addBtn = document.getElementById('sidebar-add-friend-btn');
  var profBtn = document.getElementById('sidebar-profile-btn');
  var settBtn = document.getElementById('sidebar-settings-btn');
  var friendPanel = document.getElementById('sidebar-friend-panel');
  var copyBtn = document.getElementById('copy-my-id-btn');

  // Modal open/close listeners are handled centrally at the end of DOMContentLoaded

  if (profBtn) profBtn.onclick = openProfileModal;
  if (settBtn) settBtn.onclick = openSettingsPanel;

  if (copyBtn) {
    copyBtn.onclick = function () {
      var uidEl = document.getElementById('my-unique-id');
      if (!uidEl || uidEl.textContent === '----') return;

      navigator.clipboard.writeText(uidEl.textContent).then(function () {
        var original = copyBtn.textContent;
        copyBtn.textContent = 'DONE!';
        copyBtn.style.color = 'var(--accent)';
        setTimeout(function () {
          copyBtn.textContent = original;
          copyBtn.style.color = '';
        }, 1500);
      });
    };
  }

  // Close friend panel if clicking outside or on contacts
  document.addEventListener('click', function (e) {
    if (friendPanel && friendPanel.style.display !== 'none') {
      if (!friendPanel.contains(e.target) && !addBtn.contains(e.target)) {
        friendPanel.style.display = 'none';
        addBtn.classList.remove('active');
      }
    }
  });
}

/* ─── PROFILE MODAL LOGIC ─── */
var pendingAvatarKey = null;

function getAvatarSvgFromChat(key) {
  if (typeof AVATARS !== 'undefined' && AVATARS[key]) return AVATARS[key];
  return null;
}

function renderAvatarInEl(el, avatarKey) {
  if (!el) return;
  if (avatarKey && avatarKey.startsWith('data:image')) {
    el.innerHTML = `<img src="${avatarKey}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    el.style.padding = '0';
    return;
  }
  var svg = getAvatarSvgFromChat(avatarKey);
  if (svg) {
    el.innerHTML = svg;
    el.style.padding = '2px';
  } else {
    el.textContent = (avatarKey || '?').charAt(0).toUpperCase();
  }
}

function openProfileModal() {
  var overlay = document.getElementById('profile-modal-overlay');
  if (!overlay) return;

  var nameEl = document.getElementById('profile-name');
  var codeEl = document.getElementById('profile-unique-id');
  var aboutEl = document.getElementById('profile-about');
  var avatarEl = document.getElementById('profile-avatar-display');

  var displayName = '';
  var friendCode = '----';
  var aboutMe = '';
  var avatarKey = 'alex';

  if (typeof currentDisplayName !== 'undefined' && currentDisplayName) displayName = currentDisplayName;
  else if (typeof currentClientId !== 'undefined' && currentClientId) displayName = currentClientId;

  if (typeof currentUniqueId !== 'undefined' && currentUniqueId) friendCode = currentUniqueId;
  if (typeof currentAvatar !== 'undefined' && currentAvatar) avatarKey = currentAvatar;

  if (!displayName) displayName = localStorage.getItem('ss_display_name') || '';
  if (friendCode === '----') friendCode = localStorage.getItem('ss_friend_code') || '----';
  if (!aboutMe) aboutMe = localStorage.getItem('ss_about_me') || '';

  if (nameEl) nameEl.value = displayName;
  if (codeEl) {
    if (codeEl.tagName === 'INPUT') codeEl.value = friendCode;
    else codeEl.textContent = friendCode;
  }
  if (aboutEl) aboutEl.value = aboutMe;
  if (avatarEl) renderAvatarInEl(avatarEl, avatarKey);

  pendingAvatarKey = avatarKey;
  overlay.classList.add('is-open');

  // Populate inline avatar picker if empty
  var pickerGrid = document.getElementById('profile-avatar-picker');
  if (pickerGrid && pickerGrid.children.length === 0 && typeof AVATARS !== 'undefined') {
    Object.keys(AVATARS).forEach(function (k) {
      var item = document.createElement('div');
      item.className = 'avatar-option';
      item.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; padding: 2px; transition: all 0.1s;';
      if (k === avatarKey) item.style.borderColor = 'var(--accent)';
      item.innerHTML = AVATARS[k];
      item.onclick = function () {
        pendingAvatarKey = k;
        if (avatarEl) renderAvatarInEl(avatarEl, k);
        pickerGrid.querySelectorAll('.avatar-option').forEach(function (el) { el.style.borderColor = 'transparent'; });
        item.style.borderColor = 'var(--accent)';
      };
      pickerGrid.appendChild(item);
    });
  }
}

function closeProfileModal() {
  var overlay = document.getElementById('profile-modal-overlay');
  if (overlay) overlay.classList.remove('is-open');
  pendingAvatarKey = null;
}

function openAvatarPicker() {
  var overlay = document.getElementById('avatar-picker-overlay');
  if (!overlay) return;

  var grid = document.getElementById('avatar-picker-grid');
  if (!grid) return;

  var currentKey = pendingAvatarKey || (typeof currentAvatar !== 'undefined' ? currentAvatar : 'alex');

  if (typeof AVATARS === 'undefined') {
    grid.innerHTML = '<p style="font-family:var(--font-pixel);color:var(--text-muted);font-size:0.9rem;padding:1rem;">Avatars not loaded yet.</p>';
  } else {
    var keys = Object.keys(AVATARS);
    grid.innerHTML = keys.map(function (k) {
      var selected = k === currentKey ? 'is-selected' : '';
      var svg = AVATARS[k] || '';
      return `<div class="avatar-option ${selected}" data-avatar="${k}" title="${k.charAt(0).toUpperCase() + k.slice(1)}">
              ${svg}
            </div>`;
    }).join('');

    grid.querySelectorAll('.avatar-option').forEach(function (item) {
      item.addEventListener('click', function () {
        var key = this.dataset.avatar;
        pendingAvatarKey = key;
        grid.querySelectorAll('.avatar-option').forEach(function (el) {
          el.classList.remove('is-selected');
        });
        this.classList.add('is-selected');
        var avatarEl = document.getElementById('profile-avatar-circle');
        if (avatarEl) renderAvatarInEl(avatarEl, key);
        setTimeout(function () {
          overlay.classList.remove('is-open');
        }, 180);
      });
    });
  }

  var uploadZone = document.getElementById('profile-avatar-upload-zone');
  var fileInput = document.getElementById('profile-avatar-input');
  if (uploadZone && fileInput) {
    uploadZone.onclick = function () { fileInput.click(); };
    fileInput.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (evt) {
        pixelifyAvatar(evt.target.result, function (pixelData) {
          pendingAvatarKey = pixelData;
          var avatarEl = document.getElementById('profile-avatar-circle');
          if (avatarEl) {
            avatarEl.innerHTML = `<img src="${pixelData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          }
          overlay.classList.remove('is-open');
        });
      };
      reader.readAsDataURL(file);
    };
  }

  overlay.classList.add('is-open');
}

function pixelifyAvatar(dataUrl, callback) {
  var img = new Image();
  img.onload = function () {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var size = 92;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size, size);
    callback(canvas.toDataURL('image/png'));
  };
  img.src = dataUrl;
}

function saveProfile() {
  var nameEl = document.getElementById('profile-name');
  var aboutEl = document.getElementById('profile-about');

  var newName = nameEl ? nameEl.value.trim() : '';
  var newAbout = aboutEl ? aboutEl.value.trim() : '';
  var newAvatar = pendingAvatarKey || (typeof currentAvatar !== 'undefined' ? currentAvatar : 'alex');

  if (newName) {
    localStorage.setItem('ss_display_name', newName);
    if (typeof currentDisplayName !== 'undefined') currentDisplayName = newName;
    if (typeof currentClientId !== 'undefined') currentClientId = newName; // In this app, client_id is often the name
  }
  localStorage.setItem('ss_about_me', newAbout);

  var token = localStorage.getItem('chat_token');
  if (token) {
    var updates = {};
    if (newAvatar) updates.avatar = newAvatar;
    if (newName) {
      updates.display_name = newName;
      updates.client_id = newName; // Required to change the name everywhere
    }
    if (newAbout !== undefined) updates.about = newAbout;

    fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(updates)
    }).then(function (res) {
      if (res.ok) {
        if (newName && typeof window.currentDisplayName !== 'undefined') {
          var selfNameEl = document.getElementById('chat-self-name-display');
          if (selfNameEl) selfNameEl.textContent = newName;
          window.currentDisplayName = newName;
          window.currentClientId = newName;
        }
        if (newAvatar && typeof window.currentAvatar !== 'undefined') {
          window.currentAvatar = newAvatar;
          var chatSelfAvatar = document.querySelector('.chat-self-avatar');
          if (chatSelfAvatar) renderAvatarInEl(chatSelfAvatar, newAvatar);
          var sidebarSelfAvatar = document.getElementById('self-avatar-display');
          if (sidebarSelfAvatar) renderAvatarInEl(sidebarSelfAvatar, newAvatar);
        }
        // Force a refresh of the UI
        if (typeof refreshOnlineUsers === 'function') refreshOnlineUsers();
      } else {
        res.json().then(function (err) {
          alert("Error: " + (err.error || "Failed to update profile"));
        });
      }
    }).catch(function (e) {
      console.error("Profile save error:", e);
    });
  }

  if (newName) {
    var navPill = document.getElementById('nav-user-pill');
    if (navPill) navPill.textContent = newName;
  }

  closeProfileModal();
}

function enhanceContactsHeader() {
  var copyBtn = document.getElementById('copy-code-btn');
  var uniqueIdEl = document.getElementById('my-unique-id');

  if (copyBtn && uniqueIdEl && !copyBtn.hasEventListener) {
    copyBtn.addEventListener('click', function () {
      var code = uniqueIdEl.textContent.trim();
      if (code && code !== '----') {
        navigator.clipboard.writeText(code).then(function () {
          var orig = copyBtn.textContent;
          copyBtn.textContent = 'COPIED!';
          setTimeout(function () { copyBtn.textContent = orig; }, 1200);
        });
      }
    });
    copyBtn.hasEventListener = true;
  }
}


function populateSettingsBody() {
  var panel = document.getElementById('settings-panel');
  if (!panel) return;
  var body = panel.querySelector('.settings-body');
  if (!body || body.children.length > 0) return;

  var currentBg = localStorage.getItem('ss_bg') || 'space';
  var currentTheme = localStorage.getItem('ss_theme') || 'matrix';
  var currentScale = localStorage.getItem('ss_font_scale') || '105';

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;min-height:100%;">
      <!-- Settings Content -->
      <div style="display:flex;flex-direction:column;gap:0.25rem;">
        <p style="font-family:var(--font-pixel);font-size:0.85rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:0.8rem;">Background</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:1.5rem;">
          ${[
      { key: 'default', label: 'Default Dark', img: null },
      { key: 'cyber', label: 'Cyber City', img: '/img/bg/cyber-city.png' },
      { key: 'space', label: 'Space Station', img: '/img/bg/space-station.png' },
      { key: 'hacker', label: 'Hacker Den', img: '/img/bg/hacker-den.png' },
      { key: 'forest', label: 'Dark Forest', img: '/img/bg/dark-forest.png' },
    ].map(bg => {
      var sel = currentBg === bg.key;
      return '<div class="bg-option ' + (sel ? 'is-selected' : '') + '" data-bg="' + bg.key + '" style="position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;cursor:pointer;border-radius:6px;background:#000;border:2px solid ' + (sel ? 'var(--accent)' : 'rgba(255,255,255,0.08)') + ';transition:all 0.2s;">'
        + (bg.img ? '<img src="' + bg.img + '" style="width:100%;height:100%;object-fit:cover;object-position:center;opacity:' + (sel ? '1' : '0.65') + ';display:block;">' : '<div style="width:100%;height:100%;background:#050508;"></div>')
        + '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:#fff;font-size:0.58rem;text-align:center;padding:5px 2px;font-family:var(--font-pixel);letter-spacing:0.04em;">' + bg.label + '</span>'
        + '</div>';
    }).join('')}
        </div>

        <p style="font-family:var(--font-pixel);font-size:0.85rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:0.6rem;">Theme Color</p>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:1.5rem;">
          ${Object.keys(THEMES).map(k => {
      var t = THEMES[k];
      var sel = k === currentTheme;
      return '<button class="theme-btn ' + (sel ? 'is-selected' : '') + '" data-theme="' + k + '" style="background:' + t.accent + ';color:' + (k === 'amber' ? '#000' : '#fff') + ';border:2px solid ' + (sel ? '#fff' : t.accent) + ';box-shadow:' + (sel ? ('0 0 12px ' + t.accent) : 'none') + ';padding:10px 6px;border-radius:6px;font-family:var(--font-pixel);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;transition:all 0.15s;">' + k + '</button>';
    }).join('')}
        </div>

        <div style="margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <p style="font-family:var(--font-pixel);font-size:0.85rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin:0;">Text Scale</p>
            <span id="font-scale-val" style="font-family:var(--font-pixel);font-size:0.95rem;color:var(--accent);">${currentScale}%</span>
          </div>
          <input type="range" id="settings-font-scale" min="80" max="130" value="${currentScale}" style="width:100%;-webkit-appearance:none;appearance:none;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;outline:none;accent-color:var(--accent);">
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-family:var(--font-pixel);font-size:0.7rem;color:#606080;">
            <span>Small</span><span>Large</span>
          </div>
        </div>
      </div>

      <!-- Centered Logout Area -->
      <div style="flex:1; display:flex; align-items:center; border-top:1px solid rgba(255,255,255,0.08); margin-top:0.5rem; padding:1.2rem 0;">
        <button id="settings-logout-btn" style="width:100%;background:transparent;border:2px solid rgba(239,68,68,0.5);color:#ef4444;padding:12px;font-family:var(--font-pixel);font-size:1rem;text-transform:uppercase;letter-spacing:0.12em;cursor:pointer;border-radius:4px;transition:background 0.15s,border-color 0.15s;">LOGOUT</button>
      </div>
    </div>
  `;

  document.getElementById('settings-logout-btn').addEventListener('click', function () {
    var logoutOverlay = document.getElementById('logout-modal-overlay');
    if (logoutOverlay) logoutOverlay.classList.add('is-visible');
  });

  body.querySelectorAll('.bg-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      applyBackground(this.dataset.bg);
      body.querySelectorAll('.bg-option').forEach(o => {
        o.classList.remove('is-selected');
        o.style.border = '2px solid rgba(255,255,255,0.08)';
      });
      this.classList.add('is-selected');
      this.style.border = '2px solid var(--accent)';
    });
  });

  body.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(this.dataset.theme);
      body.querySelectorAll('.theme-btn').forEach(function (b) {
        b.classList.remove('is-selected');
        b.style.border = '2px solid ' + b.style.background;
        b.style.boxShadow = 'none';
      });
      this.classList.add('is-selected');
      this.style.border = '2px solid #fff';
      this.style.boxShadow = '0 0 12px ' + THEMES[this.dataset.theme].accent;
    });
  });

  var scaleSlider = document.getElementById('settings-font-scale');
  var scaleVal = document.getElementById('font-scale-val');
  if (scaleSlider) {
    scaleSlider.addEventListener('input', function () {
      if (scaleVal) scaleVal.textContent = this.value + '%';
      applyScale(this.value);
    });
  }
}

function applyBackground(bgType) {
  var bodyEl = document.body;
  localStorage.setItem('ss_bg', bgType);

  var overlay = "linear-gradient(rgba(5, 5, 8, 0.82), rgba(5, 5, 8, 0.82))";

  /* CRITICAL: never use fixed — it paints relative to viewport and
     bleeds through all overlays regardless of z-index */
  bodyEl.style.backgroundAttachment = "scroll";
  bodyEl.style.backgroundSize = "cover";
  bodyEl.style.backgroundPosition = "center";

  if (bgType === 'cyber') {
    bodyEl.style.backgroundImage = `${overlay}, url('/img/bg/cyber-city.png')`;
  } else if (bgType === 'space') {
    bodyEl.style.backgroundImage = `${overlay}, url('/img/bg/space-station.png')`;
  } else if (bgType === 'hacker') {
    bodyEl.style.backgroundImage = `${overlay}, url('/img/bg/hacker-den.png')`;
  } else if (bgType === 'forest') {
    bodyEl.style.backgroundImage = `${overlay}, url('/img/bg/dark-forest.png')`;
  } else {
    bodyEl.style.backgroundImage = "none";
    bodyEl.style.backgroundColor = "#050508";
  }
}

function applyTheme(themeName) {
  var theme = THEMES[themeName];
  if (!theme) return;
  localStorage.setItem('ss_theme', themeName);
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-dim', theme.dim);
  document.documentElement.style.setProperty('--accent-glow', theme.glow);
  document.documentElement.style.setProperty('--green', theme.accent);

  if (theme.rgb) {
    document.documentElement.style.setProperty('--accent-rgb', theme.rgb);
  } else {
    // Convert hex to RGB for rgba() CSS vars
    var hex = theme.accent.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
  }

  // Recolor elements with hardcoded colors
  document.querySelectorAll('.logo').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.chat-sidebar-title').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.chat-self-row .label').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.chat-code-row .label').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.chat-active-status').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.contact-online').forEach(function (el) { el.style.color = theme.accent; });
  document.querySelectorAll('.sidebar-lightning').forEach(function (el) { el.style.color = theme.accent; });
}

function applyScale(val) {
  localStorage.setItem('ss_font_scale', val);
  document.documentElement.style.fontSize = (val / 100 * 100) + "%";
  document.body.style.fontSize = ((val / 100) * 18) + "px";
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', function () {
  injectProfileModal();
  setupStaticSidebar();

  applyBackground(localStorage.getItem('ss_bg') || 'space');
  // Always default to purple theme for pixel adventure aesthetic
  var savedTheme = localStorage.getItem('ss_theme');
  if (!savedTheme || !THEMES[savedTheme]) { savedTheme = 'purple'; localStorage.setItem('ss_theme', 'purple'); }
  applyTheme(savedTheme);
  applyScale(localStorage.getItem('ss_font_scale') || '105');

  // Small local interactions only; main modal logic is in chat.js
  document.addEventListener('click', function (e) {
    // Profile Copy Code
    var copyCodeBtn = e.target.closest('#profile-copy-code-btn');
    if (copyCodeBtn) {
      var codeInput = document.getElementById('profile-unique-id');
      if (codeInput) {
        var code = codeInput.tagName === 'INPUT' ? codeInput.value : codeInput.textContent;
        navigator.clipboard.writeText(code);
        copyCodeBtn.textContent = 'COPIED!';
        setTimeout(function () { copyCodeBtn.textContent = 'COPY'; }, 2000);
      }
    }

    // Profile Modal Buttons
    var saveBtn = e.target.closest('#profile-save-btn');
    if (saveBtn) {
      saveProfile();
    }
    var cancelBtn = e.target.closest('#profile-cancel-btn');
    var closeBtn = e.target.closest('#profile-modal-close');
    if (cancelBtn || closeBtn) {
      closeProfileModal();
    }
    var changeAvBtn = e.target.closest('#profile-change-avatar-btn');
    if (changeAvBtn) {
      var picker = document.getElementById('profile-avatar-picker-inline');
      if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    }
  });

  var sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
  if (sidebarSettingsBtn) sidebarSettingsBtn.addEventListener('click', function (e) { e.preventDefault(); openSettingsPanel(); });

  var sidebarProfileBtn = document.getElementById('sidebar-profile-btn');
  if (sidebarProfileBtn) sidebarProfileBtn.addEventListener('click', function (e) { e.preventDefault(); openProfileModal(); });

  var sidebarAddBtn = document.getElementById('sidebar-add-friend-btn');
  if (sidebarAddBtn) sidebarAddBtn.addEventListener('click', function (e) {
    e.preventDefault();
    var modal = document.getElementById('add-contact-modal');
    if (modal) modal.style.display = 'flex';
  });

  // Wiring up buttons inside the Add Contact Modal (Image 1 style)
  var addFriendModalBtn = document.getElementById('add-friend-modal-btn');
  if (addFriendModalBtn) {
    addFriendModalBtn.onclick = function () {
      var input = document.getElementById('add-friend-modal-code');
      if (input && input.value && window.addContact) {
        window.addContact(input.value);
        // showToast("Request sent", false); // addContact usually shows its own status
      }
    };
  }

  var addModalClose = document.getElementById('add-contact-modal-close');
  if (addModalClose) {
    addModalClose.onclick = function () {
      document.getElementById('add-contact-modal').style.display = 'none';
    };
  }

  var reqModalClose = document.getElementById('requests-modal-close');
  if (reqModalClose) {
    reqModalClose.onclick = function () {
      var overlay = document.getElementById('requests-modal-overlay');
      if (overlay) overlay.classList.remove('is-visible');
    };
  }

  // Global click-outside-to-close handler
  window.addEventListener('click', function (e) {
    var overlays = [
      { el: document.getElementById('profile-modal-overlay'), type: 'class', close: 'is-open' },
      { el: document.getElementById('settings-overlay'), type: 'class', close: 'is-visible' },
      { el: document.getElementById('avatar-picker-overlay'), type: 'class', close: 'is-open' },
      { el: document.getElementById('add-contact-modal'), type: 'style', close: 'none' },
      { el: document.getElementById('requests-modal-overlay'), type: 'style', close: 'none' },
      { el: document.getElementById('uid-card-modal'), type: 'style', close: 'none' },
      { el: document.getElementById('analysis-modal-overlay'), type: 'class', close: 'is-visible' },
      { el: document.getElementById('logout-modal-overlay'), type: 'class', close: 'is-visible' }
    ];

    overlays.forEach(function (ov) {
      if (ov.el && e.target === ov.el) {
        if (ov.type === 'class') {
          ov.el.classList.remove(ov.close);
          if (ov.el.id === 'logout-modal-overlay') ov.el.style.display = 'none'; // Extra safety
        }
        else if (ov.type === 'style') {
          ov.el.style.display = ov.close;
          ov.el.classList.remove('is-visible');
        }
      }
    });

    // Logout Modal Buttons Wiring (Inside the global handler to ensure they exist after injection)
    var logConfirm = document.getElementById('logout-confirm-btn');
    if (logConfirm && e.target === logConfirm) {
      localStorage.clear();
      window.location.reload();
    }
    var logCancel = document.getElementById('logout-cancel-btn');
    if (logCancel && e.target === logCancel) {
      var ov = document.getElementById('logout-modal-overlay');
      if (ov) {
        ov.classList.remove('is-visible');
        ov.style.display = 'none';
      }
    }
  });

  var viewPendingBtn = document.getElementById('view-pending-btn');
  if (viewPendingBtn) {
    viewPendingBtn.onclick = function (e) {
      if (e) e.stopPropagation();
      var requestsOverlay = document.getElementById('requests-modal-overlay');
      if (requestsOverlay) {
        // High-reliability show: force display flex and opacity 1
        requestsOverlay.style.display = 'flex';
        requestsOverlay.style.opacity = '1';
        requestsOverlay.classList.add('is-visible');
        if (window.checkIncomingRequests) window.checkIncomingRequests();
      }
    };
  }

  setTimeout(function () {
    enhanceContactsHeader();
    populateSettingsBody();
  }, 800);

  var observer = new MutationObserver(function () {
    var uid = document.getElementById('my-unique-id');
    if (uid && uid.textContent !== '----') {
      enhanceContactsHeader();
      var codeEl = document.getElementById('profile-unique-id');
      if (codeEl && (codeEl.value === '----' || codeEl.textContent === '----')) {
        if (codeEl.tagName === 'INPUT') codeEl.value = uid.textContent;
        else codeEl.textContent = uid.textContent;
      }
      localStorage.setItem('ss_friend_code', uid.textContent);
    }
    populateSettingsBody();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
});