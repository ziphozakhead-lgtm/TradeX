// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDemoKeyForTradeXApp1234567890",
    authDomain: "tradex-app-demo.firebaseapp.com",
    databaseURL: "https://tradex-app-demo-default-rtdb.firebaseio.com",
    projectId: "tradex-app-demo",
    storageBucket: "tradex-app-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Firebase References
const itemsRef = db.ref('items');
const offersRef = db.ref('offers');
const chatsRef = db.ref('chats');
const accountsRef = db.ref('accounts');

// Application Global State
let currentUser = JSON.parse(localStorage.getItem('tradex_current_user')) || null;
let items = [];
let offers = [];
let chats = {};
let activeChatId = null;

let userLocation = null;
let selectedPinCoords = { lat: 40.7128, lng: -74.0060 };

// Real-time synchronization listeners across all clients
itemsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        items = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
        items = [];
    }
    applyFilters();
});

offersRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        offers = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
        offers = [];
    }
    renderOffers();
    updateOfferCount();
});

chatsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    chats = data || {};
    if (activeChatId) {
        renderChatMessages();
    }
});

// Utility to convert image uploads to Data URLs
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// Haversine formula to calculate distance between GPS points
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function requestUserLocation() {
    if (!navigator.geolocation) {
        return showErrorToast("Geolocation is not supported by your browser.");
    }

    const locStatus = document.getElementById('location-status');
    locStatus.innerText = "Locating...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            document.getElementById('location-btn').classList.add('active');
            locStatus.innerText = "GPS Active";
            
            const distOpt = document.getElementById('distance-sort-option');
            if (distOpt) distOpt.disabled = false;

            showSuccessToast("Location updated! Showing distance to listings.");
            applyFilters();
        },
        (error) => {
            locStatus.innerText = "Enable GPS";
            showErrorToast("Unable to retrieve location.");
        }
    );
}

// Authentication Functions
function switchAuthMode(mode) {
    document.getElementById('login-form').style.display = (mode === 'login') ? 'block' : 'none';
    document.getElementById('signup-form').style.display = (mode === 'signup') ? 'block' : 'none';
    document.getElementById('tab-login-btn').classList.toggle('active', mode === 'login');
    document.getElementById('tab-signup-btn').classList.toggle('active', mode === 'signup');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    accountsRef.once('value', (snapshot) => {
        const accounts = snapshot.val() || {};
        const foundKey = Object.keys(accounts).find(k => accounts[k].email.toLowerCase() === email && accounts[k].password === password);

        if (!foundKey) {
            showErrorToast("Invalid email or password!");
            return;
        }

        currentUser = accounts[foundKey];
        localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
        document.getElementById('auth-modal').style.display = 'none';
        showSuccessToast(`Welcome back, ${currentUser.fullName}!`);
        initUserSession();
    });
}

function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();

    accountsRef.once('value', (snapshot) => {
        const accounts = snapshot.val() || {};
        const exists = Object.keys(accounts).some(k => accounts[k].email.toLowerCase() === email);

        if (exists) {
            return showErrorToast("An account with this email address already exists!");
        }

        const newAccount = {
            fullName: document.getElementById('signup-name').value.trim(),
            email: email,
            phone: document.getElementById('signup-phone').value.trim(),
            address: document.getElementById('signup-address').value.trim(),
            password: document.getElementById('signup-password').value,
            rating: 5.0,
            tradesCompleted: 0
        };

        const newAccRef = accountsRef.push();
        newAccRef.set(newAccount);

        currentUser = newAccount;
        localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
        document.getElementById('auth-modal').style.display = 'none';
        showSuccessToast("Account created successfully!");
        initUserSession();
    });
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem('tradex_current_user');
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('user-chip').style.display = 'none';
    showSuccessToast("Logged out successfully.");
}

function checkAuthStatus() {
    if (!currentUser) {
        document.getElementById('auth-modal').style.display = 'flex';
    } else {
        document.getElementById('auth-modal').style.display = 'none';
        initUserSession();
    }
}

function initUserSession() {
    if (!currentUser) return;
    document.getElementById('user-chip').style.display = 'block';
    document.getElementById('user-chip-name').innerText = currentUser.fullName.split(' ')[0];
    document.getElementById('seller-name').value = currentUser.fullName;
    document.getElementById('offered-by-name').value = currentUser.fullName;

    loadProfileForm();
    renderOffers();
    applyFilters();
}

// Toasts
function showSuccessToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `<span>✅ ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showErrorToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `<span>⚠️ ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function generateHandoverPin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Navigation Tabs
function switchTab(tabId, btnElement) {
    if (!currentUser) return checkAuthStatus();

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    if (tabId === 'explore-tab') renderItems();
    if (tabId === 'offers-tab') renderOffers();
    if (tabId === 'profile-tab') loadProfileForm();
}

// Timeline Filter & Sorting
function applyFilters() {
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const categoryVal = document.getElementById('filter-category').value;
    const statusVal = document.getElementById('filter-status').value;
    const radiusVal = document.getElementById('filter-radius').value;
    const sortVal = document.getElementById('sort-price').value;

    let filtered = items.filter(item => {
        const matchesSearch = (item.title && item.title.toLowerCase().includes(searchVal)) || 
                              (item.sellerName && item.sellerName.toLowerCase().includes(searchVal)) ||
                              (item.location && item.location.toLowerCase().includes(searchVal));
        const matchesCategory = categoryVal === 'ALL' || item.category === categoryVal;
        const matchesStatus = statusVal === 'ALL' || item.status === statusVal;

        let matchesRadius = true;
        if (radiusVal !== 'ALL' && userLocation && item.lat && item.lng) {
            const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            matchesRadius = dist <= parseFloat(radiusVal);
        }

        return matchesSearch && matchesCategory && matchesStatus && matchesRadius;
    });

    if (sortVal === 'DISTANCE' && userLocation) {
        filtered.sort((a, b) => {
            const distA = (a.lat && a.lng) ? calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) : Infinity;
            const distB = (b.lat && b.lng) ? calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng) : Infinity;
            return distA - distB;
        });
    } else if (sortVal === 'LOW_HIGH') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'HIGH_LOW') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortVal === 'NEWEST') {
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    renderItems(filtered);
}

// Render Timeline Item Grid
function renderItems(itemsToRender = items) {
    const grid = document.getElementById('item-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (itemsToRender.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 3rem 1rem; color:#8e8e93; font-size:0.9rem;">No listings found matching your criteria.</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const isMyItem = currentUser && item.sellerEmail === currentUser.email;

        let distanceText = '';
        if (userLocation && item.lat && item.lng) {
            const km = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            distanceText = ` (${km < 1 ? '<1' : km.toFixed(1)} km away)`;
        }

        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onclick="openDetailModal('${item.id}')">
            <div class="card-body">
                <span class="badge">${item.category}</span>
                <div class="price-tag">Est. Value: R${parseFloat(item.price).toLocaleString()}</div>
                <h3 class="card-title">${item.title}</h3>
                
                <div class="location-tag">
                    📍 ${item.location || 'Metro Area'}${distanceText}
                </div>

                <p style="font-size:0.8rem; color:#8e8e93;">Seller: ${item.sellerName}</p>
                <div class="card-actions">
                    <button class="secondary-btn" onclick="openDetailModal('${item.id}')">Details</button>
                    ${!isMyItem ? `<button class="secondary-btn" style="padding:0.65rem 0.5rem;" onclick="openDirectItemChat('${item.id}')">💬 Chat</button>` : ''}
                    ${!isMyItem && item.status === 'OPEN' ? `<button class="primary-btn" onclick="openTradeModal('${item.id}')">Offer Trade</button>` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openDetailModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    let distanceText = '';
    if (userLocation && item.lat && item.lng) {
        const km = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
        distanceText = `<p><strong>Distance:</strong> ${km.toFixed(2)} km away</p>`;
    }

    const isMyItem = currentUser && item.sellerEmail === currentUser.email;

    document.getElementById('detail-modal-body').innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; color:#1d1d1f; letter-spacing:-0.02em;">${item.title}</h2>
        <img src="${item.image}" style="width:100%; height:220px; object-fit:cover; border-radius:16px; margin:1rem 0;">
        <p><strong>Category:</strong> ${item.category}</p>
        <p><strong>Value:</strong> R${parseFloat(item.price).toLocaleString()}</p>
        <p><strong>Location:</strong> 📍 ${item.location || 'Not Specified'}</p>
        ${distanceText}
        <p><strong>Seller:</strong> ${item.sellerName}</p>
        <p style="margin-top:0.75rem; color:#6e6e73; font-size:0.9rem; line-height:1.4;">${item.description}</p>
        
        ${!isMyItem ? `
            <div style="margin-top:1.25rem; display:flex; gap:0.5rem;">
                <button class="secondary-btn" onclick="closeDetailModal(); openDirectItemChat('${item.id}');">💬 Message Seller</button>
                <button class="primary-btn" onclick="closeDetailModal(); openTradeModal('${item.id}');">Propose Trade</button>
            </div>
        ` : ''}
    `;
    document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// --- CREATE REAL-TIME LISTING (EVERYONE'S TIMELINE) ---
document.getElementById('post-item-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentUser) return checkAuthStatus();

    const locationVal = document.getElementById('item-location').value.trim();
    const imageInput = document.getElementById('item-image');
    let imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500";

    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            imageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Image processing error:", err);
        }
    }

    const newItemRef = itemsRef.push();
    const newItem = {
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: document.getElementById('item-title').value.trim(),
        category: document.getElementById('item-category').value,
        price: parseFloat(document.getElementById('item-price').value),
        location: locationVal,
        lat: userLocation ? userLocation.lat : 40.7128,
        lng: userLocation ? userLocation.lng : -74.0060,
        image: imageUrl,
        description: document.getElementById('item-desc').value.trim(),
        wanted: document.getElementById('item-wanted').value.trim(),
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    // Save to Firebase (Realtime sync pushes this to everyone's timeline)
    newItemRef.set(newItem, (err) => {
        if (err) {
            showErrorToast("Failed to upload item. Try again.");
        } else {
            this.reset();
            showSuccessToast("Listing published! It is now visible on everyone's timeline.");
            switchTab('explore-tab', document.querySelectorAll('.bottom-nav-btn')[0]);
        }
    });
});

// Proposal Modal
function openTradeModal(itemId) {
    if (!currentUser) return checkAuthStatus();
    const targetItem = items.find(i => i.id === itemId);
    document.getElementById('target-item-id').value = itemId;
    document.getElementById('modal-item-title').innerText = `Offer Trade for: ${targetItem.title}`;
    document.getElementById('trade-modal').style.display = 'flex';
}

function closeTradeModal() {
    document.getElementById('trade-modal').style.display = 'none';
    document.getElementById('trade-offer-form').reset();
}

document.getElementById('trade-offer-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const targetId = document.getElementById('target-item-id').value;
    const targetItem = items.find(i => i.id === targetId);

    const imageInput = document.getElementById('offered-image');
    let offeredImageUrl = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500";

    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            offeredImageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Trade offer image error:", err);
        }
    }

    const newOfferRef = offersRef.push();
    const newOffer = {
        targetItemId: targetId,
        targetTitle: targetItem.title,
        targetPrice: targetItem.price,
        targetImage: targetItem.image,
        sellerName: targetItem.sellerName,
        sellerEmail: targetItem.sellerEmail,
        offeredByName: currentUser.fullName,
        offeredByEmail: currentUser.email,
        offeredItem: document.getElementById('offered-item').value,
        offeredPrice: parseFloat(document.getElementById('offered-price').value),
        offeredImage: offeredImageUrl,
        offeredDesc: document.getElementById('offer-desc').value,
        cashTopUp: parseFloat(document.getElementById('offered-cash').value) || 0,
        meetingLocation: "",
        meetingDate: "",
        meetingTime: "",
        additionalInstructions: "",
        meetingCoordinates: null,
        meetingConfirmedBySeller: false,
        meetingConfirmedByBuyer: false,
        sellerPin: generateHandoverPin(),
        buyerPin: generateHandoverPin(),
        status: "Pending",
        date: new Date().toLocaleDateString()
    };

    newOfferRef.set(newOffer, (err) => {
        if (!err) {
            closeTradeModal();
            showSuccessToast("Trade proposal submitted!");
        }
    });
});

// Render Offers List
function renderOffers() {
    const list = document.getElementById('offers-list');
    if (!list) return;
    list.innerHTML = '';

    if (!currentUser) {
        list.innerHTML = '<p style="text-align:center; padding:3rem 1rem; color:#8e8e93;">Please log in to view trades.</p>';
        return;
    }

    const myOffers = offers.filter(o => o.offeredByEmail === currentUser.email || o.sellerEmail === currentUser.email);

    if (myOffers.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:3rem 1rem; color:#8e8e93;">No active trade proposals.</p>';
        return;
    }

    myOffers.forEach(offer => {
        const card = document.createElement('div');
        card.className = 'offer-card';

        const isReceivingParty = offer.sellerEmail === currentUser.email;
        const isAccepted = offer.status === 'Accepted';
        const isCompleted = offer.status === 'Completed' || offer.status === 'Cancelled';
        const partnerName = isReceivingParty ? offer.offeredByName : offer.sellerName;

        let meetingCardContent = '';

        if (!isAccepted && !isCompleted) {
            meetingCardContent = `
                <div class="pre-acceptance-locked-box">
                    <span>🔒</span>
                    <div>
                        <strong style="color:#1d1d1f;">Meeting Details Locked</strong>
                        <div>Parameters will be specified upon acceptance.</div>
                    </div>
                </div>
            `;
        } else {
            const isConfirmed = offer.meetingConfirmedBySeller && offer.meetingConfirmedByBuyer;
            const statusBadge = isConfirmed 
                ? `<span class="status-badge-confirmed">Confirmed</span>` 
                : `<span class="status-badge-pending-confirm">Pending Confirmation</span>`;

            meetingCardContent = `
                <div class="meeting-details-card">
                    <div class="meeting-card-header">
                        <strong style="font-size:0.88rem; color:#1d1d1f;">📍 Meeting Details Card</strong>
                        ${statusBadge}
                    </div>
                    
                    <div class="meeting-info-row">
                        <strong>Location:</strong> ${offer.meetingLocation}
                    </div>
                    <div class="meeting-info-row">
                        <strong>Date & Time:</strong> ${offer.meetingDate} at ${offer.meetingTime}
                    </div>
                    ${offer.additionalInstructions ? `<div class="meeting-info-row"><strong>Instructions:</strong> ${offer.additionalInstructions}</div>` : ''}

                    <div class="map-container" style="height:100px; margin-top:0.6rem; cursor:default;">
                        <div class="map-grid-overlay"></div>
                        <div class="map-pin" style="top: 45%; left: 50%;">📍</div>
                        <div class="map-coordinates-bar">Confirmed Swap Coordinates</div>
                    </div>

                    <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
                        <button class="secondary-btn" style="font-size:0.78rem;" onclick="openDirections('${offer.meetingLocation}')">🗺️ Directions</button>
                        ${!isCompleted ? `<button class="secondary-btn" style="font-size:0.78rem;" onclick="openProposeLocationModal('${offer.id}')">Propose New Location</button>` : ''}
                    </div>
                </div>
            `;
        }

        let actionButtonsHtml = '';
        if (offer.status === 'Pending') {
            if (isReceivingParty) {
                actionButtonsHtml = `
                    <div style="display:flex; gap:0.5rem; width:100%;">
                        <button class="accept-btn" style="flex:2;" onclick="openAcceptanceModal('${offer.id}')">Accept Trade</button>
                        <button class="secondary-btn" style="flex:1;" onclick="openTradeOfferChat('${offer.id}')">💬 Chat</button>
                    </div>
                `;
            } else {
                actionButtonsHtml = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:0.82rem; color:#b26200; font-weight:500;">Awaiting receiving party response...</div>
                        <button class="secondary-btn" style="padding:0.4rem 0.85rem; font-size:0.8rem;" onclick="openTradeOfferChat('${offer.id}')">💬 Chat Trader</button>
                    </div>
                `;
            }
        } else if (offer.status === 'Accepted') {
            actionButtonsHtml = `
                <div style="display:flex; gap:0.5rem; flex-direction:column;">
                    <button class="primary-btn" style="background:#34c759;" onclick="openOtpModal('${offer.id}')">Execute Handover PIN Verification</button>
                    <button class="secondary-btn" onclick="openTradeOfferChat('${offer.id}')">💬 Open Chat with ${partnerName}</button>
                </div>
            `;
        } else {
            actionButtonsHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.82rem; color:#8e8e93; font-weight:600;">Trade ${offer.status}</div>
                    <button class="secondary-btn" style="padding:0.4rem 0.85rem; font-size:0.8rem;" onclick="openTradeOfferChat('${offer.id}')">💬 Chat History</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:1.05rem; font-weight:600; color:#1d1d1f;">Trade: ${offer.sellerName} & ${offer.offeredByName}</h3>
                <span class="badge">${offer.status}</span>
            </div>

            <div class="offer-grid-preview">
                <div class="offer-preview-box">
                    <strong style="font-size:0.85rem; color:#1d1d1f;">${offer.targetTitle}</strong>
                    <img src="${offer.targetImage}">
                    <span style="font-size:0.8rem; color:#6e6e73;">Value: R${parseFloat(offer.targetPrice).toLocaleString()}</span>
                </div>
                <div class="offer-preview-box">
                    <strong style="font-size:0.85rem; color:#1d1d1f;">${offer.offeredItem}</strong>
                    <img src="${offer.offeredImage}">
                    <span style="font-size:0.8rem; color:#6e6e73;">Value: R${parseFloat(offer.offeredPrice).toLocaleString()}</span>
                </div>
            </div>

            ${meetingCardContent}

            <div style="margin-top:0.85rem;">
                ${actionButtonsHtml}
            </div>
        `;

        list.appendChild(card);
    });
}

// Live Chat Functions
function openDirectItemChat(itemId) {
    if (!currentUser) return checkAuthStatus();
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const safeEmailKey = currentUser.email.replace(/[.#$\[\]]/g, "_");
    const chatId = `item_${item.id}_${safeEmailKey}`;
    activeChatId = chatId;

    document.getElementById('chat-recipient-name').innerText = `Chat with ${item.sellerName}`;
    document.getElementById('chat-item-context').innerText = `Item: ${item.title}`;

    if (!chats[chatId]) {
        chatsRef.child(chatId).push({
            senderEmail: "system",
            senderName: "System",
            text: `Discussion started for item "${item.title}". Ask questions or negotiate barter options.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }

    renderChatMessages();
    document.getElementById('chat-modal').style.display = 'flex';
}

function openTradeOfferChat(offerId) {
    if (!currentUser) return checkAuthStatus();
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    const isSeller = currentUser.email === offer.sellerEmail;
    const recipientName = isSeller ? offer.offeredByName : offer.sellerName;

    const chatId = `trade_${offer.id}`;
    activeChatId = chatId;

    document.getElementById('chat-recipient-name').innerText = `Trade Chat w/ ${recipientName}`;
    document.getElementById('chat-item-context').innerText = `Trade: ${offer.targetTitle} ↔ ${offer.offeredItem}`;

    if (!chats[chatId]) {
        chatsRef.child(chatId).push({
            senderEmail: "system",
            senderName: "System",
            text: `Trade proposal channel created for ${offer.targetTitle}. Use this chat to discuss meetup locations!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }

    renderChatMessages();
    document.getElementById('chat-modal').style.display = 'flex';
}

function closeChatModal() {
    document.getElementById('chat-modal').style.display = 'none';
    activeChatId = null;
}

function renderChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !activeChatId) return;

    const currentChatObj = chats[activeChatId] || {};
    const messageList = Object.keys(currentChatObj).map(k => currentChatObj[k]);

    container.innerHTML = '';

    messageList.forEach(msg => {
        const msgDiv = document.createElement('div');
        if (msg.senderEmail === 'system') {
            msgDiv.className = 'chat-bubble chat-system';
            msgDiv.innerHTML = `<span>${msg.text}</span>`;
        } else {
            const isMe = msg.senderEmail === currentUser.email;
            msgDiv.className = `chat-bubble ${isMe ? 'chat-me' : 'chat-them'}`;
            msgDiv.innerHTML = `
                <div class="chat-sender-name">${isMe ? 'You' : msg.senderName}</div>
                <div>${msg.text}</div>
                <div class="chat-time">${msg.timestamp}</div>
            `;
        }
        container.appendChild(msgDiv);
    });

    container.scrollTop = container.scrollHeight;
}

function handleSendChatMessage(e) {
    e.preventDefault();
    if (!currentUser || !activeChatId) return;

    const input = document.getElementById('chat-input-text');
    const text = input.value.trim();
    if (!text) return;

    chatsRef.child(activeChatId).push({
        senderEmail: currentUser.email,
        senderName: currentUser.fullName,
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    input.value = '';
}

// Meeting Acceptance Handlers
function openAcceptanceModal(offerId) {
    document.getElementById('accepting-offer-id').value = offerId;
    document.getElementById('acceptance-form').reset();
    document.getElementById('confirm-accept-btn').disabled = true;
    
    selectedPinCoords = { lat: 40.7128, lng: -74.0060 };
    updateMapPinUI();

    document.getElementById('acceptance-modal').style.display = 'flex';
}

function closeAcceptanceModal() {
    document.getElementById('acceptance-modal').style.display = 'none';
}

function handleMapPinDrop(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    const pin = document.getElementById('map-pin');
    pin.style.left = `${xPct}%`;
    pin.style.top = `${yPct}%`;

    selectedPinCoords = {
        lat: 40.7000 + (yPct / 1000),
        lng: -74.0000 + (xPct / 1000)
    };

    document.getElementById('map-coords-text').innerText = `Lat: ${selectedPinCoords.lat.toFixed(4)}, Lng: ${selectedPinCoords.lng.toFixed(4)} (Pin Selected)`;
    
    if (!document.getElementById('accept-location-input').value) {
        document.getElementById('accept-location-input').value = `Pinned Spot (${selectedPinCoords.lat.toFixed(3)}, ${selectedPinCoords.lng.toFixed(3)})`;
    }
    validateAcceptanceForm();
}

function updateMapPinUI() {
    document.getElementById('map-coords-text').innerText = `Lat: ${selectedPinCoords.lat.toFixed(4)}, Lng: ${selectedPinCoords.lng.toFixed(4)} (Click map to adjust pin)`;
}

function usePresetSafeZone() {
    document.getElementById('accept-location-input').value = "Metro City Central Safe Exchange Zone";
    validateAcceptanceForm();
}

function validateAcceptanceForm() {
    const loc = document.getElementById('accept-location-input').value.trim();
    const date = document.getElementById('accept-date').value;
    const time = document.getElementById('accept-time').value;

    const isValid = loc !== "" && date !== "" && time !== "" && selectedPinCoords !== null;
    document.getElementById('confirm-accept-btn').disabled = !isValid;
    return isValid;
}

function submitAcceptanceWithMeeting(e) {
    e.preventDefault();

    const offerId = document.getElementById('accepting-offer-id').value;
    const loc = document.getElementById('accept-location-input').value.trim();
    const date = document.getElementById('accept-date').value;
    const time = document.getElementById('accept-time').value;

    if (!loc || !date || !time || !selectedPinCoords) {
        return showErrorToast("Data Validation Error: Location, date, and time cannot be empty!");
    }

    offersRef.child(offerId).update({
        status: "Accepted",
        meetingLocation: loc,
        meetingDate: date,
        meetingTime: time,
        additionalInstructions: document.getElementById('accept-instructions').value.trim(),
        meetingCoordinates: selectedPinCoords,
        meetingConfirmedBySeller: true,
        meetingConfirmedByBuyer: false
    }, (err) => {
        if (!err) {
            closeAcceptanceModal();
            showSuccessToast("Trade Accepted & Meeting Parameters Linked!");
        }
    });
}

function openProposeLocationModal(offerId) {
    document.getElementById('adjust-offer-id').value = offerId;
    const offer = offers.find(o => o.id === offerId);
    if (offer) {
        document.getElementById('adjust-location').value = offer.meetingLocation || '';
        document.getElementById('adjust-date').value = offer.meetingDate || '';
        document.getElementById('adjust-time').value = offer.meetingTime || '';
    }
    document.getElementById('propose-location-modal').style.display = 'flex';
}

function closeProposeLocationModal() {
    document.getElementById('propose-location-modal').style.display = 'none';
}

function submitLocationAdjustment(e) {
    e.preventDefault();
    const offerId = document.getElementById('adjust-offer-id').value;

    offersRef.child(offerId).update({
        meetingLocation: document.getElementById('adjust-location').value.trim(),
        meetingDate: document.getElementById('adjust-date').value,
        meetingTime: document.getElementById('adjust-time').value,
        additionalInstructions: document.getElementById('adjust-notes').value.trim(),
        meetingConfirmedByBuyer: true,
        meetingConfirmedBySeller: false
    }, (err) => {
        if (!err) {
            closeProposeLocationModal();
            showSuccessToast("Proposed new location updated!");
        }
    });
}

function openDirections(locationStr) {
    const query = encodeURIComponent(locationStr);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
}

function openOtpModal(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer || !currentUser) return;

    document.getElementById('otp-offer-id').value = offerId;
    const isSeller = currentUser.email === offer.sellerEmail;
    document.getElementById('my-otp-display').innerText = isSeller ? offer.sellerPin : offer.buyerPin;
    document.getElementById('otp-modal').style.display = 'flex';
}

function closeOtpModal() {
    document.getElementById('otp-modal').style.display = 'none';
}

function submitHandoverPin(e) {
    e.preventDefault();
    const offerId = document.getElementById('otp-offer-id').value;
    const offer = offers.find(o => o.id === offerId);
    const enteredPin = document.getElementById('received-pin-input').value.trim();

    const isSeller = currentUser.email === offer.sellerEmail;
    const expectedPin = isSeller ? offer.buyerPin : offer.sellerPin;

    if (enteredPin !== expectedPin) {
        return showErrorToast("Invalid PIN entered!");
    }

    offersRef.child(offerId).update({ status: "Completed" });
    if (offer.targetItemId) {
        itemsRef.child(offer.targetItemId).update({ status: "CLOSED" });
    }

    closeOtpModal();
    showSuccessToast("Handover Verified! Trade is Completed.");
}

function loadProfileForm() {
    if (!currentUser) return;
    document.getElementById('profile-full-name').value = currentUser.fullName || '';
    document.getElementById('profile-email').value = currentUser.email || '';
}

function updateOfferCount() {
    if (!currentUser) return;
    const count = offers.filter(o => o.offeredByEmail === currentUser.email || o.sellerEmail === currentUser.email).length;
    const badge = document.getElementById('offer-count');
    if (badge) badge.innerText = count;
}

// Initial session check
checkAuthStatus();
