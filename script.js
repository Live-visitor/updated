// ===== BEGIN existing script.js (bootstrap) =====
// script.js (bootstrap only)
// ============================================
// GLOBAL FUNCTIONS DONT TOUCH AGAIN 
// ============================================
let app;
let messagesApp = null;

// ------------------------------------------------------------
// Global onclick targets (so buttons can call methods directly)
// These are intentionally lightweight wrappers around existing
// functions to keep behaviour unchanged.
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
    window.matchApp = window.matchApp || {
        startChat: (btn) => {
            // Prefer explicit dataset on the button, but fall back to the card's data-match-id
            // to avoid silent failures if rendering changes.
            const id = (btn && btn.dataset && btn.dataset.userId)
                ? btn.dataset.userId
                : (btn?.closest?.('[data-match-id]')?.dataset?.matchId);
            if (!id) return;
            startChat(Number(id));
        },
        report: (btn) => {
            const id = (btn && btn.dataset && btn.dataset.userId)
                ? btn.dataset.userId
                : (btn?.closest?.('[data-match-id]')?.dataset?.matchId);
            const name = (btn && btn.dataset && btn.dataset.userName)
                ? btn.dataset.userName
                : (btn?.closest?.('[data-match-name]')?.dataset?.matchName || 'User');
            if (!id) return;
            openReportModal('user', Number(id), String(name || 'User'));
        }
    };

    window.skillswapApp = window.skillswapApp || {
        message: (btn) => {
            const postId = btn?.dataset?.postId;
            const postType = btn?.dataset?.postType;
            const postTitle = btn?.dataset?.postTitle;
            const ownerId = btn?.dataset?.ownerId;
            if (!postId) return;
            handleSkillSwapAction(Number(postId), String(postType || ''), String(postTitle || ''), Number(ownerId || 0));
        },
        addPostPrompt: async () => {
            // SkillSwap creation is now handled by skillswapform.html
            window.location.href = 'skillswapform.html';
        }
    };

    window.storiesApp = window.storiesApp || {
        viewComments: (btn) => {
            const storyId = btn?.dataset?.storyId;
            if (!storyId) return;
            expandStoryPostWithComments(Number(storyId));
        },
        postComment: (btn) => {
            const storyId = btn?.dataset?.storyId;
            if (!storyId) return;
            postStoryComment(Number(storyId));
        },
        addStoryPrompt: async () => {
            await storyPromptAdd();
        }
    };
}

function toggleMode() {
    app.modeToggle.toggle();
}

function changeFontSize(size) {
    app.modeToggle.changeFontSize(size);
}

function toggleHighContrast() {
    app.accessibilityManager.toggleHighContrast();
}

function toggleVoiceReading() {
    app.accessibilityManager.toggleVoiceReading();
}

function changeAnimationSpeed(speed) {
    app.accessibilityManager.changeAnimationSpeed(speed);
}

function updateNotificationBadge() {
    app.notificationManager.updateBadge();
}

function clearNotifications() {
    app.notificationManager.clear();
}

function toggleNotificationDropdown() {
    app.notificationManager.toggleDropdown();
}

function closeDropdown() {
    app.notificationManager.closeDropdown();
}

function renderNotifications(containerId, notifications) {
    app.notificationManager.render(containerId, notifications);
}

function toggleProfileDropdown() {
    app.profileManager.toggleDropdown();
}

function handleLogout() {
    app.profileManager.handleLogout();
}

function sendMessage() {
    app.chatbot.sendMessage();
}

function suggestTopic() {
    app.chatbot.suggestTopic();
}

function translateMessage() {
    app.chatbot.translateMessage();
}

function performTranslation() {
    app.translator.performTranslation();
}

function swapTranslation() {
    app.translator.swap(app.modeToggle);
}

function toggleMatchFilter(button) {
    app.filterManager.toggleMatchFilter(button);
}

function filterMatches() {
    app.filterManager.filterMatches();
}

function toggleStoryFilter(button) {
    app.filterManager.toggleStoryFilter(button);
}

function filterStories() {
    app.filterManager.filterStories();
}

function loadSettings() {
    app.settingsManager.load();
}

function handleLogin(event) {
    app.authManager.handleLogin(event);
}

function handleSignup(event) {
    app.authManager.handleSignup(event);
}

function expandPost(postId) {
    app.storyManager.expandPost(postId);
}

function collapsePost(postId) {
    app.storyManager.collapsePost(postId);
}

function toggleChallengeFilter(button) {
    app.filterManager.toggleChallengeFilter(button);
}

function filterChallenges() {
    app.filterManager.filterChallenges();
}

function searchChallenges() {
    app.filterManager.searchChallenges();
}

function setActiveNavLink() {
    app.navigationManager.setActiveLink();
}

// ============================================
// INITIALIZE APPLICATION
// ============================================
function _loadScript(src) {
    return new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) return resolve(true);
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
    });
}

async function _refreshHeaderFromBackend() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data && data.ok && data.user) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify({
                name: data.user.full_name,
                email: data.user.email,
                age: data.user.age,
                user_id: data.user.id,
                is_admin: !!data.user.is_admin,
            }));

            document.querySelectorAll('[data-bind="profile-name"]').forEach(el => {
                el.textContent = data.user.full_name || 'Guest';
            });
            document.querySelectorAll('[data-bind="profile-email"]').forEach(el => {
                el.textContent = data.user.email || '';
            });
            document.querySelectorAll('[data-bind="profile-bio"]').forEach(el => {
                el.textContent = data.user.bio || '';
            });
        }
    } catch (e) {
        // ignore
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load realtime wrapper class
    await _loadScript('/js/classes/RealtimeClient.js');

    await _refreshHeaderFromBackend();

    app = new GenerationBridgeApp();
    app.init();
    messagesApp = app.messagesApp;

    const page = document.body?.getAttribute('data-page') || '';
    if (page === 'stories') {
        await loadStoriesFromAPI();
        wireStoryPromptAdd();
    }
    if (page === 'skillswap') {
        await loadSkillSwapFromAPI();
        wireSkillPromptAdd();
    }
    if (page === 'match') {
        await loadMatchesFromAPI();
        await refreshMatchupJoinState();
    }
});
// ============================================
// Skillswap FILTER (17th attempt)
// ============================================

// 1) Add skillswap methods onto the existing FilterManager class (without editing it above)
if (typeof FilterManager !== 'undefined') {
    FilterManager.prototype.toggleSkillFilter = function (button) {
        const filter = button.getAttribute('data-filter');
        const allButton = document.querySelector('#skillFilterBar button[data-filter="all"]');
        const allFilterButtons = document.querySelectorAll('#skillFilterBar .filter-btn');

        if (!allButton || !allFilterButtons.length) return;

        if (filter === 'all') {
            allFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        } else {
            allButton.classList.remove('active');
            button.classList.toggle('active');

            const activeFilters = Array.from(allFilterButtons).filter(btn => btn.classList.contains('active'));
            if (activeFilters.length === 0) {
                allButton.classList.add('active');
            }
        }

        this.filterSkills();
    };

    FilterManager.prototype.filterSkills = function () {
        const offeringGrid = document.getElementById('offeringGrid');
        const seekingGrid = document.getElementById('seekingGrid');

        // If not on skillswap page, do nothing
        if (!offeringGrid && !seekingGrid) return;

        const activeFilters = Array.from(document.querySelectorAll('#skillFilterBar .filter-btn.active'))
            .map(btn => String(btn.getAttribute('data-filter') || '').trim().toLowerCase())
            .filter(f => f && f !== 'all');

        const applyToGrid = (grid) => {
            if (!grid) return;
            const cards = grid.querySelectorAll('.card');

            if (activeFilters.length === 0) {
                // Reset visibility without forcing a display type (preserves grid/flex styling)
                cards.forEach(card => (card.style.display = ''));
                return;
            }

            cards.forEach(card => {
                // Cards are rendered with data-category (preferred) and data-skill (legacy)
                const category = String(
                    card.getAttribute('data-category') ||
                    card.getAttribute('data-skill') ||
                    ''
                ).trim().toLowerCase();

                card.style.display = (category && activeFilters.includes(category)) ? '' : 'none';
            });
        };

        applyToGrid(offeringGrid);
        applyToGrid(seekingGrid);
    };
}

// 2) Global functions used by skillswap.html onclick handlers
function toggleSkillFilter(button) {
    if (typeof app !== 'undefined' && app?.filterManager?.toggleSkillFilter) {
        app.filterManager.toggleSkillFilter(button);
    }
}

function filterSkills() {
    if (typeof app !== 'undefined' && app?.filterManager?.filterSkills) {
        app.filterManager.filterSkills();
    }
}

// 3) Ensure filter runs once on load (skillswap doesn't call it in app.init())
document.addEventListener('DOMContentLoaded', () => {
    if (typeof app !== 'undefined' && app?.filterManager?.filterSkills) {
        app.filterManager.filterSkills();
    }
});

// ============================================
// API-DRIVEN RENDERING (dont fucking change file names)
// ============================================

async function loadStoriesFromAPI() {
    const ongoingGrid = document.getElementById('ongoingGrid');
    const resolvedGrid = document.getElementById('resolvedGrid');
    if (!ongoingGrid && !resolvedGrid) return;

    try {
        const res = await fetch('/api/stories');
        const data = await res.json();
        const stories = (data && data.ok && Array.isArray(data.stories)) ? data.stories : [];

        const ongoing = stories.filter(s => (s.status || '').toLowerCase() === 'ongoing');
        const resolved = stories.filter(s => (s.status || '').toLowerCase() === 'resolved');

        if (ongoingGrid) {
            if (!ongoing.length) {
                ongoingGrid.innerHTML = emptyCard('No ongoing stories yet', 'Be the first to share.');
            } else {
                ongoingGrid.innerHTML = '';
                ongoing.forEach(story => {
                    const el = createStoryCard(story);
                    if (el) ongoingGrid.appendChild(el);
                });
            }
        }

        if (resolvedGrid) {
            if (!resolved.length) {
                resolvedGrid.innerHTML = emptyCard('No resolved stories yet', 'Resolved stories will appear here.');
            } else {
                resolvedGrid.innerHTML = '';
                resolved.forEach(story => {
                    const el = createStoryCard(story);
                    if (el) resolvedGrid.appendChild(el);
                });
            }
        }

        // Apply filters after render (if any)
        try { app?.filterManager?.filterChallenges?.(); } catch {}
    } catch (e) {
        if (ongoingGrid) ongoingGrid.innerHTML = emptyCard('Unable to load stories', 'Please try again.');
        if (resolvedGrid) resolvedGrid.innerHTML = '';
    }
}

function createStoryCard(story) {
    const tpl = document.getElementById('story-card-template');
    // Enforce template-driven rendering so action buttons are defined in stories.html (not generated in JS)
    if (!tpl || !tpl.content) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = emptyCard('UI template missing', 'Missing #story-card-template in stories.html.');
        return wrapper.firstElementChild;
    }

    const card = tpl.content.firstElementChild.cloneNode(true);

    const category = (story.category || 'untagged');
    const created = story.created_at ? new Date(story.created_at).toLocaleString() : '';
    const author = (story.user && story.user.full_name) || story.user_name || 'User';
    const commentsCount = Number(story.comments_count || 0) || 0;

    const title = (story.title || '');
    const content = (story.content || '');
    const previewRaw = (story.content || '');
    const preview = previewRaw.slice(0, 160) + (previewRaw.length > 160 ? '...' : '');

    const categoryLabel = String(category || 'untagged')
        .replace(/(^|[-_])(\w)/g, (_, p1, p2) => (p1 ? ' ' : '') + p2.toUpperCase())
        .trim();

    card.setAttribute('data-story-id', String(story.id || ''));
    card.setAttribute('data-category', String(category || 'untagged'));

    const badge = card.querySelector('.category-badge');
    if (badge) badge.textContent = categoryLabel;

    const titleEl = card.querySelector('.story-header .card-title');
    if (titleEl) titleEl.textContent = title;

    const metaEl = card.querySelector('.story-header .card-meta');
    if (metaEl) metaEl.textContent = `By ${author}${created ? ` • ${created}` : ''}`;

    const previewEl = card.querySelector('.story-preview');
    if (previewEl) previewEl.textContent = preview;

    const viewBtn = card.querySelector('.view-comments-btn');
    if (viewBtn) {
        viewBtn.textContent = `💬 View Comments (${commentsCount})`;
        // Button onclick is declared in stories.html; we just attach the target id.
        viewBtn.dataset.storyId = String(story.id || '');
    }

    const expanded = card.querySelector('.story-expanded');
    if (expanded) {
        expanded.id = `story-${story.id}`;
        expanded.style.display = 'none';
    }

    const fullEl = card.querySelector('.story-full-content');
    if (fullEl) fullEl.textContent = content;

    const commentsList = card.querySelector('.comments-list');
    if (commentsList) commentsList.id = `comments-list-${story.id}`;

    const commentInput = card.querySelector('.comment-input');
    if (commentInput) commentInput.id = `comment-input-${story.id}`;

    const postBtn = card.querySelector('.post-comment-btn');
    if (postBtn) postBtn.dataset.storyId = String(story.id || '');

    const closeBtn = card.querySelector('.close-story-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => collapseStoryPost(`story-${story.id}`));

    return card;
}

// ---- Stories: expand + comments ----
async function expandStoryPostWithComments(storyId) {
    // Use StoryManager if available so the UI behaves consistently (preview hidden, expanded shown)
    const panelId = `story-${storyId}`;
    expandStoryPost(panelId);

    await loadStoryComments(storyId);
}

async function loadStoryComments(storyId) {
    const list = document.getElementById(`comments-list-${storyId}`);
    if (!list) return;
    list.innerHTML = `<div style="opacity:0.8;">Loading comments...</div>`;
    try {
        const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments`);
        const data = await res.json();
        const comments = (data && data.ok && Array.isArray(data.comments)) ? data.comments : [];

        if (!comments.length) {
            list.innerHTML = `<div style="opacity:0.8;">No comments yet. Be the first to comment.</div>`;
            return;
        }

        list.innerHTML = comments.map(c => {
            const who = (c.user && c.user.full_name) || c.user_name || 'User';
            const when = c.created_at ? new Date(c.created_at).toLocaleString() : '';
            return `
                <div style="padding:0.75rem; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);">
                    <div style="display:flex; justify-content:space-between; gap:1rem; margin-bottom:0.25rem; opacity:0.9;">
                        <strong>${escapeHtml(who)}</strong>
                        <small style="opacity:0.75;">${escapeHtml(when)}</small>
                    </div>
                    <div>${escapeHtml(c.text || '')}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = `<div style="opacity:0.8;">Unable to load comments. Please try again.</div>`;
    }
}

async function postStoryComment(storyId) {
    const input = document.getElementById(`comment-input-${storyId}`);
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text) return;

    try {
        const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data && data.ok) {
            input.value = '';
            await loadStoryComments(storyId);

// Update comment count on the "View Comments" button (without rerendering the whole list)
try {
    const card = document.querySelector(`.story-card[data-story-id="${storyId}"]`);
    if (card) {
        const btn = card.querySelector('.view-comments-btn');
        if (btn) {
            const m = String(btn.textContent || '').match(/\((\d+)\)/);
            const n = m ? (Number(m[1]) || 0) : 0;
            btn.textContent = `💬 View Comments (${n + 1})`;
        }
    }
} catch {}
        }
    } catch (e) {
        // ignore
    }
}

function expandStoryPost(postId) {
    if (window.app && app.storyManager) {
        app.storyManager.expandPost(postId);
        return;
    }
    const el = typeof postId === 'string' ? document.getElementById(postId) : null;
    if (el) el.style.display = 'block';
}

function collapseStoryPost(postId) {
    if (window.app && app.storyManager) {
        app.storyManager.collapsePost(postId);
        return;
    }
    const el = typeof postId === 'string' ? document.getElementById(postId) : null;
    if (el) el.style.display = 'none';
}

async function loadSkillSwapFromAPI() {
    const offeringGrid = document.getElementById('offeringGrid');
    const seekingGrid = document.getElementById('seekingGrid');
    if (!offeringGrid && !seekingGrid) return;

    try {
        const res = await fetch('/api/skillswap');
        const data = await res.json();
        const posts = (data && data.ok && Array.isArray(data.posts)) ? data.posts : [];
        const offering = posts.filter(p => ['offer','offering'].includes((p.post_type || '').toLowerCase()));
        const seeking = posts.filter(p => ['request','seeking'].includes((p.post_type || '').toLowerCase()));

        if (offeringGrid) {
            if (!offering.length) {
                offeringGrid.innerHTML = emptyCard('No offering posts yet', 'Be the first to offer a skill.');
            } else {
                offeringGrid.innerHTML = '';
                offering.forEach(p => {
                    const el = createSkillCard(p);
                    if (el) offeringGrid.appendChild(el);
                });
            }
        }

        if (seekingGrid) {
            if (!seeking.length) {
                seekingGrid.innerHTML = emptyCard('No seeking posts yet', 'Be the first to ask for help.');
            } else {
                seekingGrid.innerHTML = '';
                seeking.forEach(p => {
                    const el = createSkillCard(p);
                    if (el) seekingGrid.appendChild(el);
                });
            }
        }

        // Apply filter immediately after render
        try { app?.filterManager?.filterSkills?.(); } catch {}
    } catch (e) {
        if (offeringGrid) offeringGrid.innerHTML = emptyCard('Unable to load posts', 'Please try again.');
        if (seekingGrid) seekingGrid.innerHTML = '';
    }
}

function createSkillCard(post) {
    const tpl = document.getElementById('skillswap-card-template');
    // Enforce template-driven rendering so action buttons are defined in skillswap.html (not generated in JS)
    if (!tpl || !tpl.content) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = emptyCard('UI template missing', 'Missing #skillswap-card-template in skillswap.html.');
        return wrapper.firstElementChild;
    }

    const card = tpl.content.firstElementChild.cloneNode(true);

    const category = String(post.category || 'cultural').trim().toLowerCase();
    const created = post.created_at ? new Date(post.created_at).toLocaleString() : '';
    const author = (post.user && post.user.full_name) || post.user_name || 'User';
    const ptype = (post.post_type || '').toLowerCase();
    const isOffer = ['offer','offering'].includes(ptype);

    const title = (post.title || '');
    const descRaw = (post.description || '');
    const desc = descRaw.slice(0, 220) + (descRaw.length > 220 ? '...' : '');

    const ownerId = Number(post.user_id || (post.user && post.user.id) || 0);

    const typeLabel = isOffer ? 'Offering' : 'Seeking';
    const categoryLabel = String(category || 'cultural')
        .replace(/(^|[-_])(\w)/g, (_, p1, p2) => (p1 ? ' ' : '') + p2.toUpperCase())
        .trim();

    card.setAttribute('data-skill-id', String(post.id || ''));
    // Used by filters: data-category is preferred; data-skill kept for backwards compatibility
    card.setAttribute('data-category', String(category || 'cultural'));
    card.setAttribute('data-skill', String(category || 'cultural'));
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

    const msgBtn = card.querySelector('.skill-message-btn');
    if (msgBtn) {
        // Button onclick is declared in skillswap.html; we just attach payload.
        msgBtn.dataset.postId = String(post.id || '');
        msgBtn.dataset.postType = String(ptype || '');
        msgBtn.dataset.postTitle = String(post.title || '');
        msgBtn.dataset.ownerId = String(ownerId || 0);
    }

    return card;
}

// ---- SkillSwap: confirm + auto-message + redirect ----
async function handleSkillSwapAction(postId, postType, postTitle, ownerId) {
    const owner = Number(ownerId || 0);
    if (!owner) {
        // Fallback: just go messages
        startChat(ownerId);
        return;
    }

    // Determine wording
    const p = String(postType || '').toLowerCase();
    const isOffer = ['offer','offering'].includes(p);
    const verb = isOffer ? 'requested' : 'offered';
    const tail = isOffer ? 'session' : 'help';

    const proceed = confirm('Are you sure?');
    if (!proceed) return;

    // Get current user name from cached header or backend (best-effort)
    let myName = 'Someone';
    try {
        const cached = JSON.parse(localStorage.getItem('userData') || '{}');
        if (cached && cached.name) myName = cached.name;
    } catch {}

    // Send automated message then redirect to the thread
    const text = `${myName} has ${verb} ${postTitle} ${tail}.`;
    try {
        await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: owner, text })
        });
    } catch (e) {
        // ignore
    }

    startChat(owner);
}


// ---- Match-Up: join / state ----
async function refreshMatchupJoinState() {
    const btn = document.getElementById('matchupJoinBtn');
    if (!btn) return;

    try {
        const res = await fetch('/api/profile/me');
        const data = await res.json();
        const joined = !!(data && data.ok && data.user && data.user.show_in_matchup);

        if (joined) {
            btn.textContent = 'Joined';
            btn.disabled = true;
        } else {
            btn.textContent = 'Join Match-Up';
            btn.disabled = false;
        }
    } catch (e) {
        // If we can't determine state, keep button usable
        btn.textContent = 'Join Match-Up';
        btn.disabled = false;
    }
}

async function joinMatchUp() {
    const btn = document.getElementById('matchupJoinBtn');
    if (btn) btn.disabled = true;

    try {
        await fetch('/api/matches/join', { method: 'POST' });
    } catch (e) {
        if (btn) btn.disabled = false;
        alert('Unable to join Match-Up right now. Please try again.');
        return;
    }

    await refreshMatchupJoinState();
    await loadMatchesFromAPI();
}

async function loadMatchesFromAPI() {
    const grid = document.getElementById('matchGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/matches');
        const data = await res.json();
        const matches = (data && data.ok && Array.isArray(data.matches)) ? data.matches : [];

        if (!matches.length) {
            grid.innerHTML = emptyCard('No matches yet', 'Matches will appear here once users join and add interests.');
            return;
        }

        // Render using HTML <template> so key buttons exist in match.html (not generated in JS)
        grid.innerHTML = '';
        matches.forEach(match => {
            const el = createMatchCard(match);
            if (el) grid.appendChild(el);
        });

        // Ensure any existing filters apply immediately
        try { app?.filterManager?.filterMatches?.(); } catch {}
    } catch (e) {
        grid.innerHTML = emptyCard('Unable to load matches', 'Please try again.');
    }
}

function createMatchCard(match) {
    const u = match.user || {};
    const shared = Array.isArray(match.shared_interests) ? match.shared_interests : [];
    // Prefer shared interests for the tags, but fall back to the user's own interests
    // so the Match-Up cards never look "empty".
    const allInterests = Array.isArray(u.interests) ? u.interests : [];
    const tags = shared.length ? shared : allInterests;
    const category = (tags[0] || 'all');

    const tpl = document.getElementById('match-card-template');
    if (!tpl || !tpl.content) {
        // Enforce template-driven rendering so action buttons are defined in match.html (not generated in JS)
        const wrapper = document.createElement('div');
        wrapper.innerHTML = emptyCard('UI template missing', 'Missing #match-card-template in match.html.');
        return wrapper.firstElementChild;
    }

    const card = tpl.content.firstElementChild.cloneNode(true);
    card.setAttribute('data-category', escapeHtml(category));
    try {
        card.setAttribute('data-interests', JSON.stringify((u.interests || []).map(x => String(x))));
    } catch (e) {
        card.setAttribute('data-interests', '[]');
    }
    card.setAttribute('data-match-id', String(u.id || ''));
    card.setAttribute('data-match-name', String(u.full_name || 'User'));

    const name = (u.full_name || 'User');
    const gen = (u.generation || '');
    const age = u.age ? `${String(u.age)} years old` : '';
    const avatar = (u.avatar || '👤');

    const chipsWrap = card.querySelector('.match-interests');
    if (chipsWrap) {
        chipsWrap.innerHTML = '';
        // Match the intended UI (2 compact tags like the mock).
        tags.slice(0, 2).forEach(i => {
            const span = document.createElement('span');
            span.className = 'interest-tag';
            span.textContent = i;
            chipsWrap.appendChild(span);
        });
    }

    const avatarEl = card.querySelector('.match-avatar');
    if (avatarEl) avatarEl.textContent = avatar;

    const titleEl = card.querySelector('.card-title');
    if (titleEl) titleEl.textContent = name;

    const metaEl = card.querySelector('.card-meta');
    if (metaEl) metaEl.textContent = `${age}${(age && gen) ? ' • ' : ''}${gen}`;

    const blurbEl = card.querySelector('.match-blurb');
    if (blurbEl) blurbEl.textContent = (u.bio || '');

    const reportBtn = card.querySelector('.report-chip');
    if (reportBtn) {
        // onclick is declared in match.html; we just attach payload.
        reportBtn.dataset.userId = String(u.id || '');
        reportBtn.dataset.userName = String(u.full_name || 'User');
    }

    const startBtn = card.querySelector('.start-chat-btn');
    if (startBtn) {
        // Button onclick is declared in match.html; we just attach the target id.
        startBtn.dataset.userId = String(u.id || '');
    }

    return card;
}

// ---- Floating Add Buttons (stories / skillswap) ----
// The buttons are defined in HTML with explicit onclick handlers, so the logic lives here
// but is not injected into the DOM from JavaScript.

async function storyPromptAdd() {
    const title = prompt('Story title:');
    if (!title) return;
    const categoryRaw = prompt('Category (Day-To-Day, Tradition, Career, Untagged):', 'Untagged') || 'Untagged';
    const catMap = {
        'day-to-day': 'daytoday',
        'daytoday': 'daytoday',
        'tradition': 'tradition',
        'career': 'career',
        'untagged': 'untagged'
    };
    const category = catMap[String(categoryRaw).trim().toLowerCase()] || 'untagged';
    const content = prompt('Story content:');
    if (!content) return;
    try {
        await fetch('/api/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, content, status: 'ongoing' })
        });
    } catch (e) {}
    await loadStoriesFromAPI();
}

async function skillPromptAdd() {
    // Backward compatible entry point (older onclick hooks).
    window.location.href = 'skillswapform.html';
}

function wireStoryPromptAdd() {
    const btn = document.querySelector('#floating-add-btn') || document.querySelector('.floating-add-btn') || document.querySelector('.floating-btn');
    if (!btn) return;
    // If the HTML already defines onclick=..., do not override it.
    if (btn.getAttribute('onclick')) return;
    if (typeof btn.onclick === 'function') return;
    btn.onclick = async () => { await storyPromptAdd(); };
}

function wireSkillPromptAdd() {
    const btn = document.querySelector('#floating-add-btn') || document.querySelector('.floating-add-btn') || document.querySelector('.floating-btn');
    if (!btn) return;
    // If the HTML already defines onclick=..., do not override it.
    if (btn.getAttribute('onclick')) return;
    if (typeof btn.onclick === 'function') return;
    btn.onclick = async () => { await skillPromptAdd(); };
}

function wireMatchFiltersToAPI() {
    // Existing filter buttons rely on DOM data-interest. We keep that.
}

function emptyCard(title, subtitle) {
    return `
        <div class="card empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p class="mb-2">${escapeHtml(subtitle)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ===== END existing script.js (bootstrap) =====



// ============================================
// PAGE-SPECIFIC FUNCTIONS (migrated from inline <script> blocks)
// ============================================

// ---- match.html ----
function startChat(contactId) {
    window.location.href = `messages.html?contact=${encodeURIComponent(contactId)}`;
}

function openReportModal(targetType, targetId, targetName) {
    const modal = document.getElementById('reportModal');
    const form = document.getElementById('reportForm');
    const successMessage = document.getElementById('reportSuccessMessage');
    if (!modal || !form || !successMessage) return;

    form.reset();
    successMessage.style.display = 'none';

    const counter = document.getElementById('reportCharCount');
    if (counter) counter.textContent = '0 / 500';

    const tType = document.getElementById('reportTargetType');
    const tId = document.getElementById('reportTargetId');
    const tName = document.getElementById('reportTargetName');
    if (tType) tType.value = targetType;
    if (tId) tId.value = targetId;
    if (tName) tName.value = targetName;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

function updateCharCount() {
    const textarea = document.getElementById('reportDetails');
    const counter = document.getElementById('reportCharCount');
    if (!textarea || !counter) return;
    counter.textContent = `${textarea.value.length} / 500`;
}

function submitReport(event) {
    event.preventDefault();

    const targetType = document.getElementById('reportTargetType')?.value;
    const targetId = document.getElementById('reportTargetId')?.value;
    const targetName = document.getElementById('reportTargetName')?.value;
    const reasonEl = document.querySelector('input[name="reportReason"]:checked');
    const reason = reasonEl ? reasonEl.value : '';
    const details = document.getElementById('reportDetails')?.value || '';

    (async () => {
        try {
            await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_user_id: Number(targetId || 0) || 0,
                    reason,
                    details,
                })
            });
        } catch (e) {
            // ignore
        }
    })();

    const form = document.getElementById('reportForm');
    const successMessage = document.getElementById('reportSuccessMessage');
    if (form) form.style.display = 'none';
    if (successMessage) successMessage.style.display = 'block';

    setTimeout(() => {
        closeReportModal();
        if (form) form.style.display = 'block';
    }, 2000);
}

// Attach modal dismiss listeners (safe no-op if modal absent)
document.addEventListener('click', function (event) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    if (event.target === modal) closeReportModal();
});

document.addEventListener('keydown', function (event) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    if (event.key === 'Escape') closeReportModal();
});

// ---- profile.html ----
function selectAvatar(emoji) {
    const options = document.querySelectorAll('.avatar-option');
    if (!options.length) return;

    options.forEach(opt => opt.classList.remove('selected'));

    const selected = document.querySelector(`[data-avatar="${emoji}"]`);
    if (selected) selected.classList.add('selected');

    const field = document.getElementById('selectedAvatar');
    if (field) field.value = emoji;
}

function loadProfileData() {
    (async () => {
        try {
            const res = await fetch('/api/profile/me');
            const data = await res.json();
            if (data && data.ok && data.user) {
                const u = data.user;
                const fullName = document.getElementById('fullName');
                const email = document.getElementById('email');
                const age = document.getElementById('age');
                const generation = document.getElementById('generation');
                const bio = document.getElementById('bio');
                const matchPreference = document.getElementById('matchPreference');
                if (fullName) fullName.value = u.full_name || '';
                if (email) email.value = u.email || '';
                if (age) age.value = u.age || '';
                if (generation) generation.value = u.generation || '';
                if (bio) bio.value = u.bio || '';
                if (matchPreference) matchPreference.value = u.match_preferences || 'any';

                // Interests
                try {
                    const set = new Set((u.interests || []).map(x => String(x).trim().toLowerCase()).filter(Boolean));
                    document.querySelectorAll('input[name="interests"]').forEach(cb => {
                        cb.checked = set.has(String(cb.value || '').trim().toLowerCase());
                    });
                } catch (e) {}

                if (u.avatar) selectAvatar(u.avatar);
                const avField = document.getElementById('selectedAvatar');
                if (avField) avField.value = u.avatar || avField.value || '';
            }
        } catch (e) {
            // ignore
        }

        // Keep UI-only preferences in localStorage (prototype)
        try {
            const profileData = JSON.parse(localStorage.getItem('profileData') || '{}');
            if (profileData.showAge !== undefined) document.getElementById('showAge').checked = profileData.showAge;
            if (profileData.showOnline !== undefined) document.getElementById('showOnline').checked = profileData.showOnline;
            if (profileData.allowMessages !== undefined) document.getElementById('allowMessages').checked = profileData.allowMessages;
        } catch {}
    })();
}

async function saveProfile(event) {
    event.preventDefault();

    const interests = Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value);

    const profileData = {
        avatar: document.getElementById('selectedAvatar').value,
        full_name: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        age: Number(document.getElementById('age').value || 0) || null,
        generation: document.getElementById('generation').value,
        bio: document.getElementById('bio').value,
        match_preferences: document.getElementById('matchPreference').value,
        interests,
    };
    // Persist required fields to backend
    try {
        const res = await fetch('/api/profile/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) {
            const msg = (data && data.error === 'email_exists')
                ? 'That email is already in use. Please use a different email.'
                : 'Unable to save your profile. Please try again.';
            alert(msg);
            return;
        }
        try { await _refreshHeaderFromBackend(); } catch (e) {}
    } catch (e) {
        alert('Unable to save your profile. Please try again.');
        return;
    }

    // Keep UI-only toggles locally (prototype)
    const localPrefs = {
        showAge: document.getElementById('showAge').checked,
        showOnline: document.getElementById('showOnline').checked,
        allowMessages: document.getElementById('allowMessages').checked
    };
    localStorage.setItem('profileData', JSON.stringify(localPrefs));

    const banner = document.getElementById('successBanner');
    if (banner) {
        banner.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { banner.style.display = 'none'; }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = document.body?.getAttribute('data-page') || '';
    if (page !== 'profile' && page !== 'profile-edit') return;
    loadProfileData();
});


