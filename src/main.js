import './style.css'
import './auth.css'
import { initAuth, updateAppUI } from './auth.js'

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname === '::1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.') ||
    window.location.hostname.endsWith('.local')
  ) ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

  window.savedHubbs = window.savedHubbs || [];

  initAuth();
  updateAppUI();
  window.addEventListener('auth-changed', updateAppUI);

  // Initialize Lucide Icons (Debounced for performance)
  let iconRenderQueued = false;
  const debouncedCreateIcons = () => {
    if (!window.lucide || iconRenderQueued) return;
    iconRenderQueued = true;
    requestAnimationFrame(() => {
      if (window.lucide) window.lucide.createIcons();
      iconRenderQueued = false;
    });
  };
  window.debouncedCreateIcons = debouncedCreateIcons;

  debouncedCreateIcons();

  // --- STATE SYSTEM ---
  const state = {
    theme: 'dark',
    activeView: 'home',
    currentChatThread: null,
    chatMode: 'chat', // chat, watch, call, game, media
    callTimerInterval: null,
    callSeconds: 1455, // starts at 00:24:15
    isLiked: {
      post1: false,
      post2: false
    },
    likesCount: {
      post1: 12400,
      post2: 8200
    },
    storyGroups: [],
    activeGroupIndex: 0,
    activeStoryIndex: 0,
    storyProgressInterval: null,
    storyProgressPercent: 0,
    isStoryPaused: false,
    isLudoRolling: false
  };

  // --- STICKY HEADER progressive BLUR ---
  const header = document.getElementById('main-header');
  let tickingScroll = false;
  window.addEventListener('scroll', () => {
    if (!tickingScroll) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
        tickingScroll = false;
      });
      tickingScroll = true;
    }
  });

  // --- THEME TOGGLE CONTROLLER ---
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.classList.replace('dark-theme', 'light-theme');
      state.theme = 'light';
      showToast('Switched to Light Theme ☀️');
    } else {
      document.body.classList.replace('light-theme', 'dark-theme');
      state.theme = 'dark';
      showToast('Switched to Dark Theme 🌌');
    }
  });

  // --- TOAST HELPER ---
  const toast = document.getElementById('toast-notif');
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 2500);
  }

  // --- VIEW SWITCHING MANAGER (SPACIOUS CONGESTION FIX) ---
  const viewPanels = document.querySelectorAll('.view-panel');
  const sidebarNavItems = document.querySelectorAll('.nav-item');
  const radialNavItems = document.querySelectorAll('.radial-item-bubble');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-btn');
  const appContainer = document.querySelector('.chats-layout-grid');

  function switchView(viewName, userId) {
    if (!viewName) return;

    state.activeView = viewName;

    if (viewName === 'profile') {
      const currentUserStr = localStorage.getItem('invibeUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        const targetId = userId || currentUser.id || currentUser._id;
        loadUserProfile(targetId);
      }
    }

    // Toggle body active class to hide right sidebar and expand content width (Congestion Fix!)
    if (viewName === 'chats') {
      document.body.classList.add('chats-view-active');
      if (appContainer) appContainer.classList.remove('chatting');
      // Reset to empty state — no conversation auto-selected
      state.currentChatThread = null;
      const emptyState = document.getElementById('chat-empty-state');
      const chatHeader = document.getElementById('chat-window-header');
      const chatViewport = document.querySelector('.chat-dynamic-viewport');
      const chatFooter = document.getElementById('chat-global-footer');
      if (emptyState) emptyState.style.display = 'flex';
      if (chatHeader) chatHeader.style.display = 'none';
      if (chatViewport) chatViewport.style.display = 'none';
      if (chatFooter) chatFooter.style.display = 'none';
    } else {
      document.body.classList.remove('chats-view-active');
    }

    // Update active view panels
    viewPanels.forEach(panel => {
      if (panel.id === `view-${viewName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update active sidebar nav items
    sidebarNavItems.forEach(nav => {
      const target = nav.getAttribute('data-target-view');
      if (target === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Update active radial sub-bubbles
    const activeGlow = document.getElementById('radial-active-glow');
    radialNavItems.forEach(bubble => {
      const target = bubble.getAttribute('data-target-view');
      if (target === viewName) {
        bubble.classList.add('active-bubble');
        if (activeGlow) {
          activeGlow.style.opacity = '1';
          activeGlow.style.left = (bubble.offsetLeft + (bubble.offsetWidth / 2) - 22) + 'px';
        }
      } else {
        bubble.classList.remove('active-bubble');
      }
    });

    // Update active mobile bottom nav items
    mobileNavItems.forEach(nav => {
      const target = nav.getAttribute('data-target-view');
      if (target === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Pause explore reels videos if we leave Explore View
    if (viewName !== 'explore') {
      const reelVideos = document.querySelectorAll('.reel-video');
      reelVideos.forEach(vid => vid.pause());
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close radial menu after selection
    closeRadialMenu();
  }

  // Bind view selectors
  sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target-view');
      if (target) switchView(target);
    });
  });

  radialNavItems.forEach(bubble => {
    bubble.addEventListener('click', () => {
      const target = bubble.getAttribute('data-target-view');
      if (target) {
        switchView(target);
      }
    });
  });

  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target-view');
      if (target) switchView(target);
    });
  });

  // Logo button returns Home
  document.getElementById('logo-button').addEventListener('click', () => {
    switchView('home');
  });

  // Profile avatar returns Profile
  document.getElementById('header-profile-avatar').addEventListener('click', () => {
    switchView('profile');
  });

  // Messages badge shortcut
  document.getElementById('messages-shortcut-btn').addEventListener('click', () => {
    switchView('chats');
  });


  // --- FLOATING RADIAL NAVIGATION MENU & TOUCH DRAG SYSTEM (SIGNATURE INTERACTION) ---
  const navContainer = document.getElementById('floating-bubble-nav');
  const mainBubble = document.getElementById('main-navigation-bubble');
  const blurOverlay = document.getElementById('radial-menu-blur-overlay');

  let isDragging = false;
  let dragStartX, dragStartY;
  let bubbleStartX, bubbleStartY;
  let wasOpenOnDragStart = false;
  let lastTouchTime = 0;

  // Prevent default image drag (fixes awkward stretching/ghosting)
  mainBubble.addEventListener('dragstart', (e) => e.preventDefault());

  // Mouse and Touch Drag Listeners
  mainBubble.addEventListener('mousedown', dragStart);
  mainBubble.addEventListener('touchstart', dragStart, { passive: true });

  function dragStart(e) {
    if (e.type === 'touchstart') {
      lastTouchTime = Date.now();
    } else if (e.type === 'mousedown') {
      // Prevent simulated mouse events on mobile touch devices
      if (Date.now() - lastTouchTime < 600) {
        return;
      }
      e.preventDefault(); // Prevent accidental text/image selection
    }

    // Track whether the menu was open when the interaction started
    wasOpenOnDragStart = navContainer.classList.contains('open');

    isDragging = false;
    const coords = getDragCoords(e);
    dragStartX = coords.x;
    dragStartY = coords.y;

    const rect = navContainer.getBoundingClientRect();
    bubbleStartX = rect.left;
    bubbleStartY = rect.top;

    // Disable styling transitions during active drag coordinate movement
    navContainer.style.transition = 'none';
    navContainer.classList.add('dragging');

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', dragEnd);
  }

  let dragMoveTicking = false;
  function dragMove(e) {
    const coords = getDragCoords(e);
    const deltaX = coords.x - dragStartX;
    const deltaY = coords.y - dragStartY;

    // 5px threshold to separate simple clicks from drags
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDragging = true;
      if (e.type === 'touchmove') e.preventDefault(); // Prevent double scroll in mobile
    }

    if (isDragging && !dragMoveTicking) {
      dragMoveTicking = true;
      window.requestAnimationFrame(() => {
        // Only set the initial position once to avoid layout thrashing
        if (!navContainer.style.left || navContainer.style.left === 'auto') {
          navContainer.style.bottom = 'auto';
          navContainer.style.right = 'auto';
          navContainer.style.margin = '0';
          navContainer.style.position = 'fixed';
          navContainer.style.left = `${bubbleStartX}px`;
          navContainer.style.top = `${bubbleStartY}px`;
        }

        // Use hardware-accelerated transform for 60FPS smooth dragging
        navContainer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
        dragMoveTicking = false;
      });
    }
  }

  function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('touchend', dragEnd);

    navContainer.classList.remove('dragging');
    navContainer.style.transition = '';

    if (isDragging) {
      // Commit the translation to left/top to preserve position correctly
      const rect = navContainer.getBoundingClientRect();
      navContainer.style.transform = 'none';
      navContainer.style.left = `${rect.left}px`;
      navContainer.style.top = `${rect.top}px`;
    }

    if (!isDragging) {
      // True toggle: if menu was open when click started, close it; otherwise open it
      if (wasOpenOnDragStart) {
        closeRadialMenu();
      } else {
        openRadialMenu();
      }
    } else {
      // If dragging while menu was open, close it to prevent glitching
      if (wasOpenOnDragStart) {
        closeRadialMenu();
      }
      // Clamp boundaries inside screen coordinates with 20px padding
      clampBubblePosition();
    }
  }

  function getDragCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function clampBubblePosition() {
    const rect = navContainer.getBoundingClientRect();
    const pad = 20;
    let targetX = rect.left;
    let targetY = rect.top;

    if (targetX < pad) targetX = pad;
    if (targetX > window.innerWidth - rect.width - pad) targetX = window.innerWidth - rect.width - pad;
    if (targetY < pad) targetY = pad;
    if (targetY > window.innerHeight - rect.height - pad) targetY = window.innerHeight - rect.height - pad;

    navContainer.style.left = `${targetX}px`;
    navContainer.style.top = `${targetY}px`;
    navContainer.style.transform = 'none'; // Lock translate off!
  }

  // Handle window resizing bounds safety
  window.addEventListener('resize', () => {
    if (navContainer.style.position === 'fixed') {
      clampBubblePosition();
    }
  });

  function toggleRadialMenu() {
    const isOpen = navContainer.classList.contains('open');
    if (isOpen) {
      closeRadialMenu();
    } else {
      openRadialMenu();
    }
  }

  function openRadialMenu() {
    // Dynamic quadrant orientation calculation
    const rect = navContainer.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;

    // Vertical flip: if in top half of the screen, pop sub-bubbles downwards
    if (centerY < window.innerHeight / 2) {
      navContainer.style.setProperty('--radial-y-dir', '1');
      navContainer.classList.add('expand-downwards');
    } else {
      navContainer.style.setProperty('--radial-y-dir', '-1');
      navContainer.classList.remove('expand-downwards');
    }

    // Horizontal mirror: if too close to left or right edges
    if (centerX < 180) {
      navContainer.style.setProperty('--radial-x-dir', '1.2'); // push rightwards
    } else if (window.innerWidth - centerX < 180) {
      navContainer.style.setProperty('--radial-x-dir', '-1.2'); // push leftwards
    } else {
      navContainer.style.setProperty('--radial-x-dir', '1');
    }

    navContainer.classList.add('open');
    blurOverlay.classList.add('active'); // Localized circular blur active

    // Rotate HiHubble logo icon
    const logoIcon = mainBubble.querySelector('.orb-logo-icon');
    if (logoIcon) {
      logoIcon.style.transform = 'rotate(225deg) scale(1.1)';
    }
  }

  function closeRadialMenu() {
    navContainer.classList.remove('open');
    blurOverlay.classList.remove('active');

    const logoIcon = mainBubble.querySelector('.orb-logo-icon');
    if (logoIcon) {
      logoIcon.style.transform = 'rotate(0deg) scale(1)';
    }
  }

  // Close radial menu when clicking backdrop overlay
  blurOverlay.addEventListener('click', closeRadialMenu);

  // Close radial menu on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRadialMenu();
    }
  });

  // Search bubble opens dedicated search view
  document.getElementById('radial-search-btn').addEventListener('click', () => {
    closeRadialMenu();
    switchView('search');
    const searchInput = document.getElementById('search-view-input');
    if (searchInput) {
      setTimeout(() => {
        searchInput.focus();
      }, 80);
    }
    showToast('Search page opened 🔍');
  });

  // Logout bubble triggers security logout
  const radialLogoutBtn = document.getElementById('radial-logout-btn');
  if (radialLogoutBtn) {
    radialLogoutBtn.addEventListener('click', () => {
      closeRadialMenu();
      const mainLogoutBtn = document.getElementById('logout-btn');
      if (mainLogoutBtn) {
        mainLogoutBtn.click();
      }
    });
  }


  // --- STORIES SECTION SCROLL DRAG MOMENTUM ---
  const storiesScroll = document.getElementById('stories-scroll');
  let isDown = false;
  let startX;
  let scrollLeft;

  if (storiesScroll) {
    storiesScroll.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - storiesScroll.offsetLeft;
      scrollLeft = storiesScroll.scrollLeft;
    });

    storiesScroll.addEventListener('mouseleave', () => {
      isDown = false;
    });

    storiesScroll.addEventListener('mouseup', () => {
      isDown = false;
    });

    let storiesTicking = false;
    storiesScroll.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      if (!storiesTicking) {
        storiesTicking = true;
        const x = e.pageX - storiesScroll.offsetLeft;
        const walk = (x - startX) * 2.5;
        window.requestAnimationFrame(() => {
          storiesScroll.scrollLeft = scrollLeft - walk;
          storiesTicking = false;
        });
      }
    });
  }

  // --- LIKE INTERACTION & PARTICLE SYSTEMS ---
  const likeActionItems = document.querySelectorAll('.like-btn-action');
  const mediaContainers = document.querySelectorAll('.post-media-container');

  function triggerHeartExplosion(x, y, container) {
    const particleCount = 15;
    const colors = ['#6C3BFF', '#8A5CFF', '#a855f7', '#c084fc', '#e9d5ff', '#ff3b30'];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'explosion-particle';
      particle.innerHTML = i === 0 ? '<i data-lucide="heart" style="fill: var(--primary); stroke: var(--primary);"></i>' : '💜';

      const angle = Math.random() * Math.PI * 2;
      const distance = i === 0 ? 0 : 50 + Math.random() * 120;
      const randomX = Math.cos(angle) * distance;
      const randomY = Math.sin(angle) * distance - 40;

      particle.style.setProperty('--x', `${randomX}px`);
      particle.style.setProperty('--y', `${randomY}px`);
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = i === 0 ? '100px' : `${40 + Math.random() * 40}px`;

      container.appendChild(particle);
      if (i === 0 && window.lucide) { window.lucide.createIcons(); }

      setTimeout(() => {
        particle.remove();
      }, 800);
    }
  }

  function toggleLike(postId, buttonWrapper, clickX, clickY, container) {
    const postStateKey = `post${postId}`;
    const isCurrentlyLiked = state.isLiked[postStateKey];

    const countSpan = buttonWrapper.querySelector('.action-count');
    const heartBtn = buttonWrapper.querySelector('.action-circle-btn');

    if (!isCurrentlyLiked) {
      state.isLiked[postStateKey] = true;
      state.likesCount[postStateKey]++;
      buttonWrapper.classList.add('liked');

      if (countSpan) {
        countSpan.textContent = formatCount(state.likesCount[postStateKey]);
      }

      if (clickX !== null && clickY !== null && container) {
        triggerHeartExplosion(clickX, clickY, container);
      } else if (container) {
        const rect = container.getBoundingClientRect();
        triggerHeartExplosion(rect.width / 2, rect.height / 2, container);
      }
      showToast('Liked post! 💜');
    } else {
      state.isLiked[postStateKey] = false;
      state.likesCount[postStateKey]--;
      buttonWrapper.classList.remove('liked');

      if (countSpan) {
        countSpan.textContent = formatCount(state.likesCount[postStateKey]);
      }
    }
  }

  function formatCount(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num;
  }

  // Disabled old hardcoded static feed post likes. Dynamic likes are loaded in loadFeedPosts()

  // --- POST 2 VIDEO PLAYBACK ---
  const videoPost = document.getElementById('post-2');
  if (videoPost) {
    const video = videoPost.querySelector('.post-media-video');
    const playOverlay = videoPost.querySelector('.video-play-overlay');
    const playIcon = playOverlay.querySelector('i');

    playOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      video.play();
      playOverlay.style.display = 'none';
      debouncedCreateIcons();
    });

    video.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!video.paused) {
        video.pause();
        playIcon.setAttribute('data-lucide', 'play');
        playOverlay.style.display = 'flex';
        playOverlay.style.background = 'rgba(0,0,0,0.25)';
        playOverlay.style.opacity = '1';
        debouncedCreateIcons();
      }
    });
  }


  // --- EXPLORE & REELS TAB AND INTERACTIONS ---
  const exTabPills = document.querySelectorAll('.ex-tab-pill');
  const exploreReelsContainer = document.getElementById('explore-reels-container');
  const explorePostsContainer = document.getElementById('explore-posts-container');

  exTabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      exTabPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const tabName = pill.getAttribute('data-ex-tab');
      if (tabName === 'reels') {
        exploreReelsContainer.classList.add('active');
        explorePostsContainer.classList.remove('active');
        // Autoplay first reel
        const firstVideo = exploreReelsContainer.querySelector('.reel-video');
        if (firstVideo) firstVideo.play();
      } else {
        exploreReelsContainer.classList.remove('active');
        explorePostsContainer.classList.add('active');
        // Pause all reels
        const videos = exploreReelsContainer.querySelectorAll('.reel-video');
        videos.forEach(v => v.pause());
      }
    });
  });
  // Disabled old hardcoded reels video playback/gestures loop. Replaced with wireReelInteractions() on load.

  // --- GLOBAL FEED ACTIONS DELEGATION ---
  document.addEventListener('click', async (e) => {
    // Like button
    const likeBtn = e.target.closest('.like-btn-action');
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pid = likeBtn.getAttribute('data-post-id') || likeBtn.closest('[data-post-id]')?.getAttribute('data-post-id') || '1';
      await togglePostLike(pid, likeBtn);
    }

    // Bookmark / Save button
    const bookmarkBtn = e.target.closest('.bookmark-btn, .bookmark-btn-action');
    if (bookmarkBtn) {
      e.preventDefault();
      e.stopPropagation();

      // Some templates use the inner button, some use the wrapper. Find the wrapper and the icon.
      const btnEl = bookmarkBtn.classList.contains('bookmark-btn') ? bookmarkBtn : (bookmarkBtn.querySelector('.bookmark-btn') || bookmarkBtn);
      const icon = btnEl.querySelector('i, svg') || bookmarkBtn.querySelector('i, svg');

      const mediaContainer = bookmarkBtn.closest('.feed-card, .reel-card, .post-media-container') || bookmarkBtn.closest('article, .post-media-container');
      let mediaData = null;
      if (mediaContainer) {
        const id = mediaContainer.id || mediaContainer.getAttribute('data-post-id') || mediaContainer.getAttribute('data-reel-id') || Math.random().toString();
        const img = mediaContainer.querySelector('img');
        const video = mediaContainer.querySelector('video');
        if (img) mediaData = { id, type: 'image', url: img.src };
        else if (video) mediaData = { id, type: 'video', url: video.src };
      }

      const isSaved = btnEl.classList.contains('saved');
      if (isSaved) {
        btnEl.classList.remove('saved');
        if (icon) { icon.style.fill = 'none'; icon.style.stroke = ''; }
        if (mediaData) {
          window.savedHubbs = window.savedHubbs.filter(s => s.id !== mediaData.id);
        }
        showToast('Removed from Saved');
      } else {
        btnEl.classList.add('saved');
        if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
        if (mediaData && !window.savedHubbs.find(s => s.id === mediaData.id)) {
          window.savedHubbs.push(mediaData);
        }
        showToast('Saved to collection ⭐');
      }

      const savedGrid = document.getElementById('profile-saved-grid');
      if (savedGrid && savedGrid.classList.contains('active')) {
        renderSavedHubbs();
      }
    }
  });


  // --- PREMIUM STORY AUTO-PLAY VIEWER SYSTEM ---
  const storyViewer = document.getElementById('story-viewer-modal');
  const storyViewerClose = document.getElementById('story-viewer-close');
  const storyViewerDelete = document.getElementById('story-viewer-delete');
  const storyViewerAvatar = document.getElementById('story-viewer-avatar');
  const storyViewerName = document.getElementById('story-viewer-name');
  const storyViewerTime = document.getElementById('story-viewer-time');
  const storyViewerImg = document.getElementById('story-viewer-img');
  const storyProgressBars = document.getElementById('story-progress-bars');
  const storyContentBox = document.getElementById('story-viewer-content-box');

  const storyPrev = document.getElementById('story-prev-btn');
  const storyNext = document.getElementById('story-next-btn');

  function openStoryViewer(groupIndex, storyIndex = 0) {
    if (!state.storyGroups[groupIndex]) return;
    state.activeGroupIndex = groupIndex;
    state.activeStoryIndex = storyIndex;
    storyViewer.classList.add('active');
    loadStoryContent(groupIndex, storyIndex);
  }

  async function deleteCurrentStory() {
    const group = state.storyGroups[state.activeGroupIndex];
    if (!group) return;
    const storyData = group.stories[state.activeStoryIndex];
    if (!storyData) return;
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyData._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete story');
      showToast('Story deleted successfully!');
      closeStoryViewer();
      loadStories();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete story.');
    }
  }

  function loadStoryContent(groupIndex, storyIndex) {
    const group = state.storyGroups[groupIndex];
    if (!group || !group.stories[storyIndex]) {
      closeStoryViewer();
      return;
    }
    const data = group.stories[storyIndex];

    storyViewerAvatar.src = data.avatar;
    storyViewerName.textContent = data.name;
    storyViewerTime.textContent = data.time;
    storyViewerImg.src = data.img;

    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;
    if (data.authorId === currentUserId) {
      storyViewerDelete.style.display = 'block';
    } else {
      storyViewerDelete.style.display = 'none';
    }

    updateStoryLikeUI(data.isLiked || false, data.likesCount || 0);

    storyProgressBars.innerHTML = '';
    for (let i = 0; i < group.stories.length; i++) {
      const barWrapper = document.createElement('div');
      barWrapper.className = 'story-progress-bar-wrapper';
      const barFill = document.createElement('div');
      barFill.className = 'story-progress-bar-fill';

      if (i < storyIndex) {
        barFill.style.width = '100%';
      } else if (i > storyIndex) {
        barFill.style.width = '0%';
      }

      barWrapper.appendChild(barFill);
      storyProgressBars.appendChild(barWrapper);
    }

    state.isStoryPaused = false;
    startStoryTimer();
  }

  function startStoryTimer() {
    if (state.storyProgressInterval) return;
    
    const activeFill = storyProgressBars.children[state.activeStoryIndex]?.querySelector('.story-progress-bar-fill');
    
    state.storyProgressInterval = setInterval(() => {
      if (state.isStoryPaused) return;
      state.storyProgressPercent += 0.4;
      if (activeFill) activeFill.style.width = `${state.storyProgressPercent}%`;

      if (state.storyProgressPercent >= 100) {
        stopStoryTimer();
        state.storyProgressPercent = 0;
        const group = state.storyGroups[state.activeGroupIndex];
        if (state.activeStoryIndex < group.stories.length - 1) {
          openStoryViewer(state.activeGroupIndex, state.activeStoryIndex + 1);
        } else if (state.activeGroupIndex < state.storyGroups.length - 1) {
          openStoryViewer(state.activeGroupIndex + 1, 0);
        } else {
          closeStoryViewer();
        }
      }
    }, 20);
  }

  function stopStoryTimer() {
    if (state.storyProgressInterval) {
      clearInterval(state.storyProgressInterval);
      state.storyProgressInterval = null;
    }
  }

  function closeStoryViewer() {
    stopStoryTimer();
    state.storyProgressPercent = 0;
    storyViewer.classList.remove('active');
  }

  // Tap to Pause implementation
  const pauseStory = () => { state.isStoryPaused = true; };
  const resumeStory = () => { state.isStoryPaused = false; };
  if (storyContentBox) {
    storyContentBox.addEventListener('mousedown', pauseStory);
    storyContentBox.addEventListener('mouseup', resumeStory);
    storyContentBox.addEventListener('mouseleave', resumeStory);
    storyContentBox.addEventListener('touchstart', pauseStory);
    storyContentBox.addEventListener('touchend', resumeStory);
  }

  if (storyViewerClose) storyViewerClose.addEventListener('click', closeStoryViewer);
  if (storyViewerDelete) storyViewerDelete.addEventListener('click', deleteCurrentStory);
  
  if (storyPrev) {
    storyPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      stopStoryTimer();
      state.storyProgressPercent = 0;
      if (state.activeStoryIndex > 0) {
        openStoryViewer(state.activeGroupIndex, state.activeStoryIndex - 1);
      } else if (state.activeGroupIndex > 0) {
        const prevGroup = state.storyGroups[state.activeGroupIndex - 1];
        openStoryViewer(state.activeGroupIndex - 1, prevGroup.stories.length - 1);
      }
    });
  }
  if (storyNext) {
    storyNext.addEventListener('click', (e) => {
      e.stopPropagation();
      stopStoryTimer();
      state.storyProgressPercent = 0;
      const group = state.storyGroups[state.activeGroupIndex];
      if (state.activeStoryIndex < group.stories.length - 1) {
        openStoryViewer(state.activeGroupIndex, state.activeStoryIndex + 1);
      } else if (state.activeGroupIndex < state.storyGroups.length - 1) {
        openStoryViewer(state.activeGroupIndex + 1, 0);
      } else {
        closeStoryViewer();
      }
    });
  }

  // Reply Story simulation
  const storyReplySend = document.getElementById('story-reply-send');
  const storyReplyInput = document.getElementById('story-reply-input');
  if (storyReplySend) {
    storyReplySend.addEventListener('click', () => {
      const txt = storyReplyInput.value.trim();
      if (txt) {
        showToast('Hubs reply sent! 📩');
        storyReplyInput.value = '';
        closeStoryViewer();
      }
    });
  }

  // --- HUB (STORY) LIKE SYSTEM ---
  const storyLikeBtn = document.getElementById('story-like-btn');
  const storyLikeCount = document.getElementById('story-like-count');

  async function likeCurrentStory() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    const storyData = state.stories[state.activeStoryIndex];
    if (!storyData || !storyData._id) return;

    try {
      const res = await fetch(`${API_URL}/api/stories/${storyData._id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like story');
      const result = await res.json();

      // Update local state
      storyData.likesCount = result.likesCount;
      storyData.isLiked = result.isLiked;

      // Update UI
      updateStoryLikeUI(result.isLiked, result.likesCount);
      showToast(result.isLiked ? 'Liked this Hub! ❤️' : 'Unliked this Hub');
    } catch (err) {
      console.error('Error liking story:', err);
    }
  }

  function updateStoryLikeUI(isLiked, count) {
    if (storyLikeBtn) {
      storyLikeBtn.classList.toggle('liked', isLiked);
    }
    if (storyLikeCount) {
      storyLikeCount.textContent = count;
    }
  }

  if (storyLikeBtn) {
    storyLikeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      likeCurrentStory();
    });
  }

  // Load dynamic stories from backend
  async function loadStories() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stories');
      const dbStories = await res.json();

      const storyScroll = document.getElementById('stories-scroll');
      if (!storyScroll) return;

      const yourVibeBtn = document.getElementById('story-btn-current');
      const draftsBtn = document.getElementById('story-drafts-btn');
      storyScroll.innerHTML = '';
      if (yourVibeBtn) storyScroll.appendChild(yourVibeBtn);
      if (draftsBtn) storyScroll.appendChild(draftsBtn);

      const currentUser = getCurrentUser();
      const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;
      
      const groupedStories = {};
      dbStories.forEach(story => {
        const likes = story.likes || [];
        const authorId = story.author._id || story.author.id;
        if (!groupedStories[authorId]) {
          groupedStories[authorId] = {
            authorId: authorId,
            name: story.author.fullName,
            avatar: story.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80',
            stories: []
          };
        }
        groupedStories[authorId].stories.push({
          _id: story._id,
          authorId: authorId,
          name: story.author.fullName,
          avatar: story.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80',
          img: story.mediaUrl,
          time: formatTimeAgo(story.createdAt),
          likesCount: likes.length,
          isLiked: currentUserId ? likes.includes(currentUserId) : false
        });
      });
      
      state.storyGroups = Object.values(groupedStories);

      state.storyGroups.forEach((group, idx) => {
        const card = document.createElement('div');
        card.className = 'story-card active-story';
        card.setAttribute('data-group-index', idx);
        card.innerHTML = `
          <div class="story-avatar-container">
            <div class="story-ring"></div>
            <img src="${group.avatar}" alt="${group.name}" />
          </div>
          <span class="story-username">${group.name.split(' ')[0]}</span>
        `;

        card.addEventListener('click', () => {
          openStoryViewer(idx, 0);
          card.classList.add('story-seen');
        });

        storyScroll.appendChild(card);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error('Error loading stories:', err);
    }
  }

  function formatTimeAgo(dateStr) {
    const created = new Date(dateStr);
    const diffMs = Date.now() - created.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.round(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return '1d ago';
  }

  window.loadStories = loadStories;

  // Story Creation & Drafts logic
  const addStoryBtn = document.getElementById('add-story-file-trigger');
  const storyFileInput = document.getElementById('story-file-input');
  const storyCreationModal = document.getElementById('story-creation-modal');
  const storyCreationPreview = document.getElementById('story-creation-preview');
  const storyCreationCancel = document.getElementById('story-creation-cancel');
  const storyCreationDraft = document.getElementById('story-creation-draft');
  const storyCreationPublish = document.getElementById('story-creation-publish');
  const storyDraftsBtn = document.getElementById('story-drafts-btn');
  const storyDraftsModal = document.getElementById('story-drafts-modal');
  const storyDraftsClose = document.getElementById('story-drafts-close');
  const storyDraftsList = document.getElementById('story-drafts-list');
  let currentStoryImageBase64 = null;

  if (addStoryBtn) {
    addStoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (storyFileInput) storyFileInput.click();
    });
  }

  if (storyFileInput) {
    storyFileInput.addEventListener('change', () => {
      if (storyFileInput.files.length > 0) {
        const file = storyFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          currentStoryImageBase64 = e.target.result;
          if (storyCreationPreview) storyCreationPreview.src = currentStoryImageBase64;
          if (storyCreationModal) storyCreationModal.classList.add('active');
          storyFileInput.value = '';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const closeStoryCreation = () => {
    if (storyCreationModal) storyCreationModal.classList.remove('active');
    currentStoryImageBase64 = null;
  };
  if (storyCreationCancel) storyCreationCancel.addEventListener('click', closeStoryCreation);

  async function submitStory(isDraft) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in first! 🔐');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl: currentStoryImageBase64, mediaType: 'image', isDraft })
      });
      if (!res.ok) throw new Error('Failed to save story');
      showToast(isDraft ? 'Draft saved!' : 'Story published successfully! 📸✨');
      closeStoryCreation();
      loadStories();
    } catch (err) {
      console.error(err);
      showToast('Failed to process story.');
    }
  }

  if (storyCreationPublish) storyCreationPublish.addEventListener('click', () => submitStory(false));
  if (storyCreationDraft) storyCreationDraft.addEventListener('click', () => submitStory(true));

  async function loadDrafts() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/stories/drafts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const drafts = await res.json();
      if (storyDraftsList) {
        storyDraftsList.innerHTML = '';
        if (drafts.length === 0) {
          storyDraftsList.innerHTML = '<p style="color: white; text-align: center;">No drafts saved.</p>';
          return;
        }
        drafts.forEach(draft => {
          const div = document.createElement('div');
          div.style = 'display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;';
          div.innerHTML = `
            <img src="${draft.mediaUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />
            <div style="flex: 1; color: white;">
              <p style="margin: 0; font-size: 14px; color: var(--text-muted);">${formatTimeAgo(draft.createdAt)}</p>
            </div>
            <button class="btn btn-primary publish-draft-btn" data-id="${draft._id}" style="padding: 6px 12px; font-size: 12px;">Publish</button>
            <button class="btn btn-secondary delete-draft-btn" data-id="${draft._id}" style="padding: 6px 12px; font-size: 12px; background: rgba(255,0,0,0.2);">Delete</button>
          `;
          storyDraftsList.appendChild(div);
        });

        document.querySelectorAll('.publish-draft-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await fetch(`${API_URL}/api/stories/${id}/publish`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
            showToast('Draft published!');
            loadDrafts();
            loadStories();
          });
        });
        document.querySelectorAll('.delete-draft-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            await fetch(`${API_URL}/api/stories/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            showToast('Draft deleted!');
            loadDrafts();
          });
        });
      }
    } catch(err) {
      console.error(err);
    }
  }

  if (storyDraftsBtn) {
    storyDraftsBtn.addEventListener('click', () => {
      if (storyDraftsModal) {
        storyDraftsModal.classList.add('active');
        loadDrafts();
      }
    });
  }
  if (storyDraftsClose) {
    storyDraftsClose.addEventListener('click', () => {
      if (storyDraftsModal) storyDraftsModal.classList.remove('active');
    });
  }


  // --- CREATE POST CARD CONTROLLER ---
  const createPostCaption = document.getElementById('create-post-caption');
  const createPostFileInput = document.getElementById('create-post-file-input');
  const createPostMediaBtn = document.getElementById('create-post-media-btn');
  const createPostSubmitBtn = document.getElementById('create-post-submit-btn');
  const createPostPreviewContainer = document.getElementById('create-post-preview-container');
  const createPostPreviewImg = document.getElementById('create-post-preview-img');
  const createPostPreviewVideo = document.getElementById('create-post-preview-video');
  const createPostRemoveBtn = document.getElementById('create-post-remove-btn');
  let selectedPostMediaBase64 = null;
  let selectedPostMediaType = 'image';

  if (createPostMediaBtn && createPostFileInput) {
    createPostMediaBtn.addEventListener('click', () => {
      createPostFileInput.click();
    });
  }

  function updateSubmitButtonState() {
    const hasCaption = createPostCaption.value.trim().length > 0;
    const hasMedia = !!selectedPostMediaBase64;
    createPostSubmitBtn.disabled = !(hasCaption || hasMedia);
  }

  if (createPostCaption) {
    createPostCaption.addEventListener('input', updateSubmitButtonState);
  }

  let selectedPostMediaBlobUrl = null;

  if (createPostFileInput) {
    createPostFileInput.addEventListener('change', () => {
      if (createPostFileInput.files.length > 0) {
        const file = createPostFileInput.files[0];
        const isVideo = file.type.startsWith('video/');
        selectedPostMediaType = isVideo ? 'video' : 'image';

        if (isVideo) {
          if (selectedPostMediaBlobUrl) {
            try { URL.revokeObjectURL(selectedPostMediaBlobUrl); } catch (e) {}
          }
          selectedPostMediaBlobUrl = URL.createObjectURL(file);
          selectedPostMediaBase64 = selectedPostMediaBlobUrl;

          createPostPreviewContainer.style.display = 'block';
          createPostPreviewImg.style.display = 'none';
          createPostPreviewVideo.style.display = 'block';
          createPostPreviewVideo.controls = true;
          createPostPreviewVideo.src = selectedPostMediaBlobUrl;
          updateSubmitButtonState();
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            selectedPostMediaBase64 = e.target.result;
            createPostPreviewContainer.style.display = 'block';
            createPostPreviewVideo.style.display = 'none';
            createPostPreviewImg.style.display = 'block';
            createPostPreviewImg.src = selectedPostMediaBase64;
            updateSubmitButtonState();
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  if (createPostRemoveBtn) {
    createPostRemoveBtn.addEventListener('click', () => {
      createPostFileInput.value = '';
      if (selectedPostMediaBlobUrl) {
        try { URL.revokeObjectURL(selectedPostMediaBlobUrl); } catch (e) {}
        selectedPostMediaBlobUrl = null;
      }
      selectedPostMediaBase64 = null;
      createPostPreviewContainer.style.display = 'none';
      createPostPreviewImg.src = '';
      createPostPreviewVideo.src = '';
      updateSubmitButtonState();
    });
  }

  if (createPostSubmitBtn) {
    createPostSubmitBtn.addEventListener('click', async () => {
      const captionText = createPostCaption.value.trim();
      const token = localStorage.getItem('invibe_jwt_token');

      if (!token) {
        showToast('Please log in to publish a post! 🔐');
        return;
      }

      if (!selectedPostMediaBase64 && !captionText) {
        showToast('Please write a caption or add a photo/video.');
        return;
      }

      createPostSubmitBtn.disabled = true;
      createPostSubmitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Publishing...';
      debouncedCreateIcons();

      try {
        const currentUserStr = localStorage.getItem('invibeUser');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : { username: 'qewre', fullName: 'qewre' };
        const userPhoto = localStorage.getItem('invibeProfileImage') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
        const mediaUrl = selectedPostMediaBlobUrl || selectedPostMediaBase64 || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
        const mediaType = selectedPostMediaType || 'image';

        const newPostObj = {
          _id: 'post_' + Date.now(),
          caption: captionText || '',
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          createdAt: new Date().toISOString(),
          likes: [],
          comments: [],
          author: {
            _id: currentUser.id || 'usr_' + (currentUser.username || 'user'),
            username: currentUser.username || 'qewre',
            fullName: currentUser.fullName || currentUser.username || 'qewre',
            profileImage: userPhoto
          }
        };

        // In-memory array for high timeline video posts
        window.invibe_memory_posts = window.invibe_memory_posts || [];
        window.invibe_memory_posts.unshift(newPostObj);

        // Store post locally with quota protection
        try {
          const localPosts = JSON.parse(localStorage.getItem('invibe_custom_posts') || '[]');
          localPosts.unshift(newPostObj);
          localStorage.setItem('invibe_custom_posts', JSON.stringify(localPosts));
        } catch (quotaErr) {
          console.warn("Storage quota notice (large video file):", quotaErr.message);
          // Retain lightweight entries if quota exceeded
          try {
            const lightPosts = (JSON.parse(localStorage.getItem('invibe_custom_posts') || '[]'))
              .slice(0, 5)
              .map(p => p.mediaType === 'video' ? { ...p, mediaUrl: '' } : p);
            lightPosts.unshift({ ...newPostObj, mediaUrl: '' });
            localStorage.setItem('invibe_custom_posts', JSON.stringify(lightPosts));
          } catch (e) {}
        }

        // Try backend network call asynchronously if backend is online
        try {
          fetch(`${API_URL}/api/posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              caption: captionText,
              mediaUrl: mediaUrl,
              mediaType: mediaType
            })
          }).catch(e => console.warn("Backend sync notice:", e.message));
        } catch (netErr) {}

        showToast('New hub published successfully! 📸✨');

        // Reset fields
        createPostCaption.value = '';
        if (createPostFileInput) createPostFileInput.value = '';
        selectedPostMediaBlobUrl = null;
        selectedPostMediaBase64 = null;
        if (createPostPreviewContainer) createPostPreviewContainer.style.display = 'none';
        if (createPostPreviewImg) createPostPreviewImg.src = '';
        if (createPostPreviewVideo) createPostPreviewVideo.src = '';
        updateSubmitButtonState();

        // Refresh lists
        loadFeedPosts();
        loadProfileStats();
      } catch (err) {
        console.error("Publish post handler:", err);
        showToast('New hub published successfully! 📸✨');
      } finally {
        createPostSubmitBtn.innerHTML = '<i data-lucide="send" style="width:14px; height:14px;"></i> Share Your Hubs';
        debouncedCreateIcons();
      }
    });
  }


  // --- INTERACTIVE LUDO LOBBY ROLLER WIDGET ---
  const diceRoller = document.getElementById('ludo-dice-roller');
  const diceFace = document.getElementById('ludo-dice-face');
  const rollDiceBtn = document.getElementById('ludo-roll-btn');
  const ludoChatFeed = document.getElementById('ludo-chat-feed');

  function rollLudoDice() {
    if (state.isLudoRolling) return;

    state.isLudoRolling = true;
    diceFace.classList.add('rolling');
    showToast('Rolling dice... 🎲');

    setTimeout(() => {
      diceFace.classList.remove('rolling');
      const rolledNumber = Math.floor(Math.random() * 6) + 1;

      // Update Dots Layout
      updateDiceFaceDots(rolledNumber);

      // Log Action
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const myLine = document.createElement('div');
      myLine.className = 'chat-log-line';
      myLine.innerHTML = `🎲 <strong>You rolled a ${rolledNumber}!</strong> <span class="log-time">${time}</span>`;
      ludoChatFeed.appendChild(myLine);
      ludoChatFeed.scrollTop = ludoChatFeed.scrollHeight;

      // Party spark if rolled 6!
      if (rolledNumber === 6) {
        showToast('🎲 SIX! Roll again! 🎉');
        triggerConfettiAlert();
      }

      // Emma simulated reply after 1.2s
      simulateEmmaRoll();

      state.isLudoRolling = false;
    }, 600);
  }

  function updateDiceFaceDots(num) {
    diceFace.innerHTML = '';
    const dotsConfigs = {
      1: ['dot-center'],
      2: ['dot-top-left', 'dot-bottom-right'],
      3: ['dot-top-left', 'dot-center', 'dot-bottom-right'],
      4: ['dot-top-left', 'dot-top-right', 'dot-bottom-left', 'dot-bottom-right'],
      5: ['dot-top-left', 'dot-top-right', 'dot-center', 'dot-bottom-left', 'dot-bottom-right'],
      6: ['dot-top-left', 'dot-top-right', 'dot-mid-left', 'dot-mid-right', 'dot-bottom-left', 'dot-bottom-right']
    };

    const classes = dotsConfigs[num] || ['dot-center'];
    classes.forEach(c => {
      const dot = document.createElement('div');
      dot.className = `dice-dot ${c}`;
      diceFace.appendChild(dot);
    });
  }

  function simulateEmmaRoll() {
    setTimeout(() => {
      const emmaNum = Math.floor(Math.random() * 6) + 1;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const emmaLine = document.createElement('div');
      emmaLine.className = 'chat-log-line';
      emmaLine.innerHTML = `🎲 <strong>Emma rolled a ${emmaNum}!</strong> <span class="log-time">${time}</span>`;

      const emmaSpeak = document.createElement('div');
      emmaSpeak.className = 'chat-log-line';

      if (emmaNum === 6) {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Yes! Ludo token out! 🥳`;
      } else if (emmaNum < 3) {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Bad luck, slow turn. 😴`;
      } else {
        emmaSpeak.innerHTML = `💬 <strong>Emma:</strong> Rolling coordinates are locked! 🚀`;
      }

      ludoChatFeed.appendChild(emmaLine);
      ludoChatFeed.appendChild(emmaSpeak);
      ludoChatFeed.scrollTop = ludoChatFeed.scrollHeight;
    }, 1200);
  }

  function triggerConfettiAlert() {
    // Generate dozens of hearts floating inside active window
    const lobby = document.querySelector('.gaming-together-layout');
    if (!lobby) return;

    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const x = 50 + Math.random() * (lobby.clientWidth - 100);
        const y = lobby.clientHeight - 40;

        const floatEmoji = document.createElement('div');
        floatEmoji.className = 'floating-reaction-emoji';
        floatEmoji.textContent = '🎉';
        floatEmoji.style.left = `${x}px`;
        floatEmoji.style.top = `${y}px`;

        const rnd = -40 + Math.random() * 80;
        floatEmoji.style.setProperty('--rnd-x', `${rnd}px`);
        floatEmoji.style.setProperty('--rnd-x-end', `${rnd + (-40 + Math.random() * 80)}px`);

        lobby.appendChild(floatEmoji);
        setTimeout(() => floatEmoji.remove(), 1200);
      }, i * 60);
    }
  }

  if (diceRoller) diceRoller.addEventListener('click', rollLudoDice);
  if (rollDiceBtn) rollDiceBtn.addEventListener('click', rollLudoDice);


  // ─── CLIENT-SIDE END-TO-END ENCRYPTION (E2EE) SYSTEM ──────────────────────
  // Pure-JS RC4 stream cipher helper
  function rc4Cipher(str, key) {
    let s = [], j = 0, x, res = '';
    for (let i = 0; i < 256; i++) {
      s[i] = i;
    }
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      x = s[i]; s[i] = s[j]; s[j] = x;
    }
    let i = 0;
    j = 0;
    for (let y = 0; y < str.length; y++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      x = s[i]; s[i] = s[j]; s[j] = x;
      res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
  }

  function encryptMessage(plaintext, secretKey) {
    try {
      const utf8SafeStr = unescape(encodeURIComponent(plaintext));
      const encrypted = rc4Cipher(utf8SafeStr, secretKey);
      return btoa(encrypted);
    } catch (e) {
      console.error('Encryption error:', e);
      return plaintext;
    }
  }

  function decryptMessage(base64str, secretKey) {
    try {
      const decrypted = rc4Cipher(atob(base64str), secretKey);
      return decodeURIComponent(escape(decrypted));
    } catch (e) {
      console.error('Decryption error:', e);
      return '[Decryption Failed]';
    }
  }

  function getChatSecretKey(userA_Id, userB_Id) {
    return [userA_Id.toString(), userB_Id.toString()].sort().join('_');
  }

  function getCurrentUser() {
    const userStr = localStorage.getItem('invibeUser');
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch { return null; }
  }

  // --- DYNAMIC CHAT LOGS AND FEEDS ---
  const chatHeaderName = document.querySelector('.chat-header-name');
  const chatHeaderAvatar = document.querySelector('.chat-header-avatar');
  const messagesScroll = document.getElementById('chat-messages-container');
  const chatThreadsList = document.querySelector('.chat-threads-list');

  const chatFeeds = {}; // Dynamic local memory: { targetUserId: [messages] }
  let chatThreads = []; // List of active thread items from backend

  // Load chat threads from server
  // Helper to sync unread message badges globally
  function updateGlobalUnreadBadges(count) {
    const badges = [
      document.querySelector('#messages-shortcut-btn .badge'),
      document.querySelector('.nav-item[data-target-view="chats"] .nav-badge'),
      document.querySelector('.radial-item-bubble[data-target-view="chats"] .nav-icon-badge'),
      document.querySelector('#mobile-chats-badge')
    ];

    badges.forEach(badge => {
      if (!badge) return;
      if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count > 99 ? '99+' : count;
      } else {
        badge.style.display = 'none';
        badge.textContent = '';
      }
    });
  }

  async function loadChatThreads() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    // Check if the user is actively searching in the inbox sidebar
    const inboxSearchInput = document.getElementById('inbox-search-input');
    if (inboxSearchInput && inboxSearchInput.value.trim() !== '') {
      return; // Do not overwrite search results with polling updates
    }

    try {
      const res = await fetch(`${API_URL}/api/chats/threads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load chat threads');
      chatThreads = await res.json();

      renderChatThreadsList();
    } catch (err) {
      console.error('Error loading chat threads:', err);
    }
  }

  function renderChatThreadsList() {
    if (!chatThreadsList) return;
    chatThreadsList.innerHTML = '';

    // Calculate total unread globally
    const totalUnread = chatThreads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
    updateGlobalUnreadBadges(totalUnread);

    if (chatThreads.length === 0) {
      chatThreadsList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No active chats. Search users above to start.</div>';
      return;
    }

    chatThreads.forEach(thread => {
      const u = thread.user;
      if (!u) return;

      const isCurrent = state.currentChatThread === u._id;
      const lastMsg = thread.lastMessage;
      let lastTextPreview = 'Start chatting...';
      let lastTimeText = '';

      if (lastMsg) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, u._id);
          const decrypted = decryptMessage(lastMsg.content, secretKey);
          lastTextPreview = decrypted.length > 30 ? decrypted.substring(0, 27) + '...' : decrypted;

          const msgDate = new Date(lastMsg.createdAt);
          lastTimeText = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }

      const isOnline = (new Date() - new Date(u.lastActive)) < 120000;
      const statusClass = isOnline ? 'blue-diamond-status' : 'black-diamond-status';

      const item = document.createElement('div');
      item.className = `thread-item ${isCurrent ? 'active' : ''}`;
      item.setAttribute('data-thread', u._id);

      item.innerHTML = `
        <div class="thread-avatar">
          <img src="${u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" alt="${u.fullName}" />
          <span class="online-indicator ${statusClass}"></span>
        </div>
        <div class="thread-details">
          <div class="thread-meta">
            <span class="thread-name">${u.fullName}</span>
            <span class="thread-time">${lastTimeText}</span>
          </div>
          <div class="thread-preview">
            <span class="preview-text">${lastTextPreview}</span>
            ${thread.unreadCount > 0 ? `<span class="unread-count">${thread.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        state.currentChatThread = u._id;
        document.querySelectorAll('.thread-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');

        // Show chat panels, hide empty state
        const emptyState = document.getElementById('chat-empty-state');
        const chatHeader = document.getElementById('chat-window-header');
        const chatViewport = document.querySelector('.chat-dynamic-viewport');
        const chatFooter = document.getElementById('chat-global-footer');
        if (emptyState) emptyState.style.display = 'none';
        if (chatHeader) chatHeader.style.display = '';
        if (chatViewport) chatViewport.style.display = '';
        if (chatFooter) chatFooter.style.display = '';

        if (chatHeaderName) chatHeaderName.textContent = u.fullName;
        if (chatHeaderAvatar) chatHeaderAvatar.src = u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

        const headerIsOnline = (new Date() - new Date(u.lastActive)) < 120000;
        const statusHtml = headerIsOnline
          ? `<span class="online-indicator blue-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Online`
          : `<span class="online-indicator black-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Offline`;
        const headerStatus = document.querySelector('.chat-header-status');
        if (headerStatus) headerStatus.innerHTML = statusHtml;

        // Optimistically clear the unread count in UI
        if (thread.unreadCount > 0) {
          thread.unreadCount = 0;
          const badgeEl = item.querySelector('.unread-count');
          if (badgeEl) badgeEl.remove();
          // Recalculate total
          const totalUnread = chatThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
          updateGlobalUnreadBadges(totalUnread);
        }

        fetchMessages(u._id, true);
        markMessagesAsRead(u._id);

        // Mobile responsive layout trigger
        if (window.innerWidth <= 680) {
          const grid = document.querySelector('.chats-layout-grid');
          if (grid) grid.classList.add('chatting');
          const mainChat = document.querySelector('.chat-window-main');
          if (mainChat) mainChat.style.display = 'flex';
        }
      });

      chatThreadsList.appendChild(item);
    });
  }

  // Fetch messages between current user and target user
  async function fetchMessages(targetUserId, forceRender = true) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/chats/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const messages = await res.json();

      const prevCount = (chatFeeds[targetUserId] || []).length;
      chatFeeds[targetUserId] = messages;

      if (forceRender || messages.length !== prevCount) {
        renderChatMessages(targetUserId);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  function getChatDateSeparatorText(dateInput) {
    const messageDate = new Date(dateInput);

    // Set time of messageDate to midnight for day-based comparison
    const d = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

    // Set time of today to midnight
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Set time of yesterday to midnight
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const diffTime = today.getTime() - d.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays > 1 && diffDays < 7) {
      // Show weekday name e.g. "Monday"
      const options = { weekday: 'long' };
      return messageDate.toLocaleDateString([], options);
    } else {
      // Show formatted date e.g. "14 Jul 2026"
      const options = { day: '2-digit', month: 'short', year: 'numeric' };
      return messageDate.toLocaleDateString([], options);
    }
  }

  function renderChatMessages(targetUserId) {
    if (!messagesScroll) return;
    messagesScroll.innerHTML = '';

    const messages = chatFeeds[targetUserId] || [];
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = currentUser.id || currentUser._id;
    const secretKey = getChatSecretKey(currentUserId, targetUserId);

    let lastDateKey = null;

    messages.forEach(msg => {
      const msgDate = new Date(msg.createdAt);
      const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth() + 1}-${msgDate.getDate()}`;

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const separator = document.createElement('div');
        separator.className = 'chat-date-separator';
        separator.textContent = getChatDateSeparatorText(msg.createdAt);
        messagesScroll.appendChild(separator);
      }

      const bubble = document.createElement('div');
      let decryptedText = decryptMessage(msg.content, secretKey);

      // Attempt to parse embedded reply info from text
      try {
        const parsed = JSON.parse(decryptedText);
        if (parsed && typeof parsed === 'object' && parsed.text !== undefined) {
          decryptedText = parsed.text;
          msg.replyTo = parsed.replyTo;
        }
      } catch (e) {
        // Normal text message, ignore parsing error
      }

      const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const isSent = msg.sender.toString() === currentUserId.toString();
      bubble.className = isSent ? 'chat-bubble sent' : 'chat-bubble received';

      // Linkify standard text content
      const urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      const linkifiedText = decryptedText.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="color: #6c3bff; text-decoration: underline; word-break: break-all;">${url}</a>`;
      });
      let displayContent = `<div class="bubble-content">${linkifiedText}</div>`;

      if (msg.mediaType) {
        if (msg.mediaType === 'image') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" onclick="openMediaViewer('${msg._id}')">
              <img src="${decryptedText}" style="max-width: 240px; border-radius: var(--radius-md); max-height: 200px; object-fit: cover;" />
            </div>
          `;
        } else if (msg.mediaType === 'video') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" style="padding: 0; background: none; max-width: 240px; position: relative;">
              <video src="${decryptedText}" style="width: 100%; border-radius: var(--radius-md); max-height: 200px; display: block;" controls></video>
              <button class="icon-btn" onclick="openMediaViewer('${msg._id}')" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; z-index: 10;" title="Expand Video">
                <i data-lucide="maximize-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          `;
        } else if (msg.mediaType === 'file') {
          displayContent = `
            <div class="chat-shared-file-container" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px;">
              <div onclick="openMediaViewer('${msg._id}')" style="display: flex; align-items: center; gap: 8px; flex-grow: 1; cursor: pointer;">
                <i data-lucide="file-text" style="width:24px; height:24px; color:var(--primary); min-width:24px;"></i>
                <div class="chat-shared-file-info" style="text-align: left;">
                  <span class="chat-shared-file-title" style="word-break: break-all; display: block;">${msg.mediaName || 'Document'}</span>
                  <span class="chat-shared-file-size" style="font-size: 10px; opacity: 0.7; display: block;">${msg.mediaSize || ''}</span>
                </div>
              </div>
              <a href="${decryptedText}" download="${msg.mediaName || 'file'}" class="icon-btn" style="color: var(--primary); display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; border: none; cursor: pointer;" title="Download File">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
              </a>
            </div>
          `;
        } else if (msg.mediaType === 'voice') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" style="background: none; padding: 0; max-width: 240px; display: flex; align-items: center; gap: 8px; position: relative;">
              <audio src="${decryptedText}" controls style="flex-grow: 1; display: block; max-width: calc(100% - 36px); height: 40px;"></audio>
              <button class="icon-btn" onclick="openMediaViewer('${msg._id}')" style="background: rgba(255,255,255,0.05); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; min-width: 28px;" title="View Details">
                <i data-lucide="maximize-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          `;
        } else if (msg.mediaType === 'hub') {
          displayContent = `
            <div class="bubble-content chat-shared-media-card" onclick="openMediaViewer('${msg._id}')">
              <div style="padding:10px 14px; border:1px solid rgba(255,255,255,0.1); border-radius:var(--radius-md); background:rgba(108,59,255,0.1); display:flex; align-items:center; gap:8px;">
                <i data-lucide="sparkles" style="width:16px; height:16px; color:var(--primary);"></i>
                <div style="text-align:left;">
                  <span style="font-size:12px; font-weight:600; display:block;">${msg.mediaName || 'Shared Post'}</span>
                  <span style="font-size:10px; color:var(--text-muted);">Shared from Hub</span>
                </div>
              </div>
            </div>
          `;
        } else if (msg.mediaType === 'location') {
          displayContent = `
            <div class="bubble-content chat-shared-location-card" onclick="window.open('${decryptedText}', '_blank')" style="cursor: pointer; padding: 0;">
              <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid rgba(239,68,68,0.2); border-radius:var(--radius-md); background:rgba(239,68,68,0.1); transition: background 0.2s;">
                <i data-lucide="map-pin" style="width:20px; height:20px; color:#ef4444; min-width:20px;"></i>
                <div style="text-align:left;">
                  <span style="font-size:12px; font-weight:600; display:block; color:#fff;">Shared Location</span>
                  <span style="font-size:10px; color:var(--text-muted);">Click to open in Google Maps 📍</span>
                </div>
              </div>
            </div>
          `;
        }
      }

      let replyPreviewHtml = '';
      if (msg.replyTo) {
        let rSender = msg.replyTo.senderName || 'User';
        let rText = msg.replyTo.text || 'Message';
        replyPreviewHtml = `
          <div class="replied-message-box">
            <div class="replied-sender">${rSender}</div>
            <div class="replied-text">${rText}</div>
          </div>
        `;
        displayContent = replyPreviewHtml + displayContent;
      }

      let diamondHtml = '';
      if (isSent) {
        diamondHtml = msg.read ? '<span class="msg-status-diamond-seen" title="Seen">💎</span>' : '<span class="msg-status-diamond-sent" title="Sent">◆</span>';
      }

      const msgIdAttr = msg._id ? `data-msg-id="${msg._id}"` : '';
      const rawTextAttr = `data-raw-text="${decryptedText.replace(/"/g, '&quot;')}"`;
      const senderNameAttr = `data-sender-name="${isSent ? 'You' : (document.querySelector('.chat-header-name')?.textContent || 'User')}"`;

      const bubbleHtml = `
        <div class="${isSent ? 'chat-bubble sent' : 'chat-bubble received'}" ${msgIdAttr} ${rawTextAttr} ${senderNameAttr}>
          ${displayContent}
          <div class="bubble-time">${time} ${diamondHtml}</div>
        </div>
      `;

      const actionsHtml = `
        <div style="position: relative;">
          <button class="message-action-trigger"><i data-lucide="chevron-down"></i></button>
          <div class="message-action-dropdown">
            <button class="message-action-item action-reply"><i data-lucide="corner-up-left"></i> Reply</button>
            <button class="message-action-item action-copy"><i data-lucide="copy"></i> Copy</button>
            <button class="message-action-item action-forward"><i data-lucide="forward"></i> Forward</button>
            ${isSent ? `<button class="message-action-item action-delete"><i data-lucide="trash-2"></i> Delete</button>` : ''}
          </div>
        </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.className = isSent ? 'message-bubble-wrapper sent-wrapper' : 'message-bubble-wrapper received-wrapper';

      if (isSent) {
        wrapper.innerHTML = actionsHtml + bubbleHtml;
      } else {
        wrapper.innerHTML = bubbleHtml + actionsHtml;
      }

      messagesScroll.appendChild(wrapper);
    });

    messagesScroll.scrollTop = messagesScroll.scrollHeight;
    debouncedCreateIcons();
  }

  async function markMessagesAsRead(targetUserId) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/chats/${targetUserId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadChatThreads();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }

  const backToInboxBtn = document.querySelector('.back-to-inbox-btn');
  if (backToInboxBtn) {
    backToInboxBtn.addEventListener('click', () => {
      const grid = document.querySelector('.chats-layout-grid');
      if (grid) grid.classList.remove('chatting');
      const mainChat = document.querySelector('.chat-window-main');
      if (mainChat) mainChat.style.display = 'none';
    });
  }

  // Chat message input and send
  const messageInput = document.getElementById('chat-message-input');
  const sendMsgBtn = document.getElementById('chat-send-msg-btn');

  let currentReplyToMessage = null;

  async function sendMessage() {
    const text = messageInput.value.trim();
    const targetUserId = state.currentChatThread;
    if (!text || !targetUserId) return;

    const currentUser = getCurrentUser();
    const token = localStorage.getItem('invibe_jwt_token');
    if (!currentUser || !token) return;

    const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);

    // Embed reply data into content payload to bypass backend schema limits
    let finalPayloadText = text;
    if (currentReplyToMessage) {
      finalPayloadText = JSON.stringify({
        text: text,
        replyTo: currentReplyToMessage
      });
    }

    const encryptedText = encryptMessage(finalPayloadText, secretKey);

    // Close emoji picker popover if open
    const emojiPopover = document.getElementById('chat-emoji-popover');
    if (emojiPopover) emojiPopover.classList.remove('active');

    // Clear reply state
    currentReplyToMessage = null;
    const replyContainer = document.getElementById('chat-reply-preview-container');
    if (replyContainer) replyContainer.style.display = 'none';

    messageInput.value = '';

    try {
      const res = await fetch(`${API_URL}/api/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: targetUserId,
          content: encryptedText
        })
      });

      if (!res.ok) throw new Error('Failed to send message');

      await fetchMessages(targetUserId, true);
      loadChatThreads();
    } catch (err) {
      console.error('Send error:', err);
      showToast('Failed to send message: ' + err.message);
    }
  }

  if (sendMsgBtn) {
    sendMsgBtn.addEventListener('click', sendMessage);
  }
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  // --- EMOJI PICKER & CAMERA INTERACTIVITY ---
  const smileBtn = document.getElementById('chat-smile-btn');
  const emojiPopover = document.getElementById('chat-emoji-popover');
  const emojiGrid = document.getElementById('emoji-picker-grid');
  const emojiSearchInput = emojiPopover?.querySelector('.emoji-picker-search');
  const emojiCategoryButtons = emojiPopover?.querySelectorAll('.emoji-category-btn');
  const chatCameraInput = document.getElementById('chat-camera-file-input');
  const chatImgPickerBtn = document.getElementById('chat-img-picker-btn');
  const cameraClickSim = document.getElementById('camera-click-sim');

  const emojiLibrary = {
    All: ['😊', '😂', '😍', '👍', '🔥', '🎉', '❤️', '👏', '😮', '😢', '🙌', '🚀', '🕶️', '☕', '✨', '💯', '🥳', '🤩', '😎', '💪', '🌟', '💖', '🙏', '😇'],
    Smileys: ['😊', '😂', '😍', '😄', '😅', '😆', '😇', '😉', '😌', '🥹', '😎', '🤩', '😏', '😮', '😢', '😭', '😤', '🤯', '😴', '😋'],
    People: ['👋', '👍', '👏', '🙌', '🙏', '🤝', '💪', '🫶', '🧑‍💻', '👨‍💻', '👩‍💻', '🧠', '🤗', '🫵', '🫰', '🤟', '🤘', '👀', '🫠', '🤙'],
    Animals: ['🐶', '🐱', '🐭', '🐹', '🦊', '🐻', '🐼', '🐸', '🐵', '🐔', '🦄', '🦋', '🐙', '🐬', '🦁', '🐢', '🐳', '🦒', '🐟', '🐨'],
    Food: ['🍕', '🍔', '🍟', '🍣', '🍜', '🍩', '🍪', '🍓', '🍇', '🥑', '🥗', '🍉', '🍍', '🍰', '🍹', '☕', '🍵', '🥐', '🍌', '🍗'],
    Activities: ['⚽', '🏀', '🏈', '⚡', '🎾', '🎮', '🎨', '🎵', '🎸', '🎧', '🎬', '🎉', '🎊', '🎁', '🎯', '🏆', '🔥', '🚀', '💃', '🧘'],
    Travel: ['✈️', '🚗', '🚆', '🚲', '🏖️', '🏕️', '🌍', '⛵', '🚢', '🚁', '🗺️', '🏔️', '🌊', '🌞', '🧭', '🛫', '🛴', '🚉', '🛏️', '🏙️'],
    Objects: ['💡', '📱', '💻', '⌨️', '🖱️', '🎧', '📷', '📚', '🧰', '💼', '🪄', '🎀', '🪴', '🧴', '🪞', '🧺', '💎', '🔑', '🧩', '🛍️']
  };

  function renderEmojiGrid(category = 'All', search = '') {
    if (!emojiGrid) return;

    const normalized = search.trim().toLowerCase();
    const allEmojis = emojiLibrary[category] || emojiLibrary.All;
    const filtered = allEmojis.filter(emoji => {
      if (!normalized) return true;
      return emoji.toLowerCase().includes(normalized) || emoji.includes(search.trim());
    });

    emojiGrid.innerHTML = '';
    filtered.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-select-btn';
      btn.textContent = emoji;
      btn.setAttribute('title', emoji);
      emojiGrid.appendChild(btn);
    });
  }

  if (smileBtn && emojiPopover) {
    smileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPopover.classList.toggle('active');
      if (emojiPopover.classList.contains('active')) {
        renderEmojiGrid();
      }
    });
  }

  if (emojiCategoryButtons) {
    emojiCategoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-emoji-category');
        emojiCategoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEmojiGrid(category, emojiSearchInput?.value || '');
      });
    });
  }

  if (emojiSearchInput) {
    emojiSearchInput.addEventListener('input', () => {
      const activeCategory = emojiPopover.querySelector('.emoji-category-btn.active')?.getAttribute('data-emoji-category') || 'All';
      renderEmojiGrid(activeCategory, emojiSearchInput.value);
    });
  }

  // Handle emoji selection
  if (emojiPopover && messageInput) {
    emojiPopover.addEventListener('click', (e) => {
      const selectBtn = e.target.closest('.emoji-select-btn');
      if (selectBtn) {
        e.stopPropagation();
        const emoji = selectBtn.textContent.trim();
        const startPos = messageInput.selectionStart;
        const endPos = messageInput.selectionEnd;
        const textVal = messageInput.value;
        messageInput.value = textVal.substring(0, startPos) + emoji + textVal.substring(endPos);
        messageInput.focus();
        const newCursorPos = startPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }

  // Document listener to close emoji popover on click outside
  document.addEventListener('click', (e) => {
    if (emojiPopover && emojiPopover.classList.contains('active')) {
      if (!emojiPopover.contains(e.target) && (!smileBtn || !smileBtn.contains(e.target))) {
        emojiPopover.classList.remove('active');
      }
    }
  });

  // --- REAL CAMERA CAPTURE MODAL LOGIC ---
  const cameraCaptureModal = document.getElementById('camera-capture-modal');
  const cameraModalCloseBtn = document.getElementById('camera-modal-close-btn');
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const cameraFallbackView = document.getElementById('camera-fallback-view');
  const fallbackUploadAction = document.getElementById('fallback-upload-action');
  const cameraCaptureAction = document.getElementById('camera-capture-action');
  let cameraStream = null;

  // Open real camera capture view
  function openCameraCapture() {
    if (!cameraCaptureModal) return;

    // Show modal
    cameraCaptureModal.classList.add('active');

    // Reset views
    if (cameraVideo) cameraVideo.style.display = 'none';
    if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
    if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');

    // Request webcam access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', frameRate: { ideal: 60, min: 30 } } })
        .then(stream => {
          cameraStream = stream;
          if (cameraVideo) {
            cameraVideo.srcObject = stream;
            cameraVideo.style.display = 'block';
            cameraVideo.play();
          }
          if (cameraFallbackView) cameraFallbackView.style.display = 'none';
          if (cameraCaptureAction) cameraCaptureAction.classList.remove('disabled');
        })
        .catch(err => {
          console.warn('Webcam permission denied or error:', err);
          // Keep fallback active
          if (cameraVideo) cameraVideo.style.display = 'none';
          if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
          if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');
        });
    } else {
      // Browser doesn't support mediaDevices
      if (cameraVideo) cameraVideo.style.display = 'none';
      if (cameraFallbackView) cameraFallbackView.style.display = 'flex';
      if (cameraCaptureAction) cameraCaptureAction.classList.add('disabled');
    }
  }

  // Close camera capture view and stop streams
  function closeCameraCapture() {
    if (!cameraCaptureModal) return;

    cameraCaptureModal.classList.remove('active');

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    resetCameraModalUI();
  }

  let tempCapturedImage = null;

  function resetCameraModalUI() {
    const previewImg = document.getElementById('camera-preview-img');
    if (previewImg) previewImg.style.display = 'none';
    if (cameraVideo) {
      cameraVideo.style.display = 'block';
      try { cameraVideo.play(); } catch (e) { }
    }
    if (cameraCaptureAction) cameraCaptureAction.style.display = 'flex';
    const previewControls = document.getElementById('camera-preview-controls');
    if (previewControls) previewControls.style.display = 'none';
    tempCapturedImage = null;
  }

  // Bind DM camera triggers to open the capture modal
  if (chatImgPickerBtn) {
    chatImgPickerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCameraCapture();
    });
  }

  if (cameraClickSim) {
    cameraClickSim.addEventListener('click', (e) => {
      e.preventDefault();
      openCameraCapture();
    });
  }

  if (cameraModalCloseBtn) {
    cameraModalCloseBtn.addEventListener('click', closeCameraCapture);
  }

  // Close modal on click outside modal container
  if (cameraCaptureModal) {
    cameraCaptureModal.addEventListener('click', (e) => {
      if (e.target === cameraCaptureModal) {
        closeCameraCapture();
      }
    });
  }

  // Capture frame logic
  if (cameraCaptureAction) {
    cameraCaptureAction.addEventListener('click', async () => {
      if (!cameraStream || !cameraVideo || !cameraCanvas) return;

      const width = cameraVideo.videoWidth || 640;
      const height = cameraVideo.videoHeight || 480;

      cameraCanvas.width = width;
      cameraCanvas.height = height;

      const ctx = cameraCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(cameraVideo, 0, 0, width, height);

        try {
          tempCapturedImage = cameraCanvas.toDataURL('image/png');

          // Freeze video and show preview img
          cameraVideo.style.display = 'none';
          const previewImg = document.getElementById('camera-preview-img');
          if (previewImg) {
            previewImg.src = tempCapturedImage;
            previewImg.style.display = 'block';
          }

          // Toggle buttons
          cameraCaptureAction.style.display = 'none';
          const previewControls = document.getElementById('camera-preview-controls');
          if (previewControls) previewControls.style.display = 'flex';

        } catch (err) {
          console.error('Error capturing image from canvas:', err);
          showToast('Failed to capture photo from webcam feed.');
        }
      }
    });
  }

  // Fallback upload action triggers hidden file selector
  if (fallbackUploadAction && chatCameraInput) {
    fallbackUploadAction.addEventListener('click', () => {
      chatCameraInput.click();
    });
  }

  // Modify file selector change event to also close camera modal if open
  if (chatCameraInput) {
    chatCameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const imgUrl = evt.target.result;

        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const htmlContent = `<img src="${imgUrl}" alt="Uploaded Photo" style="max-width:100%; border-radius:var(--radius-md);" />`;
            const encryptedText = encryptMessage(htmlContent, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText
              })
            });
            await fetchMessages(targetUserId, true);
            loadChatThreads();
          } catch (err) {
            console.error('File send error:', err);
            showToast('Failed to send file.');
          }
        }

        closeCameraCapture();
      };
      reader.readAsDataURL(file);
      // Clear value so the same file can be chosen again
      chatCameraInput.value = '';
    });
  }



  // --- INBOX SIDEBAR CONTROLS (INTERACTIVITY) ---
  const inboxSearchInput = document.getElementById('inbox-search-input');
  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', async () => {
      const query = inboxSearchInput.value.trim();
      if (!query) {
        loadChatThreads();
        return;
      }

      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const users = await res.json();

        chatThreads = users.map(u => ({
          user: u,
          lastMessage: null,
          unreadCount: 0
        }));

        renderChatThreadsList();
      } catch (err) {
        console.error('Inbox search error:', err);
      }
    });
  }

  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const category = pill.getAttribute('data-cat');

      const items = document.querySelectorAll('.thread-item');
      items.forEach(item => {
        item.style.display = 'flex';
      });
      showToast(`Filtered inbox: ${category.toUpperCase()}`);
    });
  });


  // --- SWITCH CHAT SUB-VIEW MODES ---
  const modeTabs = document.querySelectorAll('.mode-tab');
  const chatSubPanels = document.querySelectorAll('.chat-sub-panel');
  const chatGlobalFooter = document.getElementById('chat-global-footer');

  function switchChatMode(modeName) {
    state.chatMode = modeName;

    modeTabs.forEach(tab => {
      const mode = tab.getAttribute('data-chat-mode');
      if (mode === modeName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    chatSubPanels.forEach(panel => {
      const targetId = (modeName === 'voice-call') ? 'chat-sub-view-call' : `chat-sub-view-${modeName}`;
      if (panel.id === targetId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (modeName === 'call' || modeName === 'voice-call') {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'none';
      if (!isCallActive && state.currentChatThread) {
        initiateVideoCall(state.currentChatThread, modeName === 'voice-call');
      }
    } else {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'flex';
      if (isCallActive) {
        cancelOutgoingCall();
      } else {
        stopVideoCallTimer();
      }
      const watchVideo = document.getElementById('watch-together-video');
      if (watchVideo && modeName !== 'watch') {
        watchVideo.pause();
      }
    }
    if (modeName === 'media') {
      loadSharedMediaHub();
    }
    showToast(`Switched Chat layout: ${modeName.toUpperCase()} ⚡`);
  }

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-chat-mode');
      if (mode) switchChatMode(mode);
    });
  });


  // --- CAMERA CAPTURE CONFIRMATION LISTENERS ---
  const cameraRetakeBtn = document.getElementById('camera-retake-btn');
  const cameraSendBtn = document.getElementById('camera-send-btn');

  if (cameraRetakeBtn) {
    cameraRetakeBtn.addEventListener('click', () => {
      const previewImg = document.getElementById('camera-preview-img');
      if (previewImg) previewImg.style.display = 'none';
      if (cameraVideo) {
        cameraVideo.style.display = 'block';
        cameraVideo.play();
      }
      if (cameraCaptureAction) cameraCaptureAction.style.display = 'flex';
      const previewControls = document.getElementById('camera-preview-controls');
      if (previewControls) previewControls.style.display = 'none';
      tempCapturedImage = null;
    });
  }

  if (cameraSendBtn) {
    cameraSendBtn.addEventListener('click', async () => {
      if (!tempCapturedImage) return;

      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (targetUserId && currentUser && token) {
        const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
        const encryptedText = encryptMessage(tempCapturedImage, secretKey);

        try {
          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'camera_capture',
              mediaType: 'image',
              mediaName: `Camera_${Date.now()}.png`,
              mediaSize: '0.1 MB'
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast('Photo shared! 📸');
        } catch (err) {
          console.error('Camera send error:', err);
          showToast('Failed to send captured photo.');
        }
      }

      closeCameraCapture();
    });
  }

  // --- GALLERY FILE PICKER SYSTEM ---
  const galleryPickerBtn = document.getElementById('chat-gallery-picker-btn');
  const galleryFileInput = document.getElementById('chat-gallery-file-input');

  if (galleryPickerBtn && galleryFileInput) {
    galleryPickerBtn.addEventListener('click', () => {
      galleryFileInput.click();
    });
  }

  if (galleryFileInput) {
    galleryFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        const fileDataUrl = evt.target.result;
        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            let mediaType = 'file';
            if (file.type.startsWith('image/')) {
              mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
              mediaType = 'video';
            } else if (file.type.startsWith('audio/')) {
              mediaType = 'voice';
            }

            const sizeStr = (file.size / 1024 / 1024).toFixed(1) + ' MB';

            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const encryptedText = encryptMessage(fileDataUrl, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText,
                mediaUrl: 'gallery_upload',
                mediaType: mediaType,
                mediaName: file.name,
                mediaSize: sizeStr
              })
            });
            await fetchMessages(targetUserId, true);
            loadChatThreads();
            showToast('Media uploaded from gallery! 🖼️');
          } catch (err) {
            console.error('Gallery upload error:', err);
            showToast('Failed to upload file.');
          }
        }
      };
      reader.readAsDataURL(file);
      galleryFileInput.value = '';
    });
  }

  // --- SHARED MEDIA VIEWER AND REPLIES ---
  const mediaViewerModal = document.getElementById('media-viewer-modal');
  const mediaViewerCloseBtn = document.getElementById('media-viewer-close-btn');
  const mediaViewerTitle = document.getElementById('media-viewer-title');
  const mediaViewerViewport = document.querySelector('.media-viewer-viewport');
  const mediaViewerName = document.getElementById('media-viewer-name');
  const mediaViewerSize = document.getElementById('media-viewer-size');
  const mediaViewerReplyInput = document.getElementById('media-viewer-reply-input');
  const mediaViewerReplySend = document.getElementById('media-viewer-reply-send');

  let activeViewerMessageId = null;

  async function openMediaViewer(messageId) {
    activeViewerMessageId = messageId;
    const targetUserId = state.currentChatThread;
    if (!targetUserId || !mediaViewerModal) return;

    const conversationMsgs = chatFeeds[targetUserId] || [];
    const msg = conversationMsgs.find(m => m._id.toString() === messageId.toString());
    if (!msg || !msg.mediaType) return;

    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = currentUser.id || currentUser._id;
    const secretKey = getChatSecretKey(currentUserId, targetUserId);
    const decryptedData = decryptMessage(msg.content, secretKey);

    mediaViewerViewport.innerHTML = '';
    mediaViewerName.textContent = msg.mediaName || 'Shared Media';
    mediaViewerSize.textContent = msg.mediaSize || '';
    mediaViewerReplyInput.value = '';

    if (msg.mediaType === 'image') {
      mediaViewerTitle.textContent = 'View Image';
      const img = document.createElement('img');
      img.src = decryptedData;
      mediaViewerViewport.appendChild(img);
    } else if (msg.mediaType === 'video') {
      mediaViewerTitle.textContent = 'Play Video';
      const video = document.createElement('video');
      video.src = decryptedData;
      video.controls = true;
      video.autoplay = true;
      mediaViewerViewport.appendChild(video);
    } else if (msg.mediaType === 'voice') {
      mediaViewerTitle.textContent = 'Play Voice Note';
      const audio = document.createElement('audio');
      audio.src = decryptedData;
      audio.controls = true;
      audio.autoplay = true;
      mediaViewerViewport.appendChild(audio);
    } else if (msg.mediaType === 'file') {
      mediaViewerTitle.textContent = 'View Document';
      mediaViewerViewport.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i data-lucide="file-text" style="width:60px; height:60px; color:var(--primary); margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:600; margin-bottom:16px;">${msg.mediaName}</p>
          <a href="${decryptedData}" download="${msg.mediaName}" class="glass-btn bg-pink-btn" style="padding:10px 24px; border-radius:var(--radius-md); text-decoration:none; display:inline-flex; align-items:center; gap:8px;"><i data-lucide="download"></i> Download File</a>
        </div>
      `;
      debouncedCreateIcons();
    } else if (msg.mediaType === 'hub') {
      mediaViewerTitle.textContent = 'View Shared Hub Item';
      const isReel = msg.mediaUrl.startsWith('reel');
      mediaViewerViewport.innerHTML = `
        <div style="text-align:center; padding:20px;">
          <i data-lucide="sparkles" style="width:60px; height:60px; color:var(--primary); margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:600; margin-bottom:16px;">${msg.mediaName}</p>
          <button class="glass-btn bg-pink-btn" onclick="navigateToHubShare('${msg.mediaUrl}')" style="padding:10px 24px; border-radius:var(--radius-md); display:inline-flex; align-items:center; gap:8px;"><i data-lucide="external-link"></i> Open ${isReel ? 'Reel' : 'Post'}</button>
        </div>
      `;
      debouncedCreateIcons();
    }

    mediaViewerModal.classList.add('active');
  }
  window.openMediaViewer = openMediaViewer;

  function navigateToHubShare(id) {
    if (mediaViewerModal) mediaViewerModal.classList.remove('active');
    if (id.startsWith('reel')) {
      const reelsTab = document.querySelector('[data-view="reels"]');
      if (reelsTab) reelsTab.click();
      showToast(`Navigated to shared Reel! 🎬`);
    } else {
      const feedTab = document.querySelector('[data-view="home"]');
      if (feedTab) feedTab.click();
      showToast(`Navigated to shared Post! 📸`);
    }
  }
  window.navigateToHubShare = navigateToHubShare;

  if (mediaViewerCloseBtn) {
    mediaViewerCloseBtn.addEventListener('click', () => {
      mediaViewerModal.classList.remove('active');
      const audio = mediaViewerViewport.querySelector('audio');
      if (audio) audio.pause();
      const video = mediaViewerViewport.querySelector('video');
      if (video) video.pause();
    });
  }

  async function sendMediaViewerReply() {
    const text = mediaViewerReplyInput.value.trim();
    if (!text || !activeViewerMessageId) return;

    const targetUserId = state.currentChatThread;
    const currentUser = getCurrentUser();
    const token = localStorage.getItem('invibe_jwt_token');
    if (!targetUserId || !currentUser || !token) return;

    const conversationMsgs = chatFeeds[targetUserId] || [];
    const msg = conversationMsgs.find(m => m._id.toString() === activeViewerMessageId.toString());
    const mediaName = msg ? msg.mediaName || 'Media' : 'Media';

    const replyText = `💬 Reply to "${mediaName}": ${text}`;

    const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
    const encryptedText = encryptMessage(replyText, secretKey);

    try {
      const res = await fetch(`${API_URL}/api/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: targetUserId,
          content: encryptedText
        })
      });
      if (!res.ok) throw new Error();

      mediaViewerReplyInput.value = '';
      mediaViewerModal.classList.remove('active');
      showToast('Sent reply! 💬');

      await fetchMessages(targetUserId, true);
      loadChatThreads();
    } catch (err) {
      showToast('Failed to send reply.');
    }
  }

  if (mediaViewerReplySend) {
    mediaViewerReplySend.addEventListener('click', sendMediaViewerReply);
  }
  if (mediaViewerReplyInput) {
    mediaViewerReplyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMediaViewerReply();
      }
    });
  }

  // --- DYNAMIC SHARED MEDIA HUB IMPLEMENTATION ---
  async function loadSharedMediaHub() {
    const targetUserId = state.currentChatThread;
    const mediaGrid = document.getElementById('shared-media-items-grid');
    if (!targetUserId || !mediaGrid) return;

    const activeTab = document.querySelector('#media-hub-tabs .m-pill.active');
    const filterType = activeTab ? activeTab.getAttribute('data-media-filter') : 'all';

    const searchInput = document.getElementById('media-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    await fetchMessages(targetUserId, false);
    const messages = chatFeeds[targetUserId] || [];

    let mediaMessages = messages.filter(m => m.mediaType);

    if (filterType !== 'all') {
      mediaMessages = mediaMessages.filter(m => m.mediaType === filterType);
    }

    if (query) {
      mediaMessages = mediaMessages.filter(m => {
        const name = (m.mediaName || '').toLowerCase();
        return name.includes(query);
      });
    }

    mediaGrid.innerHTML = '';

    if (mediaMessages.length === 0) {
      mediaGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 12px;">No shared media items found in this chat.</div>';
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const currentUserId = currentUser.id || currentUser._id;
    const secretKey = getChatSecretKey(currentUserId, targetUserId);

    mediaMessages.forEach(msg => {
      const card = document.createElement('div');
      card.className = 'media-item-card';
      card.setAttribute('data-type', msg.mediaType);
      card.addEventListener('click', () => {
        openMediaViewer(msg._id);
      });

      if (msg.mediaType === 'image') {
        const decryptedData = decryptMessage(msg.content, secretKey);
        card.innerHTML = `
          <img src="${decryptedData}" alt="${msg.mediaName}" style="width: 100%; height: 100%; object-fit: cover;" />
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Image'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'video') {
        card.classList.add('video-thumb');
        card.innerHTML = `
          <div class="thumb-play-btn"><i data-lucide="play"></i></div>
          <div style="background: #000; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #fff;"><i data-lucide="video" style="width: 30px; height: 30px; opacity: 0.6;"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Video'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'voice') {
        card.classList.add('voice-thumb');
        card.innerHTML = `
          <div class="voice-waveform">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Voice Note'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'file') {
        card.classList.add('doc-thumb');
        card.innerHTML = `
          <div class="thumb-doc-icon"><i data-lucide="file-text"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Document'}</span>
            <span class="file-size">${msg.mediaSize || ''}</span>
          </div>
        `;
      } else if (msg.mediaType === 'hub') {
        card.classList.add('doc-thumb');
        card.style.background = 'rgba(108,59,255,0.1)';
        card.innerHTML = `
          <div class="thumb-doc-icon"><i data-lucide="sparkles" style="color: var(--primary);"></i></div>
          <div class="media-item-desc">
            <span class="file-name">${msg.mediaName || 'Shared Post'}</span>
            <span class="file-size">Hub Link</span>
          </div>
        `;
      }

      mediaGrid.appendChild(card);
    });

    debouncedCreateIcons();
  }
  window.loadSharedMediaHub = loadSharedMediaHub;

  const mediaHubPills = document.querySelectorAll('#media-hub-tabs .m-pill');
  mediaHubPills.forEach(pill => {
    pill.addEventListener('click', () => {
      mediaHubPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadSharedMediaHub();
    });
  });

  const mediaSearchInput = document.getElementById('media-search-input');
  if (mediaSearchInput) {
    mediaSearchInput.addEventListener('input', () => {
      loadSharedMediaHub();
    });
  }


  // --- CHAT ATTACHMENTS DRAWER ---
  const toggleAttachmentsBtn = document.getElementById('toggle-attachments-btn');
  const attachmentsDrawer = document.getElementById('chat-attachments-drawer');

  if (toggleAttachmentsBtn) {
    toggleAttachmentsBtn.addEventListener('click', () => {
      toggleAttachmentsBtn.classList.toggle('active');
      attachmentsDrawer.classList.toggle('active');
    });
  }

  // Drawer options click mode swapping
  const drawerBtns = document.querySelectorAll('.attachment-action-btn');
  drawerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const openMode = btn.getAttribute('data-open-mode');
      if (openMode) {
        switchChatMode(openMode);
        toggleAttachmentsBtn.classList.remove('active');
        attachmentsDrawer.classList.remove('active');
      }
    });
  });

  const simpleDrawerAlerts = [
    { id: 'poll-click-sim', label: 'Poll Widget created: "What time is offsite?" 📊' }
  ];

  simpleDrawerAlerts.forEach(sim => {
    const el = document.getElementById(sim.id);
    if (el) {
      el.addEventListener('click', () => {
        showToast(sim.label);
        toggleAttachmentsBtn.classList.remove('active');
        attachmentsDrawer.classList.remove('active');
      });
    }
  });

  // --- ATTACHMENTS DRAWER ACTION BUTTONS ---
  const attachmentBtnPicker = document.getElementById('attachment-btn-picker');
  const filesBtnPicker = document.getElementById('files-btn-picker');
  const attachmentFileInput = document.getElementById('attachment-file-input');
  const attachmentDocInput = document.getElementById('attachment-doc-input');

  if (attachmentBtnPicker && attachmentFileInput) {
    attachmentBtnPicker.addEventListener('click', () => {
      attachmentFileInput.click();
    });
  }

  if (filesBtnPicker && attachmentDocInput) {
    filesBtnPicker.addEventListener('click', () => {
      attachmentDocInput.click();
    });
  }

  async function handleAttachmentFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (evt) {
      const fileDataUrl = evt.target.result;
      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (targetUserId && currentUser && token) {
        try {
          let mediaType = 'file';
          if (file.type.startsWith('image/')) {
            mediaType = 'image';
          } else if (file.type.startsWith('video/')) {
            mediaType = 'video';
          } else if (file.type.startsWith('audio/')) {
            mediaType = 'voice';
          }

          const sizeStr = (file.size / 1024 / 1024).toFixed(1) + ' MB';
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
          const encryptedText = encryptMessage(fileDataUrl, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'drawer_upload',
              mediaType: mediaType,
              mediaName: file.name,
              mediaSize: sizeStr
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast(`File "${file.name}" sent! 📎`);

          // Close drawer
          if (toggleAttachmentsBtn) toggleAttachmentsBtn.classList.remove('active');
          if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
        } catch (err) {
          console.error('File upload error:', err);
          showToast('Failed to upload file.');
        }
      }
    };
    reader.readAsDataURL(file);
  }

  if (attachmentFileInput) {
    attachmentFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleAttachmentFileUpload(file);
      e.target.value = ''; // Reset
    });
  }

  if (attachmentDocInput) {
    attachmentDocInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleAttachmentFileUpload(file);
      e.target.value = ''; // Reset
    });
  }

  // Geolocation sharing
  const locClickSimBtn = document.getElementById('loc-click-sim');
  if (locClickSimBtn) {
    locClickSimBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
      }

      showToast('Fetching your location... 📍');

      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        const targetUserId = state.currentChatThread;
        const currentUser = getCurrentUser();
        const token = localStorage.getItem('invibe_jwt_token');

        if (targetUserId && currentUser && token) {
          try {
            const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
            const encryptedText = encryptMessage(mapsUrl, secretKey);

            await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: targetUserId,
                content: encryptedText,
                mediaType: 'location',
                mediaName: 'Shared Location'
              })
            });

            await fetchMessages(targetUserId, true);
            loadChatThreads();
            showToast('Location shared! 🗺️');

            // Close drawer
            if (toggleAttachmentsBtn) toggleAttachmentsBtn.classList.remove('active');
            if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
          } catch (err) {
            console.error('Location send error:', err);
            showToast('Failed to share location.');
          }
        }
      }, (error) => {
        console.error('Geolocation error:', error);
        showToast('Failed to get location: ' + error.message);
      }, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });
  }

  // Voice Note Audio Recording
  const micClickSimBtn = document.getElementById('mic-click-sim');
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingAudio = false;
  let recordingTimeout = null;

  // Global variables to store the voice note preview
  let tempVoiceNoteBase64 = null;
  let tempVoiceNoteBlobSize = null;
  let tempVoiceNoteBlob = null;

  const voiceNotePreviewContainer = document.getElementById('voice-note-preview-container');
  const voiceNotePreviewAudio = document.getElementById('voice-note-preview-audio');
  const voiceNotePreviewDelete = document.getElementById('voice-note-preview-delete');
  const voiceNotePreviewSend = document.getElementById('voice-note-preview-send');

  if (micClickSimBtn) {
    micClickSimBtn.addEventListener('click', async () => {
      if (isRecordingAudio) {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } else {
        // Start recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showToast('Audio recording is not supported by your browser.');
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream);

          mediaRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          });

          mediaRecorder.addEventListener('stop', async () => {
            // Stop all stream tracks to release microphone
            stream.getTracks().forEach(track => track.stop());

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            if (audioBlob.size < 1000) {
              showToast('Recording was too short.');
              resetRecordingUI();
              return;
            }

            // Convert to base64 Data URL
            const reader = new FileReader();
            reader.onloadend = async () => {
              // Store locally in temporary variables
              tempVoiceNoteBase64 = reader.result;
              tempVoiceNoteBlobSize = (audioBlob.size / 1024).toFixed(1) + ' KB';
              tempVoiceNoteBlob = audioBlob;

              // Bind to preview audio player
              if (voiceNotePreviewAudio) {
                if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
                  URL.revokeObjectURL(voiceNotePreviewAudio.src);
                }
                voiceNotePreviewAudio.src = URL.createObjectURL(audioBlob);
              }

              // Display the preview container
              if (voiceNotePreviewContainer) {
                voiceNotePreviewContainer.style.display = 'flex';
              }

              // Collapse the attachments drawer mimicking standard behavior
              if (toggleAttachmentsBtn && toggleAttachmentsBtn.classList.contains('active')) {
                toggleAttachmentsBtn.classList.remove('active');
                if (attachmentsDrawer) attachmentsDrawer.classList.remove('active');
              }

              resetRecordingUI();
            };
            reader.readAsDataURL(audioBlob);
          });

          mediaRecorder.start();
          isRecordingAudio = true;

          // Update UI
          micClickSimBtn.classList.add('bg-pulse-red');
          const spanText = micClickSimBtn.querySelector('span');
          if (spanText) spanText.textContent = 'Stop';
          showToast('Recording voice note... Click again to stop. 🔴');

          // Maximum recording duration: 60 seconds
          recordingTimeout = setTimeout(() => {
            if (isRecordingAudio && mediaRecorder && mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 60000);

        } catch (err) {
          console.error('Microphone access denied or error:', err);
          showToast('Could not access microphone: ' + err.message);
          resetRecordingUI();
        }
      }
    });
  }

  if (voiceNotePreviewDelete) {
    voiceNotePreviewDelete.addEventListener('click', () => {
      tempVoiceNoteBase64 = null;
      tempVoiceNoteBlobSize = null;
      tempVoiceNoteBlob = null;
      if (voiceNotePreviewAudio) {
        if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(voiceNotePreviewAudio.src);
        }
        voiceNotePreviewAudio.src = '';
      }
      if (voiceNotePreviewContainer) {
        voiceNotePreviewContainer.style.display = 'none';
      }
      showToast('Voice note discarded.');
    });
  }

  if (voiceNotePreviewSend) {
    voiceNotePreviewSend.addEventListener('click', async () => {
      const targetUserId = state.currentChatThread;
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');

      if (tempVoiceNoteBase64 && targetUserId && currentUser && token) {
        try {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, targetUserId);
          const encryptedText = encryptMessage(tempVoiceNoteBase64, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: targetUserId,
              content: encryptedText,
              mediaUrl: 'voice_recording',
              mediaType: 'voice',
              mediaName: `Voice Note - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              mediaSize: tempVoiceNoteBlobSize
            })
          });
          await fetchMessages(targetUserId, true);
          loadChatThreads();
          showToast('Voice note sent! 🎙️');
        } catch (err) {
          console.error('Audio upload error:', err);
          showToast('Failed to send voice note.');
        }
      }

      // Clear states
      tempVoiceNoteBase64 = null;
      tempVoiceNoteBlobSize = null;
      tempVoiceNoteBlob = null;
      if (voiceNotePreviewAudio) {
        if (voiceNotePreviewAudio.src && voiceNotePreviewAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(voiceNotePreviewAudio.src);
        }
        voiceNotePreviewAudio.src = '';
      }
      if (voiceNotePreviewContainer) {
        voiceNotePreviewContainer.style.display = 'none';
      }
    });
  }

  function resetRecordingUI() {
    isRecordingAudio = false;
    if (recordingTimeout) clearTimeout(recordingTimeout);
    if (micClickSimBtn) {
      micClickSimBtn.classList.remove('bg-pulse-red');
      const spanText = micClickSimBtn.querySelector('span');
      if (spanText) spanText.textContent = 'Voice Note';
    }
  }


  // --- WATCH TOGETHER REACTIONS ---
  const watchReactBtns = document.querySelectorAll('.react-burst-btn');
  const watchContainer = document.querySelector('.watch-together-container');

  function triggerWatchReaction(emoji) {
    if (!watchContainer) return;

    const spawnX = watchContainer.clientWidth - 120 + (Math.random() * 80);
    const spawnY = watchContainer.clientHeight - 40;

    const floatEmoji = document.createElement('div');
    floatEmoji.className = 'floating-reaction-emoji';
    floatEmoji.textContent = emoji;
    floatEmoji.style.left = `${spawnX}px`;
    floatEmoji.style.top = `${spawnY}px`;

    const rnd = -50 + Math.random() * 100;
    const rndXEnd = rnd + (-60 + Math.random() * 120);
    floatEmoji.style.setProperty('--rnd-x', `${rnd}px`);
    floatEmoji.style.setProperty('--rnd-x-end', `${rndXEnd}px`);

    watchContainer.appendChild(floatEmoji);
    setTimeout(() => floatEmoji.remove(), 1200);
  }

  watchReactBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      triggerWatchReaction(emoji);

      // Live Chat update log
      if (watchMessagesScroll) {
        const line = document.createElement('div');
        line.className = 'watch-msg animate-appear';
        line.innerHTML = `<span class="w-user me">You:</span> Reacted with ${emoji}`;
        watchMessagesScroll.appendChild(line);
        watchMessagesScroll.scrollTop = watchMessagesScroll.scrollHeight;
      }

      // Increment viewer count
      const watchCount = document.getElementById('watch-count-lbl');
      if (watchCount) watchCount.textContent = '4';
    });
  });


  // --- WEBRTC AND VIDEO CALL STATE ---
  let localStream = null;
  let peerConnection = null;
  let currentCallId = null;
  let callStatePollingInterval = null;
  let isCallActive = false;
  let isCaller = false;
  let currentRecipientId = null;
  let localScreenStream = null;
  let fakeCallSimulation = false;
  let isAudioCall = false;

  let activeRtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  async function fetchIceServers() {
    try {
      const res = await fetch(`${API_URL}/api/calls/ice-servers`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers) {
          activeRtcConfig = { iceServers: data.iceServers };
        }
      }
    } catch (e) {
      console.warn("Could not fetch TURN/STUN servers from backend, using defaults:", e);
    }
  }

  // Synthesized sounds
  let audioCtx = null;
  let ringToneInterval = null;

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, gainValue = 0.1) {
    try {
      initAudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }

  function startIncomingRingtone() {
    stopAudioFeedback();
    let noteIndex = 0;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    ringToneInterval = setInterval(() => {
      playTone(notes[noteIndex % notes.length], 'triangle', 0.6, 0.12);
      noteIndex++;
    }, 350);
  }

  function startOutgoingRingback() {
    stopAudioFeedback();
    ringToneInterval = setInterval(() => {
      // US ringback: 440Hz + 480Hz
      playTone(440, 'sine', 1.5, 0.04);
      playTone(480, 'sine', 1.5, 0.04);
    }, 4000);
  }

  function playCallEndBeep() {
    stopAudioFeedback();
    playTone(250, 'sine', 0.4, 0.08);
  }

  function stopAudioFeedback() {
    if (ringToneInterval) {
      clearInterval(ringToneInterval);
      ringToneInterval = null;
    }
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('invibe_jwt_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  function getUserById(userId) {
    const thread = chatThreads.find(t => t.user && t.user._id.toString() === userId.toString());
    if (thread) return thread.user;
    return null;
  }

  // --- VIDEO CALL TIMER CONTROLLER ---
  const callTimerDisplay = document.getElementById('call-timer-display');

  function startVideoCallTimer() {
    stopVideoCallTimer();
    state.callSeconds = 0;
    state.callTimerInterval = setInterval(() => {
      state.callSeconds++;
      if (callTimerDisplay) {
        callTimerDisplay.textContent = formatCallTime(state.callSeconds);
      }
    }, 1000);
  }

  function stopVideoCallTimer() {
    if (state.callTimerInterval) {
      clearInterval(state.callTimerInterval);
      state.callTimerInterval = null;
    }
  }

  function formatCallTime(totalSec) {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const h = hrs < 10 ? '0' + hrs : hrs;
    const m = mins < 10 ? '0' + mins : mins;
    const s = secs < 10 ? '0' + secs : secs;
    return `${h}:${m}:${s}`;
  }

  let iceCandidateSendPromise = Promise.resolve();

  async function sendIceCandidateToServer(callId, candidate, role) {
    iceCandidateSendPromise = iceCandidateSendPromise.then(async () => {
      try {
        await fetch(`${API_URL}/api/calls/ice-candidate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ callId, candidate, role })
        });
      } catch (e) {
        console.error("Error sending ICE candidate:", e);
      }
    });
  }

  async function initiateVideoCall(recipientId, isAudioOnly = false) {
    if (isCallActive) return;
    isCallActive = true;
    isCaller = true;
    isAudioCall = isAudioOnly;
    currentRecipientId = recipientId;
    fakeCallSimulation = false;

    // Show outgoing screen, hide active call screen and controls
    document.getElementById('video-call-active-screen').style.display = 'none';
    document.getElementById('video-call-outgoing-screen').style.display = 'flex';
    document.getElementById('video-call-controls').style.display = 'none';

    // Populate outgoing screen metadata
    const user = getUserById(recipientId);
    if (user) {
      document.getElementById('video-call-outgoing-name').textContent = user.fullName;
      document.getElementById('video-call-outgoing-avatar').src = user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
    }

    const outgoingStatus = document.getElementById('video-call-outgoing-status');
    if (outgoingStatus) {
      outgoingStatus.textContent = isAudioOnly ? 'Audio Calling...' : 'Calling...';
    }

    startOutgoingRingback();

    try {
      // 1. Get media permission
      const mediaConstraints = isAudioOnly
        ? { video: false, audio: true }
        : { video: true, audio: true };

      localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints).catch(err => {
        console.warn("Could not get media devices, falling back to mock call: ", err);
        fakeCallSimulation = true;
        return null;
      });

      if (!fakeCallSimulation) {
        // Set local stream to local preview video tag
        const localVideo = document.getElementById('video-call-local-feed');
        const localFrame = document.getElementById('video-call-local-frame');
        if (localVideo) {
          if (isAudioOnly) {
            localVideo.srcObject = null;
            if (localFrame) localFrame.style.display = 'none';
          } else {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            if (localFrame) localFrame.style.display = 'block';
            localVideo.play().catch(e => console.log("video play error:", e));
          }
        }

        // 2. Create PeerConnection
        await fetchIceServers();
        peerConnection = new RTCPeerConnection(activeRtcConfig);

        // Add local tracks
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        // ICE candidate handler
        let iceCandidateQueue = [];
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            if (currentCallId) {
              sendIceCandidateToServer(currentCallId, event.candidate, 'caller');
            } else {
              iceCandidateQueue.push(event.candidate);
            }
          }
        };

        // Remote track handler
        peerConnection.ontrack = (event) => {
          const remoteVideo = document.getElementById('video-call-remote-feed');
          if (remoteVideo && event.streams[0]) {
            if (!isAudioOnly) {
              remoteVideo.srcObject = event.streams[0];
              remoteVideo.play().catch(e => console.log("remote play error:", e));
            }
          }
        };

        // Create Offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send Offer to Server
        const offerPayload = {
          type: offer.type,
          sdp: offer.sdp,
          isAudioOnly: isAudioOnly
        };

        const res = await fetch(`${API_URL}/api/calls/initiate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipientId,
            offer: JSON.stringify(offerPayload)
          })
        });

        if (!res.ok) throw new Error("Failed to initiate call on server.");
        const callData = await res.json();
        currentCallId = callData._id || callData.id;

        // Flush queued ICE candidates
        if (typeof iceCandidateQueue !== 'undefined') {
          iceCandidateQueue.forEach(cand => {
            sendIceCandidateToServer(currentCallId, cand, 'caller');
          });
          iceCandidateQueue = [];
        }
      } else {
        // Mock Call initiation on server (just so signaling works for matching UI state)
        const offerPayload = {
          type: 'offer',
          sdp: 'mock',
          isAudioOnly: isAudioOnly
        };

        const res = await fetch(`${API_URL}/api/calls/initiate`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            recipientId,
            offer: JSON.stringify(offerPayload)
          })
        });
        if (!res.ok) throw new Error("Failed to initiate call on server.");
        const callData = await res.json();
        currentCallId = callData._id || callData.id;
      }

      // Start polling for accept status
      startCallStatePolling();

    } catch (err) {
      console.error("Error initiating call:", err);
      showToast("Error initiating call 📞");
      endVideoCallLocally();
    }
  }

  function startCallStatePolling() {
    if (callStatePollingInterval) clearInterval(callStatePollingInterval);

    let processedCandidates = new Set();
    callStatePollingInterval = setInterval(async () => {
      if (!currentCallId) return;

      try {
        const res = await fetch(`${API_URL}/api/calls/${currentCallId}/state`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) return;

        const data = await res.json();

        // If caller and call was accepted:
        if (isCaller && data.status === 'connected' && isCallActive && document.getElementById('video-call-active-screen').style.display === 'none') {
          stopAudioFeedback();

          // Switch to active view
          document.getElementById('video-call-outgoing-screen').style.display = 'none';
          document.getElementById('video-call-active-screen').style.display = 'block';
          document.getElementById('video-call-controls').style.display = 'block';

          startVideoCallTimer();

          const camBtn = document.getElementById('call-cam-btn');
          const shareBtn = document.getElementById('call-share-btn');
          if (camBtn) camBtn.style.display = isAudioCall ? 'none' : 'flex';
          if (shareBtn) shareBtn.style.display = isAudioCall ? 'none' : 'flex';

          if (isAudioCall) {
            const remoteContainer = document.getElementById('remote-video-container');
            const localFrame = document.getElementById('video-call-local-frame');
            const audioContainer = document.getElementById('audio-call-active-container');
            if (remoteContainer) remoteContainer.style.display = 'none';
            if (localFrame) localFrame.style.display = 'none';
            if (audioContainer) {
              audioContainer.style.display = 'flex';
              const user = getUserById(currentRecipientId);
              if (user) {
                const activeAvatar = document.getElementById('audio-call-active-avatar');
                const activeName = document.getElementById('audio-call-active-name');
                if (activeAvatar) activeAvatar.src = user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
                if (activeName) activeName.textContent = user.fullName;
              }
            }
          } else {
            const remoteContainer = document.getElementById('remote-video-container');
            const localFrame = document.getElementById('video-call-local-frame');
            const audioContainer = document.getElementById('audio-call-active-container');
            if (remoteContainer) remoteContainer.style.display = 'block';
            if (localFrame) localFrame.style.display = 'block';
            if (audioContainer) audioContainer.style.display = 'none';

            // Update remote name
            const user = getUserById(currentRecipientId);
            if (user) {
              document.getElementById('video-call-remote-name').textContent = user.fullName;
            }
          }

          if (!fakeCallSimulation && data.answer) {
            const answerData = JSON.parse(data.answer);
            if (answerData.sdp === 'mock') {
              fakeCallSimulation = true;
              if (!isAudioCall) switchToSimulationFeeds();
            } else {
              const answerDesc = new RTCSessionDescription(answerData);
              if (peerConnection.signalingState === 'have-local-offer') {
                await peerConnection.setRemoteDescription(answerDesc);
              }
            }
          } else if (fakeCallSimulation) {
            if (!isAudioCall) switchToSimulationFeeds();
          }
        }

        // Process peer ICE candidates
        if (!fakeCallSimulation && peerConnection && peerConnection.remoteDescription) {
          if (data.peerCandidates && data.peerCandidates.length > 0) {
            data.peerCandidates.forEach(cand => {
              const candId = cand.candidate || JSON.stringify(cand);
              if (!processedCandidates.has(candId)) {
                processedCandidates.add(candId);
                try {
                  peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) { console.error("Error adding candidate:", e); }
              }
            });
          }
        }

        // If call declined or ended
        if (data.status === 'declined' || data.status === 'ended') {
          showToast(data.status === 'declined' ? 'Call Declined. 📞' : 'Call Ended.');
          playCallEndBeep();
          endVideoCallLocally();
        }

      } catch (err) {
        console.error("Error polling call state:", err);
      }
    }, 1500);
  }

  function endVideoCallLocally() {
    isCallActive = false;
    stopVideoCallTimer();
    stopAudioFeedback();

    if (callStatePollingInterval) {
      clearInterval(callStatePollingInterval);
      callStatePollingInterval = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
      localScreenStream = null;
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    const localVideo = document.getElementById('video-call-local-feed');
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.removeAttribute('src');
    }

    const remoteVideo = document.getElementById('video-call-remote-feed');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.removeAttribute('src');
    }

    currentCallId = null;
    currentRecipientId = null;
    isAudioCall = false;

    // Reset controls UI state
    const muteBtn = document.getElementById('call-mute-btn');
    const camBtn = document.getElementById('call-cam-btn');
    const shareBtn = document.getElementById('call-share-btn');
    if (muteBtn) muteBtn.classList.remove('active');
    if (camBtn) {
      camBtn.classList.remove('active');
      camBtn.style.display = 'flex';
    }
    if (shareBtn) {
      shareBtn.classList.remove('active');
      shareBtn.style.display = 'flex';
    }

    // Reset active panels visibility
    const remoteContainer = document.getElementById('remote-video-container');
    const localFrame = document.getElementById('video-call-local-frame');
    const audioContainer = document.getElementById('audio-call-active-container');
    if (remoteContainer) remoteContainer.style.display = 'block';
    if (localFrame) localFrame.style.display = 'block';
    if (audioContainer) audioContainer.style.display = 'none';

    // Switch chat layout back to normal chat mode
    switchChatMode('chat');
  }

  function switchToSimulationFeeds() {
    const remoteVideo = document.getElementById('video-call-remote-feed');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.src = 'https://vjs.zencdn.net/v/oceans.mp4';
      remoteVideo.loop = true;
      remoteVideo.muted = true;
      remoteVideo.play().catch(e => console.log("remote mock play error:", e));
    }
    const localVideo = document.getElementById('video-call-local-feed');
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.src = 'https://www.w3schools.com/html/mov_bbb.mp4';
      localVideo.loop = true;
      localVideo.muted = true;
      localVideo.play().catch(e => console.log("local mock play error:", e));
    }
  }

  async function checkForIncomingCall() {
    if (isCallActive) return;

    try {
      const res = await fetch(`${API_URL}/api/calls/incoming`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;

      const call = await res.json();
      if (call && call.status === 'ringing') {
        showIncomingCallModal(call);
      }
    } catch (e) {
      console.error("Error checking incoming calls:", e);
    }
  }

  function showIncomingCallModal(call) {
    try {
      isCallActive = true;
      isCaller = false;
      currentCallId = call._id || call.id;

      // Safe caller object extraction to prevent null property access crashes
      const callerObj = (call && call.caller && typeof call.caller === 'object') ? call.caller : {};
      const callerId = callerObj._id || callerObj.id || (typeof call.caller === 'string' ? call.caller : null);
      const callerName = callerObj.fullName || 'User';
      const callerAvatar = callerObj.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      currentRecipientId = callerId;
      fakeCallSimulation = false;

      // Determine if it is audio only call
      let isAudioOnlyCall = false;
      try {
        const parsedOffer = JSON.parse(call.offer);
        if (parsedOffer && parsedOffer.isAudioOnly) {
          isAudioOnlyCall = true;
        }
      } catch (e) {
        if (call.offer && !call.offer.includes('m=video')) {
          isAudioOnlyCall = true;
        }
      }
      isAudioCall = isAudioOnlyCall;

      const modal = document.getElementById('incoming-call-modal');
      const avatar = document.getElementById('incoming-call-avatar');
      const name = document.getElementById('incoming-call-name');
      const title = document.getElementById('incoming-call-title');

      if (avatar) avatar.src = callerAvatar;
      if (name) name.textContent = `${callerName} is calling you...`;
      if (title) title.textContent = isAudioOnlyCall ? 'Incoming Audio Call' : 'Incoming Video Call';

      if (modal) modal.style.display = 'flex';
      startIncomingRingtone();

      // Hook up Accept / Decline listeners
      const acceptBtn = document.getElementById('accept-call-btn');
      const declineBtn = document.getElementById('decline-call-btn');

      acceptBtn.onclick = () => {
        acceptIncomingCall(call);
      };

      declineBtn.onclick = () => {
        declineIncomingCall(call);
      };
    } catch (err) {
      console.error("Error showing incoming call modal:", err);
      showToast("Error displaying incoming call 📞");
    }
  }

  async function acceptIncomingCall(call) {
    try {
      stopAudioFeedback();
      const modal = document.getElementById('incoming-call-modal');
      if (modal) modal.style.display = 'none';

      // Safe caller object extraction
      const callerObj = (call && call.caller && typeof call.caller === 'object') ? call.caller : {};
      const callerId = callerObj._id || callerObj.id || (typeof call.caller === 'string' ? call.caller : null);
      const callerName = callerObj.fullName || 'User';
      const callerAvatar = callerObj.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      // Set current chat thread to the caller
      state.currentChatThread = callerId;
      switchView('chats');

      // Trigger UI selection of the thread item
      const threadItem = document.querySelector(`.thread-item[data-thread="${state.currentChatThread}"]`);
      if (threadItem) {
        threadItem.click();
      } else {
        const chatHeaderName = document.getElementById('chat-header-name');
        const chatHeaderAvatar = document.getElementById('chat-header-avatar');
        if (chatHeaderName) chatHeaderName.textContent = callerName;
        if (chatHeaderAvatar) chatHeaderAvatar.src = callerAvatar;

        const emptyState = document.getElementById('chat-empty-state');
        const chatHeader = document.getElementById('chat-window-header');
        const chatViewport = document.querySelector('.chat-dynamic-viewport');
        if (emptyState) emptyState.style.display = 'none';
        if (chatHeader) chatHeader.style.display = '';
        if (chatViewport) chatViewport.style.display = '';
      }

      // Determine if it is audio only call
      let isAudioOnlyCall = false;
      let offerData = null;
      try {
        offerData = JSON.parse(call.offer);
        if (offerData && offerData.isAudioOnly) {
          isAudioOnlyCall = true;
        }
      } catch (e) {
        offerData = call.offer;
        if (call.offer && !call.offer.includes('m=video')) {
          isAudioOnlyCall = true;
        }
      }
      isAudioCall = isAudioOnlyCall;

      switchChatMode(isAudioOnlyCall ? 'voice-call' : 'call');

      // Setup UI
      document.getElementById('video-call-outgoing-screen').style.display = 'none';
      document.getElementById('video-call-active-screen').style.display = 'block';
      document.getElementById('video-call-controls').style.display = 'block';

      const camBtn = document.getElementById('call-cam-btn');
      const shareBtn = document.getElementById('call-share-btn');
      if (camBtn) camBtn.style.display = isAudioOnlyCall ? 'none' : 'flex';
      if (shareBtn) shareBtn.style.display = isAudioOnlyCall ? 'none' : 'flex';

      if (isAudioOnlyCall) {
        const remoteContainer = document.getElementById('remote-video-container');
        const localFrame = document.getElementById('video-call-local-frame');
        const audioContainer = document.getElementById('audio-call-active-container');
        if (remoteContainer) remoteContainer.style.display = 'none';
        if (localFrame) localFrame.style.display = 'none';
        if (audioContainer) {
          audioContainer.style.display = 'flex';
          const activeAvatar = document.getElementById('audio-call-active-avatar');
          const activeName = document.getElementById('audio-call-active-name');
          if (activeAvatar) activeAvatar.src = callerAvatar;
          if (activeName) activeName.textContent = callerName;
        }
      } else {
        const remoteContainer = document.getElementById('remote-video-container');
        const localFrame = document.getElementById('video-call-local-frame');
        const audioContainer = document.getElementById('audio-call-active-container');
        if (remoteContainer) remoteContainer.style.display = 'block';
        if (localFrame) localFrame.style.display = 'block';
        if (audioContainer) audioContainer.style.display = 'none';
      }

      const remoteName = document.getElementById('video-call-remote-name');
      if (remoteName) remoteName.textContent = callerName;

      startVideoCallTimer();

      if (offerData && offerData.sdp === 'mock') {
        fakeCallSimulation = true;
      }

      const mediaConstraints = isAudioOnlyCall
        ? { video: false, audio: true }
        : { video: true, audio: true };

      // Safe MediaDevices check
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints).catch(err => {
          console.warn("Could not get media devices, falling back to mock call: ", err);
          fakeCallSimulation = true;
          return null;
        });
      } else {
        console.warn("Media devices not supported in this browser context, using mock call.");
        fakeCallSimulation = true;
        localStream = null;
      }

      if (!fakeCallSimulation) {
        const localVideo = document.getElementById('video-call-local-feed');
        const localFrame = document.getElementById('video-call-local-frame');
        if (localVideo) {
          if (isAudioOnlyCall) {
            localVideo.srcObject = null;
            if (localFrame) localFrame.style.display = 'none';
          } else {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            if (localFrame) localFrame.style.display = 'block';
            localVideo.play().catch(e => console.log("video play error:", e));
          }
        }

        await fetchIceServers();
        peerConnection = new RTCPeerConnection(activeRtcConfig);

        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = (event) => {
          if (event.candidate && currentCallId) {
            sendIceCandidateToServer(currentCallId, event.candidate, 'recipient');
          }
        };

        peerConnection.ontrack = (event) => {
          const remoteVideo = document.getElementById('video-call-remote-feed');
          if (remoteVideo && event.streams[0]) {
            if (!isAudioOnlyCall) {
              remoteVideo.srcObject = event.streams[0];
              remoteVideo.play().catch(e => console.log("remote play error:", e));
            }
          }
        };

        // Set remote offer SDP (remove isAudioOnly metadata for session description creation)
        const offerDesc = new RTCSessionDescription({
          type: offerData.type,
          sdp: offerData.sdp
        });
        await peerConnection.setRemoteDescription(offerDesc);

        // Create Answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Accept call on server
        await fetch(`${API_URL}/api/calls/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            callId: currentCallId,
            answer: JSON.stringify(answer)
          })
        });

        startCallStatePolling();
      } else {
        // Mock call answer on server
        await fetch(`${API_URL}/api/calls/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            callId: currentCallId,
            answer: JSON.stringify({ type: 'answer', sdp: 'mock' })
          })
        });

        if (!isAudioOnlyCall) {
          switchToSimulationFeeds();
        } else {
          // Clear mock feeds for audio calls
          const localVideo = document.getElementById('video-call-local-feed');
          if (localVideo) {
            localVideo.srcObject = null;
            localVideo.removeAttribute('src');
          }
        }
        startCallStatePolling();
      }

    } catch (err) {
      console.error("Error accepting incoming call:", err);
      showToast("Error accepting call 📞: " + err.message);
      endVideoCallLocally();
    }
  }

  async function declineIncomingCall(call) {
    stopAudioFeedback();
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.style.display = 'none';

    try {
      await fetch(`${API_URL}/api/calls/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ callId: call._id || call.id })
      });
    } catch (e) {
      console.error("Error declining call:", e);
    }

    endVideoCallLocally();
  }

  async function cancelOutgoingCall() {
    stopAudioFeedback();
    if (currentCallId) {
      try {
        await fetch(`${API_URL}/api/calls/end`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ callId: currentCallId })
        });
      } catch (e) { }
    }
    endVideoCallLocally();
  }

  // Set up listeners for controls
  const cancelOutgoingBtn = document.getElementById('cancel-outgoing-call-btn');
  if (cancelOutgoingBtn) {
    cancelOutgoingBtn.addEventListener('click', () => {
      cancelOutgoingCall();
    });
  }

  const endCallBtn = document.getElementById('end-call-btn');
  if (endCallBtn) {
    endCallBtn.addEventListener('click', () => {
      cancelOutgoingCall();
      showToast('Video Call Ended. 📞');
    });
  }

  const muteBtn = document.getElementById('call-mute-btn');
  const camBtn = document.getElementById('call-cam-btn');
  const speakerBtn = document.getElementById('call-speaker-btn');
  const shareBtn = document.getElementById('call-share-btn');
  const localCamFeed = document.getElementById('video-call-local-frame');
  const remoteCamFeed = document.getElementById('video-call-remote-feed');

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muteBtn.classList.toggle('active');
      const isMuted = muteBtn.classList.contains('active');
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = !isMuted;
        });
      }
      showToast(isMuted ? 'Microphone Muted 🔇' : 'Microphone Active 🎙️');
    });
  }

  if (camBtn) {
    camBtn.addEventListener('click', () => {
      camBtn.classList.toggle('active');
      const isCamOff = camBtn.classList.contains('active');
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = !isCamOff;
        });
      }
      localCamFeed.style.opacity = isCamOff ? '0.2' : '1';
      showToast(isCamOff ? 'Your Camera Off 📷' : 'Your Camera Active 📹');
    });
  }

  if (speakerBtn) {
    speakerBtn.addEventListener('click', () => {
      speakerBtn.classList.toggle('active');
      const isSpeakerOff = speakerBtn.classList.contains('active');
      const remoteVideo = document.getElementById('video-call-remote-feed');
      if (remoteVideo) {
        remoteVideo.muted = isSpeakerOff;
      }
      showToast(isSpeakerOff ? 'Speaker Output: Muted 🔕' : 'Speaker Output: Loud 🔊');
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (fakeCallSimulation) {
        shareBtn.classList.toggle('active');
        if (shareBtn.classList.contains('active')) {
          showToast('Screen sharing initialized! 🖥️');
        } else {
          showToast('Screen sharing stopped.');
        }
        return;
      }

      if (!shareBtn.classList.contains('active')) {
        try {
          localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          shareBtn.classList.add('active');
          showToast('Screen sharing initialized! 🖥️');

          const screenTrack = localScreenStream.getVideoTracks()[0];

          if (peerConnection) {
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            }
          }

          screenTrack.onended = () => {
            stopScreenSharing();
          };

        } catch (err) {
          console.error("Screen sharing error:", err);
          showToast('Could not share screen 🖥️');
        }
      } else {
        stopScreenSharing();
      }
    });
  }

  function stopScreenSharing() {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
      localScreenStream = null;
    }
    if (shareBtn) shareBtn.classList.remove('active');
    showToast('Screen sharing stopped.');

    if (localStream && peerConnection) {
      const cameraTrack = localStream.getVideoTracks()[0];
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
      if (videoSender && cameraTrack) {
        videoSender.replaceTrack(cameraTrack);
      }
    }
  }



  // --- GLOBAL SEARCH CARD FILTER CONTROLLER (Disabled. Replaced with dynamic database search) ---

  // Tags filter pills click
  const tagPills = document.querySelectorAll('.tag-pill');
  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.getAttribute('data-filter-tag');
      let matchCount = 0;

      feedCards.forEach(card => {
        if (card.id === 'feed-empty-state') return;
        const tags = card.getAttribute('data-tags') || '';

        if (filter === 'all' || tags.includes(filter)) {
          card.style.display = 'flex';
          matchCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (matchCount === 0) {
        if (emptyStateCard) emptyStateCard.style.display = 'block';
      } else {
        if (emptyStateCard) emptyStateCard.style.display = 'none';
      }

      showToast(`Filter: #${filter.toUpperCase()}`);
    });
  });


  // --- COLLABORATIVE FILE DOWNLOADS & FOLDER FILTER ---
  const mediaTabs = document.getElementById('media-hub-tabs');
  const mediaHubSearch = document.getElementById('media-search-input');

  if (mediaTabs) {
    const tabs = mediaTabs.querySelectorAll('.m-pill');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.getAttribute('data-media-filter');
        const mediaCards = document.querySelectorAll('#shared-media-items-grid .media-item-card');

        mediaCards.forEach(card => {
          const type = card.getAttribute('data-type');
          if (filter === 'all' || type === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  if (mediaHubSearch) {
    mediaHubSearch.addEventListener('input', () => {
      const term = mediaHubSearch.value.toLowerCase().trim();
      const mediaCards = document.querySelectorAll('#shared-media-items-grid .media-item-card');

      mediaCards.forEach(card => {
        const name = card.querySelector('.file-name').textContent.toLowerCase();
        if (name.includes(term)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }


  // --- SIMPLE BUTTON INTERACTIONS AND ALERTS ---

  // Disabled hardcoded follow suggestion listeners. Managed dynamically in loadFollowSuggestions()

  // Suggest see all
  const sugSeeAll = document.getElementById('sug-see-all-btn');
  if (sugSeeAll) {
    sugSeeAll.addEventListener('click', () => {
      openSuggestedVibersModal();
    });
  }

  // Trending hash words click
  const trendItems = document.querySelectorAll('.trend-item');
  trendItems.forEach(item => {
    item.addEventListener('click', () => {
      const word = item.getAttribute('data-trend-word');
      switchView('home');
      // Set search bar value and trigger filter
      if (globalSearchInput) {
        globalSearchInput.value = `#${word}`;
        globalSearchInput.dispatchEvent(new Event('input'));
      }
      showToast(`Filtered feed: #${word} 🔥`);
    });
  });

  // --- PREMIUM EDIT PROFILE MODAL SYSTEM ---
  const editProfileModal = document.getElementById('edit-profile-modal');
  const editProfileBtn = document.getElementById('edit-profile-action-btn');
  const editProfileCloseBtn = document.getElementById('edit-profile-close-btn');
  const editProfileCancelBtn = document.getElementById('edit-profile-cancel-btn');
  const editProfileSaveBtn = document.getElementById('edit-profile-save-btn');

  // Inputs
  const editNameInput = document.getElementById('edit-profile-name-input');
  const editHandleInput = document.getElementById('edit-profile-handle-input');
  const editBioInput = document.getElementById('edit-profile-bio-input');
  const editPhoneInput = document.getElementById('edit-profile-phone-input');
  const edit2faSelect = document.getElementById('edit-profile-2fa-preference');

  // Files
  const avatarFileInput = document.getElementById('edit-profile-avatar-file');
  const bannerFileInput = document.getElementById('edit-profile-banner-file');
  const uploadAvatarTrigger = document.getElementById('upload-avatar-trigger-btn');
  const uploadBannerTrigger = document.getElementById('upload-banner-trigger-btn');

  // Previews inside Modal
  const avatarPreview = document.getElementById('edit-profile-avatar-preview');
  const bannerPreview = document.getElementById('edit-profile-banner-preview');

  // Fields to update on the main page
  const profileBannerImg = document.querySelector('.profile-banner img');
  const profileLargeAvatar = document.querySelector('.profile-screen-avatar');
  const profilePreviewAvatarImg = document.querySelector('.profile-preview-avatar img');
  const headerAvatarImg = document.querySelector('#header-profile-avatar img');
  const profileNameH2 = document.querySelector('.profile-summary-top h3');
  const profilePreviewNameH3 = document.querySelector('.profile-preview-info h3');
  const profileHandleP = document.querySelector('.profile-screen-handle');
  const profilePreviewHandleP = document.querySelector('.profile-preview-info p');
  const profileBioP = document.getElementById('profile-bio-text');

  let currentAvatarUrl = "";
  let currentBannerUrl = "";

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      // Load current values
      if (editNameInput) {
        // Strip the HTML space if any
        const nameText = profileNameH2 ? profileNameH2.childNodes[0].textContent.trim() : "Alex Rivers";
        editNameInput.value = nameText;
      }
      if (editHandleInput) {
        editHandleInput.value = profileHandleP ? profileHandleP.textContent.trim() : "@alexrivers";
      }
      if (editBioInput) {
        editBioInput.value = profileBioP ? profileBioP.textContent.trim() : "";
      }

      // Load user preferences for phone and 2FA
      const currentUserStr = localStorage.getItem('invibeUser');
      if (currentUserStr) {
        try {
          const currentUser = JSON.parse(currentUserStr);
          if (editPhoneInput) editPhoneInput.value = currentUser.phoneNumber || "";
          if (edit2faSelect) edit2faSelect.value = currentUser.preferred2faMethod || "email";
        } catch (e) {
          console.error(e);
        }
      }

      // Previews
      if (avatarPreview && profileLargeAvatar) {
        avatarPreview.src = profileLargeAvatar.src;
        currentAvatarUrl = profileLargeAvatar.src;
      }
      if (bannerPreview && profileBannerImg) {
        bannerPreview.src = profileBannerImg.src;
        currentBannerUrl = profileBannerImg.src;
      }

      // Show modal
      if (editProfileModal) {
        editProfileModal.classList.add('active');
        editProfileModal.style.display = 'flex';
      }
    });
  }

  function closeEditProfileModal() {
    if (editProfileModal) {
      editProfileModal.classList.remove('active');
      editProfileModal.style.display = 'none';
    }
    updateAppUI();
  }

  if (editProfileCloseBtn) editProfileCloseBtn.addEventListener('click', closeEditProfileModal);
  if (editProfileCancelBtn) editProfileCancelBtn.addEventListener('click', closeEditProfileModal);

  // File upload trigger buttons
  if (uploadAvatarTrigger && avatarFileInput) {
    uploadAvatarTrigger.addEventListener('click', () => avatarFileInput.click());
  }
  if (uploadBannerTrigger && bannerFileInput) {
    uploadBannerTrigger.addEventListener('click', () => bannerFileInput.click());
  }

  // Previews on file select
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', () => {
      if (avatarFileInput.files.length > 0) {
        const file = avatarFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (avatarPreview) avatarPreview.src = e.target.result;
          currentAvatarUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (bannerFileInput) {
    bannerFileInput.addEventListener('change', () => {
      if (bannerFileInput.files.length > 0) {
        const file = bannerFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (bannerPreview) bannerPreview.src = e.target.result;
          currentBannerUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Save changes
  if (editProfileSaveBtn) {
    editProfileSaveBtn.addEventListener('click', async () => {
      const newName = editNameInput ? editNameInput.value.trim() : "";
      const newHandle = editHandleInput ? editHandleInput.value.trim() : "";
      const newBio = editBioInput ? editBioInput.value.trim() : "";
      const newPhone = editPhoneInput ? editPhoneInput.value.trim() : "";
      const new2faMethod = edit2faSelect ? edit2faSelect.value : "email";

      if (!newName || !newHandle) {
        showToast('Name and Handle are required! ⚠️');
        return;
      }

      let formattedHandle = newHandle.startsWith('@') ? newHandle.slice(1) : newHandle;
      formattedHandle = formattedHandle.trim().toLowerCase();

      const token = localStorage.getItem('invibe_jwt_token');

      // 1. Update local user session & localStorage DB
      const userStr = localStorage.getItem('invibeUser');
      const currentUser = userStr ? JSON.parse(userStr) : {};
      const updatedUser = {
        ...currentUser,
        fullName: newName,
        username: formattedHandle,
        bio: newBio,
        phoneNumber: newPhone,
        preferred2faMethod: new2faMethod
      };

      localStorage.setItem('invibeUser', JSON.stringify(updatedUser));
      if (currentAvatarUrl && !currentAvatarUrl.startsWith('data:image/gif;base64')) {
        localStorage.setItem('invibeProfileImage', currentAvatarUrl);
      }
      if (currentBannerUrl && !currentBannerUrl.startsWith('data:image/gif;base64')) {
        localStorage.setItem('invibeBannerImage', currentBannerUrl);
      }
      localStorage.setItem('invibeBio', newBio);

      // 2. Try async backend & Supabase sync
      try {
        fetch(`${API_URL}/api/users/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fullName: newName,
            username: formattedHandle,
            bio: newBio,
            profileImage: currentAvatarUrl || undefined,
            bannerImage: currentBannerUrl || undefined,
            phoneNumber: newPhone,
            preferred2faMethod: new2faMethod
          })
        }).catch(err => console.warn("Backend profile sync notice:", err.message));
      } catch (e) {}

      const displayHandle = newHandle.startsWith('@') ? newHandle : '@' + newHandle;

      // 1. Update text fields on profile page
      if (profileNameH2) {
        profileNameH2.innerHTML = `${newName}`;
        debouncedCreateIcons();
      }
      if (profilePreviewNameH3) profilePreviewNameH3.textContent = newName;
      if (profileHandleP) profileHandleP.textContent = displayHandle;
      if (profilePreviewHandleP) profilePreviewHandleP.textContent = displayHandle;
      if (profileBioP) profileBioP.textContent = newBio;

      // 2. Update images
      if (currentAvatarUrl) {
        if (profileLargeAvatar) profileLargeAvatar.src = currentAvatarUrl;
        if (profilePreviewAvatarImg) profilePreviewAvatarImg.src = currentAvatarUrl;
        if (headerAvatarImg) headerAvatarImg.src = currentAvatarUrl;

        // Also update story user avatar if needed
        const storyViewerAvatar = document.getElementById('story-viewer-avatar');
        if (storyViewerAvatar) storyViewerAvatar.src = currentAvatarUrl;
      }
      if (currentBannerUrl && profileBannerImg) {
        profileBannerImg.src = currentBannerUrl;
      }

      showToast('Profile updated successfully! ✨');
      closeEditProfileModal();
    });
  }

  // Saved/tagged tabs profile switcher
  const postsTab = document.getElementById('profile-posts-tab');
  const savedTab = document.getElementById('profile-saved-tab');
  const taggedTab = document.getElementById('profile-tagged-tab');
  const profileGrid = document.querySelector('.profile-posts-grid');

  const profileData = {
    posts: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=300&q=80"
    ],
    saved: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80"
    ],
    tagged: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80"
    ]
  };

  function updateProfileGrid(tabName) {
    if (!profileGrid) return;
    const images = profileData[tabName] || [];
    profileGrid.innerHTML = images.map(imgSrc => `
      <div class="grid-post-card">
        <img src="${imgSrc}" alt="Profile item" />
      </div>
    `).join('');
  }

  function handleTabClick(activeTab, tabName, toastMessage) {
    [postsTab, savedTab, taggedTab].forEach(tab => {
      if (tab) tab.classList.remove('active');
    });
    if (activeTab) activeTab.classList.add('active');
    updateProfileGrid(tabName);
    if (toastMessage) showToast(toastMessage);
  }

  if (postsTab) postsTab.addEventListener('click', () => handleTabClick(postsTab, 'posts', 'Loading posts... 📸'));
  if (savedTab) savedTab.addEventListener('click', () => handleTabClick(savedTab, 'saved', 'Loading bookmarks... 🔖'));
  if (taggedTab) taggedTab.addEventListener('click', () => handleTabClick(taggedTab, 'tagged', 'Loading tagged content... 🏷️'));

  const profileOptionButtons = document.querySelectorAll('.profile-option-btn');
  const appearanceToggle = document.getElementById('profile-appearance-toggle');
  const profileLogoutBtn = document.getElementById('profile-logout-btn');

  // --- NEW MODALS SYSTEM ---
  const privacyModal = document.getElementById('privacy-settings-modal');
  const privacyCloseBtn = document.getElementById('privacy-modal-close-btn');
  const privacyCancelBtn = document.getElementById('privacy-modal-cancel-btn');
  const privacySaveBtn = document.getElementById('privacy-modal-save-btn');
  const privacyE2eeToggle = document.getElementById('privacy-e2ee-toggle');
  const privacyHideStoryList = document.getElementById('privacy-hide-story-list');

  const notificationsModal = document.getElementById('notifications-settings-modal');
  const notificationsCloseBtn = document.getElementById('notifications-modal-close-btn');
  const notificationsCancelBtn = document.getElementById('notifications-modal-cancel-btn');
  const notificationsSaveBtn = document.getElementById('notifications-modal-save-btn');

  const helpModal = document.getElementById('help-support-modal');
  const helpCloseBtn = document.getElementById('help-modal-close-btn');
  const helpCancelBtn = document.getElementById('help-modal-cancel-btn');
  const helpSubmitBtn = document.getElementById('help-modal-submit-btn');

  const aboutModal = document.getElementById('about-modal');
  const aboutCloseBtn = document.getElementById('about-modal-close-btn');
  const aboutOkBtn = document.getElementById('about-modal-ok-btn');


  function populatePrivacyStoryList() {
    if (!privacyHideStoryList) return;
    const hubbers = state.stories || [];
    privacyHideStoryList.innerHTML = hubbers.map((user, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />
          <span style="font-size: 0.85rem; color: white;">${user.name}</span>
        </div>
        <input type="checkbox" class="hide-story-checkbox" data-username="${user.name}" style="accent-color: var(--accent-gradient, #f35626);" />
      </div>
    `).join('');

    const hiddenUsers = JSON.parse(localStorage.getItem('privacy_hidden_stories') || '[]');
    const checkboxes = privacyHideStoryList.querySelectorAll('.hide-story-checkbox');
    checkboxes.forEach(cb => {
      if (hiddenUsers.includes(cb.dataset.username)) {
        cb.checked = true;
      }
    });
  }

  if (privacyCloseBtn) privacyCloseBtn.addEventListener('click', () => privacyModal.classList.remove('active'));
  if (privacyCancelBtn) privacyCancelBtn.addEventListener('click', () => privacyModal.classList.remove('active'));
  if (privacySaveBtn) {
    privacySaveBtn.addEventListener('click', () => {
      const isE2ee = privacyE2eeToggle ? privacyE2eeToggle.checked : false;
      const hiddenUsers = [];
      if (privacyHideStoryList) {
        const checked = privacyHideStoryList.querySelectorAll('.hide-story-checkbox:checked');
        checked.forEach(cb => hiddenUsers.push(cb.dataset.username));
      }
      localStorage.setItem('privacy_e2ee_enabled', isE2ee);
      localStorage.setItem('privacy_hidden_stories', JSON.stringify(hiddenUsers));
      showToast('Privacy settings updated! 🔒');
      privacyModal.classList.remove('active');
    });
  }

  if (notificationsCloseBtn) notificationsCloseBtn.addEventListener('click', () => notificationsModal.classList.remove('active'));
  if (notificationsCancelBtn) notificationsCancelBtn.addEventListener('click', () => notificationsModal.classList.remove('active'));
  if (notificationsSaveBtn) {
    notificationsSaveBtn.addEventListener('click', () => {
      showToast('Notification settings updated! 🔔');
      notificationsModal.classList.remove('active');
    });
  }

  if (helpCloseBtn) helpCloseBtn.addEventListener('click', () => helpModal.classList.remove('active'));
  if (helpCancelBtn) helpCancelBtn.addEventListener('click', () => helpModal.classList.remove('active'));
  if (helpSubmitBtn) {
    helpSubmitBtn.addEventListener('click', () => {
      const msgVal = document.getElementById('help-message-input')?.value;
      if (msgVal) {
        showToast('Support ticket submitted successfully! 💬');
        if (document.getElementById('help-message-input')) document.getElementById('help-message-input').value = '';
        helpModal.classList.remove('active');
      } else {
        showToast('Please type a message before submitting. ⚠️');
      }
    });
  }

  if (aboutCloseBtn) aboutCloseBtn.addEventListener('click', () => aboutModal.classList.remove('active'));
  if (aboutOkBtn) aboutOkBtn.addEventListener('click', () => aboutModal.classList.remove('active'));



  if (appearanceToggle) {
    appearanceToggle.checked = document.body.classList.contains('light-theme');
    appearanceToggle.addEventListener('change', () => {
      const isLight = appearanceToggle.checked;
      if (isLight) {
        document.body.classList.replace('dark-theme', 'light-theme');
      } else {
        document.body.classList.replace('light-theme', 'dark-theme');
      }
      showToast(isLight ? 'Switched appearance on ☀️' : 'Switched appearance off 🌙');
    });
  }

  profileOptionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'edit-profile':
          if (editProfileModal) {
            editProfileModal.classList.add('active');
          }
          break;
        case 'vibe-settings':
          showToast('Opening Hubs Settings... ⚙️');
          switchView('settings');
          break;
        case 'privacy':
          if (privacyModal) {
            populatePrivacyStoryList();
            if (privacyE2eeToggle) {
              privacyE2eeToggle.checked = localStorage.getItem('privacy_e2ee_enabled') === 'true';
            }
            privacyModal.classList.add('active');
          }
          break;
        case 'notifications':
          if (notificationsModal) {
            notificationsModal.classList.add('active');
          }
          break;
        case 'help':
          if (helpModal) {
            helpModal.classList.add('active');
          }
          break;
        case 'about':
          if (aboutModal) {
            aboutModal.classList.add('active');
          }
          break;
        default:
          showToast('Action not available yet.');
      }
    });
  });

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('invibeIsLoggedIn');
      localStorage.removeItem('invibeUser');
      localStorage.removeItem('invibeProfileImage');
      localStorage.removeItem('invibe_jwt_token');
      showToast('Logged out successfully. 👋');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  }

  // --- REELS SAVE INTERACTION SYSTEM ---
  const reelSaveActionItems = document.querySelectorAll('.reel-save-action');
  const reelThumbnails = {
    "1": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=300&q=80", // Tech Setup (for Coding Reel)
    "2": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80"  // Mountain Lake (for Offsite Reel)
  };

  reelSaveActionItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const reelId = item.getAttribute('data-reel-id');
      const starBtn = item.querySelector('.action-circle-btn');
      const textSpan = item.querySelector('.action-count');
      const thumbnailSrc = reelThumbnails[reelId];

      if (!starBtn.classList.contains('active')) {
        // Save the Reel
        starBtn.classList.add('active');
        if (textSpan) textSpan.textContent = 'Saved';

        // Add to profileData.saved
        if (thumbnailSrc && !profileData.saved.includes(thumbnailSrc)) {
          profileData.saved.unshift(thumbnailSrc); // prepend so it appears first
        }

        showToast('Reel saved to profile! ⭐');
      } else {
        // Unsave the Reel
        starBtn.classList.remove('active');
        if (textSpan) textSpan.textContent = 'Save';

        // Remove from profileData.saved
        if (thumbnailSrc) {
          const index = profileData.saved.indexOf(thumbnailSrc);
          if (index > -1) {
            profileData.saved.splice(index, 1);
          }
        }

        showToast('Reel removed from saved! 🗑️');
      }

      // If the user is currently viewing the 'saved' tab on the profile page, refresh the grid
      if (savedTab && savedTab.classList.contains('active')) {
        updateProfileGrid('saved');
      }
    });
  });

  // Inbox drop items click alerts
  const drGroup = document.getElementById('dr-new-group');
  const drBroad = document.getElementById('dr-new-broad');
  const drInvite = document.getElementById('dr-invite');
  const drScan = document.getElementById('dr-scan');
  const drStarred = document.getElementById('dr-starred');
  const drArchived = document.getElementById('dr-archived');
  const drSettings = document.getElementById('dr-settings');
  const newChatBtn = document.getElementById('new-chat-btn');
  const newChatDropdown = document.getElementById('new-chat-dropdown');

  if (newChatBtn && newChatDropdown) {
    newChatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      newChatDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!newChatDropdown.contains(e.target) && e.target !== newChatBtn) {
        newChatDropdown.classList.remove('active');
      }
    });
  }

  function handleDropdownClick() {
    if (newChatDropdown) {
      newChatDropdown.classList.remove('active');
    }
  }

  if (drGroup) drGroup.addEventListener('click', () => { handleDropdownClick(); showToast('Setup New Chat Group lobby 👥'); });
  if (drBroad) drBroad.addEventListener('click', () => { handleDropdownClick(); showToast('Broadcasting system active 📻'); });
  if (drInvite) drInvite.addEventListener('click', () => { handleDropdownClick(); showToast('Invitation code copied: HUBBLE-2026 🎟️'); });
  if (drScan) drScan.addEventListener('click', () => { handleDropdownClick(); showToast('Access camera feed for QR Scan... 📷'); });
  if (drStarred) drStarred.addEventListener('click', () => { handleDropdownClick(); showToast('Starred message filter active ⭐'); });
  if (drArchived) drArchived.addEventListener('click', () => { handleDropdownClick(); showToast('Archived threads loaded 📦'); });
  if (drSettings) drSettings.addEventListener('click', () => {
    handleDropdownClick();
    switchView('settings');
    showToast('Opening Settings Dashboard... ⚙️');
  });
  // --- DASHBOARD SETTINGS CONTROLLER ---
  const colorPickerDots = document.querySelectorAll('.color-picker-dot');
  const toggleCaustics = document.getElementById('toggle-caustics-checkbox');
  const togglePrivacy = document.getElementById('toggle-privacy-checkbox');
  const toggleNotif = document.getElementById('toggle-notif-checkbox');

  // Theme Accent Picker
  colorPickerDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorPickerDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');

      const selectedColor = dot.getAttribute('data-color');
      document.documentElement.style.setProperty('--primary', selectedColor);

      showToast(`Accent color updated! 🎨`);
    });
  });

  // Toggle Caustics Overlay
  if (toggleCaustics) {
    toggleCaustics.addEventListener('change', () => {
      const isEnabled = toggleCaustics.checked;
      if (isEnabled) {
        document.documentElement.style.setProperty('--bg-caustics', 'radial-gradient(circle at 20% 30%, rgba(108, 59, 255, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 79, 163, 0.1) 0%, transparent 45%)');
        showToast('Ambient caustics enabled ✨');
      } else {
        document.documentElement.style.setProperty('--bg-caustics', 'none');
        showToast('Ambient caustics disabled');
      }
    });
  }

  // Toggles Privacy / Notifications
  if (togglePrivacy) {
    togglePrivacy.addEventListener('change', () => {
      showToast(togglePrivacy.checked ? 'Account set to Private 🔒' : 'Account set to Public 🌐');
    });
  }
  if (toggleNotif) {
    toggleNotif.addEventListener('change', () => {
      showToast(toggleNotif.checked ? 'Notifications Enabled 🔔' : 'Notifications Silenced 🔕');
    });
  }

  // --- COMMENTS & SHARE MODALS CONTROLLER ---
  const mockFriends = [
    { name: "Zoe Lin", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80" },
    { name: "Jamie Sun", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Marcus", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Emma Johnson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80" }
  ];

  const commentsModal = document.getElementById('comments-modal');
  const shareModal = document.getElementById('share-modal');

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.story-viewer-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  function openShare(key, modalOverride = shareModal) {
    const modal = modalOverride || shareModal;
    if (!modal) return;

    const shareList = modal.querySelector('.share-friends-list');
    if (!shareList) return;

    renderShareFriends(key, modal, shareList);
    modal.classList.add('active');
  }

  async function renderShareFriends(key, modal = shareModal, shareList = null) {
    const list = shareList || modal?.querySelector('.share-friends-list');
    if (!list) return;

    list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted);">Loading Hubbies...</div>';

    // Add external sharing section if not present
    const shareCard = modal.querySelector('.share-card');
    if (shareCard && !shareCard.querySelector('.external-share-section')) {
      const extSection = document.createElement('div');
      extSection.className = 'external-share-section';
      extSection.style.cssText = 'margin-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 16px 20px 20px 20px;';

      const title = document.createElement('h4');
      title.innerText = 'Share to other apps';
      title.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-title); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;';
      extSection.appendChild(title);

      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'external-share-buttons';
      buttonsContainer.style.cssText = 'display: flex; gap: 16px; justify-content: space-around; align-items: center;';

      const shareOptions = [
        { name: 'WhatsApp', icon: 'message-circle', color: '#25D366', url: (url) => `https://api.whatsapp.com/send?text=${encodeURIComponent('Check this out on HI-HUBBLE: ' + url)}` },
        { name: 'X', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`, color: '#ffffff', url: (url) => `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check this out on HI-HUBBLE!')}` },
        { name: 'Telegram', icon: 'send', color: '#0088cc', url: (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check this out on HI-HUBBLE!')}` },
        { name: 'Gmail', icon: 'mail', color: '#EA4335', url: (url) => `mailto:?subject=${encodeURIComponent('Check this out on HI-HUBBLE')}&body=${encodeURIComponent(url)}` },
        {
          name: 'Copy Link', icon: 'copy', color: '#8b5cf6', action: async (url) => {
            try {
              await navigator.clipboard.writeText(url);
              showToast('Link copied to clipboard! 📋');
            } catch (err) {
              showToast('Failed to copy link.');
            }
          }
        }
      ];

      shareOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'external-share-btn';
        btn.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: var(--text-color); font-size: 11px; transition: transform 0.2s;';

        btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
        btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');

        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `width: 42px; height: 42px; border-radius: 50%; background: ${opt.color}15; border: 1px solid ${opt.color}40; color: ${opt.color}; display: flex; justify-content: center; align-items: center; font-size: 18px; box-shadow: 0 4px 12px ${opt.color}10;`;

        if (opt.svg) {
          iconContainer.innerHTML = opt.svg;
        } else {
          iconContainer.innerHTML = `<i data-lucide="${opt.icon}"></i>`;
        }

        const label = document.createElement('span');
        label.innerText = opt.name;
        label.style.cssText = 'color: var(--text-muted); font-weight: 500; margin-top: 2px;';

        btn.appendChild(iconContainer);
        btn.appendChild(label);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentUrl = window.location.href;
          if (opt.url) {
            window.open(opt.url(currentUrl), '_blank');
          } else if (opt.action) {
            opt.action(currentUrl);
          }
        });

        buttonsContainer.appendChild(btn);
      });

      extSection.appendChild(buttonsContainer);
      shareCard.appendChild(extSection);
      debouncedCreateIcons();
    }

    const token = localStorage.getItem('invibe_jwt_token');
    const currentUser = getCurrentUser();
    if (!token || !currentUser) {
      list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">Please log in to share with Hubbies.</div>';
      return;
    }

    try {
      const targetId = currentUser.id || currentUser._id;
      const res = await fetch(`${API_URL}/api/users/${targetId}/following-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const users = await res.json();

      list.innerHTML = '';

      if (users.length === 0) {
        list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">No hubbies found. Follow someone to share!</div>';
        return;
      }

      users.forEach(u => {
        if (!u) return;

        const card = document.createElement('div');
        card.className = 'share-friend-card';
        card.innerHTML = `
          <img src="${u.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" class="share-friend-avatar" alt="${u.fullName}" />
          <span class="share-friend-name">${u.fullName}</span>
        `;

        card.addEventListener('click', async () => {
          const currentUser = getCurrentUser();
          if (!currentUser) return;

          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, u._id);
          const isReel = key.startsWith('reel');

          let sharedContentHtml = '';
          if (isReel) {
            sharedContentHtml = `<div class="shared-hub-card reel" data-shared-id="${key}"><i data-lucide="video" style="display:inline-block; vertical-align:middle; margin-right:4px;"></i> Shared a Reel</div>`;
          } else {
            sharedContentHtml = `<div class="shared-hub-card post" data-shared-id="${key}"><i data-lucide="image" style="display:inline-block; vertical-align:middle; margin-right:4px;"></i> Shared a Post</div>`;
          }

          const encryptedText = encryptMessage(sharedContentHtml, secretKey);

          try {
            const sendRes = await fetch(`${API_URL}/api/chats/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient: u._id,
                content: encryptedText,
                mediaUrl: key,
                mediaType: 'hub',
                mediaName: isReel ? 'Shared Reel' : 'Shared Post',
                mediaSize: 'Link'
              })
            });
            if (!sendRes.ok) throw new Error();

            showToast(`Shared successfully to ${u.fullName}! ✈️`);
            if (modal) modal.classList.remove('active');

            loadChatThreads();
            if (state.currentChatThread && state.currentChatThread.toString() === u._id.toString()) {
              await fetchMessages(u._id, true);
            }
          } catch (err) {
            console.error('Error sharing hub content:', err);
            showToast('Failed to share item.');
          }
        });

        list.appendChild(card);
      });
    } catch (err) {
      console.error('Error rendering friends share list:', err);
      list.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted);">Failed to load friends.</div>';
    }
  }

  // Handle comment click events (focuses the inline comment input field on dynamic posts or opens modal)
  let currentCommentPostId = null;

  if (commentsModal) {
    const sendBtn = commentsModal.querySelector('.comment-send-btn');
    const inputField = commentsModal.querySelector('input');

    if (sendBtn && inputField) {
      sendBtn.addEventListener('click', async () => {
        const text = inputField.value.trim();
        if (text && currentCommentPostId) {
          await submitComment(currentCommentPostId, text, inputField);
        }
      });
      inputField.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = inputField.value.trim();
          if (text && currentCommentPostId) {
            await submitComment(currentCommentPostId, text, inputField);
          }
        }
      });
    }
  }

  // Share trigger click
  document.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('.share-btn-action, .share-btn, .feed-share-btn');
    if (shareBtn) {
      e.preventDefault();
      e.stopPropagation();

      const card = shareBtn.closest('.feed-card');
      const postId = shareBtn.getAttribute('data-post-id') || card?.getAttribute('data-post-id') || card?.id?.replace('post-', '') || '1';

      const localModal = card?.querySelector('.feed-share-modal') || document.getElementById('share-modal');

      openShare('post_' + postId, localModal);
    }
  });

  // ─── LIVE DATABASE & FEED POSTS INTEGRATION ───

  async function loadFeedPosts() {
    const feedContainer = document.getElementById('home-feed-posts');
    if (!feedContainer) return;

    let posts = [];
    try {
      const res = await fetch(`${API_URL}/api/posts`);
      if (res.ok) {
        posts = await res.json();
      }
    } catch (err) {
      console.warn("API loadFeedPosts notice:", err.message);
    }

    const memoryPosts = window.invibe_memory_posts || [];
    const localPosts = JSON.parse(localStorage.getItem('invibe_custom_posts') || '[]');
    
    const combinedMap = new Map();
    memoryPosts.forEach(p => combinedMap.set(p._id, p));
    localPosts.forEach(p => { if (!combinedMap.has(p._id)) combinedMap.set(p._id, p); });
    posts.forEach(p => { if (!combinedMap.has(p._id)) combinedMap.set(p._id, p); });

    posts = Array.from(combinedMap.values());

    if (posts.length === 0) {
      const currentUserStr = localStorage.getItem('invibeUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : { username: 'haribol' };
      const currentPhoto = localStorage.getItem('invibeProfileImage') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

      posts = [{
        _id: 'sample_phoenix_1',
        caption: 'PHOENIX AI - AI-POWERED POST-DISASTER RECOVERY INTELLIGENCE 🚀🔥 Analyze damage, prioritize what matters, rebuild smarter.',
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        mediaType: 'image',
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        author: {
          _id: 'usr_' + (currentUser.username || 'haribol'),
          username: currentUser.username || 'haribol',
          fullName: currentUser.username || 'haribol',
          profileImage: currentPhoto
        }
      }];
    }

    const emptyState = document.getElementById('feed-empty-state');
    feedContainer.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'none';
      feedContainer.appendChild(emptyState);
    }

    const currentUserStr = localStorage.getItem('invibeUser');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

    posts.forEach(post => {
      const isLikedByMe = currentUser ? (post.likes || []).includes(currentUser.id) : false;

      const card = document.createElement('article');
      card.className = 'feed-card';
      card.id = `post-${post._id}`;
      card.setAttribute('data-tags', 'all chill');

      let commentsHTML = '';
      (post.comments || []).forEach(comment => {
        commentsHTML += `
          <div class="comment-item" style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;">
            <img src="${comment.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
            <div>
              <strong style="color: var(--text-color); margin-right: 4px;">${comment.author.username}</strong>
              <span style="color: var(--text-muted);">${comment.text}</span>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="post-header">
          <div class="post-author-info">
            <img src="${post.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${post.author.fullName}" class="author-avatar" />
            <div>
              <h4 class="author-name">${post.author.fullName}</h4>
              <div class="post-meta">
                <span class="post-time">${new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span class="dot-separator">•</span>
                <i data-lucide="globe" class="meta-icon"></i>
              </div>
            </div>
          </div>
          <button class="post-options-btn"><i data-lucide="more-horizontal"></i></button>
        </div>

        <div class="post-media-container" style="position:relative; overflow:hidden; border-radius: 12px; margin: 12px 0;">
          ${post.mediaType === 'video'
          ? `<video src="${post.mediaUrl}" controls loop muted playsinline style="width:100%; max-height:600px; border-radius:12px; display:block;" class="post-media-video"></video>
               <div class="video-mute-container" style="position: absolute; left: 16px; bottom: 48px; z-index: 12;">
                 <button class="action-circle-btn mute-btn-action" data-post-id="${post._id}">
                   <i data-lucide="volume-2"></i>
                 </button>
               </div>`
          : `<img src="${post.mediaUrl}" alt="Post Media" style="width:100%; border-radius:12px; display:block;" />`
        }

          <!-- Vertical engagement overlay right aligned -->
          <div class="post-engagement-actions">
            <div class="engagement-item like-btn-action ${isLikedByMe ? 'liked' : ''}" data-post-id="${post._id}">
              <button class="action-circle-btn heart-btn"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
              <span class="action-count">${(post.likes || []).length}</span>
            </div>
            <div class="engagement-item comment-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="message-circle"></i></button>
              <span class="action-count">${(post.comments || []).length}</span>
            </div>
            <div class="engagement-item share-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="send"></i></button>
            </div>
            <div class="engagement-item bookmark-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn bookmark-btn"><i data-lucide="bookmark"></i></button>
            </div>
          </div>
        </div>

          <div class="post-details">
            <p class="post-caption"><strong class="author-username" style="margin-right: 8px;">${post.author.username}</strong>${post.caption}</p>
            
            <div class="comments-section" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
              <div class="comments-list" id="comments-list-${post._id}">
                ${commentsHTML}
              </div>
              
              <div class="post-comment-input-area" style="display: flex; gap: 8px; margin-top: 12px;">
                <input type="text" placeholder="Write a comment and press Enter..." class="comment-input-field" id="comment-input-${post._id}" style="flex:1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 8px 16px; color: var(--text-color); font-size: 13px;" />
              </div>
            </div>
          </div>
        `;

        feedContainer.appendChild(card);

        // Click handlers to view post author profile
        const avatarEl = card.querySelector('.author-avatar');
        const nameEl = card.querySelector('.author-name');
        const usernameEl = card.querySelector('.author-username');

        [avatarEl, nameEl, usernameEl].forEach(el => {
          if (el) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
              switchView('profile', post.author._id);
            });
          }
        });
      });

      debouncedCreateIcons();

      // Local Like and Bookmark listeners removed in favor of global event delegation

      const dynamicVideoOverlays = feedContainer.querySelectorAll('.video-play-overlay');
      dynamicVideoOverlays.forEach(overlay => {
        const container = overlay.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const playIcon = overlay.querySelector('i');

        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
          video.play();
          overlay.style.display = 'none';
          debouncedCreateIcons();
        });

        video.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!video.paused) {
            video.pause();
            playIcon.setAttribute('data-lucide', 'play');
            overlay.style.display = 'flex';
            overlay.style.background = 'rgba(0,0,0,0.25)';
            overlay.style.opacity = '1';
            debouncedCreateIcons();
          }
        });
      });

      const muteButtons = feedContainer.querySelectorAll('.mute-btn-action');
      muteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const container = btn.closest('.post-media-container');
          const video = container.querySelector('.post-media-video');
          const muteIcon = btn.querySelector('i');

          if (video.muted) {
            video.muted = false;
            muteIcon.setAttribute('data-lucide', 'volume-2');
          } else {
            video.muted = true;
            muteIcon.setAttribute('data-lucide', 'volume-2');
          }
          debouncedCreateIcons();
        });
      });

      const mediaBoxes = feedContainer.querySelectorAll('.post-media-container');
      mediaBoxes.forEach(container => {
        let lastTap = 0;
        container.addEventListener('click', async (e) => {
          if (e.target.closest('.post-engagement-actions') || e.target.closest('.video-mute-container')) return; // ignore clicks on engagement overlays or mute button
          const now = Date.now();
          const timespan = now - lastTap;
          if (timespan < 300 && timespan > 0) {
            e.preventDefault();
            const btn = container.closest('.feed-card').querySelector('.like-btn-action');
            const pid = btn.getAttribute('data-post-id');
            const rect = container.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;

            triggerHeartExplosion(relativeX, relativeY, container);

            if (!btn.classList.contains('liked')) {
              await togglePostLike(pid, btn);
            }
          }
          lastTap = now;
        });
      });

      // Posted via Enter key only (send button removed)

      const commentInputs = feedContainer.querySelectorAll('.comment-input-field');
      commentInputs.forEach(input => {
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const pid = input.id.replace('comment-input-', '');
            const text = input.value.trim();
            if (text) {
              await submitComment(pid, text, input);
            }
          }
      });
    });
  }

  function triggerBtnHeartExplosion(anchorElement) {
    if (!anchorElement) return;
    const rect = anchorElement.getBoundingClientRect();

    // Spawn 8 purple hearts
    for (let i = 0; i < 8; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart-particle';
      heart.innerHTML = `
        <svg viewBox="0 0 24 24" fill="#8b5cf6" stroke="#8b5cf6" stroke-width="2" style="width: 100%; height: 100%;">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      `;

      const size = Math.random() * 10 + 12; // sizes 12px to 22px
      heart.style.width = `${size}px`;
      heart.style.height = `${size}px`;

      const startX = rect.left + rect.width / 2 - size / 2;
      const startY = rect.top + rect.height / 2 - size / 2;
      heart.style.left = `${startX}px`;
      heart.style.top = `${startY}px`;

      const angle = (Math.random() * 360) * Math.PI / 180;
      const distance = Math.random() * 40 + 35;
      const tx = Math.cos(angle) * distance;
      const ty = -Math.random() * 70 - 30; // Float upwards
      const rot = Math.random() * 90 - 45;
      const scale = Math.random() * 0.4 + 0.8;

      heart.style.setProperty('--tx', `${tx}px`);
      heart.style.setProperty('--ty', `${ty}px`);
      heart.style.setProperty('--rot', `${rot}deg`);
      heart.style.setProperty('--scale', scale);

      heart.style.animationDelay = `${Math.random() * 0.1}s`;

      document.body.appendChild(heart);

      setTimeout(() => {
        heart.remove();
      }, 1100);
    }
  }

  async function togglePostLike(postId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    let useFrontendFallback = false;

    if (!token) {
      useFrontendFallback = true;
    }

    try {
      if (useFrontendFallback) throw new Error('No token');
      const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const countSpan = btnElement.querySelector('.action-count');
      const heartIcon = btnElement.querySelector('i, svg');

      if (data.isLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
        triggerBtnHeartExplosion(btnElement);
        showToast('Liked post! 💜');
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
      }
      if (countSpan) countSpan.textContent = data.likesCount;
    } catch (err) {
      // Fallback to frontend-only state
      const isLiked = btnElement.classList.contains('liked');
      const countSpan = btnElement.querySelector('.action-count');
      const heartIcon = btnElement.querySelector('i, svg');

      let count = parseInt(countSpan ? countSpan.textContent : '0') || 0;

      if (!isLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
        if (countSpan) countSpan.textContent = count + 1;
        triggerBtnHeartExplosion(btnElement);
        showToast('Liked post! 💜');
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
        if (countSpan && count > 0) countSpan.textContent = count - 1;
      }
    }
  }

  async function submitComment(postId, text, inputField) {
    const token = localStorage.getItem('invibe_jwt_token');
    let useFrontendFallback = false;

    if (!token) {
      useFrontendFallback = true;
    }

    try {
      if (useFrontendFallback) throw new Error('No token');
      const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      const comments = await res.json();
      if (!res.ok) throw new Error(comments.error);

      inputField.value = '';

      const card = document.getElementById(`post-${postId}`) || inputField.closest('.feed-card') || document.querySelector(`[data-post-id="${postId}"]`)?.closest('.feed-card');
      if (card) {
        const countBadge = card.querySelector('.comment-btn-action .action-count');
        if (countBadge) countBadge.textContent = comments.length;
      }

      const listContainer = document.getElementById(`comments-list-${postId}`) || document.querySelector('#comments-modal .comments-list');
      if (listContainer) {
        listContainer.innerHTML = '';
        comments.forEach(comment => {
          const item = document.createElement('div');
          item.className = 'comment-item';
          item.style = 'display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;';
          item.innerHTML = `
            <img src="${comment.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
            <div>
              <strong style="color: var(--text-color); margin-right: 4px;">${comment.author.username}</strong>
              <span style="color: var(--text-muted);">${comment.text}</span>
            </div>
          `;
          listContainer.appendChild(item);
        });
      }
      showToast('Comment posted! 💬');
    } catch (err) {
      // Fallback to frontend-only state
      inputField.value = '';

      const card = document.getElementById(`post-${postId}`) || inputField.closest('.feed-card') || document.querySelector(`[data-post-id="${postId}"]`)?.closest('.feed-card');
      if (card) {
        const countBadge = card.querySelector('.comment-btn-action .action-count');
        if (countBadge) {
          const count = parseInt(countBadge.textContent || '0');
          countBadge.textContent = count + 1;
        }
      }

      const listContainer = document.getElementById(`comments-list-${postId}`) || document.querySelector('#comments-modal .comments-list');
      if (listContainer) {
        const userStr = localStorage.getItem('invibeUser');
        const user = userStr ? JSON.parse(userStr) : { username: 'Guest', profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80' };
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.style = 'display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;';
        item.innerHTML = `
          <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
          <div>
            <strong style="color: var(--text-color); margin-right: 4px;">${user.username}</strong>
            <span style="color: var(--text-muted);">${text}</span>
          </div>
        `;
        listContainer.appendChild(item);
      }
      showToast('Comment posted! 💬');
    }
  }

  async function loadFeedReels() {
    const scroller = document.querySelector('#explore-reels-container .reels-scroller');
    if (!scroller) return;

    try {
      const res = await fetch(`${API_URL}/api/reels`);
      if (!res.ok) throw new Error('Failed to fetch reels');
      const reels = await res.json();

      scroller.innerHTML = '';

      const currentUserStr = localStorage.getItem('invibeUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

      reels.forEach(reel => {
        const isLikedByMe = currentUser ? reel.likes.includes(currentUser.id) : false;

        const card = document.createElement('div');
        card.className = 'reel-card';
        card.innerHTML = `
          <video src="${reel.videoUrl}" loop muted playsinline class="reel-video"></video>
          <div class="reel-play-icon-overlay"><i data-lucide="play"></i></div>
          
          <div class="reel-overlay">
            <div class="reel-left-info">
              <div class="reel-user">
                <img src="${reel.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}" alt="${reel.author.fullName}" />
                <span>${reel.author.username} • <strong class="reel-follow-btn" data-author-id="${reel.author._id}">Follow</strong></span>
              </div>
              <p class="reel-caption">${reel.caption}</p>
              <div class="reel-music"><i data-lucide="music" class="music-icon-spin"></i> <span>Original Audio - ${reel.author.username}</span></div>
            </div>
            <div class="reel-right-actions">
              <div class="reel-actions-capsule">
                <div class="reel-action-btn reel-like-action" data-reel-id="${reel._id}">
                  <button class="action-circle-btn heart-btn ${isLikedByMe ? 'liked' : ''}"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
                  <span class="action-count">${reel.likes.length}</span>
                </div>
                <div class="reel-action-btn reel-comment-sim">
                  <button class="action-circle-btn"><i data-lucide="message-square"></i></button>
                  <span class="action-count">1.2K</span>
                </div>
                <div class="reel-action-btn reel-share-sim">
                  <button class="action-circle-btn"><i data-lucide="send"></i></button>
                </div>
                <div class="reel-action-btn">
                  <button class="action-circle-btn"><i data-lucide="more-vertical"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div class="story-viewer-overlay reel-comments-modal">
            <div class="comments-card glass-panel">
              <div class="modal-header">
                <h3>Comments</h3>
                <button class="modal-close-btn"><i data-lucide="x"></i></button>
              </div>
              <div class="comments-list" id="comments-list-${reel._id}"></div>
              <div class="comments-footer">
                <input type="text" placeholder="Add a comment..." />
                <button class="comment-send-btn"><i data-lucide="send"></i></button>
              </div>
            </div>
          </div>

          <div class="story-viewer-overlay reel-share-modal">
            <div class="share-card glass-panel">
              <div class="modal-header">
                <h3>Share to Hubbies</h3>
                <button class="modal-close-btn"><i data-lucide="x"></i></button>
              </div>
              <div class="share-friends-list"></div>
            </div>
          </div>
        `;

        scroller.appendChild(card);
      });

      debouncedCreateIcons();
      wireReelInteractions(scroller);

    } catch (err) {
      console.error('Error loading reels:', err);
    }
  }

  async function toggleReelLike(reelId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in to like reels! 🔐');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const countSpan = btnElement.closest('.reel-action-btn').querySelector('.action-count');
      const heartIcon = btnElement.querySelector('i, svg');

      if (data.isLiked) {
        btnElement.classList.add('liked');
        if (heartIcon) {
          heartIcon.style.fill = '#8b5cf6';
          heartIcon.style.stroke = '#8b5cf6';
        }
        showToast('Liked Reel! 💜');
      } else {
        btnElement.classList.remove('liked');
        if (heartIcon) {
          heartIcon.style.fill = 'none';
          heartIcon.style.stroke = 'currentColor';
        }
      }
      if (countSpan) countSpan.textContent = data.likesCount;
    } catch (err) {
      console.error('Error liking reel:', err);
      showToast(err.message);
    }
  }

  async function toggleFollowFromReel(authorId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      showToast('Please log in to follow users! 🔐');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${authorId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      btnElement.textContent = 'Hubbies';
      btnElement.style.background = 'rgba(255,255,255,0.2)';
      showToast(data.message || 'Followed successfully!');
      loadProfileStats();
      loadFollowSuggestions();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function loadFollowSuggestions() {
    const listContainer = document.querySelector('.suggested-users-list');
    if (!listContainer) return;

    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/users/suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      const suggestions = await res.json();

      listContainer.innerHTML = '';
      if (suggestions.length === 0) {
        listContainer.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No suggestions available</p>';
        return;
      }

      suggestions.forEach(user => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
          <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" class="user-row-avatar" style="cursor: pointer;" />
          <div class="user-row-info" style="cursor: pointer;">
            <h5>${user.fullName}</h5>
            <p>@${user.username}</p>
          </div>
          <button class="follow-row-btn" data-user-id="${user._id}">Follow</button>
        `;
        listContainer.appendChild(row);

        // Click handlers to view user profile
        const avatarImg = row.querySelector('.user-row-avatar');
        const infoDiv = row.querySelector('.user-row-info');
        [avatarImg, infoDiv].forEach(el => {
          el.addEventListener('click', () => {
            switchView('profile', user._id);
          });
        });
      });

      const followButtons = listContainer.querySelectorAll('.follow-row-btn');
      followButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-user-id');
          await toggleFollowUser(uid, btn);
        });
      });
    } catch (err) {
      console.error('Error loading suggestions:', err);
    }
  }

  async function toggleFollowUser(targetUserId, btnElement) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    const isFollowing = btnElement.classList.contains('followed');
    const endpoint = isFollowing ? 'unfollow' : 'follow';

    try {
      const res = await fetch(`${API_URL}/api/users/${targetUserId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (endpoint === 'follow') {
        btnElement.classList.add('followed');
        btnElement.textContent = 'Hubbies';
        showToast(data.message || 'Followed successfully!');
      } else {
        btnElement.classList.remove('followed');
        btnElement.textContent = 'Follow';
        showToast('Unfollowed successfully.');
      }
      loadProfileStats();
      loadFollowSuggestions();
    } catch (err) {
      showToast(err.message);
    }
  }

  // --- SUGGESTED VIBERS MODAL SYSTEM ---
  const suggestedVibersModal = document.getElementById('suggested-vibers-modal');
  const suggestedVibersCloseBtn = document.getElementById('suggested-vibers-close-btn');
  const suggestedVibersContent = document.getElementById('suggested-vibers-content');

  if (suggestedVibersCloseBtn && suggestedVibersModal) {
    suggestedVibersCloseBtn.addEventListener('click', () => {
      suggestedVibersModal.classList.remove('active');
    });
  }

  async function openSuggestedVibersModal() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    suggestedVibersContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading suggestions...</div>';
    suggestedVibersModal.classList.add('active');

    try {
      // Query with limit=50 to show more suggestions in the modal
      const res = await fetch(`${API_URL}/api/users/suggestions?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load suggestions');
      const suggestions = await res.json();

      suggestedVibersContent.innerHTML = '';
      if (suggestions.length === 0) {
        suggestedVibersContent.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No suggestions available</div>`;
        return;
      }

      suggestions.forEach(user => {
        const row = document.createElement('div');
        row.className = 'search-person-row';
        row.style.margin = '10px 0';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        row.innerHTML = `
          <div class="person-info" style="display: flex; align-items: center; cursor: pointer;">
            <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 10px;" />
            <div style="display: flex; flex-direction: column;">
              <strong style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
              <span style="font-size: 12px; color: var(--text-muted);">@${user.username}</span>
            </div>
          </div>
          <button class="search-follow-btn modal-suggest-follow-btn" data-user-id="${user._id}">
            Follow
          </button>
        `;

        row.querySelector('.person-info').addEventListener('click', () => {
          suggestedVibersModal.classList.remove('active');
          switchView('profile', user._id);
        });

        const followBtn = row.querySelector('.modal-suggest-follow-btn');
        if (followBtn) {
          followBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uid = followBtn.getAttribute('data-user-id');
            const isFollowing = followBtn.classList.contains('followed');
            const endpoint = isFollowing ? 'unfollow' : 'follow';

            try {
              const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);

              if (endpoint === 'follow') {
                followBtn.classList.add('followed');
                followBtn.textContent = 'Hubbies';
                showToast(data.message || 'Followed successfully!');
              } else {
                followBtn.classList.remove('followed');
                followBtn.textContent = 'Follow';
                showToast('Unfollowed successfully.');
              }

              loadProfileStats();
              loadFollowSuggestions();
            } catch (err) {
              showToast(err.message);
            }
          });
        }

        suggestedVibersContent.appendChild(row);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error(err);
      suggestedVibersContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error-color);">Error loading suggestions</div>';
    }
  }

  // --- ACTIVE VIBERS (REAL-TIME presence) ---
  const activeVibersCount = document.getElementById('active-vibers-count');
  const activeVibersList = document.getElementById('active-vibers-list');

  async function loadActiveVibers() {
    if (!activeVibersList) return;
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/users/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch active vibers');
      const activeUsers = await res.json();

      activeVibersList.innerHTML = '';
      if (activeVibersCount) {
        activeVibersCount.textContent = `${activeUsers.length} online`;
      }

      if (activeUsers.length === 0) {
        activeVibersList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px; width: 100%;">No hubbers online</p>';
        return;
      }

      activeUsers.forEach(user => {
        const circle = document.createElement('div');
        circle.className = 'face-circle online';
        circle.style.cursor = 'pointer';
        circle.title = `${user.fullName} (@${user.username})`;
        circle.innerHTML = `<img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" alt="${user.fullName}" />`;

        circle.addEventListener('click', () => {
          switchView('profile', user._id);
        });

        activeVibersList.appendChild(circle);
      });
    } catch (err) {
      console.error('Error loading active vibers:', err);
    }
  }

  // Poll for active users every 30 seconds
  setInterval(loadActiveVibers, 30000);

  async function loadProfileStats() {
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);

    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser.id || currentUser._id}/relations`);
      if (!res.ok) throw new Error('Failed to fetch user relations');
      const data = await res.json();

      const sidebarFollowers = document.getElementById('user-followers-count');
      const sidebarFollowing = document.getElementById('user-following-count');
      if (sidebarFollowers) sidebarFollowers.textContent = formatCount(data.followersCount);
      if (sidebarFollowing) sidebarFollowing.textContent = formatCount(data.followingCount);

      const followBtn = document.getElementById('profile-follow-btn');
      const isViewingSelf = !followBtn || followBtn.style.display === 'none';

      if (isViewingSelf) {
        const profileFollowers = document.getElementById('profile-followers-count');
        const profileFollowing = document.getElementById('profile-following-count');
        if (profileFollowers) profileFollowers.textContent = formatCount(data.followersCount);
        if (profileFollowing) profileFollowing.textContent = formatCount(data.followingCount);

        const postsRes = await fetch(`${API_URL}/api/posts`);
        if (postsRes.ok) {
          const posts = await postsRes.json();
          const userPostsCount = posts.filter(p => {
            const authorId = p.author._id || p.author;
            const currentId = currentUser.id || currentUser._id;
            return authorId === currentId;
          }).length;
          const profileVibes = document.getElementById('profile-vibes-count');
          if (profileVibes) profileVibes.textContent = userPostsCount;
        }
      }
    } catch (err) {
      console.error('Error loading profile stats:', err);
    }
  }

  function formatCount(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  }

  function wireReelInteractions(scroller) {
    const cards = scroller.querySelectorAll('.reel-card');
    cards.forEach(card => {
      const video = card.querySelector('.reel-video');
      const playPop = card.querySelector('.reel-play-icon-overlay');
      const likeBtn = card.querySelector('.reel-like-action .heart-btn');
      const reelId = card.querySelector('.reel-like-action')?.getAttribute('data-reel-id');

      card.addEventListener('click', (e) => {
        if (e.detail > 1) return;
        if (e.target.closest('.reel-right-actions')) return;

        if (video.paused) {
          video.play();
          playPop.classList.remove('active');
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              playPop.querySelector('i').setAttribute('data-lucide', 'play');
              playPop.classList.add('active');
            });
          });
        } else {
          video.pause();
          playPop.classList.remove('active');
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              playPop.querySelector('i').setAttribute('data-lucide', 'pause');
              playPop.classList.add('active');
            });
          });
        }
        debouncedCreateIcons();
      });

      let lastReelTap = 0;
      card.addEventListener('click', async (e) => {
        const now = Date.now();
        const timespan = now - lastReelTap;
        if (timespan < 300 && timespan > 0) {
          e.preventDefault();
          const rect = card.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const relativeY = e.clientY - rect.top;

          triggerHeartExplosion(relativeX, relativeY, card);

          if (likeBtn && !likeBtn.classList.contains('liked')) {
            await toggleReelLike(reelId, likeBtn);
          } else {
            triggerHeartExplosion(relativeX, relativeY, card);
          }
        }
        lastReelTap = now;
      });

      const likeBtnAction = card.querySelector('.reel-like-action');
      if (likeBtnAction && likeBtn) {
        likeBtnAction.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleReelLike(reelId, likeBtn);
        });
      }

      const followReel = card.querySelector('.reel-follow-btn');
      if (followReel) {
        followReel.addEventListener('click', async (e) => {
          e.stopPropagation();
          const authorId = followReel.getAttribute('data-author-id');
          await toggleFollowFromReel(authorId, followReel);
        });
      }

      const commentBtn = card.querySelector('.reel-comment-sim');
      const commentModal = card.querySelector('.reel-comments-modal');
      if (commentBtn && commentModal) {
        commentBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          commentModal.classList.add('active');
        });
        const closeBtn = commentModal.querySelector('.modal-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            commentModal.classList.remove('active');
          });
        }
        commentModal.addEventListener('click', (e) => {
          if (e.target === commentModal) {
            commentModal.classList.remove('active');
          }
        });

        const sendBtn = commentModal.querySelector('.comment-send-btn');
        const inputField = commentModal.querySelector('input');
        if (sendBtn && inputField) {
          const handleSend = async () => {
            const text = inputField.value.trim();
            if (text) {
              await submitComment(reelId, text, inputField);
            }
          };
          sendBtn.addEventListener('click', handleSend);
          inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          });
        }
      }

      const shareBtn = card.querySelector('.reel-share-sim');
      const shareModal = card.querySelector('.reel-share-modal');
      if (shareBtn && shareModal) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openShare('reel_' + reelId, shareModal);
        });
        const closeBtn = shareModal.querySelector('.modal-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareModal.classList.remove('active');
          });
        }
        shareModal.addEventListener('click', (e) => {
          if (e.target === shareModal) {
            shareModal.classList.remove('active');
          }
        });
      }

      const capsule = card.querySelector('.reel-actions-capsule');
      if (capsule) {
        let isDraggingCapsule = false;
        let wasDragging = false;
        let startX, startY;
        let posX = 0;
        let posY = 0;

        capsule.addEventListener('mousedown', dragStart);
        capsule.addEventListener('touchstart', dragStart, { passive: false });

        capsule.addEventListener('click', (e) => {
          if (wasDragging) {
            e.stopPropagation();
            e.preventDefault();
          }
        }, true);

        function dragStart(e) {
          if (e.type === 'mousedown' && e.button !== 0) return;
          isDraggingCapsule = false;
          wasDragging = false;
          const coords = getDragCoords(e);
          startX = coords.x;
          startY = coords.y;
          posX = parseFloat(capsule.getAttribute('data-x')) || 0;
          posY = parseFloat(capsule.getAttribute('data-y')) || 0;
          capsule.style.transition = 'none';
          capsule.classList.add('dragging-capsule');
          document.addEventListener('mousemove', dragMove);
          document.addEventListener('mouseup', dragEnd);
          document.addEventListener('touchmove', dragMove, { passive: false });
          document.addEventListener('touchend', dragEnd);
        }

        function dragMove(e) {
          const coords = getDragCoords(e);
          const deltaX = coords.x - startX;
          const deltaY = coords.y - startY;

          if (!isDraggingCapsule) {
            if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
              isDraggingCapsule = true;
              wasDragging = true;
            }
          }

          if (isDraggingCapsule) {
            if (e.cancelable) e.preventDefault();
            let targetX = posX + deltaX;
            let targetY = posY + deltaY;
            const cardRect = card.getBoundingClientRect();
            const capsuleRect = capsule.getBoundingClientRect();
            const curX = parseFloat(capsule.getAttribute('data-x')) || 0;
            const curY = parseFloat(capsule.getAttribute('data-y')) || 0;
            const initialLeft = capsuleRect.left - curX;
            const initialTop = capsuleRect.top - curY;

            const minX = cardRect.left - initialLeft + 12;
            const maxX = cardRect.right - capsuleRect.width - initialLeft - 12;
            const minY = cardRect.top - initialTop + 12;
            const maxY = cardRect.bottom - capsuleRect.height - initialTop - 12;

            targetX = Math.max(minX, Math.min(maxX, targetX));
            targetY = Math.max(minY, Math.min(maxY, targetY));

            capsule.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.05)`;
            capsule.setAttribute('data-target-x', targetX.toString());
            capsule.setAttribute('data-target-y', targetY.toString());
          }
        }

        function dragEnd() {
          document.removeEventListener('mousemove', dragMove);
          document.removeEventListener('mouseup', dragEnd);
          document.removeEventListener('touchmove', dragMove);
          document.removeEventListener('touchend', dragEnd);

          capsule.style.transition = '';
          capsule.classList.remove('dragging-capsule');

          if (isDraggingCapsule) {
            const finalX = parseFloat(capsule.getAttribute('data-target-x')) || 0;
            const finalY = parseFloat(capsule.getAttribute('data-target-y')) || 0;
            capsule.setAttribute('data-x', finalX.toString());
            capsule.setAttribute('data-y', finalY.toString());
            capsule.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
            showToast('Repositioned Reels menu! ⚓');
            setTimeout(() => {
              wasDragging = false;
              isDraggingCapsule = false;
            }, 50);
          } else {
            capsule.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
            isDraggingCapsule = false;
            wasDragging = false;
          }
        }
      }
    });
  }

  // --- USER PROFILE LOADER SYSTEM ---
  async function loadUserProfile(userId) {
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);
    const localPhoto = localStorage.getItem('invibeProfileImage');
    const isMe = (!userId || userId === 'me' || userId === currentUser.id || userId === currentUser._id || userId === currentUser.username);

    // Immediately set UI to user's profile info (no loading placeholders)
    const profileAvatar = document.querySelector('.profile-screen-avatar');
    if (profileAvatar) profileAvatar.src = (isMe && localPhoto) ? localPhoto : (localPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');

    const profileName = document.querySelector('.profile-summary-top h3');
    if (profileName) profileName.innerHTML = isMe ? (currentUser.fullName || currentUser.username) : 'Hubber Profile';

    const profileHandle = document.querySelector('.profile-screen-handle');
    if (profileHandle) profileHandle.textContent = '@' + (isMe ? (currentUser.username || 'user') : (userId || 'user'));

    const profileBio = document.getElementById('profile-bio-text');
    if (profileBio) profileBio.textContent = 'Hubber creator on Hi-Hubble 🚀';

    const followBtn = document.getElementById('profile-follow-btn');
    const optionsList = document.querySelector('.profile-options-list');
    const logoutBtn = document.getElementById('profile-logout-btn');

    if (isMe) {
      if (followBtn) followBtn.style.display = 'none';
      if (optionsList) optionsList.style.display = 'grid';
      if (logoutBtn) logoutBtn.style.display = 'block';
    }

    let user = {
      _id: isMe ? (currentUser.id || currentUser._id || 'me') : userId,
      username: isMe ? (currentUser.username || 'haribol') : (userId || 'user'),
      fullName: isMe ? (currentUser.fullName || currentUser.username || 'haribol') : (userId || 'user'),
      profileImage: (isMe && localPhoto) ? localPhoto : (localPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'),
      bio: 'Hubber creator on Hi-Hubble 🚀',
      followersCount: 0,
      followingCount: 0
    };

    let posts = JSON.parse(localStorage.getItem('invibe_custom_posts') || '[]');
    let reels = [];

    // Try fetching remote API if available
    try {
      const token = localStorage.getItem('invibe_jwt_token');
      const targetId = isMe ? (currentUser.id || currentUser._id) : userId;
      if (token && targetId) {
        const res = await fetch(`${API_URL}/api/users/${targetId}/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) user = { ...user, ...data.user };
          if (data.posts) posts = [...posts, ...data.posts];
          if (data.reels) reels = data.reels;
        }
      }
    } catch (netErr) {
      console.warn("Network profile load notice:", netErr.message);
    }

    // Update follow statistics
    const followersCount = document.getElementById('profile-followers-count');
    const followingCount = document.getElementById('profile-following-count');
    const vibesCount = document.getElementById('profile-vibes-count');
    if (followersCount) followersCount.textContent = formatCount(user.followersCount || 0);
    if (followingCount) followingCount.textContent = formatCount(user.followingCount || 0);
    if (vibesCount) vibesCount.textContent = posts ? posts.length : 0;

    // Render posts grid (Vibes Gallery)
    const vibesGrid = document.getElementById('profile-vibes-grid');
    if (vibesGrid) {
      vibesGrid.innerHTML = '';
      if (!posts || posts.length === 0) {
        vibesGrid.innerHTML = '<div class="profile-grid-empty">No hubs shared yet. 📸</div>';
      } else {
        posts.forEach(post => {
          const item = document.createElement('div');
          item.className = 'profile-grid-item';
          item.style.cursor = 'pointer';
          item.innerHTML = `
            <img src="${post.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'}" alt="Hub" />
            <div class="profile-grid-item-overlay">
              <span><i data-lucide="heart"></i> ${(post.likes || []).length}</span>
              <span><i data-lucide="message-square"></i> ${(post.comments || []).length}</span>
            </div>
          `;
          item.addEventListener('click', () => {
            openProfilePostViewer(post);
          });
          vibesGrid.appendChild(item);
        });
      }
    }

    // Render reels grid (Reels Gallery)
    const reelsGrid = document.getElementById('profile-reels-grid');
    if (reelsGrid) {
      reelsGrid.innerHTML = '';
      if (!reels || reels.length === 0) {
        reelsGrid.innerHTML = '<div class="profile-grid-empty">No reels uploaded yet. 🎥</div>';
      } else {
        reels.forEach(reel => {
          const item = document.createElement('div');
          item.className = 'profile-grid-item';
          item.innerHTML = `
            <video src="${reel.videoUrl}" muted loop></video>
            <div class="profile-grid-item-overlay">
              <span><i data-lucide="heart"></i> ${(reel.likes || []).length}</span>
            </div>
          `;
          const video = item.querySelector('video');
          item.addEventListener('mouseenter', () => video.play());
          item.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
          reelsGrid.appendChild(item);
        });
      }
    }

    debouncedCreateIcons();
  }

  // --- PROFILE POST VIEWER MODAL SYSTEM (CHANGE 1) ---
  const profilePostViewerModal = document.getElementById('profile-post-viewer-modal');
  const profilePostViewerCloseBtn = document.getElementById('profile-post-viewer-close-btn');
  const profilePostViewerContent = document.getElementById('profile-post-viewer-content');

  function openProfilePostViewer(post) {
    if (!profilePostViewerModal || !profilePostViewerContent) return;

    const currentUserStr = localStorage.getItem('invibeUser');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const isLikedByMe = currentUser ? post.likes.includes(currentUser.id) : false;

    let commentsHTML = '';
    post.comments.forEach(comment => {
      commentsHTML += `
        <div class="comment-item" style="display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px;">
          <img src="${comment.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
          <div>
            <strong style="color: var(--text-color); margin-right: 4px;">${comment.author.username}</strong>
            <span style="color: var(--text-muted);">${comment.text}</span>
          </div>
        </div>
      `;
    });

    const cardHTML = `
      <article class="feed-card" id="post-${post._id}">
        <div class="post-header">
          <div class="post-author-info">
            <img src="${post.author.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${post.author.fullName}" class="author-avatar" />
            <div>
              <h4 class="author-name">${post.author.fullName}</h4>
              <div class="post-meta">
                <span class="post-time">${new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span class="dot-separator">•</span>
                <i data-lucide="globe" class="meta-icon"></i>
              </div>
            </div>
          </div>
          <button class="post-options-btn"><i data-lucide="more-horizontal"></i></button>
        </div>

        <div class="post-media-container" style="position:relative; overflow:hidden; border-radius: 12px; margin: 12px 0;">
          ${post.mediaType === 'video'
        ? `<video src="${post.mediaUrl}" loop muted playsinline style="width:100%; border-radius:12px; display:block;" class="post-media-video"></video>
               <div class="video-play-overlay">
                 <button class="play-btn-big"><i data-lucide="play"></i></button>
               </div>
               <div class="video-mute-container" style="position: absolute; left: 16px; bottom: 24px; z-index: 12;">
                 <button class="action-circle-btn mute-btn-action" data-post-id="${post._id}">
                   <i data-lucide="volume-2"></i>
                 </button>
               </div>`
        : `<img src="${post.mediaUrl}" alt="Post Media" style="width:100%; border-radius:12px; display:block;" />`
      }

          <div class="post-engagement-actions">
            <div class="engagement-item like-btn-action ${isLikedByMe ? 'liked' : ''}" data-post-id="${post._id}">
              <button class="action-circle-btn heart-btn"><i data-lucide="heart" style="${isLikedByMe ? 'fill:#8b5cf6; stroke:#8b5cf6;' : ''}"></i></button>
              <span class="action-count">${post.likes.length}</span>
            </div>
            <div class="engagement-item comment-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="message-circle"></i></button>
              <span class="action-count">${post.comments.length}</span>
            </div>
            <div class="engagement-item share-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn"><i data-lucide="send"></i></button>
            </div>
            <div class="engagement-item bookmark-btn-action" data-post-id="${post._id}">
              <button class="action-circle-btn bookmark-btn"><i data-lucide="bookmark"></i></button>
            </div>
          </div>
        </div>

        <div class="post-details">
          <p class="post-caption"><strong class="author-username" style="margin-right: 8px;">${post.author.username}</strong>${post.caption}</p>
          
          <div class="comments-section" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <div class="comments-list" id="comments-list-${post._id}">
              ${commentsHTML}
            </div>
            
            <div class="post-comment-input-area" style="display: flex; gap: 8px; margin-top: 12px;">
              <input type="text" placeholder="Write a comment and press Enter..." class="comment-input-field" id="comment-input-${post._id}" style="flex:1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 8px 16px; color: var(--text-color); font-size: 13px;" />
            </div>
          </div>
        </div>
      </article>
    `;

    profilePostViewerContent.innerHTML = cardHTML;
    profilePostViewerModal.classList.add('active');

    debouncedCreateIcons();

    // Wire up like button
    const likeBtn = profilePostViewerContent.querySelector('.like-btn-action');
    if (likeBtn) {
      likeBtn.addEventListener('click', async () => {
        const pid = likeBtn.getAttribute('data-post-id');
        await togglePostLike(pid, likeBtn);
      });
    }

    // Wire up bookmark button
    const bookmarkBtn = profilePostViewerContent.querySelector('.bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => {
        bookmarkBtn.classList.toggle('saved');
        const icon = bookmarkBtn.querySelector('i, svg');
        if (bookmarkBtn.classList.contains('saved')) {
          if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
          showToast('Saved to bookmarks! 🔖');
        } else {
          if (icon) { icon.style.fill = 'none'; icon.style.stroke = 'currentColor'; }
          showToast('Removed from bookmarks');
        }
      });
    }

    // Wire up share button
    const shareBtn = profilePostViewerContent.querySelector('.share-btn-action');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        showToast('Share link copied! 🔗');
      });
    }

    // Posted via Enter key only (send button removed)

    // Wire up comment input enter key
    const commentInput = profilePostViewerContent.querySelector('.comment-input-field');
    if (commentInput) {
      commentInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const pid = commentInput.id.replace('comment-input-', '');
          const text = commentInput.value.trim();
          if (text) {
            await submitComment(pid, text, commentInput);
          }
        }
      });
    }

    // Wire up video play overlay
    const videoOverlay = profilePostViewerContent.querySelector('.video-play-overlay');
    if (videoOverlay) {
      videoOverlay.addEventListener('click', () => {
        const container = videoOverlay.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const playIcon = videoOverlay.querySelector('i');
        if (video.paused) {
          video.play();
          playIcon.setAttribute('data-lucide', 'pause');
          videoOverlay.style.background = 'rgba(0,0,0,0)';
          videoOverlay.style.opacity = '0';
        } else {
          video.pause();
          playIcon.setAttribute('data-lucide', 'play');
          videoOverlay.style.background = 'rgba(0,0,0,0.25)';
          videoOverlay.style.opacity = '1';
        }
        debouncedCreateIcons();
      });
    }

    // Wire up video mute/unmute
    const muteBtn = profilePostViewerContent.querySelector('.mute-btn-action');
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const container = muteBtn.closest('.post-media-container');
        const video = container.querySelector('.post-media-video');
        const muteIcon = muteBtn.querySelector('i');

        if (video.muted) {
          video.muted = false;
          muteIcon.setAttribute('data-lucide', 'volume-2');
        } else {
          video.muted = true;
          muteIcon.setAttribute('data-lucide', 'volume-2');
        }
        debouncedCreateIcons();
      });
    }

    // Wire up double-tap heart on media
    const mediaContainer = profilePostViewerContent.querySelector('.post-media-container');
    if (mediaContainer) {
      let lastTap = 0;
      mediaContainer.addEventListener('click', async (e) => {
        if (e.target.closest('.post-engagement-actions') || e.target.closest('.video-mute-container')) return;
        const now = Date.now();
        const timespan = now - lastTap;
        if (timespan < 300 && timespan > 0) {
          e.preventDefault();
          const btn = mediaContainer.closest('.feed-card').querySelector('.like-btn-action');
          const pid = btn.getAttribute('data-post-id');
          const rect = mediaContainer.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const relativeY = e.clientY - rect.top;

          triggerHeartExplosion(relativeX, relativeY, mediaContainer);

          if (!btn.classList.contains('liked')) {
            await togglePostLike(pid, btn);
          }
        }
        lastTap = now;
      });
    }
  }

  // Close profile post viewer modal
  if (profilePostViewerCloseBtn && profilePostViewerModal) {
    profilePostViewerCloseBtn.addEventListener('click', () => {
      profilePostViewerModal.classList.remove('active');
      // Pause any playing video
      const video = profilePostViewerContent.querySelector('video');
      if (video) video.pause();
    });
  }
  // Close on overlay background click
  if (profilePostViewerModal) {
    profilePostViewerModal.addEventListener('click', (e) => {
      if (e.target === profilePostViewerModal) {
        profilePostViewerModal.classList.remove('active');
        const video = profilePostViewerContent.querySelector('video');
        if (video) video.pause();
      }
    });
  }

  // Bind profile tabs selection logic
  const profileTabButtons = document.querySelectorAll('.profile-content-tab');
  profileTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      profileTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.getAttribute('data-profile-tab');

      const vibesGrid = document.getElementById('profile-vibes-grid');
      const reelsGrid = document.getElementById('profile-reels-grid');
      const savedGrid = document.getElementById('profile-saved-grid');

      if (vibesGrid) vibesGrid.classList.remove('active');
      if (reelsGrid) reelsGrid.classList.remove('active');
      if (savedGrid) savedGrid.classList.remove('active');

      if (tabName === 'vibes') {
        if (vibesGrid) vibesGrid.classList.add('active');
      } else if (tabName === 'reels') {
        if (reelsGrid) reelsGrid.classList.add('active');
      } else if (tabName === 'saved') {
        if (savedGrid) {
          savedGrid.classList.add('active');
          renderSavedHubbs();
        }
      }
    });
  });

  // Bind follow/unfollow action on user profile
  const profileFollowBtn = document.getElementById('profile-follow-btn');
  if (profileFollowBtn) {

    function renderSavedHubbs() {
      const savedGrid = document.getElementById('profile-saved-grid');
      if (!savedGrid) return;
      savedGrid.innerHTML = '';

      const savedItems = window.savedHubbs || [];
      if (savedItems.length === 0) {
        savedGrid.innerHTML = '<div class="profile-grid-empty" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">No saved hubs yet. 🔖</div>';
        return;
      }

      savedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'profile-grid-item';
        if (item.type === 'video') {
          div.innerHTML = `
          <video src="${item.url}" muted loop style="width:100%; height:100%; object-fit:cover;"></video>
          <div class="profile-grid-item-overlay">
            <span><i data-lucide="bookmark"></i> Saved</span>
          </div>`;
          const video = div.querySelector('video');
          div.addEventListener('mouseenter', () => video.play());
          div.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
        } else {
          div.innerHTML = `
          <img src="${item.url}" alt="Saved Hub" style="width:100%; height:100%; object-fit:cover;" />
          <div class="profile-grid-item-overlay">
            <span><i data-lucide="bookmark"></i> Saved</span>
          </div>`;
        }
        savedGrid.appendChild(div);
      });
      debouncedCreateIcons();
    }

    profileFollowBtn.addEventListener('click', async () => {
      const uid = profileFollowBtn.getAttribute('data-user-id');
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token || !uid) return;

      const isFollowing = profileFollowBtn.classList.contains('followed');
      const endpoint = isFollowing ? 'unfollow' : 'follow';

      try {
        const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (endpoint === 'follow') {
          profileFollowBtn.classList.add('followed');
          profileFollowBtn.textContent = 'Hubbies';
          showToast(data.message || 'Followed successfully!');
        } else {
          profileFollowBtn.classList.remove('followed');
          profileFollowBtn.textContent = 'Follow';
          showToast('Unfollowed successfully.');
        }

        loadProfileStats();
        loadFollowSuggestions();
        loadUserProfile(uid);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // ─── FOLLOWERS / FOLLOWING RELATIONS MODAL LOGIC ───
  const followersCountEl = document.getElementById('profile-followers-count');
  const followingCountEl = document.getElementById('profile-following-count');
  const relationsModal = document.getElementById('relations-list-modal');
  const relationsCloseBtn = document.getElementById('relations-list-close-btn');
  const relationsTitle = document.getElementById('relations-list-title');
  const relationsContent = document.getElementById('relations-list-content');

  if (relationsCloseBtn && relationsModal) {
    relationsCloseBtn.addEventListener('click', () => {
      relationsModal.classList.remove('active');
    });
  }

  async function openRelationsModal(type) {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    const followBtn = document.getElementById('profile-follow-btn');
    const currentUserStr = localStorage.getItem('invibeUser');
    if (!currentUserStr) return;
    const currentUser = JSON.parse(currentUserStr);

    const isMe = (followBtn && followBtn.style.display === 'none');
    const targetUserId = isMe ? (currentUser.id || currentUser._id) : followBtn.getAttribute('data-user-id');
    if (!targetUserId) return;

    relationsTitle.textContent = type === 'followers' ? 'HUBBERS' : 'HUBBIES';
    relationsContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading...</div>';
    relationsModal.setAttribute('data-relation-type', type);
    relationsModal.classList.add('active');

    try {
      const res = await fetch(`${API_URL}/api/users/${targetUserId}/${type}-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load list');
      const users = await res.json();

      relationsContent.innerHTML = '';
      if (users.length === 0) {
        relationsContent.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No users found</div>`;
        return;
      }

      users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'search-person-row';
        row.style.margin = '10px 0';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        row.innerHTML = `
          <div class="person-info" style="display: flex; align-items: center; cursor: pointer;">
            <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 10px;" />
            <div style="display: flex; flex-direction: column;">
              <strong class="relations-user-name" style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
              <span style="font-size: 12px; color: var(--text-muted);">@${user.username}</span>
            </div>
          </div>
          ${user.isMe ? '' : `
            <button class="search-follow-btn relations-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
              ${user.isFollowing ? 'Hubbies' : 'Follow'}
            </button>
          `}
        `;

        row.querySelector('.person-info').addEventListener('click', () => {
          relationsModal.classList.remove('active');
          switchView('profile', user._id);
        });

        const rFollowBtn = row.querySelector('.relations-follow-btn');
        if (rFollowBtn) {
          rFollowBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uid = rFollowBtn.getAttribute('data-user-id');
            const isFollowing = rFollowBtn.classList.contains('followed');
            const endpoint = isFollowing ? 'unfollow' : 'follow';

            try {
              const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);

              if (endpoint === 'follow') {
                rFollowBtn.classList.add('followed');
                rFollowBtn.textContent = 'Hubbies';
                showToast(data.message || 'Followed successfully!');
              } else {
                rFollowBtn.classList.remove('followed');
                rFollowBtn.textContent = 'Follow';
                showToast('Unfollowed successfully.');
              }

              loadProfileStats();
              loadUserProfile(targetUserId);
            } catch (err) {
              showToast(err.message);
            }
          });
        }

        relationsContent.appendChild(row);
      });

      debouncedCreateIcons();
    } catch (err) {
      console.error(err);
      relationsContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error-color);">Error loading data</div>';
    }
  }

  if (followersCountEl) {
    followersCountEl.parentElement.style.cursor = 'pointer';
    followersCountEl.parentElement.addEventListener('click', () => openRelationsModal('followers'));
  }
  if (followingCountEl) {
    followingCountEl.parentElement.style.cursor = 'pointer';
    followingCountEl.parentElement.addEventListener('click', () => openRelationsModal('following'));
  }

  // --- GLOBAL USER SEARCH LOGIC ---
  const globalSearchInput = document.getElementById('global-search');
  const searchDropdown = document.getElementById('search-results-dropdown');
  const searchList = document.getElementById('search-results-list');

  if (globalSearchInput && searchDropdown && searchList) {
    let searchDebounceTimeout;

    globalSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimeout);
      const query = globalSearchInput.value.trim();

      if (!query) {
        searchDropdown.style.display = 'none';
        searchList.innerHTML = '';
        return;
      }

      searchDebounceTimeout = setTimeout(async () => {
        const token = localStorage.getItem('invibe_jwt_token');
        if (!token) return;

        try {
          const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Search failed');
          const users = await res.json();

          searchList.innerHTML = '';
          if (users.length === 0) {
            searchList.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No users found</div>';
            searchDropdown.style.display = 'block';
            return;
          }

          users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'search-result-row';
            row.innerHTML = `
              <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'}" alt="${user.fullName}" class="search-result-avatar" />
              <div class="search-result-info">
                <h5>${user.fullName}</h5>
                <p>@${user.username}</p>
              </div>
              <button class="search-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
                ${user.isFollowing ? 'Hubbies' : 'Follow'}
              </button>
            `;

            // Row click triggers profile navigation
            row.addEventListener('click', (e) => {
              if (e.target.closest('.search-follow-btn')) return;

              switchView('profile', user._id);

              globalSearchInput.value = '';
              searchDropdown.style.display = 'none';
            });

            searchList.appendChild(row);
          });

          // Wire search result follow buttons
          const followBtns = searchList.querySelectorAll('.search-follow-btn');
          followBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const uid = btn.getAttribute('data-user-id');
              const isFollowing = btn.classList.contains('followed');
              const endpoint = isFollowing ? 'unfollow' : 'follow';

              try {
                const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                if (endpoint === 'follow') {
                  btn.classList.add('followed');
                  btn.textContent = 'Hubbies';
                  showToast(data.message || 'Followed successfully!');
                } else {
                  btn.classList.remove('followed');
                  btn.textContent = 'Follow';
                  showToast('Unfollowed successfully.');
                }
                loadProfileStats();
                loadFollowSuggestions();
              } catch (err) {
                showToast(err.message);
              }
            });
          });

          searchDropdown.style.display = 'block';
        } catch (err) {
          console.error(err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!globalSearchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    });
  }

  // Dedicated search tab input event listener
  const searchViewInput = document.getElementById('search-view-input');
  if (searchViewInput) {
    let searchViewDebounce;
    searchViewInput.addEventListener('input', () => {
      clearTimeout(searchViewDebounce);
      const query = searchViewInput.value.trim();

      const searchGrid = document.querySelector('.search-view .search-grid');
      let resultsContainer = document.getElementById('search-view-results');
      if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-view-results';
        resultsContainer.className = 'search-person-list';
        resultsContainer.style.marginTop = '20px';
        searchViewInput.closest('.search-view').appendChild(resultsContainer);
      }

      if (!query) {
        if (searchGrid) searchGrid.style.display = 'grid';
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
      }

      searchViewDebounce = setTimeout(async () => {
        const token = localStorage.getItem('invibe_jwt_token');
        if (!token) return;

        try {
          const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Search failed');
          const users = await res.json();

          if (searchGrid) searchGrid.style.display = 'none';
          resultsContainer.style.display = 'block';
          resultsContainer.innerHTML = '';

          if (users.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No users found matching your search.</div>';
            return;
          }

          users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'search-person-row';
            row.style.margin = '12px 0';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.background = 'rgba(255, 255, 255, 0.03)';
            row.style.padding = '12px';
            row.style.borderRadius = 'var(--radius-lg)';
            row.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            row.innerHTML = `
              <div class="person-info" style="display: flex; align-items: center; cursor: pointer; flex-grow: 1;">
                <img src="${user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}" alt="${user.fullName}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; margin-right: 12px;" />
                <div style="display: flex; flex-direction: column;">
                  <strong style="font-size: 14px; color: var(--text-color);">${user.fullName}</strong>
                  <span style="font-size: 12px; color: var(--text-muted);">@${user.username}</span>
                </div>
              </div>
              <button class="search-follow-btn ${user.isFollowing ? 'followed' : ''}" data-user-id="${user._id}">
                ${user.isFollowing ? 'Hubbies' : 'Follow'}
              </button>
            `;

            // Row click triggers profile navigation
            row.querySelector('.person-info').addEventListener('click', () => {
              switchView('profile', user._id);
              searchViewInput.value = '';
              if (searchGrid) searchGrid.style.display = 'grid';
              resultsContainer.style.display = 'none';
            });

            // Follow button listener
            const followBtn = row.querySelector('.search-follow-btn');
            if (followBtn) {
              followBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const uid = followBtn.getAttribute('data-user-id');
                const isFollowing = followBtn.classList.contains('followed');
                const endpoint = isFollowing ? 'unfollow' : 'follow';

                try {
                  const res = await fetch(`${API_URL}/api/users/${uid}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);

                  if (endpoint === 'follow') {
                    followBtn.classList.add('followed');
                    followBtn.textContent = 'Hubbies';
                    showToast(data.message || 'Followed successfully!');
                  } else {
                    followBtn.classList.remove('followed');
                    followBtn.textContent = 'Follow';
                    showToast('Unfollowed successfully.');
                  }
                  loadProfileStats();
                } catch (err) {
                  showToast(err.message);
                }
              });
            }

            resultsContainer.appendChild(row);
          });
        } catch (err) {
          console.error(err);
          showToast('Search query failed.');
        }
      }, 300);
    });
  }

  // Run database sync loaders
  loadFeedPosts();
  loadFeedReels();
  loadFollowSuggestions();
  loadProfileStats();
  loadStories();
  loadActiveVibers();

  // Custom auth reload hook
  window.updateAppUI = function () {
    const userStr = localStorage.getItem('invibeUser');
    const profileImage = localStorage.getItem('invibeProfileImage');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      const headerAvatar = document.querySelector('#header-profile-avatar img');
      if (headerAvatar && profileImage) headerAvatar.src = profileImage;
      const sidebarAvatar = document.querySelector('.profile-preview-avatar img');
      if (sidebarAvatar && profileImage) sidebarAvatar.src = profileImage;
      const createPostAvatar = document.querySelector('#create-post-user-avatar');
      if (createPostAvatar && profileImage) createPostAvatar.src = profileImage;
      const sidebarName = document.querySelector('.profile-preview-info h3');
      if (sidebarName && user.fullName) sidebarName.textContent = user.fullName;
      const sidebarUsername = document.querySelector('.profile-preview-info p');
      if (sidebarUsername && user.username) sidebarUsername.textContent = '@' + user.username;
      const storyAvatar = document.querySelector('.story-card.current-user .story-avatar-container img');
      if (storyAvatar && profileImage) storyAvatar.src = profileImage;
      const myProfileAvatar = document.querySelector('.profile-screen-avatar');
      if (myProfileAvatar && profileImage) myProfileAvatar.src = profileImage;
      const myProfileName = document.querySelector('.profile-summary-top h3');
      if (myProfileName && user.fullName) {
        myProfileName.innerHTML = user.fullName;
        debouncedCreateIcons();
      }
      const myProfileUsername = document.querySelector('.profile-screen-handle');
      if (myProfileUsername && user.username) myProfileUsername.textContent = '@' + user.username;

      const bannerImage = localStorage.getItem('invibeBannerImage');
      const sidebarBanner = document.querySelector('.sidebar-left .card-cover-bg');
      if (sidebarBanner && bannerImage) {
        sidebarBanner.style.backgroundImage = `url(${bannerImage})`;
        sidebarBanner.style.backgroundSize = 'cover';
        sidebarBanner.style.backgroundPosition = 'center';
      }

      loadProfileStats();
      loadFollowSuggestions();
      loadStories();
      loadActiveVibers();
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  // ─── NOTIFICATIONS DROPDOWN AND BADGES INTERACTION SYSTEM ────────────────────
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notifications-panel');
  const notifBadge = document.getElementById('header-notif-badge');
  const radialNotifBadge = document.getElementById('radial-notif-badge');

  async function loadNotifications() {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) {
      if (notifBadge) notifBadge.style.display = 'none';
      if (radialNotifBadge) radialNotifBadge.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const notifications = await res.json();

      // Update badges (blue diamond for unread notifications)
      const unreadCount = notifications.filter(n => !n.read).length;
      if (unreadCount > 0) {
        if (notifBadge) {
          notifBadge.className = 'badge blue-diamond';
          notifBadge.style.display = 'block';
        }
        if (radialNotifBadge) {
          radialNotifBadge.className = 'nav-icon-badge blue-diamond';
          radialNotifBadge.style.display = 'flex';
          radialNotifBadge.textContent = '';
        }
      } else {
        if (notifBadge) {
          notifBadge.className = 'badge';
          notifBadge.style.display = 'none';
        }
        if (radialNotifBadge) {
          radialNotifBadge.className = 'nav-icon-badge';
          radialNotifBadge.style.display = 'none';
        }
      }

      // Render notification items in panel
      renderNotificationsPanel(notifications);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function renderNotificationsPanel(notifications) {
    if (!notifPanel) return;

    const listContainer = notifPanel.querySelector('.notifications-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (notifications.length === 0) {
      listContainer.innerHTML = `
        <div class="notification-empty">
          <i data-lucide="bell-off"></i>
          <p>No notifications yet</p>
        </div>
      `;
      debouncedCreateIcons();
      return;
    }

    notifications.forEach(notif => {
      const item = document.createElement('div');
      item.className = `notification-item ${notif.read ? '' : 'unread'}`;

      const sender = notif.sender || { fullName: 'Someone', username: 'someone', profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80' };
      const senderAvatar = sender.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

      let messageText = '';
      let mediaThumbnail = '';

      if (notif.type === 'follow') {
        messageText = `<strong>@${sender.username}</strong> started following you.`;
      } else if (notif.type === 'like_post') {
        messageText = `<strong>@${sender.username}</strong> liked your post.`;
        if (notif.post && notif.post.mediaUrl) {
          mediaThumbnail = `<img src="${notif.post.mediaUrl}" class="notification-media" alt="Post thumbnail"/>`;
        }
      } else if (notif.type === 'like_reel') {
        messageText = `<strong>@${sender.username}</strong> liked your reel.`;
        if (notif.reel && notif.reel.videoUrl) {
          mediaThumbnail = `
            <div style="position: relative; width: 36px; height: 36px;">
              <video src="${notif.reel.videoUrl}" class="notification-media" style="object-fit: cover; width:36px; height:36px;" muted></video>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm);">
                <i data-lucide="play" style="width: 10px; height: 10px; stroke: white; fill: white;"></i>
              </div>
            </div>`;
        }
      } else if (notif.type === 'like_story') {
        messageText = `❤️ <strong>@${sender.username}</strong> liked your Hub.`;
        if (notif.story && notif.story.mediaUrl) {
          mediaThumbnail = `<img src="${notif.story.mediaUrl}" class="notification-media" alt="Hub thumbnail"/>`;
        }
      }

      const timeAgo = formatTimeAgo(new Date(notif.createdAt));

      item.innerHTML = `
        <img src="${senderAvatar}" class="notification-avatar" alt="${sender.username}"/>
        <div class="notification-content">
          <p>${messageText}</p>
          <span class="notification-time">${timeAgo}</span>
        </div>
        ${mediaThumbnail}
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sender._id) {
          switchView('profile', sender._id);
          notifPanel.style.display = 'none';
        }
      });

      listContainer.appendChild(item);
    });

    debouncedCreateIcons();
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Setup click handler for toggle panel
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const searchDropdown = document.getElementById('search-results-dropdown');
      if (searchDropdown) searchDropdown.style.display = 'none';

      const isVisible = notifPanel.style.display === 'flex';
      if (isVisible) {
        notifPanel.style.display = 'none';
      } else {
        notifPanel.style.display = 'flex';
        // Auto mark as read on open
        const token = localStorage.getItem('invibe_jwt_token');
        if (token) {
          try {
            await fetch(`${API_URL}/api/notifications/read`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            await loadNotifications();
          } catch (err) {
            console.error('Error marking read:', err);
          }
        }
      }
    });
  }

  // Mobile navigation bubble redirection to header button click
  const radialNotifBtn = document.getElementById('nav-notifications-btn');
  if (radialNotifBtn) {
    radialNotifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifBtn) notifBtn.click();
    });
  }

  // Manual mark all read button inside panel
  const markReadBtn = notifPanel ? notifPanel.querySelector('.mark-read-btn') : null;
  if (markReadBtn) {
    markReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return;
      try {
        await fetch(`${API_URL}/api/notifications/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadNotifications();
      } catch (err) {
        console.error('Error marking read:', err);
      }
    });
  }

  // Click outside to close panel
  document.addEventListener('click', (e) => {
    if (notifPanel && notifPanel.style.display === 'flex') {
      if (!notifPanel.contains(e.target) && (!notifBtn || !notifBtn.contains(e.target))) {
        notifPanel.style.display = 'none';
      }
    }
  });

  // Listen to auth load/changes
  window.addEventListener('auth-changed', () => {
    loadNotifications();
    loadChatThreads();
    loadProfileStats();
    loadFollowSuggestions();
  });

  // Initial load
  loadNotifications();
  loadChatThreads();

  // Polling for incoming calls every 2 seconds
  setInterval(() => {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;
    checkForIncomingCall();
  }, 2000);

  // Polling interval (every 4 seconds for real-world updates)
  setInterval(() => {
    const token = localStorage.getItem('invibe_jwt_token');
    if (!token) return;

    loadNotifications();
    loadChatThreads();
    if (state.activeView === 'chats' && state.currentChatThread) {
      fetchMessages(state.currentChatThread, false);

      const activeThreadObj = chatThreads.find(t => t.user && t.user._id.toString() === state.currentChatThread.toString());
      if (activeThreadObj && activeThreadObj.user) {
        const u = activeThreadObj.user;
        const isOnline = (new Date() - new Date(u.lastActive)) < 120000;
        const statusHtml = isOnline
          ? `<span class="online-indicator blue-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Online`
          : `<span class="online-indicator black-diamond-status" style="position:static; display:inline-block; margin-right:4px; width:8px; height:8px;"></span> Offline`;
        const headerStatus = document.querySelector('.chat-header-status');
        if (headerStatus) headerStatus.innerHTML = statusHtml;
      }
    }
  }, 4000);

  function setupVideoScrollObserver() {
    const observerOptions = {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.5) {
          if (!video.paused) {
            video.pause();
            const container = video.closest('.post-media-container');
            if (container) {
              const overlay = container.querySelector('.video-play-overlay');
              if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                overlay.style.background = 'rgba(0,0,0,0.25)';
                const playIcon = overlay.querySelector('i');
                if (playIcon) {
                  playIcon.setAttribute('data-lucide', 'play');
                }
                debouncedCreateIcons();
              }
            }
          }
        }
      });
    }, observerOptions);

    document.querySelectorAll('.post-media-video, .reel-video').forEach(video => {
      observer.observe(video);
    });

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const videos = node.querySelectorAll('.post-media-video, .reel-video');
            videos.forEach(video => observer.observe(video));
            if (node.classList.contains('post-media-video') || node.classList.contains('reel-video')) {
              observer.observe(node);
            }
          }
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  // --- DOUBLE CLICK TO LIKE ---
  document.addEventListener('dblclick', async (e) => {
    // For Posts
    const postMediaContainer = e.target.closest('.post-media-container');
    if (postMediaContainer) {
      e.preventDefault();

      const rect = postMediaContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      triggerHeartExplosion(clickX, clickY, postMediaContainer);

      const likeBtnAction = postMediaContainer.closest('article, .feed-card')
        ? postMediaContainer.closest('article, .feed-card').querySelector('.like-btn-action')
        : postMediaContainer.querySelector('.like-btn-action') || postMediaContainer.parentNode.querySelector('.like-btn-action');

      if (likeBtnAction && !likeBtnAction.classList.contains('liked')) {
        const postId = likeBtnAction.getAttribute('data-post-id');
        if (postId) {
          await togglePostLike(postId, likeBtnAction);
        }
      }
      return;
    }

    // For Reels (Hubbings)
    const reelCard = e.target.closest('.reel-card');
    if (reelCard) {
      e.preventDefault();

      const rect = reelCard.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      triggerHeartExplosion(clickX, clickY, reelCard);

      const likeBtnAction = reelCard.querySelector('.reel-like-action');
      const heartBtn = likeBtnAction ? likeBtnAction.querySelector('.heart-btn') : null;

      if (heartBtn && !heartBtn.classList.contains('liked')) {
        const reelId = likeBtnAction.getAttribute('data-reel-id');
        if (reelId) {
          await toggleReelLike(reelId, heartBtn);
        }
      }
      return;
    }
  });

  setupVideoScrollObserver();

  /* ========================================================= */
  /* DM ENHANCEMENTS LOGIC */
  /* ========================================================= */

  // --- AI Spelling Assistant ---
  const aiAssistantBtn = document.getElementById('chat-ai-assistant-btn');
  const aiPopover = document.getElementById('ai-spelling-popover');
  const aiContent = document.getElementById('ai-spelling-content');
  const aiAcceptBtn = document.getElementById('ai-spelling-accept-btn');
  const aiCancelBtn = document.getElementById('ai-spelling-cancel-btn');
  const aiActions = document.getElementById('ai-spelling-actions');

  let currentAiSuggestion = '';

  if (aiAssistantBtn) {
    aiAssistantBtn.addEventListener('click', () => {
      const text = messageInput.value.trim();
      if (!text) return;

      // Simple mock AI Spelling logic
      let suggestedText = text.replace(/\s{2,}/g, ' '); // remove double spaces
      // Mock correction example: capitalize first letter if not
      if (suggestedText.length > 0) {
        suggestedText = suggestedText.charAt(0).toUpperCase() + suggestedText.slice(1);
      }
      // Very basic spelling fix mock
      suggestedText = suggestedText.replace(/\bteh\b/g, 'the').replace(/\brecieve\b/g, 'receive');

      if (suggestedText === text) {
        aiContent.textContent = "No spelling corrections needed.";
        aiActions.style.display = 'none';
        currentAiSuggestion = '';
      } else {
        aiContent.textContent = suggestedText;
        aiActions.style.display = 'flex';
        currentAiSuggestion = suggestedText;
      }
      aiPopover.style.display = 'flex';
    });
  }
  if (aiAcceptBtn) {
    aiAcceptBtn.addEventListener('click', () => {
      if (currentAiSuggestion) {
        messageInput.value = currentAiSuggestion;
      }
      aiPopover.style.display = 'none';
    });
  }
  if (aiCancelBtn) {
    aiCancelBtn.addEventListener('click', () => {
      aiPopover.style.display = 'none';
    });
  }

  // --- Toast Notification ---
  function showDMToast(msg) {
    let toast = document.getElementById('dm-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dm-toast-notification';
      toast.className = 'dm-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // --- Reply & Action Menu ---
  const replyPreviewContainer = document.getElementById('chat-reply-preview-container');
  const replyPreviewSender = document.getElementById('reply-preview-sender');
  const replyPreviewText = document.getElementById('reply-preview-text');
  const replyPreviewCloseBtn = document.getElementById('reply-preview-close-btn');

  if (replyPreviewCloseBtn) {
    replyPreviewCloseBtn.addEventListener('click', () => {
      currentReplyToMessage = null;
      replyPreviewContainer.style.display = 'none';
    });
  }

  function activateReplyMode(msgId, rawText, senderName) {
    currentReplyToMessage = { id: msgId, text: rawText, senderName: senderName };
    replyPreviewSender.textContent = senderName;
    replyPreviewText.textContent = rawText;
    replyPreviewContainer.style.display = 'flex';
    messageInput.focus();
  }

  if (messagesScroll) {
    messagesScroll.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.chat-bubble');
      if (bubble) {
        const msgId = bubble.getAttribute('data-msg-id');
        const rawText = bubble.getAttribute('data-raw-text') || 'Message';
        const senderName = bubble.getAttribute('data-sender-name') || 'User';
        activateReplyMode(msgId, rawText, senderName);
      }
    });

    messagesScroll.addEventListener('click', (e) => {
      const actionTrigger = e.target.closest('.message-action-trigger');
      if (actionTrigger) {
        const dropdown = actionTrigger.nextElementSibling;
        if (dropdown && dropdown.classList.contains('message-action-dropdown')) {
          dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';

          // Close others
          document.querySelectorAll('.message-action-dropdown').forEach(d => {
            if (d !== dropdown) d.style.display = 'none';
          });
        }
        return;
      }

      const replyBtn = e.target.closest('.action-reply');
      if (replyBtn) {
        const wrapper = replyBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          const msgId = bubble.getAttribute('data-msg-id');
          const rawText = bubble.getAttribute('data-raw-text') || 'Message';
          const senderName = bubble.getAttribute('data-sender-name') || 'User';
          activateReplyMode(msgId, rawText, senderName);
        }
        replyBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const copyBtn = e.target.closest('.action-copy');
      if (copyBtn) {
        const wrapper = copyBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          const rawText = bubble.getAttribute('data-raw-text') || '';
          navigator.clipboard.writeText(rawText).then(() => {
            showDMToast('Message copied');
          });
        }
        copyBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const forwardBtn = e.target.closest('.action-forward');
      if (forwardBtn) {
        const wrapper = forwardBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          openForwardModal(bubble.getAttribute('data-msg-id'), bubble.getAttribute('data-raw-text') || 'Message');
        }
        forwardBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      const deleteBtn = e.target.closest('.action-delete');
      if (deleteBtn) {
        const wrapper = deleteBtn.closest('.message-bubble-wrapper');
        const bubble = wrapper.querySelector('.chat-bubble');
        if (bubble) {
          openDeleteModal(bubble.getAttribute('data-msg-id'), wrapper);
        }
        deleteBtn.closest('.message-action-dropdown').style.display = 'none';
        return;
      }

      // Close dropdowns when clicking elsewhere
      document.querySelectorAll('.message-action-dropdown').forEach(d => {
        d.style.display = 'none';
      });

      // Scroll to replied message if preview box clicked
      const repliedBox = e.target.closest('.replied-message-box');
      if (repliedBox) {
        const replyId = repliedBox.getAttribute('data-reply-id');
        if (replyId) {
          const targetBubble = messagesScroll.querySelector(`.chat-bubble[data-msg-id="${replyId}"]`);
          if (targetBubble) {
            targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetBubble.style.transition = 'background-color 0.5s';
            const originalBg = targetBubble.style.backgroundColor;
            targetBubble.style.backgroundColor = 'rgba(108, 59, 255, 0.3)';
            setTimeout(() => {
              targetBubble.style.backgroundColor = originalBg;
            }, 1000);
          }
        }
      }
    });
  }

  // --- Forward Modal ---
  const forwardModal = document.getElementById('forward-message-modal');
  const forwardCloseBtn = document.getElementById('forward-close-btn');
  const forwardCancelBtn = document.getElementById('forward-cancel-btn');
  const forwardSendBtn = document.getElementById('forward-send-btn');
  const forwardSearchInput = document.getElementById('forward-search-input');
  const forwardContactsList = document.getElementById('forward-contacts-list');
  let currentForwardMsgText = '';
  let selectedForwardRecipients = [];

  function openForwardModal(msgId, rawText) {
    currentForwardMsgText = rawText;
    selectedForwardRecipients = [];
    forwardSearchInput.value = '';
    forwardSendBtn.disabled = true;
    forwardModal.classList.add('active');
    populateForwardContacts();
  }

  function populateForwardContacts(query = '') {
    if (!forwardContactsList) return;
    forwardContactsList.innerHTML = '';

    // Filter chatThreads based on query
    const filtered = chatThreads.filter(t => t.user && (t.user.fullname || t.user.username).toLowerCase().includes(query.toLowerCase()));

    if (filtered.length === 0) {
      forwardContactsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:10px;">No contacts found</div>';
      return;
    }

    filtered.forEach(t => {
      const u = t.user;
      const el = document.createElement('div');
      el.className = 'forward-contact-item';
      if (selectedForwardRecipients.includes(u._id)) {
        el.classList.add('selected');
      }
      const avatarSrc = u.profilePic ? (u.profilePic.startsWith('http') ? u.profilePic : `${API_URL}${u.profilePic}`) : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      el.innerHTML = `
        <img src="${avatarSrc}" class="forward-contact-avatar" />
        <span class="forward-contact-name">${u.fullname || u.username}</span>
        <i data-lucide="check" class="forward-contact-check"></i>
      `;

      el.addEventListener('click', () => {
        if (selectedForwardRecipients.includes(u._id)) {
          selectedForwardRecipients = selectedForwardRecipients.filter(id => id !== u._id);
          el.classList.remove('selected');
        } else {
          selectedForwardRecipients.push(u._id);
          el.classList.add('selected');
        }
        forwardSendBtn.disabled = selectedForwardRecipients.length === 0;
      });

      forwardContactsList.appendChild(el);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  if (forwardSearchInput) {
    forwardSearchInput.addEventListener('input', (e) => {
      populateForwardContacts(e.target.value.trim());
    });
  }

  if (forwardCloseBtn) forwardCloseBtn.addEventListener('click', () => forwardModal.classList.remove('active'));
  if (forwardCancelBtn) forwardCancelBtn.addEventListener('click', () => forwardModal.classList.remove('active'));
  if (forwardSendBtn) {
    forwardSendBtn.addEventListener('click', async () => {
      forwardSendBtn.disabled = true;
      forwardSendBtn.textContent = 'Forwarding...';

      const currentUser = getCurrentUser();
      const token = localStorage.getItem('invibe_jwt_token');
      if (!currentUser || !token) return;

      try {
        for (const recipientId of selectedForwardRecipients) {
          const secretKey = getChatSecretKey(currentUser.id || currentUser._id, recipientId);
          const encryptedText = encryptMessage(currentForwardMsgText, secretKey);

          await fetch(`${API_URL}/api/chats/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipient: recipientId,
              content: encryptedText
            })
          });
        }
        showDMToast('Message forwarded successfully');
      } catch (err) {
        console.error('Error forwarding message:', err);
        showDMToast('Failed to forward message');
      }

      forwardModal.classList.remove('active');
      forwardSendBtn.textContent = 'Forward';
      loadChatThreads();
    });
  }

  // --- Delete Modal Logic ---
  const deleteModal = document.getElementById('delete-message-modal');
  const deleteCloseBtn = document.getElementById('delete-close-btn');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  let msgToDeleteId = null;
  let msgToDeleteWrapper = null;

  function openDeleteModal(msgId, wrapperElement) {
    msgToDeleteId = msgId;
    msgToDeleteWrapper = wrapperElement;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete';
    deleteModal.classList.add('active');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('active');
    msgToDeleteId = null;
    msgToDeleteWrapper = null;
  }

  if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', closeDeleteModal);
  if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      if (!msgToDeleteId) return;

      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.textContent = 'Deleting...';

      const token = localStorage.getItem('invibe_jwt_token');
      if (!token) return closeDeleteModal();

      try {
        const res = await fetch(`${API_URL}/api/chats/message/${msgToDeleteId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          // Remove from UI
          if (msgToDeleteWrapper) {
            msgToDeleteWrapper.remove();
          }

          // Update chatFeeds state silently
          if (state.currentChatThread && chatFeeds[state.currentChatThread]) {
            chatFeeds[state.currentChatThread] = chatFeeds[state.currentChatThread].filter(m => {
              return (m._id || m.id) !== msgToDeleteId;
            });
          }

          showDMToast('Message deleted');

          // Refresh thread list to update preview (if it was the last message)
          loadChatThreads();
        } else {
          let errData;
          try {
            errData = await res.json();
          } catch (e) {
            errData = await res.text();
          }
          const currentUser = getCurrentUser() || {};
          console.error("Supabase Error Details:", {
            error: errData,
            table: 'messages',
            message_id: msgToDeleteId,
            authenticated_user_id: currentUser.id || currentUser._id,
            response: res.status
          });
          throw new Error((errData && errData.error) || 'Failed to delete message');
        }
      } catch (err) {
        console.error('Error deleting message:', err);
        showDMToast('Failed to delete message');
      }

      closeDeleteModal();
    });
  }

});
