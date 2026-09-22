/* ==========================================================================
   APP STATE & INITIALIZATION
   ========================================================================== */

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let items = JSON.parse(localStorage.getItem('items')) || [
    {
        id: 'item_1',
        sellerName: 'Sarah Jenkins',
        sellerEmail: 'sarah@example.com',
        title: 'Vintage Leather Jacket (Size M)',
        category: 'clothing',
        price: 45,
        location: 'Downtown Market',
        lat: 40.7128,
        lng: -74.0060,
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500',
        description: 'Genuine leather jacket in good condition. Minor wear on elbows.',
        wanted: 'Looking for a denim jacket or boots size 8.',
        status: 'OPEN',
        timestamp: new Date().toISOString()
    },
    {
        id: 'item_2',
        sellerName: 'David Chen',
        sellerEmail: 'david@example.com',
        title: 'Mechanical Keyboard (RGB)',
        category: 'electronics',
        price: 70,
        location: 'Westside',
        lat: 40.7306,
        lng: -73.9352,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
        description: 'Custom mechanical keyboard with blue switches. Barely used.',
        wanted: 'Interested in wireless mouse or monitor arm.',
        status: 'OPEN',
        timestamp: new Date().toISOString()
    }
];

let userLocation = null;
let isFirebaseConnected = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
let db = isFirebaseConnected ? firebase.database() : null;

/* ==========================================================================
   APP INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    syncWithFirebase();
});

function initApp() {
    updateUserUI();
    applyFilters();
    getUserLocation();
}

function saveLocalData() {
    localStorage.setItem('items', JSON.stringify(items));
    if (currentUser) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('currentUser');
    }
}

/* ==========================================================================
   FIREBASE REALTIME SYNC (WITH LOCAL FALLBACK)
   ========================================================================== */

function syncWithFirebase() {
    if (!isFirebaseConnected || !db) return;

    db.ref('items').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const firebaseItems = Object.keys(data).map(key => data[key]);
            
            // Merge Firebase items with local items (deduplicating by id)
            const itemMap = new Map();
            [...items, ...firebaseItems].forEach(item => itemMap.set(item.id, item));
            
            items = Array.from(itemMap.values());
            items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            saveLocalData();
            applyFilters();
        }
    }, (error) => {
        console.warn("Firebase sync disabled or restricted. Running in local mode.", error);
    });
}

/* ==========================================================================
   GEOLOCATION
   ========================================================================== */

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            },
            (error) => {
                console.warn("Geolocation permission denied or unavailable.", error);
            }
        );
    }
}

/* ==========================================================================
   NAVIGATION & UI CONTROLS
   ========================================================================== */

function setupEventListeners() {
    // Navigation Tabs
    const navButtons = document.querySelectorAll('.bottom-nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab) {
                switchTab(targetTab, btn);
            }
        });
    });

    // Post Item Form Submission
    const postForm = document.getElementById('post-item-form');
    if (postForm) {
        postForm.addEventListener('submit', handleCreateListing);
    }

    // Search and Filter Controls
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
}

function switchTab(tabId, targetBtn) {
    // Hide all view tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');

    // Update bottom navigation bar active state
    if (targetBtn) {
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
    }

    // Re-render items grid when switching to explore tab
    if (tabId === 'explore-tab') {
        applyFilters();
    }
}

function updateUserUI() {
    const authStatusElement = document.getElementById('auth-status');
    if (authStatusElement) {
        if (currentUser) {
            authStatusElement.innerHTML = `<span>Welcome, <strong>${escapeHtml(currentUser.fullName)}</strong></span>`;
        } else {
            authStatusElement.innerHTML = `<button type="button" onclick="handleLoginClick(event)" class="btn-login">Login / Sign Up</button>`;
        }
    }
}

function handleLoginClick(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    checkAuthStatus();
}

function checkAuthStatus() {
    if (!currentUser) {
        const name = prompt("Enter your name to sign in / trade:");
        if (!name) return false;

        const email = prompt("Enter your email address:");
        if (!email) return false;
            
        currentUser = {
            fullName: name.trim(),
            email: email.trim().toLowerCase()
        };

        saveLocalData();
        updateUserUI();
        showSuccessToast(`Logged in as ${currentUser.fullName}`);
        return true;
    }
    return true;
}

/* ==========================================================================
   CORE LISTING CREATION (FIXED & ROBUST)
   ========================================================================== */

async function handleCreateListing(e) {
    e.preventDefault();

    // Ensure user is authenticated locally before creating an item
    if (!currentUser) {
        const loggedIn = checkAuthStatus();
        if (!loggedIn) return;
    }

    const imageInput = document.getElementById('item-image');
    let imageUrl = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500"; // Fallback placeholder

    // Convert uploaded image file to DataURL base64 for local persistence
    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            imageUrl = await readFileAsDataURL(imageInput.files[0]);
        } catch (err) {
            console.error("Image conversion error, using fallback placeholder:", err);
        }
    }

    // Construct the new item object
    const newItem = {
        id: 'item_' + Date.now(),
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: document.getElementById('item-title').value.trim(),
        category: document.getElementById('item-category').value,
        price: parseFloat(document.getElementById('item-price').value) || 0,
        location: document.getElementById('item-location').value.trim(),
        lat: userLocation ? userLocation.lat : 40.7128,
        lng: userLocation ? userLocation.lng : -74.0060,
        image: imageUrl,
        description: document.getElementById('item-desc').value.trim(),
        wanted: document.getElementById('item-wanted').value.trim(),
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    // 1. ALWAYS ADD LOCALLY FIRST
    items.unshift(newItem);
    saveLocalData();
    applyFilters();

    // 2. ATTEMPT FIREBASE SYNC IN BACKGROUND (Non-blocking)
    if (isFirebaseConnected && db) {
        db.ref('items/' + newItem.id).set(newItem).catch((err) => {
            console.warn("Firebase save warning: Item stored locally.", err);
        });
    }

    // Reset Form
    e.target.reset();

    // Show Notification and Switch View to Explore Tab
    showSuccessToast("Listing published! Now visible on Explore screen.");
    
    const exploreNavBtn = document.querySelectorAll('.bottom-nav-btn')[0];
    switchTab('explore-tab', exploreNavBtn);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

/* ==========================================================================
   FILTERING & DISPLAY RENDERING
   ========================================================================== */

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';

    const filteredItems = items.filter(item => {
        const matchesQuery = !query || 
            item.title.toLowerCase().includes(query) || 
            item.description.toLowerCase().includes(query) ||
            item.location.toLowerCase().includes(query);

        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

        return matchesQuery && matchesCategory;
    });

    renderItemsGrid(filteredItems);
}

function renderItemsGrid(itemsToRender) {
    const gridContainer = document.getElementById('items-grid');
    if (!gridContainer) return;

    if (itemsToRender.length === 0) {
        gridContainer.innerHTML = `
            <div class="empty-state">
                <p>No listings found. Be the first to post something!</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = itemsToRender.map(item => `
        <div class="item-card" id="card-${item.id}">
            <div class="card-image-wrapper">
                <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" />
                <span class="category-badge">${escapeHtml(item.category)}</span>
            </div>
            <div class="card-content">
                <div class="card-header">
                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    <span class="card-price">$${item.price}</span>
                </div>
                <p class="card-location">📍 ${escapeHtml(item.location)}</p>
                <p class="card-description">${escapeHtml(item.description)}</p>
                <div class="card-wanted">
                    <strong>Wants in return:</strong>
                    <p>${escapeHtml(item.wanted || 'Open to offers')}</p>
                </div>
                <div class="card-footer">
                    <small>Posted by ${escapeHtml(item.sellerName)}</small>
                    <button type="button" onclick="handleOffer('${item.id}')" class="btn-trade">Make Offer</button>
                </div>
            </div>
        </div>
    `).join('');
}

function handleOffer(itemId) {
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem) return;

    if (!currentUser) {
        const loggedIn = checkAuthStatus();
        if (!loggedIn) return;
    }

    alert(`Offer request sent to ${targetItem.sellerName} (${targetItem.sellerEmail}) for "${targetItem.title}"!`);
}

/* ==========================================================================
   UTILITY & TOAST NOTIFICATIONS
   ========================================================================== */

function showSuccessToast(message) {
    let toast = document.getElementById('toast-notification');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #2e7d32;
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
            font-weight: 600;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
