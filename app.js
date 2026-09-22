// --- FIREBASE INITIALIZATION & PUBLIC STORAGE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyDemoKeyForTradeXApp1234567890",
    authDomain: "tradex-app-demo.firebaseapp.com",
    databaseURL: "https://tradex-app-demo-default-rtdb.firebaseio.com",
    projectId: "tradex-app-demo",
    storageBucket: "tradex-app-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

let db = null;
let isFirebaseConnected = false;

// Application Global State
let currentUser = JSON.parse(localStorage.getItem('tradex_current_user')) || null;
let items = [];
let offers = [];
let chats = {};
let activeChatId = null;

let userLocation = null;
let selectedPinCoords = { lat: 40.7128, lng: -74.0060 };

// Initial Sync & Boot
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    bindFormEvents();
    checkAuthStatus();
    
    // Sync storage across browser windows/tabs automatically
    window.addEventListener('storage', (e) => {
        if (e.key === 'tradex_items') {
            loadLocalData();
        }
    });
});

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            isFirebaseConnected = true;
            setupFirebaseListeners();
        } else {
            console.warn("Firebase SDK unavailable; running in shared local storage mode.");
            loadLocalData();
        }
    } catch (e) {
        console.warn("Firebase connection error; falling back to local storage.", e);
        loadLocalData();
    }
}

function setupFirebaseListeners() {
    if (!db) return;

    db.ref('items').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            items = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        } else {
            items = getInitialDefaultItems();
        }
        localStorage.setItem('tradex_items', JSON.stringify(items));
        applyFilters();
    });

    db.ref('offers').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            offers = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        } else {
            offers = [];
        }
        localStorage.setItem('tradex_offers', JSON.stringify(offers));
        renderOffers();
        updateOfferCount();
    });

    db.ref('chats').on('value', (snapshot) => {
        chats = snapshot.val() || {};
        localStorage.setItem('tradex_chats', JSON.stringify(chats));
        if (activeChatId) {
            renderChatMessages();
        }
    });
}

function getInitialDefaultItems() {
    return [
        {
            id: 'item_1',
            sellerName: 'Alex Taylor',
            sellerEmail: 'alex@example.com',
            title: 'Wireless Noise-Cancelling Headphones',
            category: 'Electronics',
            price: 2500,
            location: 'Downtown, Cityville',
            lat: 40.7128,
            lng: -74.0060,
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
            description: 'Brand new, sealed in box with original invoice.',
            wanted: 'Mechanical Keyboard or Smartwatch',
            status: 'OPEN',
            timestamp: new Date().toISOString()
        }
    ];
}

function loadLocalData() {
    const storedItems = localStorage.getItem('tradex_items');
    items = storedItems ? JSON.parse(storedItems) : getInitialDefaultItems();
    
    if (!storedItems) {
        localStorage.setItem('tradex_items', JSON.stringify(items));
    }

    offers = JSON.parse(localStorage.getItem('tradex_offers')) || [];
    chats = JSON.parse(localStorage.getItem('tradex_chats')) || {};

    applyFilters();
    renderOffers();
    updateOfferCount();
}

function saveLocalData() {
    localStorage.setItem('tradex_items', JSON.stringify(items));
    localStorage.setItem('tradex_offers', JSON.stringify(offers));
    localStorage.setItem('tradex_chats', JSON.stringify(chats));
}

function bindFormEvents() {
    const postForm = document.getElementById('post-item-form');
    if (postForm && !postForm.getAttribute('data-bound')) {
        postForm.addEventListener('submit', handleCreateListing);
        postForm.setAttribute('data-bound', 'true');
    }

    const tradeForm = document.getElementById('trade-offer-form');
    if (tradeForm && !tradeForm.getAttribute('data-bound')) {
        tradeForm.addEventListener('submit', handleSendTradeProposal);
        tradeForm.setAttribute('data-bound', 'true');
    }
}

// Utility Helpers
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

            showSuccessToast("Location updated! Distance calculated for listings.");
            applyFilters();
        },
        () => {
            locStatus.innerText = "Enable GPS";
            showErrorToast("Unable to retrieve location.");
        }
    );
}

// Authentication System
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

    const accounts = JSON.parse(localStorage.getItem('tradex_accounts')) || [
        { email: "alex@example.com", password: "password", fullName: "Alex Taylor", phone: "+27 82 555 0199", address: "Downtown" }
    ];

    const user = accounts.find(a => a.email.toLowerCase() === email && a.password === password);

    if (!user) {
        showErrorToast("Invalid email or password!");
        return;
    }

    currentUser = user;
    localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
    document.getElementById('auth-modal').style.display = 'none';
    showSuccessToast(`Welcome back, ${currentUser.fullName}!`);
    initUserSession();
}

function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const accounts = JSON.parse(localStorage.getItem('tradex_accounts')) || [];

    if (accounts.some(a => a.email.toLowerCase() === email)) {
        return showErrorToast("An account with this email already exists!");
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

    accounts.push(newAccount);
    localStorage.setItem('tradex_accounts', JSON.stringify(accounts));

    currentUser = newAccount;
    localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
    document.getElementById('auth-modal').style.display = 'none';
    showSuccessToast("Account created successfully!");
    initUserSession();
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
    
    if (document.getElementById('seller-name')) {
        document.getElementById('seller-name').value = currentUser.fullName;
    }
    if (document.getElementById('offered-by-name')) {
        document.getElementById('offered-by-name').value = currentUser.fullName;
    }

    loadProfileForm();
    renderOffers();
    applyFilters();
}

// Toast Notifications
function showSuccessToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `<span>✅ ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showErrorToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
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

    if (tabId === 'explore-tab') applyFilters();
    if (tabId === 'offers-tab') renderOffers();
    if (tabId === 'profile-tab') loadProfileForm();
}

// Filtering & Search (Public View)
function applyFilters() {
    const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase();
    const categoryVal = document.getElementById('filter-category')?.value || 'ALL';
    const statusVal = document.getElementById('filter-status')?.value || 'ALL';
    const radiusVal = document.getElementById('filter-radius')?.value || 'ALL';
    const sortVal = document.getElementById('sort-price')?.value || 'NEWEST';

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

                <p style="font-size:0.8rem; color:#8e8e93;">Seller: ${item.sellerName} ${isMyItem ? '(You)' : ''}</p>
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

// Listing Creation Action
async function handleCreateListing(e) {
    e.preventDefault();
    if (!currentUser) return checkAuthStatus();

    const imageInput = document.getElementById('item-image');
    let imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500";

    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            imageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Image conversion error:", err);
        }
    }

    const newItem = {
        id: 'item_' + Date.now(),
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: document.getElementById('item-title').value.trim(),
        category: document.getElementById('item-category').value,
        price: parseFloat(document.getElementById('item-price').value),
        location: document.getElementById('item-location').value.trim(),
        lat: userLocation ? userLocation.lat : 40.7128,
        lng: userLocation ? userLocation.lng : -74.0060,
        image: imageUrl,
        description: document.getElementById('item-desc').value.trim(),
        wanted: document.getElementById('item-wanted').value.trim(),
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
        db.ref('items/' + newItem.id).set(newItem);
    } else {
        items.unshift(newItem);
        saveLocalData();
        applyFilters();
    }

    document.getElementById('post-item-form').reset();
    showSuccessToast("Listing published! Now visible to everyone.");
    switchTab('explore-tab', document.querySelectorAll('.bottom-nav-btn')[0]);
}

function openTradeModal(itemId) {
    if (!currentUser) return checkAuthStatus();
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem) return;

    document.getElementById('target-item-id').value = itemId;
    document.getElementById('modal-item-title').innerText = `Offer Trade for: ${targetItem.title}`;
    document.getElementById('trade-modal').style.display = 'flex';
}

function closeTradeModal() {
    document.getElementById('trade-modal').style.display = 'none';
    document.getElementById('trade-offer-form').reset();
}

async function handleSendTradeProposal(e) {
    e.preventDefault();
    const targetId = document.getElementById('target-item-id').value;
    const targetItem = items.find(i => i.id === targetId);

    const imageInput = document.getElementById('offered-image');
    let offeredImageUrl = "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500";

    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            offeredImageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Trade offer image conversion error:", err);
        }
    }

    const newOffer = {
        id: 'offer_' + Date.now(),
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

    if (isFirebaseConnected && db) {
        db.ref('offers/' + newOffer.id).set(newOffer);
    } else {
        offers.unshift(newOffer);
        saveLocalData();
        renderOffers();
        updateOfferCount();
    }

    closeTradeModal();
    showSuccessToast("Trade proposal submitted!");
}

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

// Live Chat Handlers
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
        chats[chatId] = [
            {
                senderEmail: "system",
                senderName: "System",
                text: `Discussion started for item "${item.title}".`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ];
        saveLocalData();
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
        chats[chatId] = [
            {
                senderEmail: "system",
                senderName: "System",
                text: `Trade proposal channel created.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ];
        saveLocalData();
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

    let rawList = chats[activeChatId] || [];
    let messageList = Array.isArray(rawList) ? rawList : Object.keys(rawList).map(k => rawList[k]);

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

    const msgObj = {
        senderEmail: currentUser.email,
        senderName: currentUser.fullName,
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isFirebaseConnected && db) {
        db.ref(`chats/${activeChatId}`).push(msgObj);
    } else {
        if (!Array.isArray(chats[activeChatId])) {
            chats[activeChatId] = [];
        }
        chats[activeChatId].push(msgObj);
        saveLocalData();
        renderChatMessages();
    }

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

    if (!loc || !date || !time) {
        return showErrorToast("Please complete required fields!");
    }

    const updates = {
        status: "Accepted",
        meetingLocation: loc,
        meetingDate: date,
        meetingTime: time,
        additionalInstructions: document.getElementById('accept-instructions').value.trim(),
        meetingCoordinates: selectedPinCoords,
        meetingConfirmedBySeller: true,
        meetingConfirmedByBuyer: false
    };

    if (isFirebaseConnected && db) {
        db.ref(`offers/${offerId}`).update(updates);
    } else {
        const offer = offers.find(o => o.id === offerId);
        if (offer) Object.assign(offer, updates);
        saveLocalData();
        renderOffers();
    }

    closeAcceptanceModal();
    showSuccessToast("Trade accepted and meeting details set!");
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

    const updates = {
        meetingLocation: document.getElementById('adjust-location').value.trim(),
        meetingDate: document.getElementById('adjust-date').value,
        meetingTime: document.getElementById('adjust-time').value,
        additionalInstructions: document.getElementById('adjust-notes').value.trim(),
        meetingConfirmedByBuyer: true,
        meetingConfirmedBySeller: false
    };

    if (isFirebaseConnected && db) {
        db.ref(`offers/${offerId}`).update(updates);
    } else {
        const offer = offers.find(o => o.id === offerId);
        if (offer) Object.assign(offer, updates);
        saveLocalData();
        renderOffers();
    }

    closeProposeLocationModal();
    showSuccessToast("Location proposal sent!");
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
    if (!offer) return;

    const enteredPin = document.getElementById('received-pin-input').value.trim();
    const isSeller = currentUser.email === offer.sellerEmail;
    const expectedPin = isSeller ? offer.buyerPin : offer.sellerPin;

    if (enteredPin !== expectedPin) {
        return showErrorToast("Invalid PIN entered!");
    }

    if (isFirebaseConnected && db) {
        db.ref(`offers/${offerId}`).update({ status: "Completed" });
        if (offer.targetItemId) {
            db.ref(`items/${offer.targetItemId}`).update({ status: "CLOSED" });
        }
    } else {
        offer.status = "Completed";
        const item = items.find(i => i.id === offer.targetItemId);
        if (item) item.status = "CLOSED";
        saveLocalData();
        renderOffers();
        applyFilters();
    }

    closeOtpModal();
    showSuccessToast("Handover verified! Trade is completed.");
}

function loadProfileForm() {
    if (!currentUser) return;
    document.getElementById('profile-full-name').value = currentUser.fullName || '';
    document.getElementById('profile-email').value = currentUser.email || '';
}

function handleSaveProfile(e) {
    e.preventDefault();
    if (!currentUser) return;

    currentUser.fullName = document.getElementById('profile-full-name').value.trim();
    localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
    
    document.getElementById('user-chip-name').innerText = currentUser.fullName.split(' ')[0];
    showSuccessToast("Profile saved!");
}

function updateOfferCount() {
    if (!currentUser) return;
    const count = offers.filter(o => o.offeredByEmail === currentUser.email || o.sellerEmail === currentUser.email).length;
    const badge = document.getElementById('offer-count');
    if (badge) badge.innerText = count;
}
