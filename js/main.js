import { auth, rtdb } from './firebase-config.js';
import { ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';
import { signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const clientWorkspaceBtn = document.querySelector('.role-toggle-btn[id="toggle-client"]');
  const proDashboardBtn = document.querySelector('.role-toggle-btn[id="toggle-pro"]');
  const pointsTrackerEl = document.getElementById('client-display-points');
  const loginForm = document.getElementById('auth-email-form');
  const authStatusLabel = document.getElementById('auth-status-label');
  const authGatewayOverlay = document.getElementById('auth-gateway-overlay');
  const initialUserNode = 'sandbox_test_user';

  function updateRoleToggleUI(targetRole) {
    if (targetRole === 'client') {
      clientWorkspaceBtn?.classList.add('active');
      proDashboardBtn?.classList.remove('active');
      document.getElementById('client-view-container').style.display = 'block';
      document.getElementById('pro-view-container').style.display = 'none';
    } else {
      proDashboardBtn?.classList.add('active');
      clientWorkspaceBtn?.classList.remove('active');
      document.getElementById('client-view-container').style.display = 'none';
      document.getElementById('pro-view-container').style.display = 'block';
    }
  }

  function switchAppView(targetRole) {
    console.log(`Routing layout profile view to: ${targetRole}`);
    updateRoleToggleUI(targetRole);

    const activeUser = auth.currentUser ? auth.currentUser.uid : initialUserNode;
    set(ref(rtdb, `users/${activeUser}/sessionState`), {
      currentRole: targetRole,
      modifiedAt: new Date().toISOString()
    }).catch(err => console.warn('Firebase execution delay:', err));
  }

  function requestCatalogService(catalogName) {
    const cost = 20;
    if (!pointsTrackerEl) return alert('Point tracker unavailable.');
    const currentValue = parseInt(pointsTrackerEl.innerText, 10) || 0;
    if (currentValue < cost) return alert('⚠️ Insufficient point balances!');

    const uuid = 'JOB_' + Math.floor(Math.random() * 9000 + 1000);
    const activeUser = auth.currentUser ? auth.currentUser.uid : initialUserNode;

    set(ref(rtdb, `dispatches/${uuid}`), {
      serviceName: catalogName,
      status: 'DISPATCHED',
      clientId: activeUser,
      pointValue: cost,
      createdAt: new Date().toISOString()
    }).then(() => {
      alert(`🎉 Order Dispatched Natively: ${uuid}`);
    }).catch((error) => {
      console.error('Dispatch request failed:', error);
      alert('Unable to dispatch service request.');
    });
  }

  function handleEmailAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email-input')?.value || '';
    const password = document.getElementById('auth-password-input')?.value || '';

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('Logged in successfully:', userCredential.user);
        if (authGatewayOverlay) authGatewayOverlay.style.display = 'none';
      })
      .catch((error) => {
        console.error('Auth error:', error.message);
        alert(`Login Failed: ${error.message}`);
      });
  }

  function handleGoogleAuth() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        console.log('Google sign-in success:', result.user);
        if (authGatewayOverlay) authGatewayOverlay.style.display = 'none';
      })
      .catch((error) => {
        console.error('Google auth failed:', error.message);
        alert(`Google Login Failed: ${error.message}`);
      });
  }

  function toggleAuthMode() {
    alert('Register mode is not yet implemented.');
  }

  function setAuthRole(role) {
    const clientBtn = document.getElementById('auth-role-client-btn');
    const proBtn = document.getElementById('auth-role-pro-btn');

    if (clientBtn && proBtn) {
      clientBtn.style.background = role === 'client' ? '#EF4444' : 'transparent';
      clientBtn.style.color = role === 'client' ? 'white' : '#a1a1aa';
      proBtn.style.background = role === 'pro' ? '#EF4444' : 'transparent';
      proBtn.style.color = role === 'pro' ? 'white' : '#a1a1aa';
    }
  }

  window.switchAppView = switchAppView;
  window.SystemKernel = window.SystemKernel || { UI: {}, IO: {} };
  window.SystemKernel.UI.switchDashboardMode = switchAppView;
  window.SystemKernel.UI.switchTab = function (context, targetId, btn) {
    btn.parentElement.querySelectorAll('.nav-tab-link').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    const scope = context === 'client' ? '#client-view-container' : '#pro-view-container';
    document.querySelectorAll(`${scope} .dashboard-panel`).forEach(p => p.classList.remove('active-panel'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('active-panel');
  };
  window.SystemKernel.IO.requestCatalogService = requestCatalogService;
  window.setAuthRole = setAuthRole;
  window.handleEmailAuth = handleEmailAuth;
  window.handleGoogleAuth = handleGoogleAuth;
  window.toggleAuthMode = toggleAuthMode;

  if (clientWorkspaceBtn && proDashboardBtn) {
    clientWorkspaceBtn.addEventListener('click', () => switchAppView('client'));
    proDashboardBtn.addEventListener('click', () => switchAppView('pro'));
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleEmailAuth);
  }

  const googleAuthBtn = document.querySelector('button[onclick="handleGoogleAuth()"]');
  if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', handleGoogleAuth);
  }

  function bindPointsTracker() {
    const pointsNode = ref(rtdb, `users/${initialUserNode}/pointsLedger`);
    onValue(pointsNode, (snapshot) => {
      const serverValue = snapshot.val();
      if (serverValue && pointsTrackerEl) {
        pointsTrackerEl.innerText = `${serverValue.balance || 0} Points`;
      }
    });
  }

  bindPointsTracker();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authStatusLabel.innerHTML = `🟢 Session Connection Live: <strong style="color: var(--primary-red);">${user.email}</strong>`;
      if (authGatewayOverlay) authGatewayOverlay.style.display = 'none';
    } else {
      authStatusLabel.innerText = 'Browsing Mode: Sandbox Account Profile';
      if (authGatewayOverlay) authGatewayOverlay.style.display = 'flex';
    }
  });
});
