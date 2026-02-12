/*
  Admin panel JS (session-based via Flask backend).

  Admin credential (seeded in SQLite):
    email: admin@generationbridge.com
    password: admin123
*/

async function handleAdminLogin(event) {
    event.preventDefault();

    const adminEmail = document.getElementById('adminEmail')?.value || '';
    const adminPassword = document.getElementById('adminPassword')?.value || '';
    const adminErrorMessage = document.getElementById('adminErrorMessage');

    if (adminErrorMessage) {
        adminErrorMessage.textContent = '';
        adminErrorMessage.style.display = 'none';
    }

    try {
        const res = await fetch('/api/auth/admin_login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: adminEmail, password: adminPassword })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
            if (adminErrorMessage) {
                adminErrorMessage.textContent = 'Invalid admin credentials. Please try again.';
                adminErrorMessage.style.display = 'block';
            }
            return;
        }

        window.location.href = 'adminhome.html';
    } catch (e) {
        if (adminErrorMessage) {
            adminErrorMessage.textContent = 'Unable to login right now. Please try again.';
            adminErrorMessage.style.display = 'block';
        }
    }
}

async function handleAdminLogout() {
    const ok = confirm('Are you sure you want to logout from admin panel?');
    if (!ok) return;
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = 'adminlog.html';
}

async function checkAdminAuth() {
    // Server already protects admin pages; this is a client-side safety net.
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        const isAdmin = !!(data?.user?.is_admin);
        const path = (window.location.pathname || '').toLowerCase();
        const onLoginPage = path.includes('adminlog.html');
        if (!isAdmin && !onLoginPage) {
            window.location.href = 'adminlog.html';
        }
    } catch (e) {
        // If request fails, let server redirect handle it.
    }
}

// ----- Moderation actions -----

async function adminBanUser(userId) {
    const ok = confirm('Are you sure you want to permanently ban this user? This action cannot be undone.');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('ban failed');

        const userCard = document.querySelector(`[data-admin-user-id="${userId}"]`);
        if (userCard) userCard.remove();
        alert('User has been banned.');
    } catch (e) {
        alert('Unable to ban user. Please try again.');
    }
}

async function adminDeleteUser(userId) {
    const ok = confirm('Are you sure you want to delete this user? This action cannot be undone.');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('delete failed');

        const userCard = document.querySelector(`[data-admin-match-id="${userId}"], [data-admin-user-id="${userId}"]`);
        if (userCard) userCard.remove();
        alert('User deleted.');
    } catch (e) {
        alert('Unable to delete user. Please try again.');
    }
}

async function adminDeleteSkillPost(skillId) {
    const ok = confirm('Are you sure you want to delete this skill post?');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/skillswap/${encodeURIComponent(skillId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('delete failed');

        const card = document.querySelector(`[data-admin-skill-id="${skillId}"]`);
        if (card) card.remove();
        alert('Skill post deleted.');
    } catch (e) {
        alert('Unable to delete skill post. Please try again.');
    }
}

// Wrapper for template-defined onclick handlers.
// Keeps buttons in HTML while logic stays here.
function adminDeleteSkillPostFromBtn(btn) {
    const id = btn?.dataset?.skillId;
    if (!id) return;
    adminDeleteSkillPost(Number(id));
}

async function adminDeleteStory(storyId) {
    const ok = confirm('Are you sure you want to delete this story?');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('delete failed');

        const card = document.querySelector(`[data-admin-story-id="${storyId}"]`);
        if (card) card.remove();
        alert('Story deleted.');
    } catch (e) {
        alert('Unable to delete story. Please try again.');
    }
}

// Admin Story Post Expand/Collapse (kept)
function adminExpandStoryPost(postId) {
    const expandedSection = document.getElementById(postId);
    const card = expandedSection?.closest('.story-card');
    if (!expandedSection || !card) return;

    const header = card.querySelector('.story-header');
    const preview = card.querySelector('.story-preview');
    const viewBtn = card.querySelector('.btn-secondary');
    const deleteBtn = card.querySelector('.btn-primary');
    const badge = card.querySelector('.category-badge');

    if (header) header.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (viewBtn) viewBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (badge) badge.style.display = 'none';

    expandedSection.style.display = 'block';
}

function adminCollapseStoryPost(postId) {
    const expandedSection = document.getElementById(postId);
    const card = expandedSection?.closest('.story-card');
    if (!expandedSection || !card) return;

    const header = card.querySelector('.story-header');
    const preview = card.querySelector('.story-preview');
    const viewBtn = card.querySelector('.btn-secondary');
    const deleteBtn = card.querySelector('.btn-primary');
    const badge = card.querySelector('.category-badge');

    if (header) header.style.display = 'block';
    if (preview) preview.style.display = 'block';
    if (viewBtn) viewBtn.style.display = 'inline-block';
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
    if (badge) badge.style.display = 'inline-block';

    expandedSection.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();

    // Page-specific data loaders (admin views reflect the same SQLite DB used by users).
    const path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('adminhome.html')) {
        loadAdminReportsFromAPI();
    }
    if (path.endsWith('adminstories.html')) {
        loadAdminStoriesFromAPI();
    } else if (path.endsWith('adminskillswap.html')) {
        loadAdminSkillSwapFromAPI();
    } else if (path.endsWith('adminmatch.html')) {
        loadAdminMatchupFromAPI();
    } else if (path.endsWith('adminevents.html')) {
        loadAdminEventsFromAPI();
    }
});

// -----------------------------
// Admin: Reports (DB-backed)
// -----------------------------

async function loadAdminReportsFromAPI() {
    const grid = document.getElementById('adminReportedUsers');
    if (!grid) return;

    try {
        const res = await fetch('/api/admin/reports?status=pending');
        const data = await res.json().catch(() => ({}));
        const reports = (data && data.ok && Array.isArray(data.reports)) ? data.reports : [];

        grid.innerHTML = reports.length
            ? reports.map(renderAdminReportCard).join('')
            : '<div class="card empty-state"><h3>No reports yet</h3><p class="mb-2">Reported users will appear here. Use the Report button from Match-Up.</p></div>';
    } catch (e) {
        grid.innerHTML = '<div class="card empty-state"><h3>Unable to load reports</h3><p class="mb-2">Please refresh and try again.</p></div>';
    }
}

function renderAdminReportCard(rep) {
    const reporter = rep.reporter || {};
    const target = rep.target_user || {};
    const created = rep.created_at ? new Date(rep.created_at).toLocaleString() : '';

    const reporterName = (typeof escapeHtml === 'function') ? escapeHtml(reporter.full_name || 'User') : (reporter.full_name || 'User');
    const targetName = (typeof escapeHtml === 'function') ? escapeHtml(target.full_name || 'User') : (target.full_name || 'User');
    const reason = (typeof escapeHtml === 'function') ? escapeHtml(rep.reason || '') : (rep.reason || '');
    const details = (typeof escapeHtml === 'function') ? escapeHtml(rep.details || '') : (rep.details || '');

    return `
        <div class="card" data-admin-report-id="${rep.id}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem;">
                <div>
                    <h3 class="mb-1">Reported: ${targetName}</h3>
                    <p class="mb-1"><strong>Reason:</strong> ${reason || '—'}</p>
                    ${details ? `<p class="mb-1"><strong>Details:</strong> ${details}</p>` : ''}
                    <p class="mb-1"><strong>Reporter:</strong> ${reporterName}</p>
                    ${created ? `<p class="mb-2" style="opacity:0.8; font-size:0.95rem;">${created}</p>` : ''}
                </div>
            </div>

            <div class="btn-row" style="display:flex; gap:0.6rem; flex-wrap:wrap; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="adminWarnFromReport(${rep.id})">⚠️ Warn User</button>
                <button class="btn btn-secondary" onclick="adminSuspendFromReport(${rep.id})">⏸️ Suspend 3 Days</button>
                <button class="btn btn-danger" onclick="adminBanUser(${Number(target.id) || 0})">⛔ Ban</button>
                <button class="btn btn-primary" onclick="adminDismissReport(${rep.id})">Dismiss</button>
            </div>
        </div>
    `;
}

async function adminDismissReport(reportId) {
    const ok = confirm('Dismiss this report?');
    if (!ok) return;
    try {
        const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'dismissed' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('dismiss failed');
        document.querySelector(`[data-admin-report-id="${reportId}"]`)?.remove();
    } catch (e) {
        alert('Unable to dismiss report. Please try again.');
    }
}

async function adminWarnFromReport(reportId) {
    const ok = confirm('Send an official warning to the reported user?');
    if (!ok) return;
    try {
        const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/warn`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('warn failed');
        document.querySelector(`[data-admin-report-id="${reportId}"]`)?.remove();
        alert('Warning sent.');
    } catch (e) {
        alert('Unable to warn user. Please try again.');
    }
}

async function adminSuspendFromReport(reportId) {
    const ok = confirm('Suspend the reported user for 3 days?');
    if (!ok) return;
    try {
        const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/suspend`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('suspend failed');
        document.querySelector(`[data-admin-report-id="${reportId}"]`)?.remove();
        alert('User suspended for 3 days.');
    } catch (e) {
        alert('Unable to suspend user. Please try again.');
    }
}

// -----------------------------
// Admin: Stories (DB-backed)
// -----------------------------

async function loadAdminStoriesFromAPI() {
    const ongoingGrid = document.getElementById('adminOngoingGrid');
    const resolvedGrid = document.getElementById('adminResolvedGrid');
    if (!ongoingGrid && !resolvedGrid) return;

    try {
        const res = await fetch('/api/admin/stories');
        const data = await res.json();
        const stories = (data && data.ok && Array.isArray(data.stories)) ? data.stories : [];

        const ongoing = stories.filter(s => (s.status || '').toLowerCase() === 'ongoing');
        const resolved = stories.filter(s => (s.status || '').toLowerCase() === 'resolved');

        if (ongoingGrid) {
            ongoingGrid.innerHTML = ongoing.length
                ? ongoing.map(renderAdminStoryCard).join('')
                : '<div class="card empty-state"><h3>No ongoing stories</h3><p class="mb-2">Nothing to moderate right now.</p></div>';
        }

        if (resolvedGrid) {
            resolvedGrid.innerHTML = resolved.length
                ? resolved.map(renderAdminStoryCard).join('')
                : '<div class="card empty-state"><h3>No resolved stories yet</h3><p class="mb-2">Resolved stories will appear here.</p></div>';
        }
    } catch (e) {
        if (ongoingGrid) ongoingGrid.innerHTML = '<div class="card empty-state"><h3>Unable to load stories</h3><p class="mb-2">Please refresh and try again.</p></div>';
        if (resolvedGrid) resolvedGrid.innerHTML = '';
    }
}

function renderAdminStoryCard(story) {
    const category = (story.category || 'untagged');
    const created = story.created_at ? new Date(story.created_at).toLocaleString() : '';
    const author = (story.user && story.user.full_name) || story.user_name || 'User';
    const commentsCount = Number(story.comments_count || 0) || 0;

    const title = (typeof escapeHtml === 'function') ? escapeHtml(story.title || '') : (story.title || '');
    const content = (typeof escapeHtml === 'function') ? escapeHtml(story.content || '') : (story.content || '');
    const previewRaw = (story.content || '');
    const preview = ((typeof escapeHtml === 'function') ? escapeHtml(previewRaw.slice(0, 160)) : previewRaw.slice(0, 160)) + (previewRaw.length > 160 ? '...' : '');

    const categoryLabel = String(category || 'untagged')
        .replace(/(^|[-_])(\w)/g, (_, p1, p2) => (p1 ? ' ' : '') + p2.toUpperCase())
        .trim();

    return `
        <div class="card story-card" data-admin-story-id="${story.id}" data-category="${category}">
            <div class="card-top" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                <span class="category-badge">${(typeof escapeHtml === 'function') ? escapeHtml(categoryLabel) : categoryLabel}</span>
                <button class="btn btn-secondary" onclick="adminDeleteStory(${story.id})">🗑️ Delete</button>
            </div>

            <h3 class="card-title">${title}</h3>
            <div class="card-meta">By ${(typeof escapeHtml === 'function') ? escapeHtml(author) : author}${created ? ` • ${(typeof escapeHtml === 'function') ? escapeHtml(created) : created}` : ''}</div>
            <p class="story-preview">${preview}</p>

            <div class="card-actions" style="display:flex; gap:0.75rem;">
                <button class="btn btn-secondary" onclick="adminToggleStoryPanel(${story.id})">💬 Comments (${commentsCount})</button>
            </div>

            <div class="story-expanded" id="admin-story-${story.id}" style="display:none;">
                <div class="story-full-content">${content}</div>

                <div class="story-comments">
                    <h4>Comments</h4>
                    <div id="admin-comments-list-${story.id}" class="comments-list">
                        <div style="opacity:0.8;">Loading comments...</div>
                    </div>
                </div>

                <div class="card-actions">
                    <button class="btn btn-secondary" onclick="adminToggleStoryPanel(${story.id}, true)">Close</button>
                </div>
            </div>
        </div>
    `;
}

async function adminToggleStoryPanel(storyId, forceClose = false) {
    const panel = document.getElementById(`admin-story-${storyId}`);
    if (!panel) return;

    if (forceClose) {
        panel.style.display = 'none';
        return;
    }

    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        await loadAdminStoryComments(storyId);
    }
}

async function loadAdminStoryComments(storyId) {
    const list = document.getElementById(`admin-comments-list-${storyId}`);
    if (!list) return;
    list.innerHTML = '<div style="opacity:0.8;">Loading comments...</div>';

    try {
        // Reuse the user comments endpoint for listing; admin delete is separate.
        const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments`);
        const data = await res.json();
        const comments = (data && data.ok && Array.isArray(data.comments)) ? data.comments : [];

        if (!comments.length) {
            list.innerHTML = '<div style="opacity:0.8;">No comments yet.</div>';
            return;
        }

        list.innerHTML = comments.map(c => {
            const who = (c.user && c.user.full_name) || c.user_name || 'User';
            const when = c.created_at ? new Date(c.created_at).toLocaleString() : '';
            const text = (typeof escapeHtml === 'function') ? escapeHtml(c.text || '') : (c.text || '');
            return `
                <div style="padding:0.75rem; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);">
                    <div style="display:flex; justify-content:space-between; gap:1rem; margin-bottom:0.25rem; align-items:center;">
                        <div style="display:flex; flex-direction:column;">
                            <strong>${(typeof escapeHtml === 'function') ? escapeHtml(who) : who}</strong>
                            <small style="opacity:0.75;">${(typeof escapeHtml === 'function') ? escapeHtml(when) : when}</small>
                        </div>
                        <button class="btn btn-secondary" onclick="adminDeleteStoryComment(${storyId}, ${c.id})">Delete</button>
                    </div>
                    <div>${text}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = '<div style="opacity:0.8;">Unable to load comments. Please try again.</div>';
    }
}

async function adminDeleteStoryComment(storyId, commentId) {
    const ok = confirm('Delete this comment?');
    if (!ok) return;
    try {
        const res = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('delete failed');
        await loadAdminStoryComments(storyId);
    } catch (e) {
        alert('Unable to delete comment. Please try again.');
    }
}

// -----------------------------
// Admin: SkillSwap (DB-backed)
// -----------------------------

async function loadAdminSkillSwapFromAPI() {
    const offeringGrid = document.getElementById('adminOfferingGrid');
    const seekingGrid = document.getElementById('adminSeekingGrid');
    if (!offeringGrid && !seekingGrid) return;

    try {
        const res = await fetch('/api/admin/skillswap');
        const data = await res.json();
        const posts = (data && data.ok && Array.isArray(data.posts)) ? data.posts : [];

        // Post types in DB are stored as "offer" and "request" (user page also accepts "offering"/"seeking").
        const offering = posts.filter(p => ['offer','offering'].includes(String(p.post_type || '').toLowerCase()));
        const seeking = posts.filter(p => ['request','seeking'].includes(String(p.post_type || '').toLowerCase()));

        if (offeringGrid) {
            if (!offering.length) {
                offeringGrid.innerHTML = '<div class="card empty-state"><h3>No offering posts yet</h3><p class="mb-2">Skill offerings will appear here.</p></div>';
            } else {
                offeringGrid.innerHTML = '';
                offering.forEach(p => {
                    const el = createAdminSkillCard(p);
                    if (el) offeringGrid.appendChild(el);
                });
            }
        }
        if (seekingGrid) {
            if (!seeking.length) {
                seekingGrid.innerHTML = '<div class="card empty-state"><h3>No seeking posts yet</h3><p class="mb-2">Skill requests will appear here.</p></div>';
            } else {
                seekingGrid.innerHTML = '';
                seeking.forEach(p => {
                    const el = createAdminSkillCard(p);
                    if (el) seekingGrid.appendChild(el);
                });
            }
        }
    } catch (e) {
        if (offeringGrid) offeringGrid.innerHTML = '<div class="card empty-state"><h3>Unable to load posts</h3><p class="mb-2">Please refresh and try again.</p></div>';
        if (seekingGrid) seekingGrid.innerHTML = '';
    }
}

function createAdminSkillCard(post) {
    const tpl = document.getElementById('admin-skillswap-card-template');
    if (!tpl || !tpl.content) {
        // Fallback: avoid breaking the page if template is missing.
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<div class="card empty-state"><h3>UI template missing</h3><p class="mb-2">Missing #admin-skillswap-card-template in adminskillswap.html.</p></div>';
        return wrapper.firstElementChild;
    }

    const card = tpl.content.firstElementChild.cloneNode(true);

    const category = (post.category || 'cultural');
    const created = post.created_at ? new Date(post.created_at).toLocaleString() : '';
    const author = (post.user && post.user.full_name) || post.user_name || 'User';
    const ptype = String(post.post_type || '').toLowerCase();
    const isOffer = ['offer', 'offering'].includes(ptype);

    const title = String(post.title || '');
    const descRaw = String(post.description || '');
    const desc = descRaw.slice(0, 220) + (descRaw.length > 220 ? '...' : '');

    const typeLabel = isOffer ? 'Offering' : 'Seeking';
    const categoryLabel = String(category || 'cultural')
        .replace(/(^|[-_])(\w)/g, (_, p1, p2) => (p1 ? ' ' : '') + p2.toUpperCase())
        .trim();

    const postId = Number(post.id || 0);
    card.setAttribute('data-admin-skill-id', String(postId || ''));
    card.setAttribute('data-category', String(category || 'cultural'));
    card.setAttribute('data-type', String(ptype || ''));

    const badge = card.querySelector('.type-badge');
    if (badge) {
        badge.textContent = typeLabel;
        badge.classList.toggle('badge-offering', isOffer);
        badge.classList.toggle('badge-seeking', !isOffer);
    }

    const titleEl = card.querySelector('.card-title');
    if (titleEl) titleEl.textContent = title;

    const metaEl = card.querySelector('.card-meta');
    if (metaEl) metaEl.textContent = `By ${author}${created ? ` • ${created}` : ''}`;

    const pill = card.querySelector('.pill');
    if (pill) pill.textContent = categoryLabel;

    const body = card.querySelector('.card-body-text');
    if (body) body.textContent = desc;

    const delBtn = card.querySelector('.admin-delete-skill-btn');
    if (delBtn) {
        delBtn.dataset.skillId = String(postId || '');
    }

    return card;
}

// -----------------------------
// Admin: Users / Match-Up (DB-backed)
// -----------------------------

async function loadAdminUsersFromAPI() {
    const grid = document.getElementById('adminUserGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        const users = (data && data.ok && Array.isArray(data.users)) ? data.users : [];

        if (!users.length) {
            grid.innerHTML = '<div class="card empty-state"><h3>No users yet</h3><p class="mb-2">User accounts will appear here once created.</p></div>';
            return;
        }

        // Sort: matchup users first, then by id.
        users.sort((a, b) => {
            const am = Number(a.show_in_matchup || 0);
            const bm = Number(b.show_in_matchup || 0);
            if (am !== bm) return bm - am;
            return Number(a.id || 0) - Number(b.id || 0);
        });

        grid.innerHTML = users.map(renderAdminUserCard).join('');
    } catch (e) {
        grid.innerHTML = '<div class="card empty-state"><h3>Unable to load users</h3><p class="mb-2">Please refresh and try again.</p></div>';
    }
}

// Legacy admin user card renderer (used by older admin dashboards).
// Kept as a string renderer because those pages were originally string-based.
function renderAdminUserCard(u) {
    const name = (typeof escapeHtml === 'function') ? escapeHtml(u.full_name || '') : (u.full_name || '');
    const email = (typeof escapeHtml === 'function') ? escapeHtml(u.email || '') : (u.email || '');
    const age = u.age ? String(u.age) : '';
    const gen = (typeof escapeHtml === 'function') ? escapeHtml(u.generation || '') : (u.generation || '');
    const inMatch = !!u.show_in_matchup;

    const chips = Array.isArray(u.interests) ? u.interests.slice(0, 5) : [];

    return `
        <div class="card" data-admin-user-id="${u.id}">
            <div class="card-top" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                <span class="chip">User #${u.id}${inMatch ? ' • In Match-Up' : ''}</span>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-secondary" onclick="adminBanUser(${u.id})">Ban</button>
                    <button class="btn btn-secondary" onclick="adminDeleteUser(${u.id})">Delete</button>
                </div>
            </div>
            <h3 class="card-title">${name}</h3>
            <div class="card-meta">${email}${age ? ` • ${age} years` : ''}${gen ? ` • ${gen}` : ''}</div>
            ${chips.length ? `<div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.75rem;">${chips.map(i => `<span class="chip">${(typeof escapeHtml === 'function') ? escapeHtml(i) : i}</span>`).join('')}</div>` : ''}
        </div>
    `;
}

async function loadAdminMatchupFromAPI() {
    // Admin Match-Up page intentionally reuses the same ids/classes as the normal match page
    // so the shared FilterManager can apply without any special casing.
    const grid = document.getElementById('matchGrid') || document.getElementById('adminUserGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/admin/matchup');
        const data = await res.json();
        const users = (data && data.ok && Array.isArray(data.users)) ? data.users : [];

        if (!users.length) {
            grid.innerHTML = '<div class="card empty-state"><h3>No users in Match-Up yet</h3><p class="mb-2">Users who opt in will appear here.</p></div>';
            return;
        }

        // Sort by id for stability.
        users.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

        // Template-driven rendering so moderation buttons remain in adminmatch.html (not generated in JS)
        grid.innerHTML = '';
        users.forEach(u => {
            const el = createAdminMatchCard(u);
            if (el) grid.appendChild(el);
        });

        // Apply any active filters immediately
        try { app?.filterManager?.filterMatches?.(); } catch {}
    } catch (e) {
        grid.innerHTML = '<div class="card empty-state"><h3>Unable to load Match-Up</h3><p class="mb-2">Please refresh and try again.</p></div>';
    }
}

function adminBanUserFromBtn(btn) {
    const id = btn?.closest?.('[data-admin-match-id]')?.dataset?.adminMatchId;
    if (!id) return;
    adminBanUser(Number(id));
}

function adminDeleteUserFromBtn(btn) {
    const id = btn?.closest?.('[data-admin-match-id]')?.dataset?.adminMatchId;
    if (!id) return;
    adminDeleteUser(Number(id));
}

function _pickMatchCategory(interests) {
    const allowed = new Set(['tech', 'art', 'music', 'cooking', 'reading', 'sports', 'gaming']);
    const norm = (s) => String(s || '').trim().toLowerCase();

    const mapped = (v) => {
        const x = norm(v);
        if (!x) return '';
        if (allowed.has(x)) return x;
        // common synonyms / legacy values
        if (x === 'technical') return 'tech';
        if (x === 'technology') return 'tech';
        if (x === 'creative') return 'art';
        if (x === 'games') return 'gaming';
        return x;
    };

    const arr = Array.isArray(interests) ? interests : [];
    // Prefer a category that matches the visible filter buttons
    for (const it of arr) {
        const m = mapped(it);
        if (allowed.has(m)) return m;
    }
    // Fallback to first interest (or 'all')
    return mapped(arr[0]) || 'all';
}

function createAdminMatchCard(u) {
    const tpl = document.getElementById('admin-match-card-template');
    if (!tpl || !tpl.content) return null;

    const card = tpl.content.firstElementChild.cloneNode(true);

    const name = u.full_name || 'User';
    const gen = u.generation || '';
    const age = u.age ? `${String(u.age)} years old` : '';
    const avatar = u.avatar || '👤';
    const bio = u.bio || '';
    const interests = Array.isArray(u.interests) ? u.interests : [];

    const category = _pickMatchCategory(interests);

    card.dataset.adminMatchId = String(u.id || '');
    // Keep compatibility with older selectors in adminBanUser/adminDeleteUser
    card.dataset.adminUserId = String(u.id || '');
    card.setAttribute('data-category', (typeof escapeHtml === 'function') ? escapeHtml(category) : String(category));
    // For shared filter logic (same as user Match-Up page)
    const _norm = (v) => {
        const x = String(v || '').trim().toLowerCase();
        if (!x) return '';
        if (x === 'technical' || x === 'technology') return 'tech';
        if (x === 'creative') return 'art';
        if (x === 'games' || x === 'game') return 'gaming';
        if (x === 'sport') return 'sports';
        if (x === 'cultural' || x === 'culture') return 'art';
        if (x === 'practical') return 'cooking';
        return x;
    };
    const normList = Array.from(new Set(interests.map(_norm).filter(Boolean)));
    card.setAttribute('data-interests', JSON.stringify(normList));


    const avatarEl = card.querySelector('.match-avatar');
    if (avatarEl) avatarEl.textContent = avatar;

    const titleEl = card.querySelector('.card-title');
    if (titleEl) titleEl.textContent = name;

    const metaEl = card.querySelector('.card-meta');
    if (metaEl) metaEl.textContent = `${age}${(age && gen) ? ' • ' : ''}${gen}`;

    const blurbEl = card.querySelector('.match-blurb');
    if (blurbEl) blurbEl.textContent = bio;

    const chipsWrap = card.querySelector('.match-interests');
    if (chipsWrap) {
        chipsWrap.innerHTML = '';
        interests.slice(0, 4).forEach(i => {
            const span = document.createElement('span');
            span.className = 'interest-tag';
            span.textContent = i;
            chipsWrap.appendChild(span);
        });
    }

    return card;
}

// -----------------------------
// Admin: Events (DB-backed)
// -----------------------------

function adminSetEventMessage(text, isOk = true) {
    const el = document.getElementById('adminEventMessage');
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    el.style.opacity = '1';
    el.style.fontWeight = '600';
    el.style.color = isOk ? 'var(--youth-secondary)' : 'tomato';
}

function adminClearEventForm() {
    const title = document.getElementById('adminEventTitle');
    const loc = document.getElementById('adminEventLocation');
    const date = document.getElementById('adminEventDate');
    const time = document.getElementById('adminEventTime');
    const desc = document.getElementById('adminEventDescription');
    const link = document.getElementById('adminEventLink');
    if (title) title.value = '';
    if (loc) loc.value = '';
    if (date) date.value = '';
    if (time) time.value = '';
    if (desc) desc.value = '';
    if (link) link.value = '';
    adminSetEventMessage('', true);
}

async function adminCreateEvent() {
    const title = (document.getElementById('adminEventTitle')?.value || '').trim();
    const location = (document.getElementById('adminEventLocation')?.value || '').trim();
    const start_date = (document.getElementById('adminEventDate')?.value || '').trim();
    const start_time = (document.getElementById('adminEventTime')?.value || '').trim();
    const description = (document.getElementById('adminEventDescription')?.value || '').trim();
    const link = (document.getElementById('adminEventLink')?.value || '').trim();

    if (!title || !start_date) {
        adminSetEventMessage('Title and start date are required.', false);
        return;
    }

    adminSetEventMessage('Creating event...', true);

    try {
        const res = await fetch('/api/admin/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                location,
                start_date,
                start_time: start_time || null,
                description,
                link: link || null
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
            const err = data?.error || 'Unable to create event.';
            adminSetEventMessage(String(err).replace(/_/g, ' '), false);
            return;
        }

        adminSetEventMessage('Event created.', true);
        adminClearEventForm();
        await loadAdminEventsFromAPI();
    } catch (e) {
        adminSetEventMessage('Unable to create event. Please try again.', false);
    }
}

async function adminDeleteEvent(btn) {
    const card = btn?.closest?.('[data-event-id]');
    const eventId = card?.dataset?.eventId;
    if (!eventId) return;

    const ok = confirm('Delete this event? This will remove it for all users.');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error('delete failed');

        // remove card
        if (card) card.remove();
        // If grid becomes empty, reload to show empty state
        const grid = document.getElementById('adminEventsGrid');
        if (grid && grid.children.length === 0) {
            await loadAdminEventsFromAPI();
        }
    } catch (e) {
        alert('Unable to delete event. Please try again.');
    }
}

async function loadAdminEventsFromAPI() {
    const grid = document.getElementById('adminEventsGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/admin/events?limit=200');
        const data = await res.json().catch(() => ({}));
        const events = (data && data.ok && Array.isArray(data.events)) ? data.events : [];

        if (!events.length) {
            grid.innerHTML = '<div class="card empty-state"><h3>No upcoming events yet</h3><p class="mb-2">Create an event above to populate the Events page.</p></div>';
            return;
        }

        const tpl = document.getElementById('admin-event-card-template');
        if (!tpl || !tpl.content) {
            grid.innerHTML = '<div class="card empty-state"><h3>UI template missing</h3><p class="mb-2">Missing #admin-event-card-template in adminevents.html.</p></div>';
            return;
        }

        grid.innerHTML = '';
        events.forEach(ev => {
            const card = tpl.content.firstElementChild.cloneNode(true);
            card.dataset.eventId = String(ev.id || '');

            // day/month
            const dateStr = String(ev.start_date || '');
            const timeStr = String(ev.start_time || '').trim();
            let day = '';
            let month = '';
            try {
                const d = new Date(dateStr + 'T' + (timeStr || '00:00') + ':00');
                day = String(d.getDate()).padStart(2, '0');
                month = d.toLocaleString(undefined, { month: 'short' }).toUpperCase();
            } catch (e) {
                day = (dateStr.split('-')[2] || '').padStart(2, '0');
                month = (dateStr.split('-')[1] || '').padStart(2, '0');
            }

            const title = String(ev.title || 'Event');
            const location = String(ev.location || '').trim();
            const desc = String(ev.description || '').trim();

            const dayEl = card.querySelector('[data-bind="event-day"]');
            if (dayEl) dayEl.textContent = day;
            const monthEl = card.querySelector('[data-bind="event-month"]');
            if (monthEl) monthEl.textContent = month;
            const titleEl = card.querySelector('[data-bind="event-title"]');
            if (titleEl) titleEl.textContent = title;

            const locEl = card.querySelector('[data-bind="event-location"]');
            if (locEl) {
                const timeLabel = timeStr ? ` • 🕒 ${timeStr}` : '';
                locEl.textContent = (location ? `📍 ${location}` : '📅 Upcoming Event') + timeLabel;
            }
            const descEl = card.querySelector('[data-bind="event-description"]');
            if (descEl) descEl.textContent = desc || '';

            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<div class="card empty-state"><h3>Unable to load events</h3><p class="mb-2">Please refresh and try again.</p></div>';
    }
}
