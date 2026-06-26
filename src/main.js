import './style.css'
import './auth.css'
import { initAuth } from './auth.js'

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- STATE SYSTEM ---
  const state = {
    theme: 'dark',
    activeView: 'home',
    currentChatThread: 'emma',
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
    stories: [
      { name: "Alex Rivers", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80", time: "2 hours ago" },
      { name: "Jamie Sun", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80", time: "5 hours ago" },
      { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80", img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80", time: "Yesterday" },
      { name: "Marcus", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80", time: "3 days ago" },
      { name: "Emma Johnson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80", img: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80", time: "1 week ago" }
    ],
    activeStoryIndex: 0,
    storyProgressInterval: null,
    storyProgressPercent: 0,
    isLudoRolling: false
  };

  // --- STICKY HEADER progressive BLUR ---
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
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

  function switchView(viewName) {
    if (!viewName) return;
    
    state.activeView = viewName;
    
    // Toggle body active class to hide right sidebar and expand content width (Congestion Fix!)
    if (viewName === 'chats') {
      document.body.classList.add('chats-view-active');
      if (appContainer) appContainer.classList.remove('chatting');
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
    radialNavItems.forEach(bubble => {
      const target = bubble.getAttribute('data-target-view');
      if (target === viewName) {
        bubble.classList.add('active-bubble');
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

  // Mouse and Touch Drag Listeners
  mainBubble.addEventListener('mousedown', dragStart);
  mainBubble.addEventListener('touchstart', dragStart, { passive: true });

  function dragStart(e) {
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

  function dragMove(e) {
    const coords = getDragCoords(e);
    const deltaX = coords.x - dragStartX;
    const deltaY = coords.y - dragStartY;
    
    // 5px threshold to separate simple clicks from drags
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDragging = true;
      navContainer.style.transform = 'none'; // CRITICAL: Clear translateX(-50%) to prevent offset jump!
      if (e.type === 'touchmove') e.preventDefault(); // Prevent double scroll in mobile
    }
    
    if (isDragging) {
      navContainer.style.bottom = 'auto';
      navContainer.style.left = 'auto';
      navContainer.style.margin = '0';
      navContainer.style.position = 'fixed';
      navContainer.style.left = `${bubbleStartX + deltaX}px`;
      navContainer.style.top = `${bubbleStartY + deltaY}px`;
    }
  }

  function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('touchend', dragEnd);
    
    navContainer.classList.remove('dragging');
    navContainer.style.transition = '';
    
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
      showToast('Navigation bubble repositioned! ⚓');
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
    
    storiesScroll.addEventListener('mousemove', (e) => {
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - storiesScroll.offsetLeft;
      const walk = (x - startX) * 2.5; 
      storiesScroll.scrollLeft = scrollLeft - walk;
    });
  }

  // --- LIKE INTERACTION & PARTICLE SYSTEMS ---
  const likeActionItems = document.querySelectorAll('.like-btn-action');
  const mediaContainers = document.querySelectorAll('.post-media-container');

  function triggerHeartExplosion(x, y, container) {
    const particleCount = 10;
    const colors = ['#6C3BFF', '#8A5CFF', '#a855f7', '#c084fc', '#e9d5ff'];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'explosion-particle';
      particle.innerHTML = '💜';
      
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 80;
      const randomX = Math.cos(angle) * distance;
      const randomY = Math.sin(angle) * distance - 20; 
      
      particle.style.setProperty('--x', `${randomX}px`);
      particle.style.setProperty('--y', `${randomY}px`);
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${10 + Math.random() * 14}px`;
      
      container.appendChild(particle);
      
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

  // Like buttons listeners
  likeActionItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const postId = item.getAttribute('data-post-id');
      const card = item.closest('.feed-card');
      const mediaBox = card.querySelector('.post-media-container');
      
      const rect = mediaBox.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      
      toggleLike(postId, item, relativeX, relativeY, mediaBox);
    });
  });

  // Double tap to like feed image
  mediaContainers.forEach(container => {
    let lastTap = 0;
    container.addEventListener('click', (e) => {
      const now = new Date().getTime();
      const timespan = now - lastTap;
      
      if (timespan < 300 && timespan > 0) {
        e.preventDefault();
        
        const card = container.closest('.feed-card');
        if (!card) return; // Skip if click in chat sync window
        
        const likeBtnWrapper = card.querySelector('.like-btn-action');
        const postId = likeBtnWrapper.getAttribute('data-post-id');
        const doubleHeart = container.querySelector('.double-tap-heart');
        
        const rect = container.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;
        
        if (doubleHeart) {
          doubleHeart.style.left = `${relativeX}px`;
          doubleHeart.style.top = `${relativeY}px`;
          doubleHeart.classList.remove('animate');
          void doubleHeart.offsetWidth;
          doubleHeart.classList.add('animate');
        }
        
        if (!state.isLiked[`post${postId}`]) {
          toggleLike(postId, likeBtnWrapper, relativeX, relativeY, container);
        } else {
          triggerHeartExplosion(relativeX, relativeY, container);
        }
      }
      lastTap = now;
    });
  });

  // --- POST 2 VIDEO PLAYBACK ---
  const videoPost = document.getElementById('post-2');
  if (videoPost) {
    const video = videoPost.querySelector('.post-media-video');
    const playOverlay = videoPost.querySelector('.video-play-overlay');
    const playIcon = playOverlay.querySelector('i');
    
    playOverlay.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        playIcon.setAttribute('data-lucide', 'pause');
        playOverlay.style.background = 'rgba(0,0,0,0)';
        playOverlay.style.opacity = '0';
      } else {
        video.pause();
        playIcon.setAttribute('data-lucide', 'play');
        playOverlay.style.background = 'rgba(0,0,0,0.25)';
        playOverlay.style.opacity = '1';
      }
      if (window.lucide) window.lucide.createIcons();
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

  // Play/Pause explore reels on click
  const reelCards = document.querySelectorAll('.reel-card');
  reelCards.forEach(card => {
    const video = card.querySelector('.reel-video');
    const playPop = card.querySelector('.reel-play-icon-overlay');
    
    // Drag & Drop feature for reels vertical capsule
    const capsule = card.querySelector('.reel-actions-capsule');
    if (capsule) {
      let isDraggingCapsule = false;
      let wasDragging = false;
      let startX, startY;
      let posX = 0;
      let posY = 0;
      
      capsule.addEventListener('mousedown', dragStart);
      capsule.addEventListener('touchstart', dragStart, { passive: false });
      
      // Intercept clicks during capture phase if we were dragging
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
    
    card.addEventListener('click', (e) => {
      // Prevent double click triggers
      if (e.detail > 1) return;
      
      // Don't trigger if clicked on right engagement buttons
      if (e.target.closest('.reel-right-actions')) return;

      if (video.paused) {
        video.play();
        playPop.classList.remove('active');
        void playPop.offsetWidth;
        playPop.querySelector('i').setAttribute('data-lucide', 'play');
        playPop.classList.add('active');
      } else {
        video.pause();
        playPop.classList.remove('active');
        void playPop.offsetWidth;
        playPop.querySelector('i').setAttribute('data-lucide', 'pause');
        playPop.classList.add('active');
      }
      if (window.lucide) window.lucide.createIcons();
    });

    // Double tap reels to like
    let lastReelTap = 0;
    card.addEventListener('click', (e) => {
      const now = new Date().getTime();
      const timespan = now - lastReelTap;
      
      if (timespan < 300 && timespan > 0) {
        e.preventDefault();
        
        // Trigger explosion
        const rect = card.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;
        
        const doubleHeart = card.querySelector('.double-tap-heart');
        if (doubleHeart) {
          doubleHeart.style.left = `${relativeX}px`;
          doubleHeart.style.top = `${relativeY}px`;
          doubleHeart.classList.remove('animate');
          void doubleHeart.offsetWidth;
          doubleHeart.classList.add('animate');
        }
        
        const likeBtn = card.querySelector('.reel-like-action .heart-btn');
        if (likeBtn && !likeBtn.classList.contains('liked')) {
          likeBtn.classList.add('liked');
          const heartIcon = likeBtn.querySelector('i');
          if (heartIcon) {
            heartIcon.style.fill = '#6C3BFF';
            heartIcon.style.stroke = '#6C3BFF';
          }
        }
        triggerHeartExplosion(relativeX, relativeY, card);
        showToast('Liked Reel! ❤️');
      }
      lastReelTap = now;
    });

    // Follow simulated alert inside reel
    const followReel = card.querySelector('.reel-follow-btn');
    if (followReel) {
      followReel.addEventListener('click', (e) => {
        e.stopPropagation();
        followReel.textContent = 'Vibing';
        followReel.style.background = 'rgba(255,255,255,0.2)';
        showToast('Added to Vibing network!');
      });
    }

    // Single-tap like toggle on heart button
    const heartBtn = card.querySelector('.reel-like-action .heart-btn');
    if (heartBtn) {
      heartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isLiked = heartBtn.classList.contains('liked');
        const icon = heartBtn.querySelector('i');
        if (isLiked) {
          heartBtn.classList.remove('liked');
          if (icon) { icon.style.fill = 'none'; icon.style.stroke = ''; }
          showToast('Like removed');
        } else {
          heartBtn.classList.add('liked');
          if (icon) { icon.style.fill = '#6C3BFF'; icon.style.stroke = '#6C3BFF'; }
          showToast('Liked Reel! 💜');
        }
      });
    }

    // Bookmark / save toggle
    const saveBtn = card.querySelector('.reel-save-action .star-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isSaved = saveBtn.classList.contains('saved');
        const icon = saveBtn.querySelector('i');
        if (isSaved) {
          saveBtn.classList.remove('saved');
          if (icon) { icon.style.fill = 'none'; icon.style.stroke = ''; }
          showToast('Removed from Saved');
        } else {
          saveBtn.classList.add('saved');
          if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
          showToast('Saved to collection ⭐');
        }
      });
    }
    
  });

  // --- HOME FEED BOOKMARK / SAVE BUTTON HANDLER ---
  const homeBookmarkButtons = document.querySelectorAll('.bookmark-btn-action .bookmark-btn');
  homeBookmarkButtons.forEach(bookmarkBtn => {
    bookmarkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isSaved = bookmarkBtn.classList.contains('saved');
      const icon = bookmarkBtn.querySelector('i');
      if (isSaved) {
        bookmarkBtn.classList.remove('saved');
        if (icon) { icon.style.fill = 'none'; icon.style.stroke = ''; }
        showToast('Removed from Saved');
      } else {
        bookmarkBtn.classList.add('saved');
        if (icon) { icon.style.fill = '#FBBF24'; icon.style.stroke = '#FBBF24'; }
        showToast('Saved to collection ⭐');
      }
    });
  });


  // --- PREMIUM STORY AUTO-PLAY VIEWER SYSTEM ---
  const storyCards = document.querySelectorAll('.story-card.active-story');
  const storyViewer = document.getElementById('story-viewer-modal');
  const storyViewerClose = document.getElementById('story-viewer-close');
  const storyViewerAvatar = document.getElementById('story-viewer-avatar');
  const storyViewerName = document.getElementById('story-viewer-name');
  const storyViewerTime = document.getElementById('story-viewer-time');
  const storyViewerImg = document.getElementById('story-viewer-img');
  const storyProgressBars = document.getElementById('story-progress-bars');
  
  const storyPrev = document.getElementById('story-prev-btn');
  const storyNext = document.getElementById('story-next-btn');
  
  function openStoryViewer(index) {
    state.activeStoryIndex = index;
    storyViewer.classList.add('active');
    loadStoryContent(index);
  }

  function loadStoryContent(index) {
    const data = state.stories[index];
    if (!data) {
      closeStoryViewer();
      return;
    }
    
    storyViewerAvatar.src = data.avatar;
    storyViewerName.textContent = data.name;
    storyViewerTime.textContent = data.time;
    storyViewerImg.src = data.img;
    
    // Reset/Re-build Progress Bars
    storyProgressBars.innerHTML = '';
    for (let i = 0; i < state.stories.length; i++) {
      const barWrapper = document.createElement('div');
      barWrapper.className = 'story-progress-bar-wrapper';
      const barFill = document.createElement('div');
      barFill.className = 'story-progress-bar-fill';
      
      if (i < index) {
        barFill.style.width = '100%';
      } else if (i > index) {
        barFill.style.width = '0%';
      }
      
      barWrapper.appendChild(barFill);
      storyProgressBars.appendChild(barWrapper);
    }
    
    startStoryTimer();
  }

  function startStoryTimer() {
    stopStoryTimer();
    state.storyProgressPercent = 0;
    
    const activeFill = storyProgressBars.children[state.activeStoryIndex].querySelector('.story-progress-bar-fill');
    
    state.storyProgressInterval = setInterval(() => {
      state.storyProgressPercent += 2; // increments ticks
      if (activeFill) activeFill.style.width = `${state.storyProgressPercent}%`;
      
      if (state.storyProgressPercent >= 100) {
        stopStoryTimer();
        // Go to next story
        if (state.activeStoryIndex < state.stories.length - 1) {
          openStoryViewer(state.activeStoryIndex + 1);
        } else {
          closeStoryViewer();
        }
      }
    }, 100); // 100 * 50 = 5000ms total autoplay time per story
  }

  function stopStoryTimer() {
    if (state.storyProgressInterval) {
      clearInterval(state.storyProgressInterval);
      state.storyProgressInterval = null;
    }
  }

  function closeStoryViewer() {
    stopStoryTimer();
    storyViewer.classList.remove('active');
  }

  // Circular stories card click trigger
  storyCards.forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-story-index'));
      openStoryViewer(idx);
    });
  });

  if (storyViewerClose) storyViewerClose.addEventListener('click', closeStoryViewer);
  if (storyPrev) {
    storyPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeStoryIndex > 0) {
        openStoryViewer(state.activeStoryIndex - 1);
      }
    });
  }
  if (storyNext) {
    storyNext.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeStoryIndex < state.stories.length - 1) {
        openStoryViewer(state.activeStoryIndex + 1);
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
        showToast('Vibe reply sent! 📩');
        storyReplyInput.value = '';
        closeStoryViewer();
      }
    });
  }

  // Post story upload simulation
  const addStoryBtn = document.getElementById('add-story-file-trigger');
  const storyFileInput = document.getElementById('story-file-input');

  if (addStoryBtn) {
    addStoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      storyFileInput.click();
    });
  }

  if (storyFileInput) {
    storyFileInput.addEventListener('change', () => {
      if (storyFileInput.files.length > 0) {
        const file = storyFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          const imgUrl = e.target.result;
          
          // Add story to state stories
          const newStory = {
            name: "You",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
            img: imgUrl,
            time: "Just now"
          };
          state.stories.unshift(newStory);
          
          // Re-render Story Card lists dynamically
          const currentStoryBtn = document.getElementById('story-btn-current');
          const newStoryCard = document.createElement('div');
          newStoryCard.className = 'story-card active-story';
          newStoryCard.setAttribute('data-story-index', '0');
          newStoryCard.innerHTML = `
            <div class="story-avatar-container">
              <div class="story-ring"></div>
              <img src="${newStory.avatar}" alt="Your Vibe" />
            </div>
            <span class="story-username">You</span>
          `;
          
          // Insert after "Your Story" button
          currentStoryBtn.after(newStoryCard);
          
          // Add click trigger
          newStoryCard.addEventListener('click', () => {
            openStoryViewer(0);
          });
          
          // Recalculate story indexes of remaining circular cards
          const allActiveCards = document.querySelectorAll('.story-card.active-story');
          allActiveCards.forEach((c, idx) => {
            c.setAttribute('data-story-index', idx.toString());
          });

          // Increment followers stats
          const followerCount = document.getElementById('user-followers-count');
          if (followerCount) followerCount.textContent = '12.9K';
          
          showToast('New vibe published successfully! 📸✨');
        };
        reader.readAsDataURL(file);
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


  // --- CHAT THREADS SWITCHER WITH MULTIPLE MESSAGES LOGS ---
  const threadItems = document.querySelectorAll('.thread-item');
  const chatHeaderName = document.querySelector('.chat-header-name');
  const chatHeaderAvatar = document.querySelector('.chat-header-avatar');
  const messagesScroll = document.getElementById('chat-messages-container');

  const chatFeeds = {
    emma: [
      { sender: 'received', content: 'Hey Alex! 👋', time: '9:40 AM' },
      { sender: 'sent', content: 'Hey Emma! How are you?', time: '9:41 AM' },
      { sender: 'received', content: "I'm good! Want to watch something together? 🎁", time: '9:41 AM' },
      { sender: 'sent', content: "Sure! Let's Watch Together 🥳", time: '9:42 AM' },
      { sender: 'received-react', content: 'Awesome, clicking the Watch Together widget now!', reactions: ['❤️', '😍', '🔥'], time: '9:42 AM' }
    ],
    alex: [
      { sender: 'received', content: 'Hi, are the mockups ready yet?', time: 'Yesterday' },
      { sender: 'sent', content: 'Yes, just finishing up the active radial transitions.', time: 'Yesterday' },
      { sender: 'received', content: 'Awesome! Can\'t wait to test on spatial display.', time: 'Yesterday' }
    ],
    family: [
      { sender: 'received', content: 'Mom: Make sure to come back by 8pm!', time: 'Mon' },
      { sender: 'received', content: 'Dad: I will bring the dessert 🍰', time: 'Mon' },
      { sender: 'sent', content: 'Got it, see you then!', time: 'Mon' }
    ],
    marcus: [
      { sender: 'received', content: 'Hey, let\'s hop on Ludo together tonight?', time: 'Sun' },
      { sender: 'sent', content: 'I am down. Voice room open.', time: 'Sun' }
    ]
  };

  const chatAvatars = {
    emma: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
    alex: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    family: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    marcus: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80'
  };

  const chatNames = {
    emma: 'Emma Johnson',
    alex: 'Alex Rivers',
    family: 'Family Group',
    marcus: 'Marcus'
  };

  threadItems.forEach(item => {
    item.addEventListener('click', () => {
      const threadKey = item.getAttribute('data-thread');
      state.currentChatThread = threadKey;
      
      threadItems.forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      
      if (chatHeaderName) chatHeaderName.textContent = chatNames[threadKey];
      if (chatHeaderAvatar) chatHeaderAvatar.src = chatAvatars[threadKey];
      
      renderChatMessages(threadKey);
      switchChatMode('chat');

      // Mobile responsive toggle
      if (window.innerWidth <= 680) {
        const grid = document.querySelector('.chats-layout-grid');
        if (grid) grid.classList.add('chatting');
        const mainChat = document.querySelector('.chat-window-main');
        if (mainChat) mainChat.style.display = 'flex';
      }
    });
  });

  const backToInboxBtn = document.querySelector('.back-to-inbox-btn');
  if (backToInboxBtn) {
    backToInboxBtn.addEventListener('click', () => {
      const grid = document.querySelector('.chats-layout-grid');
      if (grid) grid.classList.remove('chatting');
      const mainChat = document.querySelector('.chat-window-main');
      if (mainChat) mainChat.style.display = 'none';
    });
  }

  function renderChatMessages(threadKey) {
    if (!messagesScroll) return;
    messagesScroll.innerHTML = '<div class="chat-date-separator">Today</div>';
    
    const messages = chatFeeds[threadKey] || [];
    messages.forEach(msg => {
      const bubble = document.createElement('div');
      
      if (msg.sender === 'received-react') {
        bubble.className = 'chat-bubble received-react';
        if (msg.isImage) bubble.classList.add('image-bubble');
        bubble.innerHTML = `
          <div class="bubble-content">${msg.content}</div>
          <div class="bubble-reactions-row">
            ${msg.reactions.map(r => `<span class="react-pill">${r}</span>`).join('')}
          </div>
          <div class="bubble-time">${msg.time}</div>
        `;
      } else {
        bubble.className = `chat-bubble ${msg.sender}`;
        if (msg.isImage) bubble.classList.add('image-bubble');
        bubble.innerHTML = `
          <div class="bubble-content">${msg.content}</div>
          <div class="bubble-time">${msg.time} ${msg.sender === 'sent' ? '<i data-lucide="check-check" style="width: 10px; height: 10px; display: inline;"></i>' : ''}</div>
        `;
      }
      messagesScroll.appendChild(bubble);
    });
    
    messagesScroll.scrollTop = messagesScroll.scrollHeight;
    if (window.lucide) window.lucide.createIcons();
  }

  // Chat message input and send
  const messageInput = document.getElementById('chat-message-input');
  const sendMsgBtn = document.getElementById('chat-send-msg-btn');

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = { sender: 'sent', content: text, time: time };
    
    // Close emoji picker popover if open
    const emojiPopover = document.getElementById('chat-emoji-popover');
    if (emojiPopover) emojiPopover.classList.remove('active');

    chatFeeds[state.currentChatThread].push(newMsg);
    renderChatMessages(state.currentChatThread);
    messageInput.value = '';
    
    triggerAutoReply();
  }

  if (sendMsgBtn) {
    sendMsgBtn.addEventListener('click', sendMessage);
  }
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // AI replies chips
  const replyChips = document.querySelectorAll('.reply-chip');
  replyChips.forEach(chip => {
    chip.addEventListener('click', () => {
      messageInput.value = chip.textContent;
      sendMessage();
    });
  });

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
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
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
    cameraCaptureAction.addEventListener('click', () => {
      if (!cameraStream || !cameraVideo || !cameraCanvas) return;
      
      const width = cameraVideo.videoWidth || 640;
      const height = cameraVideo.videoHeight || 480;
      
      cameraCanvas.width = width;
      cameraCanvas.height = height;
      
      const ctx = cameraCanvas.getContext('2d');
      if (ctx) {
        // Draw video frame to canvas
        ctx.drawImage(cameraVideo, 0, 0, width, height);
        
        // Export to base64
        try {
          const imgUrl = cameraCanvas.toDataURL('image/png');
          
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newMsg = {
            sender: 'sent',
            isImage: true,
            content: `<img src="${imgUrl}" alt="Captured Photo" />`,
            time: time
          };

          if (chatFeeds[state.currentChatThread]) {
            chatFeeds[state.currentChatThread].push(newMsg);
            renderChatMessages(state.currentChatThread);
            triggerAutoReply();
          }
          
          closeCameraCapture();
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
      reader.onload = function(evt) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const imgUrl = evt.target.result;
        
        const newMsg = {
          sender: 'sent',
          isImage: true,
          content: `<img src="${imgUrl}" alt="Uploaded Photo" />`,
          time: time
        };

        if (chatFeeds[state.currentChatThread]) {
          chatFeeds[state.currentChatThread].push(newMsg);
          renderChatMessages(state.currentChatThread);
          triggerAutoReply();
        }
        
        closeCameraCapture();
      };
      reader.readAsDataURL(file);
      // Clear value so the same file can be chosen again
      chatCameraInput.value = '';
    });
  }

  function triggerAutoReply() {
    setTimeout(() => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentThread = state.currentChatThread;
      const replies = [
        "That sounds like a great plan! ✨",
        "Could you show me a demo of this spatial effect? 🕶️",
        "Working on the feedback now, stay tuned!",
        "Yes, Hi-HUBBLE feels extremely responsive!"
      ];
      
      const replyText = replies[Math.floor(Math.random() * replies.length)];
      const responseMsg = { sender: 'received', content: replyText, time: time };
      
      chatFeeds[currentThread].push(responseMsg);
      
      if (state.currentChatThread === currentThread) {
        renderChatMessages(currentThread);
        showToast(`Message from ${chatNames[currentThread]} 💬`);
      }
    }, 1500);
  }

  // --- INBOX SIDEBAR CONTROLS (INTERACTIVITY) ---
  const inboxSearchInput = document.getElementById('inbox-search-input');
  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', () => {
      const query = inboxSearchInput.value.toLowerCase().trim();
      threadItems.forEach(item => {
        const nameNode = item.querySelector('.thread-name');
        if (nameNode) {
          const name = nameNode.textContent.toLowerCase();
          if (name.includes(query)) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        }
      });
    });
  }

  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      const category = pill.getAttribute('data-cat');
      threadItems.forEach(item => {
        if (category === 'all') {
          item.style.display = 'flex';
        } else if (category === 'friends') {
          const isFriends = item.getAttribute('data-thread') === 'emma';
          item.style.display = isFriends ? 'flex' : 'none';
        } else if (category === 'family') {
          const isFamily = item.getAttribute('data-thread') === 'family';
          item.style.display = isFamily ? 'flex' : 'none';
        }
      });
      showToast(`Filtered inbox: ${category.toUpperCase()}`);
    });
  });

  let currentFilterMode = 'all'; // all, unread, favorites
  const inboxFiltersBtn = document.getElementById('inbox-filters-btn');
  if (inboxFiltersBtn) {
    inboxFiltersBtn.addEventListener('click', () => {
      if (currentFilterMode === 'all') {
        currentFilterMode = 'unread';
        threadItems.forEach(item => {
          const hasUnread = item.querySelector('.unread-count');
          item.style.display = hasUnread ? 'flex' : 'none';
        });
        showToast('Inbox filtered by: Unread Messages ✉️');
      } else if (currentFilterMode === 'unread') {
        currentFilterMode = 'favorites';
        threadItems.forEach(item => {
          const hasFav = item.querySelector('.favorite-star');
          item.style.display = hasFav ? 'flex' : 'none';
        });
        showToast('Inbox filtered by: Starred / Favorites ⭐');
      } else {
        currentFilterMode = 'all';
        threadItems.forEach(item => {
          item.style.display = 'flex';
        });
        showToast('Inbox filter reset: Showing All Chats 📂');
      }
    });
  }

  const inboxLayoutBtn = document.getElementById('inbox-layout-btn');
  const chatThreadsList = document.querySelector('.chat-threads-list');
  if (inboxLayoutBtn && chatThreadsList) {
    inboxLayoutBtn.addEventListener('click', () => {
      chatThreadsList.classList.toggle('compact-view');
      const isCompact = chatThreadsList.classList.contains('compact-view');
      showToast(isCompact ? 'Switched to Compact Layout View 📋' : 'Switched to Comfortable Layout View 📊');
    });
  }

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
      if (panel.id === `chat-sub-view-${modeName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (modeName === 'call') {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'none';
      startVideoCallTimer();
    } else {
      if (chatGlobalFooter) chatGlobalFooter.style.display = 'flex';
      stopVideoCallTimer();
      const watchVideo = document.getElementById('watch-together-video');
      if (watchVideo && modeName !== 'watch') {
        watchVideo.pause();
      }
    }
    showToast(`Switched Chat layout: ${modeName.toUpperCase()} ⚡`);
  }

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-chat-mode');
      if (mode) switchChatMode(mode);
    });
  });


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
    { id: 'camera-click-sim', label: 'Camera stream active. Photo taken! 📸' },
    { id: 'mic-click-sim', label: 'Audio recording started... 🎙️' },
    { id: 'loc-click-sim', label: 'Location shared: 37.7749° N, 122.4194° W 📍' },
    { id: 'ai-click-sim', label: 'Hi-HUBBLE AI Assistant: Processing chats... ✨' },
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


  // --- VIDEO CALL TIMER CONTROLLER ---
  const callTimerDisplay = document.getElementById('call-timer-display');
  
  function startVideoCallTimer() {
    stopVideoCallTimer();
    state.callSeconds = 1455; // start at 00:24:15
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

  // Call Button Controllers
  const endCallBtn = document.getElementById('end-call-btn');
  if (endCallBtn) {
    endCallBtn.addEventListener('click', () => {
      switchChatMode('chat');
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
      showToast(muteBtn.classList.contains('active') ? 'Microphone Muted 🔇' : 'Microphone Active 🎙️');
    });
  }
  if (camBtn) {
    camBtn.addEventListener('click', () => {
      camBtn.classList.toggle('active');
      if (camBtn.classList.contains('active')) {
        localCamFeed.style.opacity = '0';
        showToast('Your Camera Off 📷');
      } else {
        localCamFeed.style.opacity = '1';
        showToast('Your Camera Active 📹');
      }
    });
  }
  if (speakerBtn) {
    speakerBtn.addEventListener('click', () => {
      speakerBtn.classList.toggle('active');
      showToast(speakerBtn.classList.contains('active') ? 'Speaker Output: Muted 🔕' : 'Speaker Output: Loud 🔊');
    });
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      shareBtn.classList.toggle('active');
      if (shareBtn.classList.contains('active')) {
        remoteCamFeed.src = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80';
        showToast('Screen sharing initialized! 🖥️');
      } else {
        remoteCamFeed.src = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80';
        showToast('Screen sharing stopped.');
      }
    });
  }


  // --- GLOBAL SEARCH CARD FILTER CONTROLLER ---
  const globalSearchInput = document.getElementById('global-search');
  const feedCards = document.querySelectorAll('.feed-card');
  const emptyStateCard = document.getElementById('feed-empty-state');

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      const term = globalSearchInput.value.toLowerCase().trim();
      let matchCount = 0;
      
      feedCards.forEach(card => {
        // Skip empty state
        if (card.id === 'feed-empty-state') return;
        
        const caption = card.querySelector('.post-caption').textContent.toLowerCase();
        const author = card.querySelector('.author-name').textContent.toLowerCase();
        
        if (caption.includes(term) || author.includes(term)) {
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
    });
  }

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
  
  // Follow suggestions row
  const followSug1 = document.getElementById('follow-sug-1');
  if (followSug1) {
    followSug1.addEventListener('click', () => {
      followSug1.classList.toggle('followed');
      if (followSug1.classList.contains('followed')) {
        followSug1.textContent = 'Vibing';
        showToast('You are now vibing with Zoe Lin!');
      } else {
        followSug1.textContent = 'Follow';
        showToast('Unfollowed Zoe Lin.');
      }
    });
  }

  const followSug2 = document.getElementById('follow-sug-2');
  if (followSug2) {
    followSug2.addEventListener('click', () => {
      followSug2.classList.toggle('followed');
      if (followSug2.classList.contains('followed')) {
        followSug2.textContent = 'Vibing';
      } else {
        followSug2.textContent = 'Follow';
        showToast('Unfollowed Marcus.');
      }
    });
  }

  // Suggest see all
  const sugSeeAll = document.getElementById('sug-see-all-btn');
  if (sugSeeAll) {
    sugSeeAll.addEventListener('click', () => {
      showToast('Loading additional viber recommendations... 👥');
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
  const profileLargeAvatar = document.querySelector('.profile-large-avatar');
  const profilePreviewAvatarImg = document.querySelector('.profile-preview-avatar img');
  const headerAvatarImg = document.querySelector('.header-profile img');
  const profileNameH2 = document.querySelector('.profile-title-details h2');
  const profilePreviewNameH3 = document.querySelector('.profile-preview-info h3');
  const profileHandleP = document.querySelector('.prof-handle');
  const profilePreviewHandleP = document.querySelector('.profile-preview-info p');
  const profileBioP = document.querySelector('.prof-bio');

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
      }
    });
  }

  function closeEditProfileModal() {
    if (editProfileModal) {
      editProfileModal.classList.remove('active');
    }
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
    editProfileSaveBtn.addEventListener('click', () => {
      const newName = editNameInput ? editNameInput.value.trim() : "";
      const newHandle = editHandleInput ? editHandleInput.value.trim() : "";
      const newBio = editBioInput ? editBioInput.value.trim() : "";

      if (!newName || !newHandle) {
        showToast('Name and Handle are required! ⚠️');
        return;
      }

      // 1. Update text fields on profile page
      if (profileNameH2) {
        profileNameH2.innerHTML = `${newName} <span class="verified-badge"><i data-lucide="check"></i></span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      if (profilePreviewNameH3) profilePreviewNameH3.textContent = newName;
      if (profileHandleP) profileHandleP.textContent = newHandle;
      if (profilePreviewHandleP) profilePreviewHandleP.textContent = newHandle;
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
          showToast('Opening Vibe Settings... ⚙️');
          break;
        case 'privacy':
          showToast('Opening Privacy & Safety... 🔒');
          break;
        case 'notifications':
          showToast('Opening Notifications... 🔔');
          break;
        case 'help':
          showToast('Opening Help & Support... 💬');
          break;
        case 'about':
          showToast('Opening About In Vibe... ℹ️');
          break;
        default:
          showToast('Action not available yet.');
      }
    });
  });

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      showToast('Logged out successfully.');
      // Future: replace with real logout flow
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
  const mockComments = {
    post1: [
      { name: "Zoe Lin", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80", text: "This is breathtaking! 🏔️", time: "2h ago" },
      { name: "Marcus", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80", text: "Team offsite looks amazing. Hope the coding went well too!", time: "1h ago" }
    ],
    post2: [
      { name: "Emma Johnson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80", text: "Vite dev server speed is unmatched! ⚡", time: "5h ago" }
    ],
    post3: [
      { name: "Alex Rivers", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", text: "Glassmorphism fits VisionOS so well.", time: "1h ago" }
    ],
    post4: [
      { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80", text: "Coffee + code = best combination ☕", time: "Yesterday" }
    ],
    reel1: [
      { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80", text: "This floating engine runs super smooth! 🚀", time: "3h ago" },
      { name: "Alex Rivers", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", text: "Amazing mixkit video pick!", time: "10m ago" }
    ],
    reel2: [
      { name: "Jamie Sun", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", text: "Nature vibes are the best 🌲✨", time: "1h ago" }
    ]
  };

  const mockFriends = [
    { name: "Zoe Lin", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80" },
    { name: "Jamie Sun", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Marcus", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80" },
    { name: "Emma Johnson", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80" }
  ];

  const commentsModal = document.getElementById('comments-modal');
  const shareModal = document.getElementById('share-modal');

  let activeCommentKey = 'post1';

  function getCommentTargets(modal) {
    if (!modal) return null;
    return {
      list: modal.querySelector('.comments-list'),
      input: modal.querySelector('.comments-footer input'),
      sendBtn: modal.querySelector('.comment-send-btn')
    };
  }

  function openComments(key, modalOverride = commentsModal) {
    const modal = modalOverride || commentsModal;
    const targets = getCommentTargets(modal);
    if (!modal || !targets || !targets.list) return;

    activeCommentKey = key.replace('-', '');
    renderComments(modal, targets.list);
    modal.classList.add('active');
  }

  function renderComments(modal = commentsModal, commentList = null) {
    const targets = getCommentTargets(modal);
    const list = commentList || targets?.list;
    if (!list) return;

    list.innerHTML = '';
    const comments = mockComments[activeCommentKey] || [];
    if (comments.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px; font-size: 13px;">No comments yet. Be the first to comment! 💬</div>';
      return;
    }
    comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <img src="${c.avatar}" class="comment-avatar" alt="${c.name}" />
        <div class="comment-details">
          <div class="comment-meta">
            <span class="comment-username">${c.name}</span>
            <span class="comment-time">${c.time}</span>
          </div>
          <p class="comment-text">${c.text}</p>
        </div>
      `;
      list.appendChild(item);
    });
    list.scrollTop = list.scrollHeight;
  }

  function submitComment(modal = commentsModal) {
    const targets = getCommentTargets(modal);
    if (!targets || !targets.input || !targets.list) return;

    const text = targets.input.value.trim();
    if (!text) return;

    const newComment = {
      name: "Alex Rivers",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
      text: text,
      time: "Just now"
    };

    if (!mockComments[activeCommentKey]) {
      mockComments[activeCommentKey] = [];
    }
    mockComments[activeCommentKey].push(newComment);
    targets.input.value = '';
    renderComments(modal, targets.list);
    showToast('Comment posted! 💬');
  }

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

    renderShareFriends(modal, shareList);
    modal.classList.add('active');
  }

  function renderShareFriends(modal = shareModal, shareList = null) {
    const list = shareList || modal?.querySelector('.share-friends-list');
    if (!list) return;

    list.innerHTML = '';
    mockFriends.forEach(friend => {
      const card = document.createElement('div');
      card.className = 'share-friend-card';
      card.innerHTML = `
        <img src="${friend.avatar}" class="share-friend-avatar" alt="${friend.name}" />
        <span class="share-friend-name">${friend.name}</span>
      `;
      card.addEventListener('click', () => {
        showToast(`Sent to ${friend.name}! ✈️`);
        if (modal) modal.classList.remove('active');
      });
      list.appendChild(card);
    });
  }

  // Handle submit buttons and keyboard input for comment fields
  document.addEventListener('click', (e) => {
    const sendBtn = e.target.closest('.comment-send-btn');
    if (sendBtn) {
      e.preventDefault();
      e.stopPropagation();
      const modal = sendBtn.closest('.story-viewer-overlay');
      submitComment(modal || commentsModal);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.comments-footer input')) {
      e.preventDefault();
      const modal = e.target.closest('.story-viewer-overlay');
      submitComment(modal || commentsModal);
    }
  });

  // Bind comments click events dynamically for Feed cards and Reels
  document.addEventListener('click', (e) => {
    // Comment trigger click
    const commentBtn = e.target.closest('.comment-btn-action, .reel-comment-sim');
    if (commentBtn) {
      e.preventDefault();
      e.stopPropagation();
      let key = 'post1';
      let modalOverride = commentsModal;
      if (commentBtn.classList.contains('reel-comment-sim')) {
        const id = commentBtn.getAttribute('data-reel-id') || '1';
        key = `reel${id}`;
        const reelCard = commentBtn.closest('.reel-card');
        modalOverride = reelCard ? reelCard.querySelector('.reel-comments-modal') : commentsModal;
      } else {
        const card = commentBtn.closest('.feed-card');
        key = card ? card.id : 'post1';
        modalOverride = card ? card.querySelector('.feed-comments-modal') : commentsModal;
      }
      openComments(key, modalOverride);
    }

    // Share trigger click
    const shareBtn = e.target.closest('.share-btn-action, .reel-share-sim');
    if (shareBtn) {
      e.preventDefault();
      e.stopPropagation();
      let key = 'post1';
      let modalOverride = shareModal;
      if (shareBtn.classList.contains('reel-share-sim')) {
        const id = shareBtn.getAttribute('data-reel-id') || '1';
        key = `reel${id}`;
        const reelCard = shareBtn.closest('.reel-card');
        modalOverride = reelCard ? reelCard.querySelector('.reel-share-modal') : shareModal;
      } else {
        const card = shareBtn.closest('.feed-card');
        key = card ? card.id : 'post1';
        modalOverride = card ? card.querySelector('.feed-share-modal') : shareModal;
      }
      openShare(key, modalOverride);
    }
  });


});
