class FilterManager {
    // =========================
    // MATCH-UP FILTERS
    // =========================
    toggleMatchFilter(button) {
        if (!button) return;

        const bar = document.getElementById('matchFilterBar');
        if (!bar) return;

        const allFilterButtons = Array.from(bar.querySelectorAll('.filter-btn'));
        const filter = ((button.getAttribute('data-filter') || button.dataset.filter || '')).toLowerCase();
        const allButton = bar.querySelector('button[data-filter="all"]');

        if (filter === 'all') {
            allFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        } else {
            if (allButton) allButton.classList.remove('active');
            button.classList.toggle('active');

            // If none selected, fall back to All
            const activeNonAll = allFilterButtons.filter(btn =>
                btn.classList.contains('active') &&
                ((btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase()) !== 'all'
            );
            if (activeNonAll.length === 0 && allButton) {
                allButton.classList.add('active');
            }
        }

        this.filterMatches();
    }

    filterMatches() {
        const matchGrid = document.getElementById('matchGrid');
        if (!matchGrid) return;

        const matches = Array.from(matchGrid.querySelectorAll('.match-card'));
        const activeFilters = Array.from(document.querySelectorAll('#matchFilterBar .filter-btn.active'))
            .map(btn => (btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase())
            .filter(f => f && f !== 'all');

        const parseInterests = (el) => {
            const raw = el.getAttribute('data-interests') || el.dataset.interests || '';
            if (raw) {
                try {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) return arr.map(x => String(x).trim().toLowerCase()).filter(Boolean);
                } catch (e) {
                    // fall through to CSV parsing
                }
                return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            }
            const cat = (el.getAttribute('data-category') || el.dataset.category || '').toLowerCase();
            return cat ? [cat] : [];
        };

        if (activeFilters.length === 0) {
            matches.forEach(match => match.style.display = '');
            return;
        }

        matches.forEach(match => {
            const interests = parseInterests(match);
            const show = interests.some(i => activeFilters.includes(i));
            match.style.display = show ? '' : 'none';
        });
    }

    // =========================
    // STORIES FILTERS
    // =========================
    toggleStoryFilter(button) {
        if (!button) return;

        const bar = document.getElementById('storyFilterBar');
        if (!bar) return;

        const allFilterButtons = Array.from(bar.querySelectorAll('.filter-btn'));
        const filter = ((button.getAttribute('data-filter') || button.dataset.filter || '')).toLowerCase();
        const allButton = bar.querySelector('button[data-filter="all"]');

        if (filter === 'all') {
            allFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        } else {
            if (allButton) allButton.classList.remove('active');
            button.classList.toggle('active');

            const activeNonAll = allFilterButtons.filter(btn =>
                btn.classList.contains('active') &&
                ((btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase()) !== 'all'
            );
            if (activeNonAll.length === 0 && allButton) {
                allButton.classList.add('active');
            }
        }

        this.filterStories();
    }

    filterStories() {
        const storyGrid = document.getElementById('storyGrid');
        if (!storyGrid) return;

        const stories = Array.from(storyGrid.querySelectorAll('.story-card'));
        const activeFilters = Array.from(document.querySelectorAll('#storyFilterBar .filter-btn.active'))
            .map(btn => (btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase())
            .filter(f => f && f !== 'all');

        if (activeFilters.length === 0) {
            stories.forEach(story => story.style.display = '');
            return;
        }

        stories.forEach(story => {
            const storyCategory = ((story.getAttribute('data-category') || story.dataset.category || '')).toLowerCase();
            story.style.display = activeFilters.includes(storyCategory) ? '' : 'none';
        });
    }

    // =========================
    // CHALLENGES FILTERS
    // =========================
    toggleChallengeFilter(button) {
        if (!button) return;

        const bar = document.getElementById('challengeFilterBar');
        if (!bar) return;

        const allFilterButtons = Array.from(bar.querySelectorAll('.filter-btn'));
        const filter = ((button.getAttribute('data-filter') || button.dataset.filter || '')).toLowerCase();
        const allButton = bar.querySelector('button[data-filter="all"]');

        if (filter === 'all') {
            allFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        } else {
            if (allButton) allButton.classList.remove('active');
            button.classList.toggle('active');

            const activeNonAll = allFilterButtons.filter(btn =>
                btn.classList.contains('active') &&
                ((btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase()) !== 'all'
            );
            if (activeNonAll.length === 0 && allButton) {
                allButton.classList.add('active');
            }
        }

        this.filterChallenges();
    }

    filterChallenges() {
        const ongoingGrid = document.getElementById('ongoingGrid');
        const resolvedGrid = document.getElementById('resolvedGrid');
        if (!ongoingGrid || !resolvedGrid) return;

        const activeFilters = Array.from(document.querySelectorAll('#challengeFilterBar .filter-btn.active'))
            .map(btn => (btn.getAttribute('data-filter') || btn.dataset.filter || '').toLowerCase())
            .filter(f => f && f !== 'all');

        const applyToGrid = (grid) => {
            const cards = Array.from(grid.querySelectorAll('.story-card'));
            if (activeFilters.length === 0) {
                cards.forEach(card => card.style.display = '');
                return;
            }
            cards.forEach(card => {
                const cat = ((card.getAttribute('data-category') || card.dataset.category || '')).toLowerCase();
                card.style.display = activeFilters.includes(cat) ? '' : 'none';
            });
        };

        applyToGrid(ongoingGrid);
        applyToGrid(resolvedGrid);
    }

    searchChallenges() {
        const input = document.getElementById('challengeSearch');
        if (!input) return;

        const searchTerm = (input.value || '').toLowerCase();
        const ongoingCards = document.querySelectorAll('#ongoingGrid .story-card');
        const resolvedCards = document.querySelectorAll('#resolvedGrid .story-card');

        [...ongoingCards, ...resolvedCards].forEach(card => {
            const title = (card.querySelector('h3')?.textContent || '').toLowerCase();
            const preview = (card.querySelector('.story-preview')?.textContent || '').toLowerCase();
            card.style.display = (title.includes(searchTerm) || preview.includes(searchTerm)) ? '' : 'none';
        });
    }
}

// Expose globally for non-module script tags
window.FilterManager = FilterManager;
