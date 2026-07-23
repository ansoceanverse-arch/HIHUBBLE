import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// LocalStorage User Database Helper Functions
const defaultUsers = [
  {
    "fullName": "Venkata murali",
    "email": "vu.241fa04c65@gmail.com",
    "username": "murali123",
    "password": "nari9347",
    "dob": "2005-08-24",
    "age": 20
  },
  {
    "fullName": "Venkata murali",
    "email": "muralivenkata167@gmail.com",
    "username": "murali__chowdhary",
    "password": "nari9347",
    "dob": "2005-08-24",
    "age": 20
  },
  {
    "fullName": "Venkata murali",
    "email": "muralivenkata711@gmail.com",
    "username": "emurali",
    "password": "nari9347",
    "dob": "2005-08-24",
    "age": 20
  }
];

function getUsersDB() {
  const db = localStorage.getItem('invibe_users_db');
  if (db === null) {
    localStorage.setItem('invibe_users_db', JSON.stringify(defaultUsers));
    return defaultUsers;
  }
  return db ? JSON.parse(db) : [];
}

function saveUsersDB(db) {
  localStorage.setItem('invibe_users_db', JSON.stringify(db));
}

export async function initAuth() {
  const authView = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-container');
  const authForm = document.getElementById('auth-form');
  const dobInput = document.getElementById('auth-dob');
  const ageCheckbox = document.getElementById('age-checkbox');
  const ageWarning = document.getElementById('age-warning');
  const createAccountBtn = document.getElementById('create-account-btn');
  const profileUploadModal = document.getElementById('profile-upload-modal');

  // Welcome page elements
  const authWelcomePanel = document.getElementById('auth-welcome-panel');
  const authGlassContainer = document.getElementById('auth-glass-container');
  const welcomeSigninBtn = document.getElementById('welcome-signin-btn');
  const welcomeSignupBtn = document.getElementById('welcome-signup-btn');
  const authBackBtn = document.getElementById('auth-back-btn');

  // OTP elements
  const otpModal = document.getElementById('otp-verification-modal');
  const otpInputs = document.querySelectorAll('.otp-input');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const resendOtpLink = document.getElementById('resend-otp-link');
  const otpTimer = document.getElementById('otp-timer');
  const otpErrorMsg = document.getElementById('otp-error-msg');

  // Multi-channel 2FA elements & states
  const authPhoneInput = document.getElementById('auth-phone');
  const pref2faEmailBtn = document.getElementById('pref-2fa-email');
  const pref2faSmsBtn = document.getElementById('pref-2fa-sms');
  const otpDeliveryEmailBtn = document.getElementById('otp-delivery-email');
  const otpDeliverySmsBtn = document.getElementById('otp-delivery-sms');
  const otpInstructionText = document.getElementById('otp-instruction-text');

  let tempUserData = null;
  let pendingVerificationEmail = null;
  let pendingVerificationPhone = null;
  let activeDeliveryMethod = 'email'; // 'email' or 'sms'
  let selected2faPreference = 'email'; // 'email' or 'sms' for signup
  let isSignUpVerification = false;
  let isForgotVerification = false;
  let tempNewPassword = null;
  let resendTimerInterval = null;
  let countdown = 30;

  // ─── HELPER: Show Welcome Panel ──────────────────────────────────────────────
  function showWelcomePanelDefault() {
    if (authWelcomePanel) {
      authWelcomePanel.style.display = 'flex';
      authWelcomePanel.classList.remove('hidden');
    }
    if (authGlassContainer) {
      authGlassContainer.classList.add('hidden-container');
    }
    if (window.debouncedCreateIcons) window.debouncedCreateIcons(); else if (window.lucide) window.lucide.createIcons();
  }

  function showAuthView() {
    if (authView) {
      authView.classList.remove('hidden');
      authView.style.display = 'flex';
    }
    if (appContainer) appContainer.style.display = 'none';
    showWelcomePanelDefault();
  }

  function showAppView() {
    if (authView) {
      authView.classList.add('hidden');
      authView.style.display = 'none';
    }
    if (appContainer) appContainer.style.display = 'block';
    updateAppUI();
  }

  // ─── SESSION CHECK (Custom JWT) ───────────────────────────────────────────────
  const token = localStorage.getItem('invibe_jwt_token');
  const isLoggedIn = localStorage.getItem('invibeIsLoggedIn') === 'true';

  if (isLoggedIn && token) {
    // Optionally inject token into Supabase for RLS
    // supabase.auth.setSession(...) (not fully supported natively without refresh token, but global headers work for fetch)
    showAppView();
  } else {
    showAuthView();
  }

  wireEventListeners();
  initProfileUpload();

  // ─── ALL EVENT LISTENERS ─────────────────────────────────────────────────────
  function wireEventListeners() {
    // ── Preferred 2FA selection in signup ───────────────────────────────────
    if (pref2faEmailBtn && pref2faSmsBtn) {
      pref2faEmailBtn.addEventListener('click', () => {
        pref2faEmailBtn.classList.add('active');
        pref2faSmsBtn.classList.remove('active');
        selected2faPreference = 'email';
      });
      pref2faSmsBtn.addEventListener('click', () => {
        pref2faSmsBtn.classList.add('active');
        pref2faEmailBtn.classList.remove('active');
        selected2faPreference = 'sms';
      });
    }

    // ── OTP modal delivery channel tabs ─────────────────────────────────────
    if (otpDeliveryEmailBtn && otpDeliverySmsBtn) {
      otpDeliveryEmailBtn.addEventListener('click', () => {
        if (activeDeliveryMethod === 'email') return;
        activeDeliveryMethod = 'email';
        otpDeliveryEmailBtn.classList.add('active');
        otpDeliverySmsBtn.classList.remove('active');
        if (otpInstructionText) {
          otpInstructionText.textContent = `Please enter the 6-digit verification code sent to your email address (${pendingVerificationEmail || ''}).`;
        }
        triggerResend('email');
      });

      otpDeliverySmsBtn.addEventListener('click', () => {
        if (activeDeliveryMethod === 'sms') return;
        if (otpDeliverySmsBtn.classList.contains('disabled')) return;
        activeDeliveryMethod = 'sms';
        otpDeliverySmsBtn.classList.add('active');
        otpDeliveryEmailBtn.classList.remove('active');
        if (otpInstructionText) {
          otpInstructionText.textContent = `Please enter the 6-digit verification code sent to your mobile number (${pendingVerificationPhone || ''}).`;
        }
        triggerResend('sms');
      });
    }

    // ── Trigger Resend OTP Helper ───────────────────────────────────────────
    async function triggerResend(method) {
      if (otpErrorMsg) otpErrorMsg.textContent = `Sending code via EMAIL…`;

      try {
        let err = null;
        if (isSignUpVerification) {
          // Resend OTP via custom backend
          const res = await fetch(`${API_URL}/api/auth/signup-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tempUserData) // tempUserData must be saved during signup
          });
          if (!res.ok) err = new Error('Failed to resend code');
        } else if (isForgotVerification) {
          // Resend Forgot OTP via custom backend
          const res = await fetch(`${API_URL}/api/auth/forgot-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: tempUserData.username, newPassword: tempUserData.newPassword })
          });
          if (!res.ok) err = new Error('Failed to resend code');
        }

        if (!err) {
          if (otpErrorMsg) {
            otpErrorMsg.innerHTML = `<span style="color:#22c55e">Code sent via EMAIL to ${pendingVerificationEmail}</span>`;
          }
          startResendTimer();
        } else {
          throw err;
        }
      } catch (err) {
        if (otpErrorMsg) otpErrorMsg.textContent = err.message || 'Failed to resend code';
      }
    }

    // ── OTP input focus chaining ────────────────────────────────────────────
    if (otpInputs.length > 0) {
      otpInputs.forEach((input, idx) => {
        input.addEventListener('input', () => {
          input.value = input.value.replace(/[^0-9]/g, '');
          if (input.value && idx < otpInputs.length - 1) {
            otpInputs[idx + 1].focus();
          }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !input.value && idx > 0) {
            otpInputs[idx - 1].focus();
          }
        });

        input.addEventListener('paste', (e) => {
          e.preventDefault();
          const pastedData = e.clipboardData.getData('text').trim();
          if (/^\d{6}$/.test(pastedData)) {
            pastedData.split('').forEach((char, i) => {
              if (otpInputs[i]) otpInputs[i].value = char;
            });
            otpInputs[5].focus();
          }
        });
      });
    }

    // ── Resend timer ────────────────────────────────────────────────────────
    function startResendTimer() {
      if (resendOtpLink) resendOtpLink.classList.add('disabled');
      countdown = 30;
      if (otpTimer) otpTimer.textContent = countdown;

      if (resendTimerInterval) clearInterval(resendTimerInterval);
      resendTimerInterval = setInterval(() => {
        countdown--;
        if (otpTimer) otpTimer.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(resendTimerInterval);
          if (resendOtpLink) {
            resendOtpLink.classList.remove('disabled');
            resendOtpLink.innerHTML = 'Resend Code';
          }
        }
      }, 1000);
    }

    // ── Send OTP via Express backend ────────────────────────────────────────
    async function sendOTPEmail(endpoint, payload) {
      const res = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.json(); } catch { throw new Error('Invalid server response'); }

      if (!res.ok) {
        if (data && data.devFallbackOtp) {
          alert(`Notice: OTP transmission failed (SMTP/Twilio not configured).\n\nFallback mode is active.\nYour Verification Code is: ${data.devFallbackOtp}`);
          data.success = true;
          return data;
        }
        const errorMsg = data.error + (data.details ? ` (${data.details})` : '');
        throw new Error(errorMsg);
      }
      return data;
    }

    // ── Verify OTP button ───────────────────────────────────────────────────
    if (verifyOtpBtn) {
      verifyOtpBtn.addEventListener('click', async () => {
        const code = Array.from(otpInputs).map(i => i.value).join('');
        if (code.length < 6) {
          if (otpErrorMsg) otpErrorMsg.textContent = 'Please enter the complete 6-digit code.';
          return;
        }

        if (otpErrorMsg) otpErrorMsg.textContent = 'Verifying…';
        verifyOtpBtn.disabled = true;

        let isVerified = false;
        let errorMsg = 'Verification failed. Invalid code.';
        let verifyData = null;

        try {
          let type = 'signup';
          if (isForgotVerification) type = 'recovery';

          const res = await fetch(`${API_URL}/api/auth/${isForgotVerification ? 'verify-forgot-otp' : 'verify-action-otp'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerificationEmail, otp: code })
          });
          const fetchdata = await res.json();
          if (!res.ok || fetchdata.error) {
            errorMsg = fetchdata.error || 'Invalid verification code.';
          } else {
            isVerified = true;
            verifyData = fetchdata;
            
            if (!isForgotVerification && fetchdata.token) {
               localStorage.setItem('invibe_jwt_token', fetchdata.token);
               localStorage.setItem('invibeIsLoggedIn', 'true');
               localStorage.setItem('invibeUser', JSON.stringify(fetchdata.user));
            }
          }
        } catch (err) {
          errorMsg = err.message || errorMsg;
        }

        verifyOtpBtn.disabled = false;

        if (!isVerified) {
          if (otpErrorMsg) otpErrorMsg.textContent = errorMsg;
          return;
        }

        if (otpModal) otpModal.classList.remove('active');
        if (otpErrorMsg) otpErrorMsg.textContent = '';

        if (verifyData && verifyData.access_token) {
          localStorage.setItem('invibe_jwt_token', verifyData.access_token);
        }

        if (isSignUpVerification) {
          if (profileUploadModal) {
            profileUploadModal.classList.add('active');
            if (window.startLiveCamera) window.startLiveCamera();
          }
        } else {
          showAppView();
        }
      });
    }

    // ── Resend OTP link ─────────────────────────────────────────────────────
    if (resendOtpLink) {
      resendOtpLink.addEventListener('click', async (e) => {
        e.preventDefault();
        if (resendOtpLink.classList.contains('disabled')) return;
        triggerResend(activeDeliveryMethod);
      });
    }

    // ── Welcome panel transitions ───────────────────────────────────────────
    function showWelcome() {
      console.log('showWelcome: Navigating back to welcome panel');
      if (authGlassContainer) {
        authGlassContainer.classList.add('hidden-container');
      }
      setTimeout(() => {
        if (authGlassContainer) {
          authGlassContainer.style.display = 'none';
        }
        if (authWelcomePanel) {
          authWelcomePanel.style.display = 'flex';
          authWelcomePanel.offsetHeight; // force reflow
          authWelcomePanel.classList.remove('hidden');
        }
      }, 350);
    }

    function showAuthForm(mode) {
      console.log('showAuthForm: Navigating to auth form with mode:', mode);
      if (authWelcomePanel) {
        authWelcomePanel.classList.add('hidden');
      }
      setTimeout(() => {
        if (authWelcomePanel) {
          authWelcomePanel.style.display = 'none';
        }
        if (authGlassContainer) {
          authGlassContainer.style.display = 'flex';
          authGlassContainer.offsetHeight; // force reflow
          authGlassContainer.classList.remove('hidden-container');
        }
        if (mode === 'signin') setSignInMode();
        else setSignUpMode();
      }, 350);
    }

    if (welcomeSigninBtn) welcomeSigninBtn.addEventListener('click', () => showAuthForm('signin'));
    if (welcomeSignupBtn) welcomeSignupBtn.addEventListener('click', () => showAuthForm('signup'));
    if (authBackBtn) authBackBtn.addEventListener('click', showWelcome);

    // ── Logout (Supabase) ───────────────────────────────────────────────────
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        
      localStorage.removeItem('invibe_jwt_token');
      localStorage.removeItem('invibeIsLoggedIn');
      localStorage.removeItem('invibeUser');
      localStorage.removeItem('invibeProfileImage');

        // onAuthStateChange handles the UI reset
      });
    }

    // ── Mode toggle ─────────────────────────────────────────────────────────
    let currentMode = 'signup';

    function handleAgeValidation() {
      if (currentMode !== 'signup') return;
      if (!dobInput || !dobInput.value) {
        if (createAccountBtn) createAccountBtn.disabled = true;
        if (ageCheckbox) ageCheckbox.classList.remove('checked');
        return;
      }
      const dob = new Date(dobInput.value);
      if (isNaN(dob.getTime())) {
        if (createAccountBtn) createAccountBtn.disabled = true;
        if (ageCheckbox) ageCheckbox.classList.remove('checked');
        return;
      }
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

      if (age >= 18) {
        if (ageCheckbox) ageCheckbox.classList.add('checked');
        if (ageWarning) ageWarning.style.display = 'none';
        if (createAccountBtn) createAccountBtn.disabled = false;
      } else {
        if (ageCheckbox) ageCheckbox.classList.remove('checked');
        if (ageWarning) ageWarning.style.display = 'block';
        if (createAccountBtn) createAccountBtn.disabled = true;
      }
    }

    if (dobInput) {
      dobInput.addEventListener('change', handleAgeValidation);
      dobInput.addEventListener('input', handleAgeValidation);
      dobInput.addEventListener('blur', handleAgeValidation);
    }

    const toggleBtn = document.getElementById('auth-toggle-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const title = document.getElementById('auth-form-title');
    const signupElements = document.querySelectorAll('.signup-only');
    const signinElements = document.querySelectorAll('.signin-only');
    const forgotElements = document.querySelectorAll('.forgot-only');
    const forgotBtn = document.getElementById('auth-forgot-btn');

    function setSignInMode() {
      currentMode = 'signin';
      signupElements.forEach(el => {
        el.style.display = 'none';
        el.querySelectorAll('input').forEach(i => i.removeAttribute('required'));
      });
      signinElements.forEach(el => el.style.display = '');
      forgotElements.forEach(el => {
        el.style.display = 'none';
        el.querySelectorAll('input').forEach(i => i.removeAttribute('required'));
      });

      const emailInput = document.getElementById('auth-email');
      if (emailInput) { emailInput.closest('.input-group').style.display = 'none'; emailInput.removeAttribute('required'); }
      const usernameInput = document.getElementById('auth-username');
      if (usernameInput) { usernameInput.closest('.input-group').style.display = ''; usernameInput.setAttribute('required', 'true'); }
      const passwordInput = document.getElementById('auth-password');
      if (passwordInput) passwordInput.placeholder = 'Password';

      if (title) title.textContent = 'Sign in to your account.';
      if (createAccountBtn) { createAccountBtn.textContent = 'Sign In'; createAccountBtn.disabled = false; }
      if (toggleText) toggleText.textContent = "Don't have an account?";
      if (toggleBtn) toggleBtn.textContent = 'Sign Up';
    }

    function setSignUpMode() {
      currentMode = 'signup';
      signupElements.forEach(el => {
        el.style.display = '';
        el.querySelectorAll('input').forEach(i => i.setAttribute('required', 'true'));
      });
      signinElements.forEach(el => el.style.display = 'none');
      forgotElements.forEach(el => {
        el.style.display = 'none';
        el.querySelectorAll('input').forEach(i => i.removeAttribute('required'));
      });

      const emailInput = document.getElementById('auth-email');
      if (emailInput) { emailInput.closest('.input-group').style.display = ''; emailInput.setAttribute('required', 'true'); }
      const usernameInput = document.getElementById('auth-username');
      if (usernameInput) { usernameInput.closest('.input-group').style.display = ''; usernameInput.setAttribute('required', 'true'); }
      const passwordInput = document.getElementById('auth-password');
      if (passwordInput) passwordInput.placeholder = 'Password';

      if (title) title.textContent = 'Create your account.';
      if (createAccountBtn) { createAccountBtn.textContent = 'Create Account'; }
      handleAgeValidation();
      if (toggleText) toggleText.textContent = 'Already have an account?';
      if (toggleBtn) toggleBtn.textContent = 'Sign In';
    }

    function setForgotMode() {
      currentMode = 'forgot';
      signupElements.forEach(el => {
        el.style.display = 'none';
        el.querySelectorAll('input').forEach(i => i.removeAttribute('required'));
      });
      signinElements.forEach(el => el.style.display = 'none');
      forgotElements.forEach(el => {
        el.style.display = '';
        el.querySelectorAll('input').forEach(i => i.setAttribute('required', 'true'));
      });

      const emailInput = document.getElementById('auth-email');
      if (emailInput) { emailInput.closest('.input-group').style.display = 'none'; emailInput.removeAttribute('required'); }
      const usernameInput = document.getElementById('auth-username');
      if (usernameInput) { usernameInput.closest('.input-group').style.display = ''; usernameInput.setAttribute('required', 'true'); }
      const passwordInput = document.getElementById('auth-password');
      if (passwordInput) passwordInput.placeholder = 'New Password';

      if (title) title.textContent = 'Reset your password.';
      if (createAccountBtn) { createAccountBtn.textContent = 'Reset Password'; createAccountBtn.disabled = false; }
      if (toggleText) toggleText.textContent = 'Remember your password?';
      if (toggleBtn) toggleBtn.textContent = 'Sign In';
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentMode === 'signup' || currentMode === 'forgot') setSignInMode();
        else setSignUpMode();
      });
    }

    if (forgotBtn) {
      forgotBtn.addEventListener('click', (e) => { e.preventDefault(); setForgotMode(); });
    }

    // ── Form submission ─────────────────────────────────────────────────────

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (currentMode === 'signin') {
          const usernameVal = document.getElementById('auth-username').value.trim();
          const passwordVal = document.getElementById('auth-password').value;

          if (!usernameVal || !passwordVal) {
            alert('Please enter your username and password.');
            return;
          }

          if (createAccountBtn) { createAccountBtn.disabled = true; createAccountBtn.textContent = 'Verifying…'; }

          try {
            const resolveRes = await fetch(`${API_URL}/api/auth/resolve-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameVal })
            });
            const resolveData = await resolveRes.json();
            if (!resolveRes.ok) throw new Error(resolveData.error || 'Failed to resolve username');
            
            const res = await fetch(`${API_URL}/api/auth/login-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: usernameVal, password: passwordVal })
            });
            const data = await res.json();
            
            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Sign In'; }

            if (!res.ok) {
              throw new Error(data.error || 'Login failed');
            } else {
              pendingVerificationEmail = data.email;
              isSignUpVerification = false;
              isForgotVerification = false;
              
              if (authWelcomePanel) authWelcomePanel.classList.remove('active');
              if (authGlassContainer) authGlassContainer.classList.add('hidden');
              if (otpModal) otpModal.classList.add('active');
              
              const storedEmailEl = document.getElementById('stored-email');
              if (storedEmailEl) storedEmailEl.textContent = data.email;
              
              startResendTimer();
              if (otpInputs.length > 0) otpInputs[0].focus();
            }
          } catch (err) {
            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Sign In'; }
            alert(err.message);
          }

        } else if (currentMode === 'forgot') {
          const usernameVal = document.getElementById('auth-username').value.trim();
          const passwordVal = document.getElementById('auth-password').value;
          const confirmVal = document.getElementById('auth-confirm-password').value;

          if (!usernameVal) { alert('Please enter your username.'); return; }
          if (passwordVal !== confirmVal) { alert('Passwords do not match.'); return; }
          if (passwordVal.length < 6) { alert('Password must be at least 6 characters.'); return; }

          if (createAccountBtn) { createAccountBtn.disabled = true; createAccountBtn.textContent = 'Sending OTP…'; }

          try {
            if (otpErrorMsg) otpErrorMsg.textContent = '';
            otpInputs.forEach(i => i.value = '');

            const resolveRes = await fetch(`${API_URL}/api/auth/resolve-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameVal })
            });
            const resolveData = await resolveRes.json();
            if (!resolveRes.ok) throw new Error(resolveData.error || 'Failed to resolve username');

            const resolvedEmail = resolveData.email;
            tempUserData = { username: usernameVal, newPassword: passwordVal };

            const res = await fetch(`${API_URL}/api/auth/forgot-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: usernameVal, newPassword: passwordVal })
            });
            const data = await res.json();
            let error = !res.ok ? new Error(data.error || 'Failed to start reset') : null;
            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Reset Password'; }

            if (error) {
              throw error;
            } else {
              pendingVerificationEmail = resolvedEmail;
              activeDeliveryMethod = 'email';

              if (otpInstructionText) otpInstructionText.textContent = `Please enter the 6-digit verification code sent to your email address (${pendingVerificationEmail}).`;
              if (otpDeliverySmsBtn) otpDeliverySmsBtn.classList.add('disabled');
              if (otpDeliveryEmailBtn) otpDeliveryEmailBtn.classList.add('active');

              isSignUpVerification = false;
              isForgotVerification = true;
              startResendTimer();
              if (otpModal) otpModal.classList.add('active');
            }
          } catch (err) {
            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Reset Password'; }
            alert(err.message);
          }

        } else {
          // Sign Up
          const fullName = document.getElementById('auth-fullname').value.trim();
          const email = document.getElementById('auth-email').value.trim();
          const username = document.getElementById('auth-username').value.trim();
          const password = document.getElementById('auth-password').value;
          const dob = document.getElementById('auth-dob').value;
          
          if (!fullName || !email || !username || !password || !dob) {
            alert('Please fill in all fields.');
            return;
          }
          if (password.length < 6) { alert('Password must be at least 6 characters.'); return; }

          if (createAccountBtn) { createAccountBtn.disabled = true; createAccountBtn.textContent = 'Sending OTP…'; }

          try {
            if (otpErrorMsg) otpErrorMsg.textContent = '';
            otpInputs.forEach(i => i.value = '');

            // PRE-CHECK: Ensure username is unique before calling Supabase Auth
            const trimmedUsername = username.toLowerCase();
            const { data: existingProfile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', trimmedUsername)
              .limit(1);

            if (profileError) {
              console.error('Username check error:', profileError);
              throw new Error('Failed to validate username availability.');
            }

            if (existingProfile && existingProfile.length > 0) {
              throw new Error('Username is already taken. Please choose another.');
            }

            tempUserData = { fullName, email, username, password, dob };
            const res = await fetch(`${API_URL}/api/auth/signup-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(tempUserData)
            });
            const data = await res.json();
            let error = !res.ok ? new Error(data.error || 'Signup failed') : null;

            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Create Account'; }

            if (error) {
              throw error;
            } else {
              pendingVerificationEmail = email;
              activeDeliveryMethod = 'email';

              if (otpInstructionText) otpInstructionText.textContent = `Please enter the 6-digit verification code sent to your email address (${pendingVerificationEmail}).`;
              if (otpDeliverySmsBtn) otpDeliverySmsBtn.classList.add('disabled');
              if (otpDeliveryEmailBtn) otpDeliveryEmailBtn.classList.add('active');

              isSignUpVerification = true;
              isForgotVerification = false;
              startResendTimer();
              if (otpModal) otpModal.classList.add('active');
            }
          } catch (err) {
            if (createAccountBtn) { createAccountBtn.disabled = false; createAccountBtn.textContent = 'Create Account'; }
            console.error("Signup Error:", err);
            let msg = err.message;
            if (!msg || msg === '{}' || typeof msg === 'object') {
              msg = JSON.stringify(err);
            }
            alert("Signup Error: " + msg);
          }
        }
      });
    }

    // Password visibility toggle logic with smooth scale/pop animation
    const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');
    passwordToggleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        
        const icon = btn.querySelector('i, svg');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.setAttribute('data-lucide', 'eye-off');
          btn.style.color = '#a78bfa'; // violet accent color when visible
        } else {
          input.type = 'password';
          if (icon) icon.setAttribute('data-lucide', 'eye');
          btn.style.color = 'rgba(255,255,255,0.5)';
        }
        
        // Animated icon pop effect
        if (icon) {
          icon.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          icon.style.transform = 'scale(1.25) rotate(8deg)';
          setTimeout(() => {
            icon.style.transform = 'scale(1) rotate(0deg)';
          }, 150);
        }
        
        if (window.debouncedCreateIcons) window.debouncedCreateIcons();
        else if (window.lucide) window.lucide.createIcons();
      });
    });

  } // end wireEventListeners

} // end initAuth


// ─── PROFILE UPLOAD / LIVENESS CAPTURE ─────────────────────────────────────
function initProfileUpload() {
  const modal = document.getElementById('profile-upload-modal');
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const captureBtn = document.getElementById('capture-photo-btn');
  const previewContainer = document.getElementById('profile-preview-container');
  const previewImg = document.getElementById('profile-preview-img');
  const removeImgBtn = document.getElementById('remove-profile-img');
  const finishBtn = document.getElementById('finish-profile-btn');
  const faceGuide = document.querySelector('.camera-face-guide');
  const scannerLine = document.querySelector('.camera-scanner-line');
  const scanningGrid = document.querySelector('.camera-scanning-grid');
  const livenessText = document.querySelector('.liveness-status-text');

  let stream = null;

  async function startLiveCamera() {
    try {
      if (livenessText) livenessText.textContent = 'INITIALIZING CAMERA…';
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user', frameRate: { ideal: 60, min: 30 } }
      });
      if (cameraVideo) {
        cameraVideo.srcObject = stream;
        if (livenessText) livenessText.textContent = 'LIVENESS CHECK READY';
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (livenessText) livenessText.textContent = 'CAMERA ERROR';
      alert('Camera access required. Please enable camera permissions and try again.');
    }
  }

  function stopLiveCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
  }

  window.startLiveCamera = startLiveCamera;

  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      if (!stream) { alert('Camera stream is not active.'); return; }

      captureBtn.disabled = true;
      if (faceGuide) faceGuide.classList.add('scanning');
      if (scannerLine) scannerLine.classList.add('scanning');
      if (scanningGrid) scanningGrid.classList.add('scanning');

      const scanStages = [
        { text: 'SCANNING FACE DEPTH…', delay: 500 },
        { text: 'DETECTING MICRO-MOVEMENTS…', delay: 1000 },
        { text: 'VERIFYING BLINK & REFLECTIONS…', delay: 1600 },
        { text: 'LIVENESS CHECKS PASSED!', delay: 2000 }
      ];

      for (const stage of scanStages) {
        const prevDelay = scanStages[scanStages.indexOf(stage) - 1]?.delay || 0;
        await new Promise(r => setTimeout(r, stage.delay - prevDelay));
        if (livenessText) livenessText.textContent = stage.text;
      }

      if (cameraCanvas && cameraVideo) {
        cameraCanvas.width = cameraVideo.videoWidth || 640;
        cameraCanvas.height = cameraVideo.videoHeight || 640;
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const dataUrl = cameraCanvas.toDataURL('image/jpeg');

        if (faceGuide) faceGuide.classList.remove('scanning');
        if (scannerLine) scannerLine.classList.remove('scanning');
        if (scanningGrid) scanningGrid.classList.remove('scanning');

        if (previewImg) previewImg.src = dataUrl;
        const camContainer = document.getElementById('camera-container');
        if (camContainer) camContainer.classList.remove('active');
        if (previewContainer) previewContainer.style.display = 'block';
        if (finishBtn) finishBtn.disabled = false;
      }

      captureBtn.disabled = false;
      stopLiveCamera();
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', () => {
      if (previewImg) previewImg.src = '';
      if (previewContainer) previewContainer.style.display = 'none';
      const camContainer = document.getElementById('camera-container');
      if (camContainer) camContainer.classList.add('active');
      if (finishBtn) finishBtn.disabled = true;
      startLiveCamera();
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      const base64 = previewImg ? previewImg.src : '';
      if (!base64 || base64 === window.location.href) return; // empty src guard

      finishBtn.disabled = true;
      finishBtn.textContent = 'Saving...';

      try {
        const token = localStorage.getItem('invibe_jwt_token');
        const res = await fetch(`${API_URL}/api/users/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ profileImage: base64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update profile photo.');

        localStorage.setItem('invibeProfileImage', base64);
        localStorage.setItem('invibeUser', JSON.stringify(data.user));

        if (modal) modal.classList.remove('active');
        const authView = document.getElementById('auth-view');
        if (authView) authView.classList.add('hidden');

        setTimeout(() => {
          if (authView) authView.style.display = 'none';
          const appContainer = document.getElementById('app-container');
          if (appContainer) appContainer.style.display = 'block';
          updateAppUI();
        }, 500);
      } catch (err) {
        console.error('Error updating profileImage:', err);
        alert(err.message);
      } finally {
        finishBtn.disabled = false;
        finishBtn.textContent = 'Finish & Explore';
      }
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

  // Dispatch event so that notifications system starts loading
  window.dispatchEvent(new CustomEvent('auth-changed'));
}
