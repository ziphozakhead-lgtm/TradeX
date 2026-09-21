// Initial Mock Listings with Location Addresses and Geolocation Coordinates
const defaultItems = [
    {
        id: "1",
        title: "Sony Noise Cancelling Headphones",
        category: "Electronics",
        price: 2500,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
        description: "Great condition, minor scratches. Battery lasts 30h.",
        wanted: "Mechanical Keyboard",
        sellerName: "Sarah M.",
        sellerEmail: "sarah@example.com",
        location: "Central, Port Elizabeth",
        lat: -33.9608,
        lng: 25.6022,
        status: "OPEN",
        timestamp: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: "2",
        title: "DSLR Camera Kit",
        category: "Electronics",
        price: 5000,
        image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500",
        description: "Includes 18-55mm lens. Shutter count under 2000.",
        wanted: "iPad / Tablet",
        sellerName: "Zipho D.",
        sellerEmail: "zipho@example.com",
        location: "Walmer, Port Elizabeth",
        lat: -33.9800,
        lng: 25.5800,
        status: "OPEN",
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    }
];

// Application State
let accounts = JSON.parse(localStorage.getItem('tradex_accounts')) || [
    {
        fullName: "Zipho Dastile",
        email: "zipho@example.com",
        phone: "+27 82 000 0000",
        address: "2 Mingo Street, Port Elizabeth",
        password: "123",
        rating: 4.9,
        tradesCompleted: 12
    }
];

let currentUser = JSON.parse(localStorage.getItem('tradex_current_user')) || null;
let items = JSON.parse(localStorage.getItem('tradex_items')) || defaultItems;
let offers = JSON.parse(localStorage.getItem('tradex_offers')) || [];
let userLocation = null; // Store user GPS coordinates { lat, lng }
let selectedPinCoords = { lat: -33.9608, lng: 25.6022 };

function saveData() {
    localStorage.setItem('tradex_accounts', JSON.stringify(accounts));
    if (currentUser) {
        localStorage.setItem('tradex_current_user', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('tradex_current_user');
    }
    localStorage.setItem('tradex_items', JSON.stringify(items));
    localStorage.setItem('tradex_offers', JSON.stringify(offers));
    updateOfferCount();
}

// Haversine formula to compute distance between two GPS coordinates in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Location Request
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
            
            // Enable Distance Sort Option
            const distOpt = document.getElementById('distance-sort-option');
            if (distOpt) distOpt.disabled = false;

            showSuccessToast("Location updated! Showing distance to listings.");
            applyFilters();
        },
        (error) => {
            locStatus.innerText = "Enable GPS";
            showErrorToast("Unable to retrieve location. Please check browser permissions.");
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

    const account = accounts.find(a => a.email.toLowerCase() === email && a.password === password);
    if (!account) return showErrorToast("Invalid credentials!");

    currentUser = account;
    saveData();
    document.getElementById('auth-modal').style.display = 'none';
    showSuccessToast(`Welcome back, ${currentUser.fullName}!`);
    initUserSession();
}

function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    if (accounts.some(a => a.email.toLowerCase() === email)) {
        return showErrorToast("Account with this email already exists!");
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
    currentUser = newAccount;
    saveData();
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

// Tab Switching
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

// Filtering & Radius Calculation
function applyFilters() {
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const categoryVal = document.getElementById('filter-category').value;
    const statusVal = document.getElementById('filter-status').value;
    const radiusVal = document.getElementById('filter-radius').value;
    const sortVal = document.getElementById('sort-price').value;

    let filtered = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchVal) || 
                              item.sellerName.toLowerCase().includes(searchVal) ||
                              (item.location && item.location.toLowerCase().includes(searchVal));
        const matchesCategory = categoryVal === 'ALL' || item.category === categoryVal;
        const matchesStatus = statusVal === 'ALL' || item.status === statusVal;

        // Proximity Filtering
        let matchesRadius = true;
        if (radiusVal !== 'ALL' && userLocation && item.lat && item.lng) {
            const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            matchesRadius = dist <= parseFloat(radiusVal);
        }

        return matchesSearch && matchesCategory && matchesStatus && matchesRadius;
    });

    // Sorting logic
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

// Render Item Grid
function renderItems(itemsToRender = items) {
    const grid = document.getElementById('item-grid');
    grid.innerHTML = '';

    if (itemsToRender.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem; color:#64748b;">No listings found matching your criteria.</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const isMyItem = currentUser && item.sellerEmail === currentUser.email;

        // Calculate distance if GPS is available
        let distanceText = '';
        if (userLocation && item.lat && item.lng) {
            const km = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
            distanceText = ` (${km < 1 ? '<1' : km.toFixed(1)} km away)`;
        }

        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onclick="openDetailModal('${item.id}')">
            <div class="card-body">
                <span class="badge">${item.category}</span>
                <div class="price-tag">Est. Value: R${item.price}</div>
                <h3 class="card-title">${item.title}</h3>
                
                <!-- Automatic Location Badge -->
                <div class="location-tag">
                    📍 ${item.location || 'Port Elizabeth'}${distanceText}
                </div>

                <p style="font-size:0.8rem; color:#64748b;">Seller: ${item.sellerName}</p>
                <div class="card-actions">
                    <button class="secondary-btn" onclick="openDetailModal('${item.id}')">Details</button>
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

    document.getElementById('detail-modal-body').innerHTML = `
        <h2>${item.title}</h2>
        <img src="${item.image}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin:1rem 0;">
        <p><strong>Category:</strong> ${item.category}</p>
        <p><strong>Value:</strong> R${item.price}</p>
        <p><strong>Location:</strong> 📍 ${item.location || 'Not Specified'}</p>
        ${distanceText}
        <p><strong>Seller:</strong> ${item.sellerName}</p>
        <p style="margin-top:0.5rem; color:#475569;">${item.description}</p>
    `;
    document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// Create Listing
document.getElementById('post-item-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!currentUser) return checkAuthStatus();

    const locationVal = document.getElementById('item-location').value.trim();

    const newItem = {
        id: Date.now().toString(),
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: document.getElementById('item-title').value,
        category: document.getElementById('item-category').value,
        price: parseFloat(document.getElementById('item-price').value),
        location: locationVal,
        lat: userLocation ? userLocation.lat : -33.9608,
        lng: userLocation ? userLocation.lng : 25.6022,
        image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500",
        description: document.getElementById('item-desc').value,
        wanted: document.getElementById('item-wanted').value,
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    items.unshift(newItem);
    saveData();
    this.reset();
    showSuccessToast("Listing published!");
    switchTab('explore-tab', document.querySelectorAll('.bottom-nav-btn')[0]);
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

document.getElementById('trade-offer-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const targetId = document.getElementById('target-item-id').value;
    const targetItem = items.find(i => i.id === targetId);

    const newOffer = {
        id: Date.now().toString(),
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
        offeredImage: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500",
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

    offers.unshift(newOffer);
    saveData();
    closeTradeModal();
    showSuccessToast("Trade proposal submitted!");
    renderOffers();
});

// Render Offers List
function renderOffers() {
    const list = document.getElementById('offers-list');
    if (!list) return;
    list.innerHTML = '';

    if (!currentUser) {
        list.innerHTML = '<p style="text-align:center; padding:2rem; color:#64748b;">Please log in to view trades.</p>';
        return;
    }

    const myOffers = offers.filter(o => o.offeredByEmail === currentUser.email || o.sellerEmail === currentUser.email);

    if (myOffers.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:2rem; color:#64748b;">No active trade proposals.</p>';
        return;
    }

    myOffers.forEach(offer => {
        const card = document.createElement('div');
        card.className = 'offer-card';

        const isReceivingParty = offer.sellerEmail === currentUser.email;
        const isAccepted = offer.status === 'Accepted';
        const isCompleted = offer.status === 'Completed' || offer.status === 'Cancelled';

        let meetingCardContent = '';

        if (!isAccepted && !isCompleted) {
            meetingCardContent = `
                <div class="pre-acceptance-locked-box">
                    <span>🔒</span>
                    <div>
                        <strong>Meeting Details Read-Only Prior to Acceptance</strong>
                        <div>Parameters will be specified during acceptance.</div>
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
                        <strong style="font-size:0.88rem; color:#0f172a;">📍 Meeting Details Card</strong>
                        ${statusBadge}
                    </div>
                    
                    <div class="meeting-info-row">
                        <strong>Location:</strong> ${offer.meetingLocation}
                    </div>
                    <div class="meeting-info-row">
                        <strong>Date & Time:</strong> ${offer.meetingDate} at ${offer.meetingTime}
                    </div>
                    ${offer.additionalInstructions ? `<div class="meeting-info-row"><strong>Instructions:</strong> ${offer.additionalInstructions}</div>` : ''}

                    <div class="map-container" style="height:100px; margin-top:0.5rem; cursor:default;">
                        <div class="map-grid-overlay"></div>
                        <div class="map-pin" style="top: 45%; left: 50%;">📍</div>
                        <div class="map-coordinates-bar">Confirmed Swap Coordinates</div>
                    </div>

                    <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
                        <button class="secondary-btn" style="font-size:0.75rem;" onclick="openDirections('${offer.meetingLocation}')">🗺️ Directions</button>
                        ${!isCompleted ? `<button class="secondary-btn" style="font-size:0.75rem;" onclick="openProposeLocationModal('${offer.id}')">Propose New Location</button>` : ''}
                    </div>
                </div>
            `;
        }

        let actionButtonsHtml = '';
        if (offer.status === 'Pending') {
            if (isReceivingParty) {
                actionButtonsHtml = `
                    <button class="accept-btn" style="width:100%;" onclick="openAcceptanceModal('${offer.id}')">Accept Trade</button>
                `;
            } else {
                actionButtonsHtml = `<div style="font-size:0.8rem; color:#b45309;">Awaiting receiving party response...</div>`;
            }
        } else if (offer.status === 'Accepted') {
            actionButtonsHtml = `
                <button class="primary-btn" style="background:#16a34a;" onclick="openOtpModal('${offer.id}')">Execute Handover PIN Verification</button>
            `;
        } else {
            actionButtonsHtml = `
                <div style="font-size:0.8rem; color:#64748b; font-weight:600;">Trade ${offer.status} (Parameters Read-Only)</div>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Trade: ${offer.sellerName} & ${offer.offeredByName}</h3>
                <span class="badge">${offer.status}</span>
            </div>

            <div class="offer-grid-preview">
                <div class="offer-preview-box">
                    <strong>${offer.targetTitle}</strong>
                    <img src="${offer.targetImage}">
                    <span>Value: R${offer.targetPrice}</span>
                </div>
                <div class="offer-preview-box">
                    <strong>${offer.offeredItem}</strong>
                    <img src="${offer.offeredImage}">
                    <span>Value: R${offer.offeredPrice}</span>
                </div>
            </div>

            ${meetingCardContent}

            <div style="margin-top:0.75rem;">
                ${actionButtonsHtml}
            </div>
        `;

        list.appendChild(card);
    });
}

// Acceptance Modal Handling
function openAcceptanceModal(offerId) {
    document.getElementById('accepting-offer-id').value = offerId;
    document.getElementById('acceptance-form').reset();
    document.getElementById('confirm-accept-btn').disabled = true;
    
    selectedPinCoords = { lat: -33.9608, lng: 25.6022 };
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
        lat: -33.9000 - (yPct / 1000),
        lng: 25.5000 + (xPct / 1000)
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
    document.getElementById('accept-location-input').value = "Walmer Park Shopping Centre Safe Zone";
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
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    const loc = document.getElementById('accept-location-input').value.trim();
    const date = document.getElementById('accept-date').value;
    const time = document.getElementById('accept-time').value;

    if (!loc || !date || !time || !selectedPinCoords) {
        return showErrorToast("Data Validation Error: Location, date, and time coordinates cannot be empty!");
    }

    offer.status = "Accepted";
    offer.meetingLocation = loc;
    offer.meetingDate = date;
    offer.meetingTime = time;
    offer.additionalInstructions = document.getElementById('accept-instructions').value.trim();
    offer.meetingCoordinates = selectedPinCoords;
    
    offer.meetingConfirmedBySeller = true; 
    offer.meetingConfirmedByBuyer = false; 

    saveData();
    closeAcceptanceModal();
    showSuccessToast("Trade Accepted & Meeting Parameters Linked!");
    renderOffers();
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
    const offer = offers.find(o => o.id === offerId);

    if (offer) {
        offer.meetingLocation = document.getElementById('adjust-location').value.trim();
        offer.meetingDate = document.getElementById('adjust-date').value;
        offer.meetingTime = document.getElementById('adjust-time').value;
        offer.additionalInstructions = document.getElementById('adjust-notes').value.trim();

        offer.meetingConfirmedByBuyer = true;
        offer.meetingConfirmedBySeller = false;

        saveData();
        closeProposeLocationModal();
        showSuccessToast("Proposed new location updated!");
        renderOffers();
    }
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

    offer.status = "Completed";
    
    const item = items.find(i => i.id === offer.targetItemId);
    if (item) item.status = "CLOSED";

    saveData();
    closeOtpModal();
    showSuccessToast("Handover Verified! Trade is Completed.");
    renderOffers();
    applyFilters();
}

function loadProfileForm() {
    if (!currentUser) return;
    document.getElementById('profile-full-name').value = currentUser.fullName || '';
    document.getElementById('profile-email').value = currentUser.email || '';
}

function updateOfferCount() {
    if (!currentUser) return;
    const count = offers.filter(o => o.offeredByEmail === currentUser.email || o.sellerEmail === currentUser.email).length;
    document.getElementById('offer-count').innerText = count;
}

// Initial session check
checkAuthStatus();
