// Pre-populated sample items
const defaultItems = [
    {
        id: "1",
        title: "Sony Noise Cancelling Headphones",
        category: "Electronics",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
        description: "Great condition, minor scratches on headband. Battery lasts 30h.",
        wanted: "Mechanical Keyboard or Gaming Mouse"
    },
    {
        id: "2",
        title: "DSLR Camera Kit",
        category: "Electronics",
        image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500",
        description: "Includes 18-55mm lens and carrying bag. Barely used.",
        wanted: "iPad / Tablet or Smartwatch"
    }
];

// Application State
let items = JSON.parse(localStorage.getItem('trade_items')) || defaultItems;
let offers = JSON.parse(localStorage.getItem('trade_offers')) || [];

// Save state to browser localStorage
function saveData() {
    localStorage.setItem('trade_items', JSON.stringify(items));
    localStorage.setItem('trade_offers', JSON.stringify(offers));
    updateOfferCount();
}

// Tab Switcher
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');

    if (tabId === 'explore-tab') renderItems();
    if (tabId === 'offers-tab') renderOffers();
}

// Render Listings Grid
function renderItems() {
    const grid = document.getElementById('item-grid');
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = '<p>No items available for trade right now.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">
            <div class="card-body">
                <span class="badge">${item.category}</span>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="trade-for">
                    <strong>Wants:</strong> ${item.wanted}
                </div>
                <button class="primary-btn" onclick="openModal('${item.id}', '${escape(item.title)}')">Offer Trade</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Submit New Item
document.getElementById('post-item-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newItem = {
        id: Date.now().toString(),
        title: document.getElementById('item-title').value,
        category: document.getElementById('item-category').value,
        image: document.getElementById('item-image').value,
        description: document.getElementById('item-desc').value,
        wanted: document.getElementById('item-wanted').value
    };

    items.unshift(newItem);
    saveData();
    this.reset();
    
    // Switch to explore tab
    switchTab('explore-tab');
    document.querySelector('.nav-btn').classList.add('active');
});

// Modal Logic
function openModal(itemId, title) {
    document.getElementById('target-item-id').value = itemId;
    document.getElementById('modal-item-title').innerText = `Offer Trade for: ${unescape(title)}`;
    document.getElementById('trade-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('trade-modal').style.display = 'none';
}

// Submit Trade Offer
document.getElementById('trade-offer-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const targetId = document.getElementById('target-item-id').value;
    const targetItem = items.find(i => i.id === targetId);

    const newOffer = {
        id: Date.now().toString(),
        targetTitle: targetItem ? targetItem.title : "Unknown Item",
        offeredItem: document.getElementById('offered-item').value,
        note: document.getElementById('offer-note').value,
        date: new Date().toLocaleDateString()
    };

    offers.unshift(newOffer);
    saveData();
    closeModal();
    this.reset();
    alert("Trade proposal submitted successfully!");
});

// Render Offers
function renderOffers() {
    const list = document.getElementById('offers-list');
    list.innerHTML = '';

    if (offers.length === 0) {
        list.innerHTML = '<p>You haven\'t made or received any trade offers yet.</p>';
        return;
    }

    offers.forEach(offer => {
        const item = document.createElement('div');
        item.className = 'offer-card';
        item.innerHTML = `
            <h4>Offered <strong>${offer.offeredItem}</strong> for <strong>${offer.targetTitle}</strong></h4>
            <p><strong>Note:</strong> ${offer.note || 'None'}</p>
            <small style="color: #64748b;">Submitted on ${offer.date}</small>
        `;
        list.appendChild(item);
    });
}

function updateOfferCount() {
    document.getElementById('offer-count').innerText = offers.length;
}

// Initial Load
renderItems();
updateOfferCount();
