// ─── CONSTANTS ───────────────────────────────────────────────
const LEVEL_CONFIG = [
    { level: 1, name: "Barely a Chuckle", emoji: "😐", unlockAt: 0 },
    { level: 2, name: "Mild Giggle", emoji: "🙂", unlockAt: 30 },
    { level: 3, name: "Heh", emoji: "😄", unlockAt: 70 },
    { level: 4, name: "Lol", emoji: "😆", unlockAt: 120 },
    { level: 5, name: "Ha-Ha Zone", emoji: "😂", unlockAt: 180 },
    { level: 6, name: "Genuine Laugh", emoji: "🤣", unlockAt: 250 },
    { level: 7, name: "Hard Laugh", emoji: "💀", unlockAt: 330 },
    { level: 8, name: "Can't Breathe", emoji: "🫁", unlockAt: 420 },
    { level: 9, name: "On The Floor", emoji: "🏔️", unlockAt: 520 },
    { level: 10, name: "Ultimate Funnies", emoji: "👑", unlockAt: 640 },
];

let globalState = {
    points: 0,
    visited_links: [],
    links: []
};
let adminPassword = "";

// ─── API FETCHING ─────────────────────────────────────────────
async function fetchState() {
    try {
        const res = await fetch('/api/state');
        if (res.ok) {
            globalState = await res.json();
            render();
        }
    } catch (err) {
        console.error("Failed to fetch state", err);
    }
}

// ─── RENDER ───────────────────────────────────────────────────
function render() {
    const { points, visited_links, links } = globalState;

    document.getElementById('totalPtsDisplay').textContent = `⭐ ${points} pts`;

    const grid = document.getElementById('levelsGrid');
    grid.innerHTML = '';

    LEVEL_CONFIG.forEach(cfg => {
        const unlocked = points >= cfg.unlockAt;
        const levelLinks = links.filter(l => l.level == cfg.level);
        const nextLevel = LEVEL_CONFIG.find(c => c.level === cfg.level + 1);
        const needed = nextLevel ? nextLevel.unlockAt : null;

        const card = document.createElement('div');
        card.className = 'level-card';

        // Header
        const hdr = document.createElement('div');
        hdr.className = 'level-header';
        hdr.innerHTML = `
<span class="level-title">${cfg.emoji} Level ${cfg.level}: ${cfg.name}</span>
${unlocked
                ? `<span class="level-badge">🔓 OPEN</span>`
                : `<span class="level-badge">🔒 ${cfg.unlockAt} pts</span>`}
`;
        card.appendChild(hdr);

        const body = document.createElement('div');
        body.className = 'level-body';

        if (!unlocked) {
            const prog = Math.min(100, Math.round((points / cfg.unlockAt) * 100));
            body.innerHTML = `
<div class="locked-overlay">
  <div class="lock-icon">🔒</div>
  <div class="unlock-msg">Need <strong>${cfg.unlockAt} pts</strong> to unlock<br>You have <strong>${points} pts</strong></div>
  <div class="progress-bar-wrap" style="width:100%">
    <div class="progress-bar-fill" style="width:${prog}%"></div>
  </div>
</div>`;
        } else {
            if (levelLinks.length === 0) {
                body.innerHTML = `<div style="color:#555;font-size:0.95rem;font-weight:700;padding:10px 0;">No videos yet — admin adds links here!</div>`;
            } else {
                levelLinks.forEach(link => {
                    const isVisited = visited_links.includes(link.id);
                    const a = document.createElement('a');
                    a.href = link.url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.className = 'video-link' + (isVisited ? ' visited' : '');
                    a.dataset.id = link.id;
                    a.dataset.pts = link.pts;
                    a.innerHTML = `
    <span class="link-title">${isVisited ? '✅' : '🎬'} ${link.title}</span>
    <span class="pts-chip">${isVisited ? 'Done' : '+' + link.pts + ' pts'}</span>
  `;
                    if (!isVisited) {
                        a.addEventListener('click', async function (e) {
                            await awardPoints(link.id, link.pts);
                        });
                    } else {
                        a.addEventListener('click', e => e.preventDefault());
                    }
                    body.appendChild(a);
                });
            }

            // Show progress to next level
            if (needed) {
                const pct = Math.min(100, Math.round((points / needed) * 100));
                const rem = Math.max(0, needed - points);
                body.insertAdjacentHTML('beforeend', `
  <div style="margin-top:12px;font-size:0.82rem;font-weight:900;color:#111;">
    Next level in ${rem} more pts
    <div class="progress-bar-wrap" style="width:100%;margin-top:5px;">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
  </div>`);
            }
        }

        card.appendChild(body);
        grid.appendChild(card);
    });
}

// ─── AWARD POINTS ─────────────────────────────────────────────
async function awardPoints(id, pts) {
    if (globalState.visited_links.includes(id)) return;
    
    // Optimistic UI update
    globalState.visited_links.push(id);
    globalState.points += parseInt(pts);
    render();
    
    try {
        const res = await fetch('/api/award', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pts })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                globalState.points = data.points; // sync with backend
                showToast(`+${pts} pts! 🎉 Total: ${globalState.points}`);
                render();
            }
        }
    } catch (err) {
        console.error("Failed to award points", err);
    }
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── ADMIN AUTH ───────────────────────────────────────────────
function openAdminAuth() {
    document.getElementById('pwInput').value = '';
    document.getElementById('pwError').textContent = '';
    document.getElementById('pwScreen').classList.add('open');
    setTimeout(() => document.getElementById('pwInput').focus(), 100);
}
function closePw() {
    document.getElementById('pwScreen').classList.remove('open');
}
function checkPw() {
    const val = document.getElementById('pwInput').value;
    adminPassword = val;
    // Basic frontend check just for UX, actual check happens on backend actions
    closePw();
    openAdmin();
}

// ─── ADMIN PANEL ──────────────────────────────────────────────
function openAdmin() {
    renderAdminLinks();
    document.getElementById('adminModal').classList.add('open');
}
function closeAdmin() {
    adminPassword = ""; // clear password memory when closing
    document.getElementById('adminModal').classList.remove('open');
    render();
}

function renderAdminLinks() {
    const { links } = globalState;
    const list = document.getElementById('adminLinksList');
    list.innerHTML = '';
    if (links.length === 0) {
        list.innerHTML = '<div style="font-size:0.9rem;font-weight:700;color:#555;padding:8px 0;">No links added yet.</div>';
        return;
    }
    links.forEach(link => {
        const row = document.createElement('div');
        row.className = 'admin-link-row';
        row.innerHTML = `
<span><strong>L${link.level}</strong> — ${link.title} <em style="font-size:0.8rem;color:#555;">(+${link.pts}pts)</em></span>
<button class="del-btn" onclick="deleteLink('${link.id}')">🗑</button>
`;
        list.appendChild(row);
    });
}

async function adminAddLink() {
    const level = document.getElementById('adminLevel').value;
    const title = document.getElementById('adminTitle').value.trim();
    const url = document.getElementById('adminUrl').value.trim();
    const pts = document.getElementById('adminPts').value;

    if (!title || !url) { alert('Please fill in title and URL!'); return; }
    if (!url.startsWith('http')) { alert('URL must start with http:// or https://'); return; }

    const id = 'lnk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newLink = { id, level: parseInt(level), title, url, pts: parseInt(pts), password: adminPassword };

    try {
        const res = await fetch('/api/admin/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLink)
        });
        
        if (res.ok) {
            // Success, add to local state
            delete newLink.password; // Don't keep password in state
            globalState.links.push(newLink);
            
            document.getElementById('adminTitle').value = '';
            document.getElementById('adminUrl').value = '';
            renderAdminLinks();
            showToast(`✅ Link added to Level ${level}!`);
        } else {
            alert("Admin action failed. Incorrect password?");
            closeAdmin();
        }
    } catch (err) {
        console.error("Failed to add link", err);
    }
}

async function deleteLink(id) {
    if (!confirm('Delete this link?')) return;
    
    try {
        const res = await fetch(`/api/admin/links/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: adminPassword })
        });
        
        if (res.ok) {
            globalState.links = globalState.links.filter(l => l.id !== id);
            renderAdminLinks();
        } else {
            alert("Admin action failed. Incorrect password?");
            closeAdmin();
        }
    } catch (err) {
        console.error("Failed to delete link", err);
    }
}

async function resetAllData() {
    if (!confirm('Reset your user points and visited links? This cannot be undone!')) return;
    
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
            globalState.points = 0;
            globalState.visited_links = [];
            closeAdmin();
            render();
            showToast('🗑️ User session data reset!');
        }
    } catch (err) {
        console.error("Failed to reset data", err);
    }
}

// ─── INIT ─────────────────────────────────────────────────────
fetchState();
