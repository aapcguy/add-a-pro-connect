import { auth, rtdb, db } from './firebase-config.js';
import { ref, set, push, update, onValue } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("🎮 Master App Extension Active: Activating all orphaned buttons...");

    const fallbackUid = "sandbox_test_user";
    const getActiveUid = () => auth.currentUser ? auth.currentUser.uid : fallbackUid;

    // ========================================================
    // 1. THE 3-STEP ONBOARDING REGISTRATION WIZARD (index.html)
    // ========================================================
    const wizardSteps = document.querySelectorAll('.wizard-step'); // Targets step frames
    const nextStepBtns = document.querySelectorAll('.btn-next-step');
    const tradeCheckboxes = document.querySelectorAll('.trade-matrix-checkbox');
    const saveAvailabilityBtn = document.getElementById('btn-save-schedule');

    // Simple Step Navigation State Controller
    nextStepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const currentStep = btn.closest('.wizard-step');
            const nextStepId = btn.getAttribute('data-next-step');
            const nextStep = document.getElementById(nextStepId);

            if (currentStep && nextStep) {
                currentStep.style.display = 'none';
                nextStep.style.display = 'block';
                console.log(`Wizard advanced to: ${nextStepId}`);
            }
        });
    });

    // Save Profile & Selected Trades Matrix
    const submitWizardBtn = document.getElementById('btn-complete-onboarding');
    if (submitWizardBtn) {
        submitWizardBtn.addEventListener('click', async () => {
            const selectedTrades = [];
            tradeCheckboxes.forEach(cb => { if (cb.checked) selectedTrades.push(cb.value); });

            const providerProfile = {
                onboardingCompleted: true,
                trades: selectedTrades,
                timestamp: new Date().toISOString()
            };

            update(ref(rtdb, `users/${getActiveUid()}/profile`), providerProfile)
                .then(() => alert("🎉 Onboarding Profile Sync'd with Firebase!"))
                .catch(err => console.error("Profile sync block:", err));
        });
    }

    // ========================================================
    // 2. THE 3-TOGGLE BARTER NEGOTIATION ENGINE
    // ========================================================
    const submitCounterBtn = document.getElementById('btn-submit-counter');
    const acceptBarterBtn = document.getElementById('btn-accept-barter');
    const declineBarterBtn = document.getElementById('btn-decline-barter');

    let negotiationCounter = 0;

    if (submitCounterBtn) {
        submitCounterBtn.addEventListener('click', () => {
            negotiationCounter++;
            const counterValue = document.getElementById('counter-offer-input')?.value || "0";
            
            if (negotiationCounter >= 3) {
                submitCounterBtn.disabled = true;
                submitCounterBtn.innerText = "Offers Locked";
                alert("⚠️ 3-Toggle Limit Reached! You must now Accept or Decline this barter value.");
            }

            // Sync offer ledger trail live
            push(ref(rtdb, `negotiations/${getActiveUid()}/history`), {
                sender: getActiveUid(),
                offerValue: counterValue,
                toggleIndex: negotiationCounter,
                timestamp: new Date().toISOString()
            });
        });
    }

    if (declineBarterBtn) {
        declineBarterBtn.addEventListener('click', () => {
            alert("❌ Barter offer declined. Routing job entity back into open queue pools.");
            update(ref(rtdb, `jobs/active_lead_id`), { status: "Open", currentNegotiator: null });
        });
    }

    // ========================================================
    // 3. SERVICE CATALOG ACTIONS & REAL-TIME DISPATCH QUEUE
    // ========================================================
    const requestServiceBtn = document.getElementById('btn-request-service');
    const dispatchListEl = document.getElementById('live-dispatch-pipeline');

    if (requestServiceBtn) {
        requestServiceBtn.addEventListener('click', async () => {
            const clientJobData = {
                clientId: getActiveUid(),
                serviceRequested: document.getElementById('catalog-service-select')?.value || "General Maintenance",
                status: "Dispatched",
                createdAt: new Date().toISOString()
            };

            // Write into Realtime Database Queue Node
            push(ref(rtdb, 'dispatchQueue'), clientJobData)
                .then(() => alert("🚀 Request Transmitted to Active Contractor Dashboards!"))
                .catch(err => console.error("Queue broadcast fault:", err));
        });
    }

    // Dynamic Observer Pipeline tracking live incoming requests
    if (dispatchListEl) {
        onValue(ref(rtdb, 'dispatchQueue'), (snapshot) => {
            dispatchListEl.innerHTML = ''; // Wipe mock template lines
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(key => {
                    const li = document.createElement('li');
                    li.className = 'dispatch-row-item';
                    li.innerHTML = `<strong>${data[key].serviceRequested}</strong> - <span class="badge-status">${data[key].status}</span>`;
                    dispatchListEl.appendChild(li);
                });
            } else {
                dispatchListEl.innerHTML = '<li class="muted-info">No pending dispatches active.</li>';
            }
        });
    }

    // ========================================================
    // 4. REAL-TIME LEDGER MESSAGING SYSTEM (In-App Chat)
    // ========================================================
    const sendChatBtn = document.getElementById('btn-send-chat');
    const chatInput = document.getElementById('chat-message-input');
    const chatWindow = document.getElementById('chat-drawer-stream');

    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (!text) return;

            push(ref(rtdb, 'chats/active_session_id'), {
                uid: getActiveUid(),
                message: text,
                timestamp: new Date().toISOString()
            }).then(() => { chatInput.value = ''; });
        });
    }

    if (chatWindow) {
        onValue(ref(rtdb, 'chats/active_session_id'), (snapshot) => {
            chatWindow.innerHTML = '';
            const messages = snapshot.val();
            if (messages) {
                Object.keys(messages).forEach(id => {
                    const msgDiv = document.createElement('div');
                    msgDiv.className = messages[id].uid === getActiveUid() ? 'chat-bubble bubble-me' : 'chat-bubble bubble-them';
                    msgDiv.innerText = messages[id].message;
                    chatWindow.appendChild(msgDiv);
                });
                chatWindow.scrollTop = chatWindow.scrollHeight; // Keep view pinned down to latest message
            }
        });
    }

    // ========================================================
    // 5. REGISTRATION PROCESS INTERCEPTOR & ENGINE
    // ========================================================
    const registerLink = document.querySelector('form button[type="button"]:last-of-type') || 
                         Array.from(document.querySelectorAll('button, a')).find(el => el.innerText && el.innerText.includes('Register account'));
    const authSubmitBtn = document.getElementById('btn-login') || document.querySelector('button[type="submit"]');
    const authForm = document.getElementById('login-form') || document.querySelector('form');
    
    let isRegisterMode = false;

    if (registerLink) {
        // Intercept and bypass the legacy "not yet implemented" alert
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Overrides legacy alerts safely

            isRegisterMode = !isRegisterMode;

            if (isRegisterMode) {
                if (authSubmitBtn) authSubmitBtn.innerText = "CREATE PLATFORM ACCOUNT";
                registerLink.innerText = "Have an account? Log in instead";
                console.log("🔄 Modal state shifted to Account Registration Mode.");
            } else {
                if (authSubmitBtn) authSubmitBtn.innerText = "AUTHENTICATE SESSION";
                registerLink.innerText = "Need a platform profile? Register account";
                console.log("🔄 Modal state returned to Session Authentication Mode.");
            }
        }, true); // Use capture phase to step in before legacy scripts fire
    }

    // Intercept form submission to handle user creation dynamically
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            if (!isRegisterMode) return; // Pass control to main.js if logging in
            
            e.preventDefault();
            e.stopImmediatePropagation(); // Blocks legacy login script from running during registration

            const emailInput = document.getElementById('login-email') || authForm.querySelector('input[type="email"]');
            const passwordInput = document.getElementById('login-password') || authForm.querySelector('input[type="password"]');
            
            if (!emailInput || !passwordInput) return;

            const email = emailInput.value;
            const password = passwordInput.value;

            // Dynamically fetch modular Firebase Auth functions
            const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js");
            const { ref: dynRef, set: dynSet } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js");

            console.log(`Attempting account registration for security principal: ${email}`);

            // small toast helper for non-blocking user feedback
            const showToast = (msg, ms = 2800) => {
                const t = document.createElement('div');
                t.innerText = msg;
                t.style.position = 'fixed';
                t.style.right = '20px';
                t.style.bottom = '20px';
                t.style.background = 'rgba(17,24,39,0.95)';
                t.style.color = 'white';
                t.style.padding = '12px 16px';
                t.style.borderRadius = '8px';
                t.style.boxShadow = '0 6px 18px rgba(2,6,23,0.4)';
                t.style.zIndex = 99999;
                t.style.fontWeight = 700;
                document.body.appendChild(t);
                setTimeout(() => { t.style.transition = 'opacity 260ms'; t.style.opacity = '0'; }, ms);
                setTimeout(() => t.remove(), ms + 300);
            };

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    console.log(`Account registered successfully: ${user.uid}`);

                    // Initialize baseline points tracking and metadata ledger profiles
                    dynSet(dynRef(rtdb, `users/${user.uid}/pointsLedger`), {
                        balance: 310, // Starting point package configuration
                        tier: "Standard Sandbox Profile"
                    });

                    dynSet(dynRef(rtdb, `users/${user.uid}/profile`), {
                        email: user.email,
                        createdAt: new Date().toISOString(),
                        onboardingCompleted: false
                    });

                    // Update small UI elements and show non-blocking confirmation
                    const authStatus = document.getElementById('auth-status-label');
                    if (authStatus) authStatus.innerText = `Signed in: ${user.email}`;

                    showToast('🎉 Account created and signed in — welcome!');

                    // Clear state and hide modal container overlay safely
                    const modalOverlay = document.querySelector('.modal-overlay') || (document.querySelector('.ADA-PRO-modal-context') && document.querySelector('.ADA-PRO-modal-context').parentElement);
                    if (modalOverlay) modalOverlay.style.display = 'none';

                    // reset register mode and toggle text
                    isRegisterMode = false;
                    if (authSubmitBtn) authSubmitBtn.innerText = 'AUTHENTICATE SESSION';
                    if (registerLink) registerLink.innerText = 'Need a platform profile? Register account';
                })
                .catch((error) => {
                    console.error("Firebase Registration Fault:", error.message);
                    showToast(`Registration Failed: ${error.message}`);
                });
        });
    }

        // --- Additional Platform Handlers: Reviews, Trust Stream, Booking Matrix, Barter Uploads, Gemini ---
        window.SystemKernel = window.SystemKernel || { IO: {}, UI: {} };

        // Post a review into the realtime 'reviews' node
        window.SystemKernel.IO.postEcosystemReview = async function () {
            const target = document.getElementById('review-target-type')?.value || 'Pro Contractor';
            const stars = parseInt(document.getElementById('review-stars')?.value || '5', 10);
            const text = document.getElementById('review-text')?.value || '';
            const payload = { target, stars, text, author: getActiveUid(), createdAt: new Date().toISOString() };

            push(ref(rtdb, 'reviews'), payload)
                .then(() => {
                    alert('✅ Review posted to the network.');
                    document.getElementById('review-text').value = '';
                })
                .catch(err => {
                    console.error('Failed to post review:', err);
                    alert('Unable to post review.');
                });
        };

        // Network trust stream with fallback mock loop
        (function initNetworkTrustStream(){
            const feedEl = document.getElementById('network-reviews-feed');
            if (!feedEl) return;

            let fallbackInterval = null;
            const fallbackMessages = [
                'No validated loops yet — network idle.',
                'Sample: Pro Contractor ★★★★★ - Fast, professional.',
                'Sample: Barter Partner ★★★★☆ - Good exchange, timely pickup.',
                'Sample: Work Order ★★★☆☆ - Completed with minor touchups.'
            ];
            let idx = 0;

            function startFallback(){
                if (fallbackInterval) return;
                feedEl.innerText = fallbackMessages[idx % fallbackMessages.length];
                fallbackInterval = setInterval(() => {
                    idx++;
                    feedEl.innerText = fallbackMessages[idx % fallbackMessages.length];
                }, 2400);
            }

            function stopFallback(){
                if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
            }

            // Listen for real reviews
            onValue(ref(rtdb, 'reviews'), (snap) => {
                const data = snap.val();
                if (!data) { startFallback(); return; }
                stopFallback();
                feedEl.innerHTML = '';
                Object.keys(data).reverse().slice(0,10).forEach(k => {
                    const r = data[k];
                    const div = document.createElement('div');
                    div.className = 'review-row-box';
                    div.innerHTML = `<div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div><div><strong>${r.target}</strong> — <small style="color:var(--text-muted)">by ${r.author}</small><div style="margin-top:6px;">${r.text || ''}</div></div>`;
                    feedEl.appendChild(div);
                });
            }, (err) => {
                console.warn('Network trust stream listener failed, starting fallback.', err);
                startFallback();
            });

            // start a fallback while waiting for data
            startFallback();
        })();

        // --- Barter asset publish + photo uploads ---
        window.SystemKernel.IO.saveClientBarterAsset = function () {
            const asset = document.getElementById('barter-asset')?.value || '';
            if (!asset) return alert('Please describe the asset or service to publish.');
            const payload = { owner: getActiveUid(), asset, createdAt: new Date().toISOString() };
            push(ref(rtdb, 'barterAssets'), payload)
                .then(() => {
                    alert('✔️ Asset published to exchange board.');
                    document.getElementById('barter-asset').value = '';
                })
                .catch(err => { console.error('Publish barter asset failed:', err); alert('Unable to publish asset.'); });
        };

        window.SystemKernel.IO.uploadBarterPhotos = function () {
            const input = document.getElementById('barter-photo');
            if (!input || !input.files || input.files.length === 0) return alert('No files selected.');
            const files = Array.from(input.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    push(ref(rtdb, `barterPhotos/${getActiveUid()}`), { name: file.name, dataUrl, createdAt: new Date().toISOString() });
                };
                reader.readAsDataURL(file);
            });
            alert('Uploading photos to barter portfolio (mock upload).');
            input.value = '';
        };

        // --- Calendar / Shift Distribution Matrix & Booking ---
        function renderCalendarMatrix() {
            const matrixEl = document.getElementById('client-calendar-matrix');
            if (!matrixEl) return;
            matrixEl.innerHTML = '';

            // generate next 30 days
            const days = 30;
            const today = new Date();
            onValue(ref(rtdb, 'bookings'), (snap) => {
                const bookings = snap.val() || {};
                for (let i=0;i<days;i++){
                    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()+i);
                    const keyDate = d.toISOString().slice(0,10);
                    ['AM','PM'].forEach(slot => {
                        const slotKey = `${keyDate}_${slot}`;
                        const el = document.createElement('div');
                        el.className = 'calendar-slot';
                        if (bookings[slotKey]) { el.classList.add('booked'); el.innerText = `${keyDate}\n${slot}\nBooked`; }
                        else { el.innerText = `${keyDate}\n${slot}\nOpen`; el.addEventListener('click', () => window.SystemKernel.IO.openBookingModal(keyDate, slot)); }
                        matrixEl.appendChild(el);
                    });
                }
            });
        }

        window.SystemKernel.IO.openBookingModal = function (a, b) {
            // Supports two call styles:
            // 1) openBookingModal(serviceName)
            // 2) openBookingModal(dateString, slot) - invoked from calendar slots
            let serviceName = null;
            let prefillDate = null;
            let prefillSlot = null;
            if (b !== undefined) { // called with (date, slot)
                prefillDate = a;
                prefillSlot = b;
                serviceName = 'Scheduled Job';
            } else {
                serviceName = a || 'General';
            }
            // Reuse when invoked by button: show calendar overlay and set current service
            const modalId = 'booking-modal-overlay';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.position = 'fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0';
                modal.style.background='rgba(0,0,0,0.6)'; modal.style.zIndex='100000'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center';
                modal.innerHTML = `<div style="background:white;padding:20px;border-radius:8px;max-width:520px;width:95%;box-sizing:border-box;">
                    <h3 style="margin:0 0 8px 0;">Book a Job</h3>
                    <div id="booking-modal-body"></div>
                    <div style="display:flex;gap:8px;margin-top:12px;"><button id="booking-confirm" class="form-submit-btn">Confirm Booking</button><button id="booking-cancel" class="form-submit-btn" style="background:#9ca3af;">Cancel</button></div>
                </div>`;
                document.body.appendChild(modal);
                document.getElementById('booking-cancel').addEventListener('click', () => { modal.style.display='none'; });
            }

            const body = document.getElementById('booking-modal-body');
            body.innerHTML = `<p style="color:var(--text-muted);">Service: <strong>${serviceName || 'General'}</strong></p>
                <label style="font-size:12px;color:var(--text-muted);">Select Day</label>
                <input type="date" id="booking-date" class="field-input" value="${prefillDate || ''}">
                <label style="font-size:12px;color:var(--text-muted);">Time Slot</label>
                <select id="booking-slot" class="field-input"><option value="AM">AM</option><option value="PM">PM</option></select>
                <label style="font-size:12px;color:var(--text-muted);">Notes (optional)</label>
                <input id="booking-notes" class="field-input" placeholder="Add job notes...">`;

            if (prefillSlot) {
                document.getElementById('booking-slot').value = prefillSlot;
            }

            document.getElementById('booking-confirm').onclick = function(){
                const dateVal = document.getElementById('booking-date').value;
                const slotVal = document.getElementById('booking-slot').value;
                const notes = document.getElementById('booking-notes').value;
                if (!dateVal) return alert('Please choose a date.');
                const slotKey = `${dateVal}_${slotVal}`;
                set(ref(rtdb, `bookings/${slotKey}`), { service: serviceName||'General', user: getActiveUid(), notes: notes||'', createdAt: new Date().toISOString() })
                    .then(() => { alert('Booking confirmed.'); document.getElementById(modalId).style.display='none'; renderCalendarMatrix(); })
                    .catch(err => { console.error('Booking failed', err); alert('Unable to book slot.'); });
            };

            modal.style.display='flex';
        };

        // initialize matrix on load
        renderCalendarMatrix();

        // Wire Gemini floating button
        const gemBtn = document.getElementById('gemini-toggle');
        if (gemBtn) {
            gemBtn.addEventListener('click', () => {
                // simple sliding quick help dialog
                const id = 'gemini-modal';
                if (document.getElementById(id)) { document.getElementById(id).remove(); return; }
                const m = document.createElement('div');
                m.id = id;
                m.style.position='fixed'; m.style.right='18px'; m.style.bottom='90px'; m.style.zIndex='100001'; m.style.background='white'; m.style.padding='12px'; m.style.borderRadius='10px'; m.style.boxShadow='0 10px 30px rgba(2,6,23,0.2)'; m.style.width='300px';
                m.innerHTML = `<div style="font-weight:800;margin-bottom:6px;">Gemini — Quick Assist</div><div style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">Ask for help with booking, barter, or dispatch routing.</div><div style="display:flex;gap:8px;"><button class="form-submit-btn" id="gemini-start">Start</button><button class="form-submit-btn" style="background:#9ca3af;" id="gemini-close">Close</button></div>`;
                document.body.appendChild(m);
                document.getElementById('gemini-close').addEventListener('click', () => m.remove());
                document.getElementById('gemini-start').addEventListener('click', ()=> { alert('Gemini: Hello! How can I assist? (demo)'); });
            });
        }
});
