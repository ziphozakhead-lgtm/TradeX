/* ==========================================================================
   APP STATE & INITIALIZATION
   ========================================================================== */

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let userLocation = JSON.parse(localStorage.getItem('userLocation')) || null;

let items = JSON.parse(localStorage.getItem('items')) || [
    {
        id: 'item_1',
        sellerName: 'Sarah Jenkins',
        sellerEmail: 'sarah@example.com',
        title: 'Vintage Leather Jacket (Size M)',
        category: 'clothing',
        price: 850,
        location: 'Sandton City, JHB',
        lat: -26.1076,
        lng: 28.0567,
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500',
        description: 'Genuine leather jacket in great condition. Minor wear on elbows.',
        wanted: 'Looking for denim jacket or boots size 8.',
        status: 'OPEN',
        timestamp: new Date().toISOString()
    },
    {
        id: 'item_2',
        sellerName: 'David Chen',
        sellerEmail: 'david@example.com',
        title: 'Mechanical Keyboard (RGB)',
        category: 'electronics',
        price: 1200,
        location: 'Cape Town City Bowl',
        lat: -33.9249,
        lng: 18.4241,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
        description: 'Custom mechanical keyboard with blue switches. Barely used.',
        wanted: 'Interested in wireless mouse or monitor arm.',
        status: 'OPEN',
        timestamp: new Date().toISOString()
    }
];

let offers = JSON.parse(localStorage.getItem('offers')) || [];
let chatMessages = JSON.parse(localStorage.getItem('chatMessages')) || {};
let activeChatOfferId = null;

// Firebase Check
let isFirebaseConnected = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
let db = isFirebaseConnected ? firebase.database() : null;

/* ==========================================================================
   INITIALIZATION & EVENT DELEGATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    syncWithFirebase();
});

function initApp() {
    getUserLocation();
    updateUserUI();
    applyFilters();
    renderOffersList();
    renderProfileView();
}

function saveLocalData() {
    localStorage.setItem('items', JSON.stringify(items));
    localStorage.setItem('offers', JSON.stringify(offers));
    localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
    if (currentUser) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('currentUser');
    }
}

function setupEventListeners() {
    // Form submissions
    document.addEventListener('submit', (e) => {
        if (e.target.id === 'post-item-form') {
            e.preventDefault();
            handleCreateListing();
        } else if (e.target.id === 'auth-form') {
            e.preventDefault();
            handleAuthSubmit();
        } else if (e.target.id === 'offer-form') {
            e.preventDefault();
            handleOfferSubmit();
        } else if (e.target.id === 'chat-form') {
            e.preventDefault();
            handleSendChatMessage();
        } else if (e.target.id === 'meetup-form') {
            e.preventDefault();
            handleMeetupSubmit();
        }
    });

    // Global Click Handler
    document.addEventListener('click', (e) => {
        const target = e.target;

        // Login trigger
        if (target.closest('#btn-login, .btn-login-trigger')) {
            e.preventDefault();
            openModal('auth-modal');
            return;
        }

        // Logout trigger
        if (target.closest('#btn-logout')) {
            e.preventDefault();
            handleLogout();
            return;
        }

        // GPS Toggle Button
        if (target.closest('#btn-gps-toggle')) {
            e.preventDefault();
            getUserLocation(true);
            return;
        }

        // Navigation Tabs
        const navBtn = target.closest('.bottom-nav-btn');
        if (navBtn) {
            e.preventDefault();
            const targetTab = navBtn.getAttribute('data-tab');
            if (targetTab) switchTab(targetTab, navBtn);
            return;
        }

        // Trade / Offer Button
        const tradeBtn = target.closest('.btn-trade');
        if (tradeBtn) {
            e.preventDefault();
            const itemId = tradeBtn.getAttribute('data-id');
            if (itemId) openOfferModal(itemId);
            return;
        }
    });

    // Search and Filters
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const distanceFilter = document.getElementById('distance-filter');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (distanceFilter) distanceFilter.addEventListener('change', applyFilters);
}

/* ==========================================================================
   AUTHENTICATION & PROFILE MANAGEMENT
   ========================================================================== */

function toggleAuthMode() {
    const modeInput = document.getElementById('auth-mode');
    const titleEl = document.getElementById('auth-modal-title');
    const subtitleEl = document.getElementById('auth-modal-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const nameGroup = document.getElementById('auth-name-group');
    const nameInput = document.getElementById('auth-name');

    if (modeInput.value === 'login') {
        modeInput.value = 'signup';
        titleEl.textContent = 'Create an Account';
        subtitleEl.textContent = 'Sign up to start listing and trading items.';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Sign In';
        nameGroup.style.display = 'block';
        nameInput.required = true;
    } else {
        modeInput.value = 'login';
        titleEl.textContent = 'Sign In to TradeMarket';
        subtitleEl.textContent = 'Enter your details to log into your account.';
        submitBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        nameGroup.style.display = 'none';
        nameInput.required = false;
    }
}

function handleAuthSubmit() {
    const mode = document.getElementById('auth-mode').value;
    const emailInput = document.getElementById('auth-email').value.trim().toLowerCase();
    const passwordInput = document.getElementById('auth-password').value;
    const nameInput = document.getElementById('auth-name').value.trim();

    if (!emailInput || !passwordInput) {
        showToast("Please fill in email and password.");
        return;
    }

    if (mode === 'signup') {
        if (!nameInput) {
            showToast("Please provide your full name.");
            return;
        }
        currentUser = {
            fullName: nameInput,
            email: emailInput
        };
        showToast(`Account created! Welcome ${currentUser.fullName}`);
    } else {
        // Sign In
        const displayName = nameInput || emailInput.split('@')[0];
        currentUser = {
            fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
            email: emailInput
        };
        showToast(`Logged in as ${currentUser.fullName}`);
    }

    saveLocalData();
    updateUserUI();
    renderProfileView();
    renderOffersList();
    closeModal('auth-modal');

    // Reset Form
    document.getElementById('auth-form').reset();
}

function handleLogout() {
    currentUser = null;
    saveLocalData();
    updateUserUI();
    renderProfileView();
    renderOffersList();
    showToast("Logged out successfully.");
}

function updateUserUI() {
    const authStatusElement = document.getElementById('auth-status');
    if (!authStatusElement) return;

    if (currentUser) {
        authStatusElement.innerHTML = `
            <button type="button" class="user-chip" id="btn-logout">
                ${escapeHtml(currentUser.fullName.split(' ')[0])} (Logout)
            </button>
        `;
    } else {
        authStatusElement.innerHTML = `
            <button type="button" class="user-chip btn-login-trigger">Sign In / Sign Up</button>
        `;
    }
}

function renderProfileView() {
    const container = document.getElementById('profile-details-container');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <p style="color: #6e6e73; margin-bottom: 1rem;">You are currently browsing as a guest.</p>
                <button type="button" class="submit-btn btn-login-trigger" style="max-width: 240px; margin: 0 auto;">Sign In / Sign Up</button>
            </div>
        `;
        return;
    }

    const myListings = items.filter(item => item.sellerEmail === currentUser.email);

    container.innerHTML = `
        <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(0,0,0,0.06);">
            <p style="font-size: 0.8rem; font-weight: 600; color: #8e8e93; text-transform: uppercase;">Active Profile</p>
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-top: 0.2rem;">${escapeHtml(currentUser.fullName)}</h3>
            <p style="color: #0071e3; font-size: 0.9rem;">${escapeHtml(currentUser.email)}</p>
        </div>
        <div>
            <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.8rem;">My Active Listings (${myListings.length})</h4>
            ${myListings.length === 0 ? '<p style="color:#8e8e93; font-size:0.85rem;">You have not published any items yet.</p>' : ''}
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${myListings.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #f2f2f7; padding: 0.75rem 1rem; border-radius: 12px;">
                        <div>
                            <strong style="font-size: 0.9rem;">${escapeHtml(item.title)}</strong>
                            <div style="font-size: 0.8rem; color: #2e7d32; font-weight: 700;">R ${item.price}</div>
                        </div>
                        <span class="badge">${item.status}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/* ==========================================================================
   GEOLOCATION & DISTANCE CALCULATIONS
   ========================================================================== */

function getUserLocation(userInitiated = false) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                localStorage.setItem('userLocation', JSON.stringify(userLocation));
                const gpsBtn = document.getElementById('btn-gps-toggle');
                if (gpsBtn) {
                    gpsBtn.classList.add('active');
                    gpsBtn.innerHTML = '<span>📍 GPS Active</span>';
                }
                applyFilters();
                if (userInitiated) showToast("Location acquired.");
            },
            (err) => {
                if (userInitiated) showToast("Unable to access GPS location.");
            }
        );
    }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10;
}

/* ==========================================================================
   MARKETPLACE CREATION & FILTERING
   ========================================================================== */

async function handleCreateListing() {
    if (!currentUser) {
        openModal('auth-modal');
        return;
    }

    const titleInput = document.getElementById('item-title');
    const categoryInput = document.getElementById('item-category');
    const priceInput = document.getElementById('item-price');
    const locationInput = document.getElementById('item-location');
    const descInput = document.getElementById('item-desc');
    const wantedInput = document.getElementById('item-wanted');
    const imageInput = document.getElementById('item-image');

    let imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500";

    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            imageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Error reading photo:", err);
        }
    }

    const newItem = {
        id: 'item_' + Date.now(),
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: titleInput.value.trim(),
        category: categoryInput.value,
        price: parseFloat(priceInput.value) || 0,
        location: locationInput.value.trim(),
        lat: userLocation ? userLocation.lat : -26.2041,
        lng: userLocation ? userLocation.lng : 28.0473,
        image: imageUrl,
        description: descInput.value.trim(),
        wanted: wantedInput.value.trim() || 'Open to offers',
        status: 'OPEN',
        timestamp: new Date().toISOString()
    };

    // Save globally to Firebase database so all users receive it instantly
    if (isFirebaseConnected && db) {
        db.ref('items/' + newItem.id).set(newItem);
    } else {
        items.unshift(newItem);
        saveLocalData();
        applyFilters();
    }

    document.getElementById('post-item-form').reset();
    showToast("Listing published across the network!");
    renderProfileView();

    const exploreBtn = document.querySelector('.bottom-nav-btn[data-tab="explore-tab"]');
    switchTab('explore-tab', exploreBtn);
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const distanceFilter = document.getElementById('distance-filter');

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const category = categoryFilter ? categoryFilter.value : 'all';
    const maxDist = distanceFilter && distanceFilter.value !== 'all' ? parseFloat(distanceFilter.value) : null;

    const filtered = items.filter(item => {
        const matchesQuery = !query ||
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.location.toLowerCase().includes(query);

        const matchesCategory = category === 'all' || item.category === category;

        let matchesDistance = true;
        if (maxDist !== null && userLocation && item.lat && item.lng) {
            const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            matchesDistance = dist !== null && dist <= maxDist;
        }

        return matchesQuery && matchesCategory && matchesDistance;
    });

    renderItemsGrid(filtered);
}

function renderItemsGrid(itemsToRender) {
    const gridContainer = document.getElementById('items-grid');
    if (!gridContainer) return;

    if (itemsToRender.length === 0) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #8e8e93;">
                <p style="font-size: 0.95rem;">No items matched your search filters.</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = itemsToRender.map(item => {
        let distLabel = '';
        if (userLocation && item.lat && item.lng) {
            const d = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            if (d !== null) distLabel = ` • ${d} km away`;
        }

        return `
            <div class="card" id="card-${item.id}">
                <div style="position: relative;">
                    <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" />
                    <span class="badge" style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); color: #ffffff;">${escapeHtml(item.category)}</span>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    <div class="price-tag">R ${item.price}</div>
                    <div class="location-tag">📍 ${escapeHtml(item.location)}${distLabel}</div>
                    <p style="font-size: 0.82rem; color: #6e6e73; margin-bottom: 0.6rem; line-height: 1.35;">${escapeHtml(item.description)}</p>
                    <div style="background: #f2f2f7; padding: 0.55rem; border-radius: 10px; font-size: 0.78rem; color: #1d1d1f; margin-bottom: 0.8rem;">
                        <strong>Wants:</strong> ${escapeHtml(item.wanted)}
                    </div>
                    <div class="card-actions">
                        <button type="button" data-id="${item.id}" class="primary-btn btn-trade">Make Offer</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* ==========================================================================
   OFFERS, COUNTER-OFFERS & NEGOTIATIONS
   ========================================================================== */

function openOfferModal(targetItemId, parentOfferId = null) {
    if (!currentUser) {
        openModal('auth-modal');
        return;
    }

    const targetItem = items.find(i => i.id === targetItemId);
    if (!targetItem) return;

    if (!parentOfferId && targetItem.sellerEmail === currentUser.email) {
        showToast("You cannot offer on your own listing.");
        return;
    }

    document.getElementById('offer-target-item-id').value = targetItemId;
    document.getElementById('offer-parent-id').value = parentOfferId || '';

    if (parentOfferId) {
        document.getElementById('offer-modal-title').textContent = `Negotiate / Counter Offer`;
        document.getElementById('offer-modal-subtitle').textContent = `Propose new terms for: ${targetItem.title}`;
        document.getElementById('offer-submit-btn').textContent = "Send Counter-Offer";
    } else {
        document.getElementById('offer-modal-title').textContent = `Offer for: ${targetItem.title} (R ${targetItem.price})`;
        document.getElementById('offer-modal-subtitle').textContent = `Select an item to trade or offer a cash top-up in Rands.`;
        document.getElementById('offer-submit-btn').textContent = "Send Proposal";
    }

    const selectEl = document.getElementById('offer-my-item');
    const myItems = items.filter(i => i.sellerEmail === currentUser.email && i.status === 'OPEN');

    selectEl.innerHTML = '<option value="">-- Direct Cash / Top-Up Only --</option>' +
        myItems.map(i => `<option value="${i.id}">${escapeHtml(i.title)} (Est. R ${i.price})</option>`).join('');

    openModal('offer-modal');
}

function openNegotiateModal(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;
    openOfferModal(offer.targetItemId, offer.id);
}

function handleOfferSubmit() {
    const targetItemId = document.getElementById('offer-target-item-id').value;
    const parentOfferId = document.getElementById('offer-parent-id').value;
    const myItemId = document.getElementById('offer-my-item').value;
    const cashTopup = parseFloat(document.getElementById('offer-cash-topup').value) || 0;
    const message = document.getElementById('offer-message').value.trim();

    const targetItem = items.find(i => i.id === targetItemId);
    const myItem = items.find(i => i.id === myItemId);

    let recipientEmail = targetItem.sellerEmail;
    if (parentOfferId) {
        const parentOffer = offers.find(o => o.id === parentOfferId);
        if (parentOffer) {
            recipientEmail = parentOffer.buyerEmail === currentUser.email ? parentOffer.sellerEmail : parentOffer.buyerEmail;
            parentOffer.status = 'COUNTERED';
            if (isFirebaseConnected && db) {
                db.ref('offers/' + parentOffer.id + '/status').set('COUNTERED');
            }
        }
    }

    const newOffer = {
        id: 'offer_' + Date.now(),
        targetItemId: targetItem.id,
        targetItemTitle: targetItem.title,
        sellerEmail: recipientEmail,
        buyerEmail: currentUser.email,
        buyerName: currentUser.fullName,
        offeredItemId: myItem ? myItem.id : null,
        offeredItemTitle: myItem ? myItem.title : 'Direct Offer',
        cashTopupRands: cashTopup,
        message: message,
        status: 'PENDING',
        parentOfferId: parentOfferId || null,
        timestamp: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
        db.ref('offers/' + newOffer.id).set(newOffer);
    } else {
        offers.unshift(newOffer);
        saveLocalData();
        renderOffersList();
    }

    closeModal('offer-modal');
    document.getElementById('offer-form').reset();
    showToast(parentOfferId ? "Counter-offer submitted!" : "Trade proposal sent!");
}

function renderOffersList() {
    const container = document.getElementById('offers-list');
    const badge = document.getElementById('trades-badge');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <p style="color: #6e6e73; margin-bottom: 1rem;">Sign in to review trade offers and proposals.</p>
                <button type="button" class="submit-btn btn-login-trigger" style="max-width: 200px; margin: 0 auto;">Sign In / Sign Up</button>
            </div>
        `;
        if (badge) badge.style.display = 'none';
        return;
    }

    const myOffers = offers.filter(o => o.buyerEmail === currentUser.email || o.sellerEmail === currentUser.email);

    if (badge) {
        if (myOffers.length > 0) {
            badge.textContent = myOffers.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (myOffers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #8e8e93;">
                <p style="font-size: 0.95rem;">No active trade offers or proposals.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = myOffers.map(offer => {
        const isSeller = offer.sellerEmail === currentUser.email;
        const roleText = isSeller ? 'Received Offer' : 'Sent Offer';
        const otherParty = isSeller ? offer.buyerName : offer.sellerEmail;

        return `
            <div class="offer-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span class="badge" style="background: rgba(0,113,227,0.1); color: #0071e3;">${roleText}</span>
                    <span style="font-size: 0.78rem; font-weight: 700; color: ${offer.status === 'ACCEPTED' ? '#34c759' : '#ff9500'};">${offer.status}</span>
                </div>
                <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem;">${escapeHtml(offer.targetItemTitle)}</h4>
                <div style="font-size: 0.85rem; color: #1d1d1f; line-height: 1.4;">
                    ${offer.offeredItemTitle ? `<div><strong>Offered Item:</strong> ${escapeHtml(offer.offeredItemTitle)}</div>` : ''}
                    ${offer.cashTopupRands > 0 ? `<div><strong>Cash Addition:</strong> <span style="color:#2e7d32; font-weight:bold;">R ${offer.cashTopupRands}</span></div>` : ''}
                    <div><strong>With Trader:</strong> ${escapeHtml(otherParty)}</div>
                </div>
                ${offer.message ? `
                    <p style="font-size: 0.82rem; font-style: italic; background: #f2f2f7; padding: 0.5rem 0.75rem; border-radius: 8px; margin: 0.6rem 0; color: #6e6e73;">
                        "${escapeHtml(offer.message)}"
                    </p>
                ` : ''}

                ${offer.meetup ? `
                    <div style="background: rgba(52, 199, 89, 0.12); padding: 0.65rem; border-radius: 10px; font-size: 0.82rem; margin: 0.6rem 0; color: #1b5e20;">
                        <strong>📍 Exchange Scheduled:</strong> ${escapeHtml(offer.meetup.location)} <br>
                        <small>${new Date(offer.meetup.datetime).toLocaleString()}</small>
                    </div>
                ` : ''}

                <div class="card-actions" style="margin-top: 0.75rem; gap: 0.5rem; flex-wrap: wrap;">
                    ${isSeller && offer.status === 'PENDING' ? `
                        <button type="button" onclick="acceptOffer('${offer.id}')" class="accept-btn" style="flex:1;">Accept</button>
                    ` : ''}
                    ${offer.status === 'PENDING' ? `
                        <button type="button" onclick="openNegotiateModal('${offer.id}')" class="secondary-btn" style="flex:1;">Negotiate</button>
                    ` : ''}
                    <button type="button" onclick="openChatModal('${offer.id}')" class="secondary-btn" style="flex:1;">💬 Chat</button>
                    ${offer.status === 'ACCEPTED' ? `
                        <button type="button" onclick="openMeetupModal('${offer.id}')" class="primary-btn" style="flex:1;">📍 Set Meetup</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function acceptOffer(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    offer.status = 'ACCEPTED';
    saveLocalData();

    if (isFirebaseConnected && db) {
        db.ref('offers/' + offerId).update({ status: 'ACCEPTED' });
    }

    showToast("Offer accepted! Set up a meetup location.");
    renderOffersList();
}

/* ==========================================================================
   LIVE CHAT MESSAGING
   ========================================================================== */

function openChatModal(offerId) {
    activeChatOfferId = offerId;
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    const isSeller = offer.sellerEmail === currentUser.email;
    const targetName = isSeller ? offer.buyerName : offer.sellerEmail;

    document.getElementById('chat-target-name').textContent = targetName;
    document.getElementById('chat-item-title').textContent = offer.targetItemTitle;

    renderChatMessages();
    openModal('chat-modal');
}

function renderChatMessages() {
    if (!activeChatOfferId) return;
    const container = document.getElementById('chat-messages');
    const msgs = chatMessages[activeChatOfferId] || [];

    container.innerHTML = msgs.map(msg => {
        const isMe = msg.sender === currentUser.email;
        return `
            <div class="chat-bubble ${isMe ? 'chat-me' : 'chat-them'}">
                <div class="chat-sender-name">${escapeHtml(msg.senderName)}</div>
                <div>${escapeHtml(msg.text)}</div>
                <div class="chat-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function handleSendChatMessage() {
    if (!activeChatOfferId || !currentUser) return;

    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (!chatMessages[activeChatOfferId]) {
        chatMessages[activeChatOfferId] = [];
    }

    const newMessage = {
        id: 'msg_' + Date.now(),
        sender: currentUser.email,
        senderName: currentUser.fullName,
        text: text,
        timestamp: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
        db.ref(`chats/${activeChatOfferId}/${newMessage.id}`).set(newMessage);
    } else {
        chatMessages[activeChatOfferId].push(newMessage);
        saveLocalData();
        renderChatMessages();
    }

    input.value = '';
}

/* ==========================================================================
   MEETUP SCHEDULER
   ========================================================================== */

function openMeetupModal(offerId) {
    document.getElementById('meetup-offer-id').value = offerId;
    openModal('meetup-modal');
}

function handleMeetupSubmit() {
    const offerId = document.getElementById('meetup-offer-id').value;
    const location = document.getElementById('meetup-location').value.trim();
    const datetime = document.getElementById('meetup-datetime').value;
    const notes = document.getElementById('meetup-notes').value.trim();

    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    const meetupData = {
        location: location,
        datetime: datetime,
        notes: notes,
        scheduledBy: currentUser.email
    };

    if (isFirebaseConnected && db) {
        db.ref('offers/' + offerId + '/meetup').set(meetupData);
    } else {
        offer.meetup = meetupData;
        saveLocalData();
        renderOffersList();
    }

    closeModal('meetup-modal');
    showToast("Meetup details confirmed!");
}

/* ==========================================================================
   UTILITY & INTERFACE HELPERS
   ========================================================================== */

function switchTab(tabId, targetBtn) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');

    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));

    if (targetBtn) {
        targetBtn.classList.add('active');
    } else {
        const match = document.querySelector(`.bottom-nav-btn[data-tab="${tabId}"]`);
        if (match) match.classList.add('active');
    }

    if (tabId === 'explore-tab') applyFilters();
    if (tabId === 'trades-tab') renderOffersList();
    if (tabId === 'profile-tab') renderProfileView();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function syncWithFirebase() {
    if (!isFirebaseConnected || !db) return;

    db.ref('items').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            items = Object.keys(data).map(k => data[k]);
            saveLocalData();
            applyFilters();
        }
    });

    db.ref('offers').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            offers = Object.keys(data).map(k => data[k]);
            saveLocalData();
            renderOffersList();
        }
    });

    db.ref('chats').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            chatMessages = data;
            saveLocalData();
            if (activeChatOfferId) renderChatMessages();
        }
    });
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
