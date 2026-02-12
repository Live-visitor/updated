class StoryManager {
    expandPost(postId) {
        const card = document.getElementById(postId).closest('.story-card');
        const expanded = document.getElementById(postId);
        
        card.querySelector('.story-header').style.display = 'none';
        card.querySelector('.story-preview').style.display = 'none';
        card.querySelector('.btn-secondary').style.display = 'none';
        card.querySelector('.category-badge').style.display = 'none';
        expanded.style.display = 'block';
    }

    collapsePost(postId) {
        const card = document.getElementById(postId).closest('.story-card');
        const expanded = document.getElementById(postId);
        
        card.querySelector('.story-header').style.display = 'block';
        card.querySelector('.story-preview').style.display = 'block';
        card.querySelector('.btn-secondary').style.display = 'inline-block';
        card.querySelector('.category-badge').style.display = 'inline-block';
        expanded.style.display = 'none';
    }
}


window.StoryManager = StoryManager;
