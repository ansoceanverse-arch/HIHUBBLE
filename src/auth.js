import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initAuth() {
  const authView = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-container');

  const step1 = document.getElementById('onboard-step-1');
  const step2 = document.getElementById('onboard-step-2');

  const usernameInput = document.getElementById('quick-username-input');
  const usernameError = document.getElementById('onboard-username-error');
  const gotoCameraBtn = document.getElementById('btn-goto-camera');

  const videoElem = document.getElementById('live-webcam-video');
  const photoPreviewElem = document.getElementById('live-photo-preview');
  const canvasElem = document.getElementById('live-webcam-canvas');
  const webcamStatusMsg = document.getElementById('webcam-status-msg');

  const snapPhotoBtn = document.getElementById('btn-snap-photo');
  const retakePhotoBtn = document.getElementById('btn-retake-photo');
  const finishOnboardBtn = document.getElementById('btn-finish-onboard');

  let webcamStream = null;
  let capturedBase64 = null;
  let enteredUsername = '';

  function showAuthView() {
    if (authView) {
      authView.classList.remove('hidden');
      authView.style.display = 'flex';
    }
    if (appContainer) appContainer.style.display = 'none';
    if (step1) step1.style.display = 'flex';
    if (step2) step2.style.display = 'none';
    if (window.debouncedCreateIcons) window.debouncedCreateIcons(); else if (window.lucide) window.lucide.createIcons();
  }

  function showAppView() {
    stopWebcam();
    if (authView) {
      authView.classList.add('hidden');
      authView.style.display = 'none';
    }
    if (appContainer) appContainer.style.display = 'block';
    updateAppUI();
  }

  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
  }

  async function startWebcam() {
    try {
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Starting camera preview...';
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false
      });
      if (videoElem) {
        videoElem.srcObject = webcamStream;
        videoElem.style.display = 'block';
      }
      if (photoPreviewElem) photoPreviewElem.style.display = 'none';
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Center your face and click "Snap Photo"';
      if (snapPhotoBtn) snapPhotoBtn.style.display = 'inline-flex';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'none';
      if (finishOnboardBtn) finishOnboardBtn.style.display = 'none';
    } catch (err) {
      console.warn('Webcam not available or permission denied:', err);
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Camera unavailable. Generated initial avatar.';
      
      // Fallback circular avatar generator
      if (canvasElem) {
        canvasElem.width = 400;
        canvasElem.height = 400;
        const ctx = canvasElem.getContext('2d');
        ctx.fillStyle = '#8a5cff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 160px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(enteredUsername.charAt(0).toUpperCase() || 'H', 200, 200);
        capturedBase64 = canvasElem.toDataURL('image/jpeg');
      }

      if (photoPreviewElem) {
        photoPreviewElem.src = capturedBase64;
        photoPreviewElem.style.display = 'block';
      }
      if (videoElem) videoElem.style.display = 'none';

      if (snapPhotoBtn) snapPhotoBtn.style.display = 'none';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'inline-flex';
      if (finishOnboardBtn) finishOnboardBtn.style.display = 'inline-flex';
    }
  }

  // Check existing local session
  const storedUser = localStorage.getItem('invibeUser');
  const storedPhoto = localStorage.getItem('invibeProfileImage');
  const isLoggedIn = localStorage.getItem('invibeIsLoggedIn') === 'true';

  if (isLoggedIn && storedUser && storedPhoto) {
    showAppView();
  } else {
    showAuthView();
  }

  // Handle Step 1: Username -> Camera
  if (gotoCameraBtn) {
    gotoCameraBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = usernameInput ? usernameInput.value.trim() : '';
      if (!val) {
        if (usernameError) {
          usernameError.textContent = 'Please enter your username to continue.';
          usernameError.style.display = 'block';
        }
        return;
      }
      if (usernameError) usernameError.style.display = 'none';
      enteredUsername = val;

      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'flex';
      startWebcam();
    });
  }

  // Allow pressing Enter in username input
  if (usernameInput) {
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (gotoCameraBtn) gotoCameraBtn.click();
      }
    });
  }

  // Handle Snap Photo
  if (snapPhotoBtn) {
    snapPhotoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!videoElem || !videoElem.videoWidth) {
        if (webcamStatusMsg) webcamStatusMsg.textContent = 'Waiting for camera feed...';
        return;
      }
      if (canvasElem) {
        canvasElem.width = videoElem.videoWidth;
        canvasElem.height = videoElem.videoHeight;
        const ctx = canvasElem.getContext('2d');
        ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
        capturedBase64 = canvasElem.toDataURL('image/jpeg', 0.85);
      }

      if (photoPreviewElem) {
        photoPreviewElem.src = capturedBase64;
        photoPreviewElem.style.display = 'block';
      }
      if (videoElem) videoElem.style.display = 'none';

      if (snapPhotoBtn) snapPhotoBtn.style.display = 'none';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'inline-flex';
      if (finishOnboardBtn) finishOnboardBtn.style.display = 'inline-flex';
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Awesome photograph! Click "Enter Hi-Hubble" to proceed.';
    });
  }

  // Handle Retake Photo
  if (retakePhotoBtn) {
    retakePhotoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      capturedBase64 = null;
      startWebcam();
    });
  }

  // Handle Finish Onboarding
  if (finishOnboardBtn) {
    finishOnboardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const finalUsername = enteredUsername || 'hubble_user';
      const userObj = {
        id: 'usr_' + Date.now(),
        username: finalUsername,
        fullName: finalUsername,
        email: `${finalUsername.toLowerCase()}@hihubble.com`
      };

      localStorage.setItem('invibeUser', JSON.stringify(userObj));
      if (capturedBase64) {
        localStorage.setItem('invibeProfileImage', capturedBase64);
      }
      localStorage.setItem('invibeIsLoggedIn', 'true');
      localStorage.setItem('invibe_jwt_token', 'local_active_session');

      showAppView();
    });
  }
}

// ─── UPDATE APP UI WITH LOGGED-IN USER DATA ──────────────────────────────────
export function updateAppUI() {
  const userStr = localStorage.getItem('invibeUser');
  const profileImage = localStorage.getItem('invibeProfileImage');

  if (!userStr) return;

  let user;
  try { user = JSON.parse(userStr); } catch { return; }

  // Header avatar
  const headerAvatar = document.querySelector('#header-profile-avatar img');
  if (headerAvatar && profileImage) headerAvatar.src = profileImage;

  // Sidebar preview card
  const sidebarAvatar = document.querySelector('.profile-preview-avatar img');
  if (sidebarAvatar && profileImage) sidebarAvatar.src = profileImage;
  const sidebarName = document.querySelector('.profile-preview-info h3');
  if (sidebarName && user.fullName) sidebarName.textContent = user.fullName;
  const sidebarUsername = document.querySelector('.profile-preview-info p');
  if (sidebarUsername && user.username) sidebarUsername.textContent = '@' + user.username;

  // Create post card avatar
  const createPostAvatar = document.getElementById('create-post-user-avatar');
  if (createPostAvatar && profileImage) createPostAvatar.src = profileImage;

  // Stories "Your Vibe" avatar
  const storyAvatar = document.querySelector('.story-card.current-user .story-avatar-container img');
  if (storyAvatar && profileImage) storyAvatar.src = profileImage;

  // My Profile view (middle panel)
  const myProfileAvatar = document.querySelector('.profile-screen-avatar');
  if (myProfileAvatar && profileImage) myProfileAvatar.src = profileImage;
  const myProfileName = document.querySelector('.profile-summary-top h3');
  if (myProfileName && user.fullName) {
    myProfileName.innerHTML = user.fullName;
    if (window.debouncedCreateIcons) window.debouncedCreateIcons(); else if (window.lucide) window.lucide.createIcons();
  }
  const myProfileUsername = document.querySelector('.profile-screen-handle');
  if (myProfileUsername && user.username) myProfileUsername.textContent = '@' + user.username;

  // Dispatch event so downstream features initialize
  window.dispatchEvent(new CustomEvent('auth-changed'));
}
