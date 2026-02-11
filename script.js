// --- 1. FIREBASE SETUP & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const channelsCollection = collection(db, "channels");
const categoriesCollection = collection(db, "categories");

// --- 2. GLOBAL VARIABLES ---
let channels = [];
let categories = [];
let isAdmin = false;
let editingId = null;
let overlayTimer = null;
let showOnlyFavorites = false;
let isPipMode = false;

// گۆڕاوەکان بۆ جوڵاندنی PiP
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

// DOM Elements
const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');
const channelModal = document.getElementById('channelFormModal');
const categoryModal = document.getElementById('categoryModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer'); // This is the draggable item
const relatedBar = document.getElementById('relatedChannels');
const favFilterBtn = document.getElementById('favFilterBtn');
const categorySelect = document.getElementById('channelCategory');

// --- 3. TOAST NOTIFICATION SYSTEM ---
window.showToast = (msg, type = 'success') => {
    const box = document.getElementById('toast-box');
    const toast = document.createElement('div');
    
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    if (type === 'info') iconClass = 'fa-info-circle';
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${msg}</span>`;
    
    box.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
};

// --- 4. AUTHENTICATION LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        document.body.classList.add('admin-mode');
        toggleAdminUI(true);
        showToast("بەخێربێیت ئەدمین", "success");
    } else {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        toggleAdminUI(false);
    }
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 5. DATA LISTENERS ---
onSnapshot(categoriesCollection, (snapshot) => {
    categories = [];
    snapshot.docs.forEach(doc => { categories.push({ id: doc.id, ...doc.data() }); });
    categories.sort((a, b) => a.order - b.order);
    updateCategoryDropdown();
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

onSnapshot(channelsCollection, (snapshot) => {
    channels = [];
    snapshot.docs.forEach(doc => { channels.push({ ...doc.data(), id: doc.id }); });
    channels.sort((a, b) => (a.name > b.name) ? 1 : -1);
    renderApp(document.getElementById('searchInput').value.toLowerCase().trim());
});

// --- 6. RENDER LOGIC ---
function renderApp(searchQuery = '') {
    if (channels.length === 0 && categories.length === 0 && !isAdmin) return;
    mainContainer.innerHTML = ''; 
    let displayChannels = channels;
    if(searchQuery) displayChannels = displayChannels.filter(c => c.name.toLowerCase().includes(searchQuery));
    if(showOnlyFavorites) displayChannels = displayChannels.filter(c => c.isFavorite);

    if(displayChannels.length === 0) {
        mainContainer.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#a0aec0;"><p>هیچ کەناڵێک نەدۆزرایەوە</p></div>`;
        return;
    }

    let sectionsToRender = [];
    const hasFavs = channels.some(c => c.isFavorite);
    if (!showOnlyFavorites && !searchQuery && hasFavs) sectionsToRender.push({ id: 'favorites', title: '❤️ دڵخوازەکان' });

    categories.forEach(cat => {
        const hasChannel = displayChannels.some(ch => ch.category === cat.id);
        if(hasChannel || isAdmin) sectionsToRender.push(cat);
    });

    if (showOnlyFavorites) {
         const section = createSectionHTML('favorites', '❤️ هەموو دڵخوازەکان', displayChannels);
         mainContainer.appendChild(section);
         return;
    }

    sectionsToRender.forEach(cat => {
        let catChannels = (cat.id === 'favorites') ? channels.filter(c => c.isFavorite) : displayChannels.filter(c => c.category === cat.id);
        if(catChannels.length === 0 && !isAdmin) return;
        mainContainer.appendChild(createSectionHTML(cat.id, cat.title, catChannels));
    });
}

function createSectionHTML(catId, catTitle, catChannels) {
    const section = document.createElement('div');
    section.className = 'category-section';
    if (catChannels.length === 0) {
        section.innerHTML = `<div class="section-header" style="border-bottom:none;"><div class="section-title" style="opacity:0.6;">${catTitle} (بەتاڵ)</div></div>`;
        return section;
    }
    let gridHTML = `<div class="products-container" id="grid-${catId}">`;
    catChannels.forEach(ch => gridHTML += createCardHTML(ch));
    gridHTML += `</div>`;
    section.innerHTML = `<div class="section-header"><div class="section-title">${catTitle}</div><div class="count-badge">${catChannels.length}</div></div>${gridHTML}`;
    return section;
}

function createCardHTML(ch) {
    const adminControls = isAdmin ? `
        <div class="admin-controls">
            <button class="edit-btn" onclick="event.stopPropagation(); editChannel('${ch.id}')"><i class="fas fa-pen"></i></button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteChannel('${ch.id}')"><i class="fas fa-trash"></i></button>
        </div>` : '';
    const favClass = ch.isFavorite ? 'active' : '';
    const img = ch.image || "https://placehold.co/200?text=TV";
    return `<div class="product-card" onclick="playChannel('${ch.id}')">
            <div class="fav-btn ${favClass}" onclick="toggleFavorite('${ch.id}', event)"><i class="fas fa-heart"></i></div>
            <img src="${img}" class="product-image" loading="lazy" onerror="this.src='https://placehold.co/200?text=Error'">
            ${adminControls}</div>`;
}

// --- 7. PLAYER, PiP & DRAGGING LOGIC ---

window.playChannel = (id) => {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;
    
    playerModal.style.display = 'block';
    
    // ئەگەر لە PiP بووین، با بگەڕێتەوە دۆخی ئاسایی بۆ ساتێک
    if(isPipMode) togglePipMode(); 

    videoPlayer.src = ""; 
    if (Hls.isSupported()) {
        if(window.hls) window.hls.destroy(); 
        const hls = new Hls(); 
        hls.loadSource(channel.url); 
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e=>console.log("Autoplay blocked")));
        window.hls = hls;
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.url; videoPlayer.play();
    }
    renderRelated(channel); 
    triggerOverlay();
};

window.togglePipMode = () => {
    isPipMode = !isPipMode;
    
    if (isPipMode) {
        playerModal.classList.add('pip-active');
        videoContainer.classList.add('pip-mode');
        // دەستپێکردنی گوێگرتن بۆ جووڵە (Drag)
        addDragListeners();
    } else {
        playerModal.classList.remove('pip-active');
        videoContainer.classList.remove('pip-mode');
        
        // گەڕاندنەوەی شوێنی ڤیدیۆکە بۆ ناوەڕاست
        resetDragPosition();
        removeDragListeners();
    }
};

window.triggerOverlay = () => { 
    videoContainer.classList.add('ui-visible'); 
    clearTimeout(overlayTimer); 
    overlayTimer = setTimeout(() => { videoContainer.classList.remove('ui-visible'); }, 4000); 
};

window.toggleFullScreen = () => { 
    if(isPipMode) {
        togglePipMode(); 
        return;
    }
    const elem = videoContainer; 
    (!document.fullscreenElement) ? (elem.requestFullscreen||elem.webkitRequestFullscreen).call(elem) : document.exitFullscreen(); 
};

window.closePlayer = () => { 
    if (document.fullscreenElement) document.exitFullscreen(); 
    
    if(isPipMode) {
        isPipMode = false;
        videoContainer.classList.remove('pip-mode');
        playerModal.classList.remove('pip-active');
        resetDragPosition(); // پاککردنەوەی شوێنەکە
    }

    playerModal.style.display = 'none'; 
    videoPlayer.pause(); 
    if(window.hls) window.hls.destroy(); 
};

// --- DRAGGING FUNCTIONS (New) ---

function addDragListeners() {
    // بۆ مۆبایل (Touch)
    videoContainer.addEventListener("touchstart", dragStart, {passive: false});
    videoContainer.addEventListener("touchend", dragEnd, {passive: false});
    videoContainer.addEventListener("touchmove", drag, {passive: false});

    // بۆ کۆمپیوتەر (Mouse)
    videoContainer.addEventListener("mousedown", dragStart);
    videoContainer.addEventListener("mouseup", dragEnd);
    videoContainer.addEventListener("mousemove", drag);
}

function removeDragListeners() {
    videoContainer.removeEventListener("touchstart", dragStart);
    videoContainer.removeEventListener("touchend", dragEnd);
    videoContainer.removeEventListener("touchmove", drag);
    
    videoContainer.removeEventListener("mousedown", dragStart);
    videoContainer.removeEventListener("mouseup", dragEnd);
    videoContainer.removeEventListener("mousemove", drag);
}

function dragStart(e) {
    if (!isPipMode) return;
    
    if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
    } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
    }

    // دڵنیابوونەوە کە دوگمەمان دانەگرتووە (Close, Expand)
    if (e.target.closest('.player-btn') || e.target.closest('.related-channels-bar')) {
        isDragging = false;
        return;
    }

    isDragging = true;
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
}

function drag(e) {
    if (isDragging) {
        e.preventDefault(); // ڕاگرتنی Scroll
        
        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, videoContainer);
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function resetDragPosition() {
    xOffset = 0;
    yOffset = 0;
    videoContainer.style.transform = "none";
}

// --- 8. ADMIN & FORM FUNCTIONS ---
document.getElementById('adminLoginBtn').onclick = () => loginModal.style.display = 'block';
document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass).then(() => {
        loginModal.style.display = 'none'; e.target.reset();
    }).catch(() => { showToast("هەڵە هەیە! ئیمەیڵ یان پاسۆرد هەڵەیە.", "error"); });
};
document.getElementById('logoutBtn').onclick = () => { signOut(auth).then(() => { showToast("بە سەرکەوتوویی دەرچوویت", "info"); }); };

function toggleAdminUI(show) {
    document.getElementById('adminLoginBtn').style.display = show ? 'none' : 'flex';
    document.getElementById('logoutBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addChannelBtn').style.display = show ? 'flex' : 'none';
    document.getElementById('addCategoryBtn').style.display = show ? 'flex' : 'none';
}

function updateCategoryDropdown() {
    categorySelect.innerHTML = `<option value="" disabled selected>...هەڵبژێرە</option>`;
    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id; option.text = cat.title; categorySelect.appendChild(option);
    });
}

document.getElementById('addChannelBtn').onclick = () => { 
    if(categories.length === 0) { showToast("سەرەتا دەبێت بەش زیاد بکەیت!", "error"); return; }
    editingId = null; document.getElementById('channelForm').reset(); document.getElementById('formTitle').innerText = "زیادکردنی کەناڵ"; channelModal.style.display = 'block'; 
};
document.getElementById('channelForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('channelName').value;
    const url = document.getElementById('channelUrl').value;
    const category = document.getElementById('channelCategory').value;
    const imgLink = document.getElementById('channelImageLink').value;
    const finalImage = imgLink.trim() !== "" ? imgLink : "https://placehold.co/200?text=TV";
    if(!category) { showToast("تکایە بەشێک هەڵبژێرە", "error"); return; }
    const data = { name, url, category, image: finalImage, isFavorite: false };
    try {
        if(editingId) {
            const old = channels.find(c=>c.id===editingId); data.isFavorite = old.isFavorite;
            await updateDoc(doc(db, "channels", editingId), data); showToast("کەناڵەکە نوێکرایەوە", "success");
        } else { await addDoc(channelsCollection, data); showToast("کەناڵی نوێ زیادکرا", "success"); }
        channelModal.style.display = 'none';
    } catch(err) { console.error(err); showToast("کێشەیەک ڕوویدا", "error"); }
};
window.deleteChannel = async (id) => { if(confirm("دڵنیای دەسڕێتەوە؟")) { await deleteDoc(doc(db, "channels", id)); showToast("کەناڵەکە سڕایەوە", "info"); } };
window.editChannel = (id) => { 
    const ch = channels.find(c => c.id === id); if(!ch) return;
    editingId = id; document.getElementById('channelName').value = ch.name; document.getElementById('channelUrl').value = ch.url; document.getElementById('channelCategory').value = ch.category; document.getElementById('channelImageLink').value = ch.image; channelModal.style.display = 'block'; 
};
document.getElementById('addCategoryBtn').onclick = () => { document.getElementById('categoryForm').reset(); categoryModal.style.display = 'block'; };
document.getElementById('categoryForm').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('catTitle').value; const id = document.getElementById('catId').value.toLowerCase().trim(); const order = parseInt(document.getElementById('catOrder').value);
    if(!id.match(/^[a-z0-9]+$/)) { showToast("کۆدی بەش تەنها دەبێت پیت و ژمارەی ئینگلیزی بێت", "error"); return; }
    try { await setDoc(doc(db, "categories", id), { title, order }); showToast("بەشەکە زیادکرا", "success"); categoryModal.style.display = 'none'; } catch (error) { showToast("کێشەیەک هەیە", "error"); }
};
window.toggleFavorite = async (id, event) => { if(event) event.stopPropagation(); const channelRef = doc(db, "channels", id); const channel = channels.find(c => c.id === id); if(channel) { await updateDoc(channelRef, { isFavorite: !channel.isFavorite }); } };
window.handleSearch = () => { renderApp(document.getElementById('searchInput').value.toLowerCase().trim()); };
window.toggleFavFilterView = () => { showOnlyFavorites = !showOnlyFavorites; if(showOnlyFavorites) { favFilterBtn.classList.add('active-filter'); showToast("پیشاندانی تەنها دڵخوازەکان", "info"); } else { favFilterBtn.classList.remove('active-filter'); showToast("پیشاندانی هەموو کەناڵەکان", "info"); } renderApp(document.getElementById('searchInput').value.toLowerCase().trim()); };
window.onclick = (e) => { if(e.target == loginModal) loginModal.style.display="none"; if(e.target == channelModal) channelModal.style.display="none"; if(e.target == categoryModal) categoryModal.style.display="none"; };
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { loginModal.style.display='none'; channelModal.style.display='none'; categoryModal.style.display='none'; });

// Helpers to render related when opening player
function renderRelated(current) {
    relatedBar.innerHTML = '';
    channels.filter(c => c.category === current.category).forEach(ch => {
        const div = document.createElement('div');
        div.className = `related-card ${ch.id === current.id ? 'active' : ''}`;
        div.onclick = (e) => { e.stopPropagation(); playChannel(ch.id); };
        div.innerHTML = `<img src="${ch.image}">`;
        relatedBar.appendChild(div);
    });
}
