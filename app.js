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

// Firebase Connection Initialization
let isFirebaseConnected = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
let db = isFirebaseConnected ? firebase.database() : null;

/* ==========================================================================
   INITIALIZATION & EVENT LISTENERS
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

        // Login / Logout
        if (target.closest('#btn-login, .btn-login')) {
            e.preventDefault();
            handleLogin();
            return;
        }
        if (target.closest('#btn-logout, .btn-logout')) {
            e.preventDefault();
            handleLogout();
            return;
        }

        // GPS toggle trigger
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

        // Offer Button Trigger
        const tradeBtn = target.closest('.btn-trade');
        if (tradeBtn) {
            e.preventDefault();
            const itemId = tradeBtn.getAttribute('data-id');
            if (itemId) openOfferModal(itemId);
            return;
        }
    });

    // Filters
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

function handleLogin() {
    const name = prompt("Enter your name to sign in:");
    if (!name || !name.trim()) return false;

    const email = prompt("Enter your email address:");
    if (!email || !email.trim()) return false;

    currentUser = {
        fullName: name.trim(),
        email: email.trim().toLowerCase()
    };

    saveLocalData();
    updateUserUI();
    renderProfileView();
    renderOffersList();
    showToast(`Welcome back, ${currentUser.fullName}!`);
    return true;
}

function handleLogout() {
    currentUser = null;
    saveLocalData();
    updateUserUI();
    renderProfileView();
    renderOffersList();
    showToast("Signed out successfully.");
}

function updateUserUI() {
    const authStatusElement = document.getElementById('auth-status');
    if (!authStatusElement) return;

    if (currentUser) {
        authStatusElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px;">Hi, <strong>${escapeHtml(currentUser.fullName)}</strong></span>
                <button type="button" id="btn-logout" class="btn-login" style="background:#ff3b30; padding:4px 10px; font-size:12px;">Logout</button>
            </div>
        `;
    } else {
        authStatusElement.innerHTML = `<button type="button" id="btn-login" class="btn-login">Sign In / Register</button>`;
    }
}

function renderProfileView() {
    const container = document.getElementById('profile-details-container');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <p style="margin-bottom: 15px; color: #666;">You are currently browsing as a Guest.</p>
                <button type="button" id="btn-login" class="submit-btn">Sign In / Register</button>
            </div>
        `;
        return;
    }

    const myListings = items.filter(item => item.sellerEmail === currentUser.email);

    container.innerHTML = `
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
            <p style="font-size: 14px; color: #666;">Account Details</p>
            <h3 style="margin-top: 4px;">${escapeHtml(currentUser.fullName)}</h3>
            <p style="color: #0071e3; font-size: 14px;">${escapeHtml(currentUser.email)}</p>
        </div>
        <div>
            <h4 style="margin-bottom: 10px;">My Published Items (${myListings.length})</h4>
            ${myListings.length === 0 ? '<p style="color:#888; font-size:13px;">No items posted yet.</p>' : ''}
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${myListings.map(item => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px 14px; border-radius:8px;">
                        <div>
                            <strong>${escapeHtml(item.title)}</strong>
                            <div style="font-size:12px; color:#2e7d32; font-weight:bold;">R ${item.price}</div>
                        </div>
                        <span style="font-size:11px; background:#e0e0e0; padding:2px 8px; border-radius:4px;">${item.status}</span>
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
                    gpsBtn.textContent = '📍 GPS Active';
                }
                applyFilters();
                if (userInitiated) showToast("Location updated successfully.");
            },
            (err) => {
                console.warn("Geolocation warning/error:", err.message);
                if (userInitiated) showToast("Could not retrieve GPS location.");
            }
        );
    }
}

// Distance calculation using Haversine Formula (returns km)
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
   ITEM CREATION & FILTERING
   ========================================================================== */

async function handleCreateListing() {
    if (!currentUser) {
        if (!handleLogin()) return;
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
            console.error("Error reading image:", err);
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

    items.unshift(newItem);
    saveLocalData();

    if (isFirebaseConnected && db) {
        db.ref('items/' + newItem.id).set(newItem);
    }

    document.getElementById('post-item-form').reset();
    showToast("Listing created! Now visible in Rands.");
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
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #777;">
                <p>No listings match your criteria.</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = itemsToRender.map(item => {
        let distLabel = '';
        if (userLocation && item.lat && item.lng) {
            const d = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            if (d !== null) distLabel = ` (${d} km away)`;
        }

        return `
            <div class="card" id="card-${item.id}">
                <div style="position: relative;">
                    <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" />
                    <span class="badge" style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color:#fff;">${escapeHtml(item.category)}</span>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    <div class="price-tag">R ${item.price}</div>
                    <div class="location-tag">📍 ${escapeHtml(item.location)}${distLabel}</div>
                    <p style="font-size:12px; color:#555; margin-bottom:8px;">${escapeHtml(item.description)}</p>
                    <div style="background:#f0f7f0; padding:8px; border-radius:6px; font-size:12px; margin-bottom:12px;">
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
   OFFERS, COUNTER-OFFERS & CASH TOP-UPS (IN RANDS)
   ========================================================================== */

function openOfferModal(targetItemId) {
    if (!currentUser) {
        if (!handleLogin()) return;
    }

    const targetItem = items.find(i => i.id === targetItemId);
    if (!targetItem) return;

    if (targetItem.sellerEmail === currentUser.email) {
        showToast("You cannot make an offer on your own item.");
        return;
    }

    document.getElementById('offer-target-item-id').value = targetItemId;
    document.getElementById('offer-modal-title').textContent = `Offer on: ${targetItem.title} (R ${targetItem.price})`;

    const selectEl = document.getElementById('offer-my-item');
    const myItems = items.filter(i => i.sellerEmail === currentUser.email && i.status === 'OPEN');

    selectEl.innerHTML = '<option value="">-- Cash Only / Direct Purchase --</option>' +
        myItems.map(i => `<option value="${i.id}">${escapeHtml(i.title)} (Est. R ${i.price})</option>`).join('');

    document.getElementById('offer-modal').style.display = 'flex';
}

function handleOfferSubmit() {
    const targetItemId = document.getElementById('offer-target-item-id').value;
    const myItemId = document.getElementById('offer-my-item').value;
    const cashTopup = parseFloat(document.getElementById('offer-cash-topup').value) || 0;
    const message = document.getElementById('offer-message').value.trim();

    const targetItem = items.find(i => i.id === targetItemId);
    const myItem = items.find(i => i.id === myItemId);

    const newOffer = {
        id: 'offer_' + Date.now(),
        targetItemId: targetItem.id,
        targetItemTitle: targetItem.title,
        sellerEmail: targetItem.sellerEmail,
        buyerEmail: currentUser.email,
        buyerName: currentUser.fullName,
        offeredItemId: myItem ? myItem.id : null,
        offeredItemTitle: myItem ? myItem.title : 'Direct Trade Offer',
        cashTopupRands: cashTopup,
        message: message,
        status: 'PENDING',
        timestamp: new Date().toISOString()
    };

    offers.unshift(newOffer);
    saveLocalData();

    if (isFirebaseConnected && db) {
        db.ref('offers/' + newOffer.id).set(newOffer);
    }

    closeModal('offer-modal');
    document.getElementById('offer-form').reset();
    showToast("Trade offer submitted!");
    renderOffersList();
}

function renderOffersList() {
    const container = document.getElementById('offers-list');
    const badge = document.getElementById('trades-badge');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `<p style="text-align:center; padding: 20px; color: #666;">Please sign in to manage trade offers.</p>`;
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
        container.innerHTML = `<p style="text-align:center; padding: 30px; color: #888;">No active trade offers or counter-offers.</p>`;
        return;
    }

    container.innerHTML = myOffers.map(offer => {
        const isSeller = offer.sellerEmail === currentUser.email;
        const roleText = isSeller ? 'Received Offer' : 'Sent Offer';
        const otherParty = isSeller ? offer.buyerName : offer.sellerEmail;

        return `
            <div class="offer-card">
                <div style="display:flex; justify-style:space-between; align-items:center; margin-bottom:8px;">
                    <span class="badge" style="background:#0071e3; color:white;">${roleText}</span>
                    <span style="font-size:12px; font-weight:bold; color:#ff9500;">${offer.status}</span>
                </div>
                <h4>${escapeHtml(offer.targetItemTitle)}</h4>
                <p style="font-size:13px; color:#555; margin-top:4px;">
                    ${offer.offeredItemTitle ? `<strong>Offered Item:</strong> ${escapeHtml(offer.offeredItemTitle)}<br>` : ''}
                    ${offer.cashTopupRands > 0 ? `<strong>Cash Top-Up:</strong> R ${offer.cashTopupRands}<br>` : ''}
                    <strong>With:</strong> ${escapeHtml(otherParty)}
                </p>
                ${offer.message ? `<blockquote style="font-size:12px; font-style:italic; background:#f5f5f7; padding:6px 10px; border-radius:6px; margin: 8px 0;">"${escapeHtml(offer.message)}"</blockquote>` : ''}
                
                ${offer.meetup ? `
                    <div style="background:#e8f5e9; padding:8px 12px; border-radius:8px; font-size:12px; margin:8px 0; color:#2e7d32;">
                        <strong>📍 Meetup Details:</strong> ${escapeHtml(offer.meetup.location)} @${new Date(offer.meetup.datetime).toLocaleString()}
                    </div>
                ` : ''}

                <div class="card-actions" style="margin-top:10px; gap:6px;">
                    ${isSeller && offer.status === 'PENDING' ? `
                        <button type="button" onclick="acceptOffer('${offer.id}')" class="accept-btn" style="flex:1;">Accept</button>
                    ` : ''}
                    <button type="button" onclick="openChatModal('${offer.id}')" class="secondary-btn" style="flex:1;">💬 Chat</button>
                    ${offer.status === 'ACCEPTED' ? `
                        <button type="button" onclick="openMeetupModal('${offer.id}')" class="primary-btn" style="flex:1;">📍 Meetup</button>
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

    showToast("Offer accepted! You can now arrange a meetup.");
    renderOffersList();
}

/* ==========================================================================
   LIVE CHAT BETWEEN TRADERS
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
    document.getElementById('chat-modal').style.display = 'flex';
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

    chatMessages[activeChatOfferId].push(newMessage);
    saveLocalData();

    if (isFirebaseConnected && db) {
        db.ref(`chats/${activeChatOfferId}/${newMessage.id}`).set(newMessage);
    }

    input.value = '';
    renderChatMessages();
}

/* ==========================================================================
   MEETUP SCHEDULER
   ========================================================================== */

function openMeetupModal(offerId) {
    document.getElementById('meetup-offer-id').value = offerId;
    document.getElementById('meetup-modal').style.display = 'flex';
}

function handleMeetupSubmit() {
    const offerId = document.getElementById('meetup-offer-id').value;
    const location = document.getElementById('meetup-location').value.trim();
    const datetime = document.getElementById('meetup-datetime').value;
    const notes = document.getElementById('meetup-notes').value.trim();

    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    offer.meetup = {
        location: location,
        datetime: datetime,
        notes: notes,
        scheduledBy: currentUser.email
    };

    saveLocalData();

    if (isFirebaseConnected && db) {
        db.ref('offers/' + offerId + '/meetup').set(offer.meetup);
    }

    closeModal('meetup-modal');
    showToast("Meetup details saved!");
    renderOffersList();
}

/* ==========================================================================
   UTILITY & UI HELPERS
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function syncWithFirebase() {
    if (!isFirebaseConnected || !db) return;

    // Listen to Listings
    db.ref('items').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const firebaseItems = Object.keys(data).map(k => data[k]);
            const map = new Map();
            [...items, ...firebaseItems].forEach(item => map.set(item.id, item));
            items = Array.from(map.values());
            saveLocalData();
            applyFilters();
        }
    });

    // Listen to Offers
    db.ref('offers').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const firebaseOffers = Object.keys(data).map(k => data[k]);
            const map = new Map();
            [...offers, ...firebaseOffers].forEach(offer => map.set(offer.id, offer));
            offers = Array.from(map.values());
            saveLocalData();
            renderOffersList();
        }
    });
}

function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #1d1d1f;
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 13px;
            font-weight: 500;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
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
