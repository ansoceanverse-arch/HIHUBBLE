import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fefrlcxctuhdbztyoncs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Safe API Fetch Helper to prevent raw JSON parsing failures
 */
async function apiFetch(endpoint, options = {}) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocal ? 'http://localhost:3000' : '';
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const defaultHeaders = { 'Content-Type': 'application/json' };
  const config = {
    ...options,
    headers: { ...defaultHeaders, ...(options.headers || {}) }
  };

  const response = await fetch(url, config);
  const rawText = await response.text();

  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (parseErr) {
    console.error(`[API Parse Error] Path: ${endpoint}, Status: ${response.status}, Raw:`, rawText);
    throw new Error(`Server returned unexpected response (${response.status}). Please check backend status.`);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function initAuth() {
  const authView = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-container');

  // Tabs
  const tabBtnSignup = document.getElementById('tab-btn-signup');
  const tabBtnLogin = document.getElementById('tab-btn-login');

  // Card Steps
  const step1 = document.getElementById('onboard-step-1'); // Sign Up Form
  const stepLogin = document.getElementById('onboard-login-step'); // Login Form
  const stepOtp = document.getElementById('onboard-otp-step'); // Inline 6-Digit OTP Step
  const step2 = document.getElementById('onboard-step-2'); // Webcam Live Photo

  // Sign Up Form Inputs
  const fullNameInput = document.getElementById('signup-fullname-input');
  const emailInput = document.getElementById('signup-email-input');
  const usernameInput = document.getElementById('quick-username-input');
  const passwordInput = document.getElementById('signup-password-input');
  const phoneInput = document.getElementById('signup-phone-input');
  const usernameError = document.getElementById('onboard-username-error');
  const gotoCameraBtn = document.getElementById('btn-goto-camera');

  // Login Form Inputs
  const loginUsernameInput = document.getElementById('login-username-input');
  const loginPasswordInput = document.getElementById('login-password-input');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnLoginSubmit = document.getElementById('btn-login-submit');

  // Inline OTP Step Elements
  const otpInputs = document.querySelectorAll('#onboard-otp-step .otp-input');
  const btnVerifyOtpStep = document.getElementById('btn-verify-otp-step');
  const inlineOtpErrorMsg = document.getElementById('inline-otp-error-msg');
  const inlineResendOtpLink = document.getElementById('inline-resend-otp-link');
  const inlineOtpTimer = document.getElementById('inline-otp-timer');
  const inlineOtpInstruction = document.getElementById('inline-otp-instruction');
  const btnBackToSignup = document.getElementById('btn-back-to-signup');

  // Webcam Elements
  const videoElem = document.getElementById('live-webcam-video');
  const photoPreviewElem = document.getElementById('live-photo-preview');
  const canvasElem = document.getElementById('live-webcam-canvas');
  const webcamStatusMsg = document.getElementById('webcam-status-msg');

  const snapPhotoBtn = document.getElementById('btn-snap-photo');
  const retakePhotoBtn = document.getElementById('btn-retake-photo');
  const finishOnboardBtn = document.getElementById('btn-finish-onboard');

  let webcamStream = null;
  let capturedBase64 = null;
  let signedUpUser = null;
  let resendCountdownInterval = null;
  let isResendCooldown = false;
  let activeTab = 'signup';

  // --- TAB SWITCHING (SIGN UP | LOGIN) ---
  function switchTab(target) {
    activeTab = target;
    if (target === 'signup') {
      if (tabBtnSignup) {
        tabBtnSignup.classList.add('active');
        tabBtnSignup.style.background = 'var(--primary, #a855f7)';
        tabBtnSignup.style.color = '#ffffff';
      }
      if (tabBtnLogin) {
        tabBtnLogin.classList.remove('active');
        tabBtnLogin.style.background = 'transparent';
        tabBtnLogin.style.color = 'var(--text-muted, #94a3b8)';
      }
      if (step1) step1.style.display = 'flex';
      if (stepLogin) stepLogin.style.display = 'none';
      if (stepOtp) stepOtp.style.display = 'none';
      if (step2) step2.style.display = 'none';
    } else {
      if (tabBtnLogin) {
        tabBtnLogin.classList.add('active');
        tabBtnLogin.style.background = 'var(--primary, #a855f7)';
        tabBtnLogin.style.color = '#ffffff';
      }
      if (tabBtnSignup) {
        tabBtnSignup.classList.remove('active');
        tabBtnSignup.style.background = 'transparent';
        tabBtnSignup.style.color = 'var(--text-muted, #94a3b8)';
      }
      if (stepLogin) stepLogin.style.display = 'flex';
      if (step1) step1.style.display = 'none';
      if (stepOtp) stepOtp.style.display = 'none';
      if (step2) step2.style.display = 'none';
    }
    if (window.debouncedCreateIcons) window.debouncedCreateIcons(); else if (window.lucide) window.lucide.createIcons();
  }

  if (tabBtnSignup) tabBtnSignup.addEventListener('click', () => switchTab('signup'));
  if (tabBtnLogin) tabBtnLogin.addEventListener('click', () => switchTab('login'));

  function showAuthView() {
    if (authView) {
      authView.classList.remove('hidden');
      authView.style.display = 'flex';
    }
    if (appContainer) appContainer.style.display = 'none';
    switchTab('signup');
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
      try {
        webcamStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping webcam tracks:', e);
      }
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
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Camera unavailable. Generated initial visual avatar.';

      const initialChar = signedUpUser?.username ? signedUpUser.username.charAt(0).toUpperCase() : 'H';
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
        ctx.fillText(initialChar, 200, 200);
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

  // --- OTP TIMER (25 Seconds Cooldown) ---
  function startOtpTimer(seconds = 25) {
    if (resendCountdownInterval) clearInterval(resendCountdownInterval);
    isResendCooldown = true;
    let remaining = seconds;
    if (inlineOtpTimer) inlineOtpTimer.textContent = remaining;

    resendCountdownInterval = setInterval(() => {
      remaining--;
      if (inlineOtpTimer) inlineOtpTimer.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(resendCountdownInterval);
        isResendCooldown = false;
        if (inlineResendOtpLink) inlineResendOtpLink.textContent = 'Resend Code Now';
      }
    }, 1000);
  }

  // --- 6-DIGIT OTP INPUT AUTO-ADVANCE ---
  if (otpInputs && otpInputs.length > 0) {
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length >= 1) {
          input.value = val.charAt(0);
          if (index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
          }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(pasted)) {
          pasted.split('').forEach((char, i) => {
            if (otpInputs[i]) otpInputs[i].value = char;
          });
          if (otpInputs[5]) otpInputs[5].focus();
        }
      });
    });
  }

  function getEnteredOtpCode() {
    let code = '';
    otpInputs.forEach(inp => code += inp.value.trim());
    return code;
  }

  function clearOtpInputs() {
    otpInputs.forEach(inp => inp.value = '');
    if (otpInputs[0]) otpInputs[0].focus();
    hideError(inlineOtpErrorMsg);
  }

  // Check existing session
  const storedUser = localStorage.getItem('invibeUser');
  const isLoggedIn = localStorage.getItem('invibeIsLoggedIn') === 'true';
  const storedToken = localStorage.getItem('invibe_jwt_token');

  if (isLoggedIn && storedUser && storedToken) {
    showAppView();
  } else {
    showAuthView();
  }

  // =========================================================================
  // 1. SIGN UP FLOW (Send 6-Digit OTP Code & Transition to Inline Step 2)
  // =========================================================================
  async function handleSignUpSubmit() {
    const fullName = fullNameInput ? fullNameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!fullName) return showError(usernameError, 'Please enter your full name.');
    if (!email || !email.includes('@')) return showError(usernameError, 'Please enter a valid email address.');
    if (!username) return showError(usernameError, 'Please choose a username.');
    if (!password || password.length < 4) return showError(usernameError, 'Password must be at least 4 characters long.');

    hideError(usernameError);

    if (gotoCameraBtn) {
      gotoCameraBtn.disabled = true;
      gotoCameraBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Sending OTP...';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();
    }

    try {
      const data = await apiFetch('/api/auth/signup-otp', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          username,
          password,
          phoneNumber: phone
        })
      });

      // Smoothly transition card from Step 1 Form to Inline Step 2 (OTP Input)
      if (step1) step1.style.display = 'none';
      if (stepLogin) stepLogin.style.display = 'none';
      if (stepOtp) stepOtp.style.display = 'flex';

      if (inlineOtpInstruction) {
        inlineOtpInstruction.textContent = `Please enter the 6-digit verification code sent to ${email}`;
      }

      clearOtpInputs();
      startOtpTimer(data.cooldown || 25);

      if (data.devFallbackOtp) {
        console.log(`[HI-HUBBLE Dev OTP Code]: ${data.devFallbackOtp}`);
      }
    } catch (err) {
      showError(usernameError, err.message);
    } finally {
      if (gotoCameraBtn) {
        gotoCameraBtn.disabled = false;
        gotoCameraBtn.innerHTML = '<i data-lucide="send"></i> Send Verification Code (OTP)';
        if (window.debouncedCreateIcons) window.debouncedCreateIcons();
      }
    }
  }

  if (gotoCameraBtn) {
    gotoCameraBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSignUpSubmit();
    });
  }

  if (btnBackToSignup) {
    btnBackToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      if (stepOtp) stepOtp.style.display = 'none';
      if (step1) step1.style.display = 'flex';
    });
  }

  // =========================================================================
  // 2. VERIFY INLINE 6-DIGIT OTP CODE & TRANSITION TO LIVE PHOTOGRAPH
  // =========================================================================
  if (btnVerifyOtpStep) {
    btnVerifyOtpStep.addEventListener('click', async (e) => {
      e.preventDefault();
      const code = getEnteredOtpCode();
      const email = emailInput ? emailInput.value.trim() : '';

      if (code.length < 6) {
        return showError(inlineOtpErrorMsg, 'Please enter all 6 digits of your verification code.');
      }

      hideError(inlineOtpErrorMsg);
      btnVerifyOtpStep.disabled = true;
      btnVerifyOtpStep.innerHTML = '<i data-lucide="loader" class="spin"></i> Verifying Code...';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();

      try {
        const data = await apiFetch('/api/auth/verify-action-otp', {
          method: 'POST',
          body: JSON.stringify({ email, otp: code })
        });

        signedUpUser = data.user;
        if (data.token) {
          localStorage.setItem('invibe_jwt_token', data.token);
        }

        // Transition card from Inline OTP Step to Step 3: Webcam Live Photo
        if (stepOtp) stepOtp.style.display = 'none';
        if (step1) step1.style.display = 'none';
        if (stepLogin) stepLogin.style.display = 'none';
        if (step2) step2.style.display = 'flex';

        startWebcam();
      } catch (err) {
        showError(inlineOtpErrorMsg, err.message);
      } finally {
        if (btnVerifyOtpStep) {
          btnVerifyOtpStep.disabled = false;
          btnVerifyOtpStep.innerHTML = '<i data-lucide="check-circle"></i> Verify Code & Continue';
          if (window.debouncedCreateIcons) window.debouncedCreateIcons();
        }
      }
    });
  }

  if (inlineResendOtpLink) {
    inlineResendOtpLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (isResendCooldown) return;
      handleSignUpSubmit();
    });
  }

  // =========================================================================
  // 3. LOGIN FLOW (Credentials Verification against Supabase DB)
  // =========================================================================
  async function handleLoginSubmit() {
    const username = loginUsernameInput ? loginUsernameInput.value.trim() : '';
    const password = loginPasswordInput ? loginPasswordInput.value : '';

    if (!username) return showError(loginErrorMsg, 'Please enter your username or email.');
    if (!password) return showError(loginErrorMsg, 'Please enter your password.');

    hideError(loginErrorMsg);

    if (btnLoginSubmit) {
      btnLoginSubmit.disabled = true;
      btnLoginSubmit.innerHTML = '<i data-lucide="loader" class="spin"></i> Verifying...';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();
    }

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      // Store authenticated user session
      localStorage.setItem('invibeUser', JSON.stringify(data.user));
      if (data.user?.profileImage) {
        localStorage.setItem('invibeProfileImage', data.user.profileImage);
      }
      localStorage.setItem('invibeIsLoggedIn', 'true');
      if (data.token) {
        localStorage.setItem('invibe_jwt_token', data.token);
      }

      showAppView();
    } catch (err) {
      showError(loginErrorMsg, err.message || 'Invalid username or password.');
    } finally {
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerHTML = '<i data-lucide="log-in"></i> Login to Hi-Hubble';
        if (window.debouncedCreateIcons) window.debouncedCreateIcons();
      }
    }
  }

  if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      handleLoginSubmit();
    });
  }

  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLoginSubmit();
      }
    });
  }

  // =========================================================================
  // 4. WEBCAM LIVE PHOTO & FINISH ONBOARDING
  // =========================================================================
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
        capturedBase64 = canvasElem.toDataURL('image/jpeg', 0.88);
      }

      if (photoPreviewElem) {
        photoPreviewElem.src = capturedBase64;
        photoPreviewElem.style.display = 'block';
      }
      if (videoElem) videoElem.style.display = 'none';

      if (snapPhotoBtn) snapPhotoBtn.style.display = 'none';
      if (retakePhotoBtn) retakePhotoBtn.style.display = 'inline-flex';
      if (finishOnboardBtn) finishOnboardBtn.style.display = 'inline-flex';
      if (webcamStatusMsg) webcamStatusMsg.textContent = 'Great live photograph! Click "Enter Hi-Hubble" to proceed.';
    });
  }

  if (retakePhotoBtn) {
    retakePhotoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      capturedBase64 = null;
      startWebcam();
    });
  }

  if (finishOnboardBtn) {
    finishOnboardBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      finishOnboardBtn.disabled = true;
      finishOnboardBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Completing Setup...';
      if (window.debouncedCreateIcons) window.debouncedCreateIcons();

      const userObj = signedUpUser || {
        id: 'usr_' + Date.now(),
        username: usernameInput?.value.trim() || emailInput?.value.trim().split('@')[0] || 'user',
        email: emailInput?.value.trim() || 'user@hihubble.com',
        fullName: fullNameInput?.value.trim() || usernameInput?.value.trim() || 'User'
      };

      try {
        const data = await apiFetch('/api/auth/complete-onboarding', {
          method: 'POST',
          body: JSON.stringify({
            userId: userObj.id,
            username: userObj.username,
            email: userObj.email,
            fullName: userObj.fullName,
            livePhotoBase64: capturedBase64
          })
        });

        const finalProfileImage = data.profileImage || capturedBase64;
        if (finalProfileImage) {
          userObj.profileImage = finalProfileImage;
          localStorage.setItem('invibeProfileImage', finalProfileImage);
        }
      } catch (err) {
        console.warn('Live photo upload note:', err.message);
        if (capturedBase64) localStorage.setItem('invibeProfileImage', capturedBase64);
      } finally {
        localStorage.setItem('invibeUser', JSON.stringify(userObj));
        localStorage.setItem('invibeIsLoggedIn', 'true');
        showAppView();
      }
    });
  }
}

// Helpers for Error Messaging
function showError(elem, message) {
  if (elem) {
    elem.textContent = message;
    elem.style.display = 'block';
  }
}

function hideError(elem) {
  if (elem) {
    elem.textContent = '';
    elem.style.display = 'none';
  }
}

/**
 * Global Logout Handler
 */
export function handleLogout() {
  localStorage.removeItem('invibeUser');
  localStorage.removeItem('invibeProfileImage');
  localStorage.removeItem('invibeIsLoggedIn');
  localStorage.removeItem('invibe_jwt_token');

  // Stop active media tracks if open
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(t => t.stop());
      }).catch(() => {});
    } catch (_) {}
  }

  window.location.reload();
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

  // Query backend for exact profile & follower/following counts
  const userFollowersEl = document.getElementById('user-followers-count');
  const userFollowingEl = document.getElementById('user-following-count');

  const token = localStorage.getItem('invibe_jwt_token');
  const userId = user.id || user._id;
  if (token && userId) {
    fetch(`/api/users/${userId}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) {
          const u = data.user;
          if (userFollowersEl) userFollowersEl.textContent = u.followersCount || 0;
          if (userFollowingEl) userFollowingEl.textContent = u.followingCount || 0;

          const profileHubbersEl = document.querySelector('#view-profile [data-stat="followers"] .stat-val') || document.querySelector('#profile-followers-count');
          const profileHubbiesEl = document.querySelector('#view-profile [data-stat="following"] .stat-val') || document.querySelector('#profile-following-count');
          const profilePostsEl = document.querySelector('#view-profile [data-stat="posts"] .stat-val') || document.querySelector('#profile-posts-count');

          if (profileHubbersEl) profileHubbersEl.textContent = u.followersCount || 0;
          if (profileHubbiesEl) profileHubbiesEl.textContent = u.followingCount || 0;
          if (profilePostsEl) profilePostsEl.textContent = u.postsCount || 0;

          if (sidebarName && u.fullName) sidebarName.textContent = u.fullName;
          if (sidebarUsername && u.username) sidebarUsername.textContent = '@' + u.username;
        }
      })
      .catch(() => {});
  }

  // Dispatch event so downstream features initialize
  window.dispatchEvent(new CustomEvent('auth-changed'));
}



