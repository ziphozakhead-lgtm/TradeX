// Default initial listings with pre-populated locations
const defaultItems = [
    {
        id: "1",
        title: "Sony Noise Cancelling Headphones",
        category: "Electronics",
        price: 2500,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
        description: "Great condition, minor scratches on headband. Battery lasts 30h.",
        wanted: "Mechanical Keyboard or Gaming Mouse",
        sellerName: "Sarah M.",
        address: "Govan Mbeki Avenue, Port Elizabeth",
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
        description: "Includes 18-55mm lens and carrying bag. Barely used, shutter count under 2000.",
        wanted: "iPad / Tablet or Smartwatch",
        sellerName: "Zipho D.",
        address: "2 Mingo Street, Port Elizabeth",
        lat: -33.9180,
        lng: 25.5800,
        status: "OPEN",
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    }
];

// Application State
let items = JSON.parse(localStorage.getItem('tradex_items')) || defaultItems;
let offers = JSON.parse(localStorage.getItem('tradex_offers')) || [];
let profile = JSON.parse(localStorage.getItem('tradex_profile')) || {
    fullName: "Zipho Dastile",
    email: "zipho@example.com",
    phone: "+27 82 000 0000",
    address: "2 Mingo Street, Port Elizabeth, Eastern Cape",
    rating: 4.9,
    tradesCompleted: 12
};
let userLocation = null;

function saveData() {
    localStorage.setItem('tradex_items', JSON.stringify(items));
    localStorage.setItem('tradex_offers', JSON.stringify(offers));
    localStorage.setItem('tradex_profile', JSON.stringify(profile));
    updateOfferCount();
}

// Toast Success / Error Notifications
function showSuccessToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showErrorToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Helper: Generate Secure 4-Digit Handover PIN
function generateHandoverPin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Haversine distance calculation
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

// Reverse Geocoding
async function reverseGeocodeAddress(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
            return data.display_name.split(',').slice(0, 3).join(',');
        }
    } catch (e) {
        console.warn("Reverse geocode fallback");
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Location Request
function requestUserLocation() {
    if ("geolocation" in navigator) {
        document.getElementById('location-status').innerText = "Locating...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                const btn = document.getElementById('location-btn');
                btn.classList.add('active');
                document.getElementById('location-status').innerText = "GPS Location Active";
                
                const distanceOpt = document.getElementById('distance-sort-option');
                distanceOpt.disabled = false;
                distanceOpt.selected = true;

                applyFilters();
            },
            () => {
                document.getElementById('location-status').innerText = "Location Denied";
            }
        );
    }
}

// Toggle Location Choice
function toggleLocationInputChoice(value) {
    const addressGroup = document.getElementById('manual-address-group');
    const addressInput = document.getElementById('item-address');

    if (value === 'GPS') {
        addressGroup.style.display = 'none';
        addressInput.required = false;
        detectGPSAndFillAddress();
    } else {
        addressGroup.style.display = 'block';
        addressInput.required = true;
    }
}

async function detectGPSAndFillAddress() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            const address = await reverseGeocodeAddress(userLocation.lat, userLocation.lng);
            document.getElementById('item-address').value = address;
        });
    }
}

function readFileAsBase64(fileInput) {
    return new Promise((resolve) => {
        const file = fileInput.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

// Tab Navigation
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    if (btnElement) {
        btnElement.classList.add('active');
    }

    if (tabId === 'explore-tab') renderItems();
    if (tabId === 'offers-tab') renderOffers();
    if (tabId === 'profile-tab') loadProfileForm();
}

// Filtering & Sorting
function applyFilters() {
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const statusVal = document.getElementById('filter-status').value;
    const categoryVal = document.getElementById('filter-category').value;
    const dateVal = document.getElementById('filter-date').value;
    const sortVal = document.getElementById('sort-price').value;

    const now = new Date();

    let filtered = items.map(item => {
        let dist = null;
        if (userLocation && item.lat && item.lng) {
            dist = calculateDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
        }
        return { ...item, distanceKm: dist };
    }).filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchVal) ||
                              item.description.toLowerCase().includes(searchVal) ||
                              item.sellerName.toLowerCase().includes(searchVal) ||
                              (item.address && item.address.toLowerCase().includes(searchVal));

        const matchesStatus = statusVal === 'ALL' || item.status === statusVal;
        const matchesCategory = categoryVal === 'ALL' || item.category === categoryVal;

        const itemDate = new Date(item.timestamp);
        let matchesDate = true;
        if (dateVal === 'TODAY') {
            matchesDate = itemDate.toDateString() === now.toDateString();
        } else if (dateVal === 'WEEK') {
            matchesDate = itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (dateVal === 'MONTH') {
            matchesDate = itemDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        return matchesSearch && matchesStatus && matchesCategory && matchesDate;
    });

    if (sortVal === 'DISTANCE' && userLocation) {
        filtered.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    } else if (sortVal === 'LOW_HIGH') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'HIGH_LOW') {
        filtered.sort((a, b) => b.price - a.price);
    } else {
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    renderItems(filtered);
}

// Render Item Grid
function renderItems(itemsToRender = items) {
    const grid = document.getElementById('item-grid');
    grid.innerHTML = '';

    if (itemsToRender.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem; color:#64748b;">No active trade listings found.</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        const distanceBadgeHtml = item.distanceKm !== null && item.distanceKm !== undefined
            ? `<span class="distance-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>${item.distanceKm} km away</span>`
            : '';

        const statusBadgeHtml = item.status === 'CLOSED'
            ? `<span class="status-closed">TRADE COMPLETED</span>`
            : `<span class="badge" style="background:#dcfce7; color:#15803d;">OPEN</span>`;

        const actionButtons = item.status === 'CLOSED'
            ? `<button class="secondary-btn" onclick="openDetailModal('${item.id}')" style="width:100%;">View Details</button>`
            : `<button class="secondary-btn" onclick="openDetailModal('${item.id}')">Details</button>
               <button class="primary-btn" onclick="openTradeModal('${item.id}', event)">Offer Trade</button>`;

        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onclick="openDetailModal('${item.id}')" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">
            <div class="card-body">
                <div class="card-header-info">
                    <span class="badge">${item.category}</span>
                    ${statusBadgeHtml}
                    ${distanceBadgeHtml}
                </div>
                <div class="price-tag">Est. Value: R${item.price}</div>
                <h3 class="card-title" onclick="openDetailModal('${item.id}')">${item.title}</h3>
                
                <div class="seller-info">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Seller: <strong>${item.sellerName}</strong>
                </div>
                <div class="address-info">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/></svg>
                    ${item.address || 'GPS Coordinates Active'}
                </div>

                <p class="card-desc">${item.description}</p>
                <div class="trade-for"><strong>Wants:</strong> ${item.wanted}</div>

                <div class="card-actions">
                    ${actionButtons}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openDetailModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const modalBody = document.getElementById('detail-modal-body');
    modalBody.innerHTML = `
        <h2>${item.title}</h2>
        <img src="${item.image}" alt="${item.title}" style="width:100%; max-height:280px; object-fit:cover; border-radius:8px; margin:1rem 0;">
        <p><strong>Category:</strong> ${item.category}</p>
        <p><strong>Estimated Value:</strong> R${item.price}</p>
        <p><strong>Location:</strong> ${item.address || 'GPS Coordinates Active'}</p>
        <p><strong>Seller:</strong> ${item.sellerName}</p>
        <h3 style="margin-top:1rem;">Description</h3>
        <p style="margin-top:0.4rem; color:#475569;">${item.description}</p>
    `;
    document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// Publish Item Form Submission
document.getElementById('post-item-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const fileInput = document.getElementById('item-image');
    const imageBase64 = await readFileAsBase64(fileInput);

    if (!imageBase64) return showErrorToast("Please upload an image!");

    const locationChoice = document.querySelector('input[name="location-choice"]:checked').value;
    const addressInput = document.getElementById('item-address').value;

    const newItem = {
        id: Date.now().toString(),
        sellerName: document.getElementById('seller-name').value,
        title: document.getElementById('item-title').value,
        category: document.getElementById('item-category').value,
        price: parseFloat(document.getElementById('item-price').value),
        address: (locationChoice === 'GPS') ? (addressInput || "GPS Location Active") : addressInput,
        image: imageBase64,
        description: document.getElementById('item-desc').value,
        wanted: document.getElementById('item-wanted').value,
        lat: userLocation ? userLocation.lat : -33.9180,
        lng: userLocation ? userLocation.lng : 25.5800,
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    items.unshift(newItem);
    saveData();
    this.reset();
    
    toggleLocationInputChoice('GPS');
    showSuccessToast("Trade listing posted successfully!");
    
    const exploreBtn = document.querySelectorAll('.bottom-nav-btn')[0];
    switchTab('explore-tab', exploreBtn);
});

// Trade Proposal Modal
function openTradeModal(itemId, event) {
    if (event) event.stopPropagation();
    const targetItem = items.find(i => i.id === itemId);
    document.getElementById('target-item-id').value = itemId;
    document.getElementById('modal-item-title').innerText = `Offer Trade for: ${targetItem.title}`;
    document.getElementById('trade-modal').style.display = 'flex';
}

function closeTradeModal() {
    document.getElementById('trade-modal').style.display = 'none';
    document.getElementById('trade-offer-form').reset();
}

// Handle Trade Proposal Submission
document.getElementById('trade-offer-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const targetId = document.getElementById('target-item-id').value;
    const targetItem = items.find(i => i.id === targetId);
    const offerFileInput = document.getElementById('offered-image');
    const offerImageBase64 = await readFileAsBase64(offerFileInput);

    const cashVal = parseFloat(document.getElementById('offered-cash').value) || 0;

    const newOffer = {
        id: Date.now().toString(),
        targetItemId: targetId,
        targetTitle: targetItem.title,
        targetPrice: targetItem.price,
        targetImage: targetItem.image,
        sellerName: targetItem.sellerName,
        offeredByName: document.getElementById('offered-by-name').value,
        offeredItem: document.getElementById('offered-item').value,
        offeredPrice: parseFloat(document.getElementById('offered-price').value),
        offeredImage: offerImageBase64 || "https://via.placeholder.com/300x180?text=No+Photo",
        offeredDesc: document.getElementById('offer-desc').value,
        cashTopUp: cashVal,
        escrowStatus: cashVal > 0 ? "PENDING_DEPOSIT" : "NOT_REQUIRED",
        sellerPin: generateHandoverPin(),
        buyerPin: generateHandoverPin(),
        sellerPinVerified: false,
        buyerPinVerified: false,
        note: document.getElementById('offer-note').value,
        status: "PENDING",
        date: new Date().toLocaleDateString(),
        hasUnreadNegotiation: false,
        negotiations: []
    };

    offers.unshift(newOffer);
    saveData();

    closeTradeModal();
    showSuccessToast("Trade proposal sent!");
});

// Render Offers Screen
function renderOffers() {
    const list = document.getElementById('offers-list');
    list.innerHTML = '';

    if (offers.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:2rem; color:#64748b;">No active trade proposals found.</p>';
        return;
    }

    offers.forEach(offer => {
        const card = document.createElement('div');
        card.className = 'offer-card';
        card.onclick = (e) => openOfferDetailModal(offer.id, e);

        const unreadNegotiationBanner = offer.hasUnreadNegotiation ? `
            <div class="negotiation-alert-banner">
                <span class="negotiation-badge-new">NEW</span>
                <span>New negotiation message received!</span>
            </div>
        ` : '';

        let escrowBadgeHtml = '';
        if (offer.cashTopUp > 0) {
            if (offer.escrowStatus === "HELD_IN_ESCROW") {
                escrowBadgeHtml = `<span class="status-escrow">R${offer.cashTopUp} HELD IN ESCROW VAULT</span>`;
            } else if (offer.escrowStatus === "RELEASED") {
                escrowBadgeHtml = `<span class="status-accepted">ESCROW RELEASED</span>`;
            } else {
                escrowBadgeHtml = `<span class="status-pending">ESCROW DEPOSIT REQUIRED (R${offer.cashTopUp})</span>`;
            }
        }

        // Action Buttons Setup based on Escrow & Handover PIN State
        let actionButtonsHtml = '';
        if (offer.status === 'PENDING') {
            actionButtonsHtml = `
                <button class="secondary-btn" onclick="openOfferDetailModal('${offer.id}', event)">View Details</button>
                <button class="secondary-btn" onclick="openCounterModal('${offer.id}')">Negotiate</button>
                <button class="accept-btn" onclick="acceptTradeOffer('${offer.id}')">Accept Offer</button>
            `;
        } else if (offer.status === 'ACCEPTED / ESCROW REQUIRED') {
            actionButtonsHtml = `
                <button class="secondary-btn" onclick="openOfferDetailModal('${offer.id}', event)">View Details</button>
                <button class="escrow-btn" onclick="openEscrowModal('${offer.id}')">Deposit R${offer.cashTopUp} in Escrow</button>
            `;
        } else if (offer.status === 'READY FOR HANDOVER') {
            actionButtonsHtml = `
                <button class="primary-btn" style="background:#16a34a; width:100%;" onclick="openOtpModal('${offer.id}')">Execute In-Person Handover PINs</button>
            `;
        } else {
            actionButtonsHtml = `
                <button class="secondary-btn" style="width:100%;" onclick="openOfferDetailModal('${offer.id}', event)">View Completed Trade Receipt</button>
            `;
        }

        card.innerHTML = `
            ${unreadNegotiationBanner}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.4rem;">
                <h3>Trade: ${offer.sellerName} & ${offer.offeredByName}</h3>
                <div style="display:flex; gap:0.3rem; align-items:center;">
                    ${escrowBadgeHtml}
                    <span class="${offer.status.includes('ACCEPTED') || offer.status.includes('READY') || offer.status.includes('COMPLETED') ? 'status-accepted' : 'status-pending'}">${offer.status}</span>
                </div>
            </div>

            <div class="offer-grid-preview">
                <div class="offer-preview-box">
                    <span class="badge">Requested Item</span>
                    <img src="${offer.targetImage}" alt="${offer.targetTitle}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                    <strong>${offer.targetTitle}</strong>
                    <span style="font-size:0.82rem; color:#16a34a; font-weight:700;">Value: R${offer.targetPrice}</span>
                </div>

                <div class="offer-preview-box">
                    <span class="badge" style="background:#dbeafe; color:#1e40af;">Offered Item</span>
                    <img src="${offer.offeredImage}" alt="${offer.offeredItem}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                    <strong>${offer.offeredItem}</strong>
                    <span style="font-size:0.82rem; color:#16a34a; font-weight:700;">Value: R${offer.offeredPrice}</span>
                </div>
            </div>

            <div style="display:flex; gap:0.5rem; margin-top:0.75rem;" onclick="event.stopPropagation()">
                ${actionButtonsHtml}
            </div>
        `;
        list.appendChild(card);
    });
}

// Accept Trade Offer
function acceptTradeOffer(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    if (offer.cashTopUp > 0 && offer.escrowStatus === "PENDING_DEPOSIT") {
        offer.status = "ACCEPTED / ESCROW REQUIRED";
        showSuccessToast("Offer accepted! Cash top-up must now be deposited in escrow.");
    } else {
        offer.status = "READY FOR HANDOVER";
        showSuccessToast("Trade offer accepted! Ready for in-person OTP exchange.");
    }

    offer.hasUnreadNegotiation = false;
    saveData();
    renderOffers();
    applyFilters();
}

// Escrow Deposit Logic
function openEscrowModal(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    document.getElementById('escrow-offer-id').value = offerId;
    document.getElementById('escrow-amount-display').innerText = `R${offer.cashTopUp.toFixed(2)}`;
    document.getElementById('escrow-total-display').innerText = `R${offer.cashTopUp.toFixed(2)}`;
    document.getElementById('escrow-modal').style.display = 'flex';
}

function closeEscrowModal() {
    document.getElementById('escrow-modal').style.display = 'none';
}

function executeEscrowDeposit(e) {
    e.preventDefault();
    const offerId = document.getElementById('escrow-offer-id').value;
    const offer = offers.find(o => o.id === offerId);

    if (!offer) return;

    offer.escrowStatus = "HELD_IN_ESCROW";
    offer.status = "READY FOR HANDOVER";
    saveData();

    closeEscrowModal();
    showSuccessToast(`R${offer.cashTopUp} successfully deposited into Escrow Vault!`);
    renderOffers();
}

// Handover OTP Verification Logic
function openOtpModal(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    document.getElementById('otp-offer-id').value = offerId;

    // Distinguish PIN display between Buyer and Seller display mode
    const isSeller = profile.fullName.toLowerCase().includes(offer.sellerName.toLowerCase());
    const myPin = isSeller ? offer.sellerPin : offer.buyerPin;

    document.getElementById('my-otp-display').innerText = myPin;
    document.getElementById('otp-modal').style.display = 'flex';
}

function closeOtpModal() {
    document.getElementById('otp-modal').style.display = 'none';
    document.getElementById('otp-verification-form').reset();
}

function submitHandoverPin(e) {
    e.preventDefault();
    const offerId = document.getElementById('otp-offer-id').value;
    const offer = offers.find(o => o.id === offerId);
    const enteredPin = document.getElementById('received-pin-input').value.trim();

    if (!offer) return;

    const isSeller = profile.fullName.toLowerCase().includes(offer.sellerName.toLowerCase());
    const expectedOtherPin = isSeller ? offer.buyerPin : offer.sellerPin;

    if (enteredPin !== expectedOtherPin) {
        showErrorToast("Invalid Handover PIN entered! Please re-check with trader.");
        return;
    }

    if (isSeller) {
        offer.buyerPinVerified = true;
    } else {
        offer.sellerPinVerified = true;
    }

    // Fully complete trade when PIN is validated
    offer.status = "TRADE COMPLETED";
    if (offer.cashTopUp > 0) offer.escrowStatus = "RELEASED";

    const targetItem = items.find(i => i.id === offer.targetItemId);
    if (targetItem) targetItem.status = "CLOSED";

    profile.tradesCompleted = (profile.tradesCompleted || 0) + 1;

    saveData();
    closeOtpModal();
    showSuccessToast("PIN Verified! Trade successfully completed and funds released.");
    renderOffers();
    applyFilters();
}

// Open Full Offer Preview Modal
function openOfferDetailModal(offerId, event) {
    if (event) event.stopPropagation();
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    if (offer.hasUnreadNegotiation) {
        offer.hasUnreadNegotiation = false;
        saveData();
    }

    const modalBody = document.getElementById('offer-detail-modal-body');

    modalBody.innerHTML = `
        <h2>Trade Proposal Details</h2>
        <p style="color:#64748b; font-size:0.88rem; margin-bottom:1rem;">Proposed on ${offer.date}</p>
        
        <div class="offer-grid-preview">
            <div class="offer-preview-box">
                <span class="badge">Target Item</span>
                <img src="${offer.targetImage}" alt="${offer.targetTitle}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                <strong>${offer.targetTitle}</strong>
                <span style="font-size:0.85rem; color:#16a34a; font-weight:700;">R${offer.targetPrice}</span>
            </div>

            <div class="offer-preview-box">
                <span class="badge" style="background:#dbeafe; color:#1e40af;">Offered Item</span>
                <img src="${offer.offeredImage}" alt="${offer.offeredItem}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                <strong>${offer.offeredItem}</strong>
                <span style="font-size:0.85rem; color:#16a34a; font-weight:700;">R${offer.offeredPrice}</span>
            </div>
        </div>

        ${offer.cashTopUp > 0 ? `<div style="background:#dcfce7; padding:0.6rem; border-radius:6px; font-weight:700; color:#15803d; margin-bottom:1rem;">Cash Top-Up: R${offer.cashTopUp} (${offer.escrowStatus})</div>` : ''}

        <h4>Handover Verification Status</h4>
        <p style="font-size:0.85rem; color:#475569; margin:0.3rem 0 1rem 0;">Status: <strong>${offer.status}</strong></p>

        <h4>Offered Item Description</h4>
        <p style="font-size:0.9rem; color:#334155; margin:0.4rem 0 1rem 0;">${offer.offeredDesc}</p>
    `;

    document.getElementById('offer-detail-modal').style.display = 'flex';
}

function closeOfferDetailModal() {
    document.getElementById('offer-detail-modal').style.display = 'none';
    renderOffers();
}

// Counter-Offer / Negotiation
function openCounterModal(offerId) {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    document.getElementById('counter-offer-id').value = offerId;
    let lastSender = offer.offeredByName;
    if (offer.negotiations && offer.negotiations.length > 0) {
        lastSender = offer.negotiations[offer.negotiations.length - 1].sender;
    }
    const autoSender = (lastSender === offer.offeredByName) ? offer.sellerName : offer.offeredByName;

    document.getElementById('auto-trader-badge').innerText = autoSender;
    document.getElementById('counter-modal').style.display = 'flex';
}

function closeCounterModal() {
    document.getElementById('counter-modal').style.display = 'none';
    document.getElementById('counter-offer-form').reset();
}

document.getElementById('counter-offer-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const offerId = document.getElementById('counter-offer-id').value;
    const offer = offers.find(o => o.id === offerId);

    let lastSender = offer.offeredByName;
    if (offer.negotiations && offer.negotiations.length > 0) {
        lastSender = offer.negotiations[offer.negotiations.length - 1].sender;
    }
    const autoSender = (lastSender === offer.offeredByName) ? offer.sellerName : offer.offeredByName;

    if (!offer.negotiations) offer.negotiations = [];

    const cashAdj = parseFloat(document.getElementById('counter-cash').value);
    if (!isNaN(cashAdj)) {
        offer.cashTopUp = cashAdj;
    }

    offer.negotiations.push({
        sender: autoSender,
        message: document.getElementById('counter-message').value,
        cashProposed: cashAdj || offer.cashTopUp,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    offer.hasUnreadNegotiation = true;

    saveData();
    closeCounterModal();
    showSuccessToast("Negotiation response sent!");
    renderOffers();
});

// Profile Management
function loadProfileForm() {
    document.getElementById('profile-full-name').value = profile.fullName || '';
    document.getElementById('profile-email').value = profile.email || '';
    document.getElementById('profile-phone').value = profile.phone || '';
    document.getElementById('profile-default-address').value = profile.address || '';
    document.getElementById('seller-name').value = profile.fullName || '';
    
    document.getElementById('trust-rating-val').innerText = `${profile.rating || 4.9} / 5.0 Trust Score`;
    document.getElementById('trust-details-val').innerText = `Verified Phone & ID • ${profile.tradesCompleted || 0} Successful Swaps`;
}

document.getElementById('profile-form').addEventListener('submit', function(e) {
    e.preventDefault();
    profile.fullName = document.getElementById('profile-full-name').value;
    profile.email = document.getElementById('profile-email').value;
    profile.phone = document.getElementById('profile-phone').value;
    profile.address = document.getElementById('profile-default-address').value;

    saveData();
    showSuccessToast("Profile settings saved!");
});

function resetLocalAccountData() {
    if (confirm("Clear local storage items and trade offers?")) {
        localStorage.clear();
        items = defaultItems;
        offers = [];
        saveData();
        showSuccessToast("Local trade cache cleared!");
        location.reload();
    }
}

function updateOfferCount() {
    document.getElementById('offer-count').innerText = offers.length;
}

// Auto Refresh Polling
setInterval(() => {
    const storedItems = JSON.parse(localStorage.getItem('tradex_items'));
    if (storedItems && storedItems.length !== items.length) {
        items = storedItems;
        applyFilters();
    }
}, 5000);

// Initialize
loadProfileForm();
toggleLocationInputChoice('GPS');
applyFilters();
updateOfferCount();
