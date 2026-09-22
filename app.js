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
   INITIALIZATION & EVENT DELEGATION
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

function setupEventListeners() {
    // 1. Intercept ALL Form Submissions globally (Prevents accidental reloads/clearing)
    document.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop HTML default submit/reset behavior
        
        if (e.target.id === 'post-item-form') {
            handleCreateListing(e);
        } else {
            // Treat any other submitted form as a login attempt
            handleLogin(e);
        }
    });

    // 2. Global Click Delegation for Nav, Login/Logout, and Triggers
    document.addEventListener('click', (e) => {
        const target = e.target;

        // Login buttons
        if (target.matches('#btn-login, .btn-login, [data-action="login"]')) {
            e.preventDefault();
            handleLogin(e);
            return;
        }

        // Logout buttons
        if (target.matches('#btn-logout, .btn-logout, [data-action="logout"]')) {
            e.preventDefault();
            handleLogout();
            return;
        }

        // Navigation bar tabs
        const navBtn = target.closest('.bottom-nav-btn');
        if (navBtn) {
            const targetTab = navBtn.getAttribute('data-tab');
            if (targetTab) {
                switchTab(targetTab, navBtn);
            }
        }
    });

    // 3. Search and Category Filters
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
}

/* ==========================================================================
   AUTHENTICATION LOGIC (HYBRID: READS INPUTS OR FALLS BACK TO PROMPT)
   ========================================================================== */

function handleLogin(e) {
    if (e) e.preventDefault();

    // Check if on-screen HTML inputs exist for name/email
    const nameInput = document.getElementById('login-name') || 
                      document.getElementById('user-name') || 
                      document.getElementById('username') || 
                      document.querySelector('input[type="text"]');

    const emailInput = document.getElementById('login-email') || 
                       document.getElementById('user-email') || 
                       document.getElementById('email') || 
                       document.querySelector('input[type="email"]');

    let name = nameInput ? nameInput.value.trim() : '';
    let email = emailInput ? emailInput.value.trim() : '';

    // If no inputs were filled out or found, ask via prompts
    if (!name) {
        name = prompt("Enter your name to sign in / trade:");
    }
    if (name && !email) {
        email = prompt("Enter your email address:");
    }

    if (!name || !email) {
        showSuccessToast("Login cancelled. Name and email are required.");
        return false;
    }

    currentUser = {
        fullName: name.trim(),
        email: email.trim().toLowerCase()
    };

    saveLocalData();
    updateUserUI();
    showSuccessToast(`Logged in as ${currentUser.fullName}`);

    // Hide any login modals if present
    const modal = document.querySelector('.modal, #login-modal');
    if (modal) modal.style.display = 'none';

    return true;
}

function handleLogout() {
    currentUser = null;
    saveLocalData();
    updateUserUI();
    showSuccessToast("Logged out successfully.");
}

function updateUserUI() {
    const authStatusElement = document.getElementById('auth-status');
    if (authStatusElement) {
        if (currentUser) {
            authStatusElement.innerHTML = `
                <span>Welcome, <strong>${escapeHtml(currentUser.fullName)}</strong></span>
                <button type="button" id="btn-logout" class="btn-logout" style="margin-left: 10px; padding: 4px 10px;">Logout</button>
            `;
        } else {
            authStatusElement.innerHTML = `<button type="button" id="btn-login" class="btn-login">Login / Sign Up</button>`;
        }
    }
}

/* ==========================================================================
   CORE LISTING CREATION & PERSISTENCE
   ========================================================================== */

async function handleCreateListing(e) {
    if (e) e.preventDefault();

    if (!currentUser) {
        const loggedIn = handleLogin(e);
        if (!loggedIn) return;
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
            console.error("Error reading image file:", err);
        }
    }

    const newItem = {
        id: 'item_' + Date.now(),
        sellerName: currentUser.fullName,
        sellerEmail: currentUser.email,
        title: titleInput ? titleInput.value.trim() : 'Untitled Item',
        category: categoryInput ? categoryInput.value : 'general',
        price: priceInput ? parseFloat(priceInput.value) || 0 : 0,
        location: locationInput ? locationInput.value.trim() : 'Local Area',
        lat: userLocation ? userLocation.lat : 40.7128,
        lng: userLocation ? userLocation.lng : -74.0060,
        image: imageUrl,
        description: descInput ? descInput.value.trim() : '',
        wanted: wantedInput ? wantedInput.value.trim() : 'Open to offers',
        status: "OPEN",
        timestamp: new Date().toISOString()
    };

    // 1. Add locally and re-render grid
    items.unshift(newItem);
    saveLocalData();
    applyFilters();

    // 2. Sync to Firebase if connected
    if (isFirebaseConnected && db) {
        db.ref('items/' + newItem.id).set(newItem).catch((err) => {
            console.warn("Firebase save warning: Saved locally.", err);
        });
    }

    // Reset Form
    const postForm = document.getElementById('post-item-form');
    if (postForm) postForm.reset();

    showSuccessToast("Listing published! Now visible on Explore screen.");

    // Redirect to Explore view
    const exploreBtn = document.querySelectorAll('.bottom-nav-btn')[0];
    switchTab('explore-tab', exploreBtn);
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
   NAVIGATION & TAB SWITCHING
   ========================================================================== */

function switchTab(tabId, targetBtn) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');

    if (targetBtn) {
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
    }

    if (tabId === 'explore-tab') {
        applyFilters();
    }
}

/* ==========================================================================
   FILTERING & RENDERING
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
            <div class="empty-state" style="text-align: center; padding: 40px 20px; color: #666;">
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
        const loggedIn = handleLogin();
        if (!loggedIn) return;
    }

    alert(`Offer request sent to ${targetItem.sellerName} (${targetItem.sellerEmail}) for "${targetItem.title}"!`);
}

/* ==========================================================================
   UTILITY & FIREBASE / GEOLOCATION
   ========================================================================== */

function syncWithFirebase() {
    if (!isFirebaseConnected || !db) return;

    db.ref('items').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const firebaseItems = Object.keys(data).map(key => data[key]);
            const itemMap = new Map();
            [...items, ...firebaseItems].forEach(item => itemMap.set(item.id, item));
            
            items = Array.from(itemMap.values());
            items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            saveLocalData();
            applyFilters();
        }
    }, (error) => {
        console.warn("Firebase sync disabled/restricted. Running in local mode.", error);
    });
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
            (err) => { console.warn("Geolocation unavailable.", err); }
        );
    }
}

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
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
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
