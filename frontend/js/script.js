/* Easy Hire — Dedicated Pages Integration Script (script.js)
   Connects customer-dashboard.html, booking-requests.html, provider-booking-history.html, and review.html
   to the existing Node.js / MongoDB Atlas backend.
*/

(function () {
    // API Configuration
    const API_BASE = window.API_BASE_URL || (window.location.origin.includes(":500") ? window.location.origin : "http://localhost:500");
    window.API_BASE = API_BASE;

    // Helpers
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const initials = (name) => String(name || "EH").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();

    // Session Management (synchronized with app.js)
    function getUser() {
        try {
            return JSON.parse(localStorage.getItem("eh_user") || localStorage.getItem("easyHireCurrentUserV2")) || null;
        } catch (e) {
            return null;
        }
    }
    window.getCurrentUser = getUser;

    function setUser(u) {
        if (!u) {
            localStorage.removeItem("eh_user");
            localStorage.removeItem("easyHireCurrentUserV2");
        } else {
            localStorage.setItem("eh_user", JSON.stringify(u));
            localStorage.setItem("easyHireCurrentUserV2", JSON.stringify(u));
        }
    }
    window.setCurrentUser = setUser;

    function logout() {
        setUser(null);
        window.location.href = "login.html";
    }
    window.logout = logout;

    function guard(requiredRole) {
        const u = getUser();
        if (!u) {
            const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
            window.location.href = "login.html?next=" + next;
            return null;
        }
        if (requiredRole && u.role !== requiredRole) {
            alert(`This section is for ${requiredRole}s only. You are signed in as a ${u.role}.`);
            window.location.href = u.role === "provider" ? "provider-dashboard.html" : "customer-dashboard.html";
            return null;
        }
        return u;
    }
    window.guard = guard;

    function toast(text) {
        const existing = document.getElementById("toast");
        if (existing) existing.remove();
        const e = document.createElement("div");
        e.id = "toast";
        e.textContent = text;
        document.body.appendChild(e);
        setTimeout(() => e.remove(), 3200);
    }
    window.toast = toast;

    // Friendly date & time
    function friendlyDate(date) {
        if (!date) return "N/A";
        return esc(date);
    }

    function friendlyTime(time) {
        if (!time) return "N/A";
        return esc(time);
    }

    function statusClass(status) {
        return "status-" + String(status || "pending").toLowerCase();
    }

    function parseTimeStrToMinutes(tStr) {
        if (!tStr) return null;
        const match = tStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const meridian = match[3] ? match[3].toUpperCase() : null;

        if (meridian === "PM" && hours < 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;

        return hours * 60 + minutes;
    }
    window.parseTimeStrToMinutes = parseTimeStrToMinutes;

    function isProviderAvailableNow(provider, now = new Date()) {
        if (!provider) return false;

        // 1. Manual status override
        if (provider.manualStatus === "Unavailable" || provider.isAvailable === false) {
            return false;
        }
        if (provider.manualStatus === "Available") {
            return true;
        }

        // 2. Working hours check (Auto)
        const avail = provider.availability || "9 AM - 6 PM";
        const parts = avail.split("-");
        if (parts.length === 2) {
            const startMins = parseTimeStrToMinutes(parts[0]);
            const endMins = parseTimeStrToMinutes(parts[1]);

            if (startMins !== null && endMins !== null) {
                const currentMins = now.getHours() * 60 + now.getMinutes();
                if (startMins <= endMins) {
                    return currentMins >= startMins && currentMins < endMins;
                } else {
                    return currentMins >= startMins || currentMins < endMins;
                }
            }
        }

        return true;
    }
    window.isProviderAvailableNow = isProviderAvailableNow;

    // ==========================================
    // 1. CUSTOMER DASHBOARD (customer-dashboard.html)
    // ==========================================
    let dashboardProvidersList = [];
    let currentDashboardArea = "";
    let customerArea = "";
    let locationHierarchy = {};
    let selectedDashState = "";
    let selectedDashDistrict = "";
    let selectedDashArea = "";

    async function initCustomerDashboard() {
        const u = guard("customer");
        if (!u) return;

        customerArea = (u.area || (u.address && u.address !== "N/A" ? u.address.trim() : ""));
        currentDashboardArea = customerArea; // Automatically prioritize customer's area

        // Update header & welcome with customer name & full address
        const welcomeTitle = document.querySelector(".dash-welcome h1");
        if (welcomeTitle) {
            welcomeTitle.innerHTML = `Welcome back, <em>${esc((u.name || "").split(" ")[0])}.</em>`;
        }
        const welcomeDesc = document.querySelector(".dash-welcome p");
        if (welcomeDesc) {
            const formattedAddr = [u.doorNo, u.area, u.district, u.state].filter(Boolean).join(", ");
            welcomeDesc.innerHTML = `CustomerID: <b>${esc(u.CustomerID)}</b> · 📍 Address: <b>${esc(formattedAddr || u.address || "Local Neighborhood")}</b>`;
        }

        // Update search placeholder with customer area
        const searchInput = $("dashboardSearch");
        if (searchInput && customerArea) {
            searchInput.placeholder = `Search electrician, plumbing, painting in ${customerArea}…`;
        }

        // Update explore all link to include area
        const exploreLink = $("dashExploreLink");
        if (exploreLink) {
            exploreLink.href = customerArea ? `services.html?area=${encodeURIComponent(customerArea)}` : "services.html";
        }

        // Fetch real customer bookings for stats
        try {
            const bRes = await fetch(`${API_BASE}/api/bookings?customerId=${encodeURIComponent(u.CustomerID)}`);
            if (bRes.ok) {
                const myBookings = await bRes.json();
                const pendingCount = myBookings.filter(b => b.status === "Pending").length;
                const acceptedCount = myBookings.filter(b => b.status === "Accepted").length;
                const completedCount = myBookings.filter(b => b.status === "Completed").length;

                // Add or update summary stats in welcome block
                let statsBox = document.getElementById("customerDashStats");
                if (!statsBox) {
                    statsBox = document.createElement("div");
                    statsBox.id = "customerDashStats";
                    statsBox.className = "stats-strip";
                    statsBox.style.marginTop = "20px";
                    const welcomeSection = document.querySelector(".dash-welcome");
                    if (welcomeSection) {
                        welcomeSection.parentNode.insertBefore(statsBox, welcomeSection.nextSibling);
                    }
                }
                statsBox.innerHTML = `
                    <div><span>ALL BOOKINGS</span><b>${myBookings.length}</b></div>
                    <div><span>PENDING</span><b>${pendingCount}</b></div>
                    <div><span>ACCEPTED</span><b>${acceptedCount}</b></div>
                    <div><span>COMPLETED</span><b>${completedCount}</b></div>
                `;
            }
        } catch (err) {
            console.error("Dashboard bookings fetch error:", err);
        }

        // Fetch location hierarchy for multi-level filtering
        try {
            const locRes = await fetch(`${API_BASE}/api/search/locations`);
            if (locRes.ok) {
                locationHierarchy = await locRes.json();
                populateDashStateDropdown();
            }
        } catch (err) {
            console.error("Dashboard locations fetch error:", err);
        }

        // Fetch real providers from MongoDB
        try {
            const pRes = await fetch(`${API_BASE}/api/search/providers`);
            if (!pRes.ok) throw new Error("Could not load providers");
            dashboardProvidersList = await pRes.json();
            renderDashboardAreaTabs();
            renderDashboardProviders();
        } catch (err) {
            console.error("Dashboard providers load error:", err);
            const container = $("dashboardProviders");
            if (container) {
                container.innerHTML = `<p class="empty-state" style="grid-column:1/-1">Failed to connect to database: ${esc(err.message)}</p>`;
            }
        }
    }

    function populateDashStateDropdown() {
        const stateSelect = $("dashStateSelect");
        if (!stateSelect) return;
        const states = Object.keys(locationHierarchy).sort();
        stateSelect.innerHTML = `<option value="">Level 1: All States</option>` +
            states.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    }

    window.onDashStateChange = function(stateVal) {
        selectedDashState = stateVal || "";
        selectedDashDistrict = "";
        selectedDashArea = "";
        currentDashboardArea = "";

        const distSelect = $("dashDistrictSelect");
        const areaSelect = $("dashAreaSelect");

        if (distSelect) {
            if (selectedDashState && locationHierarchy[selectedDashState]) {
                const districts = Object.keys(locationHierarchy[selectedDashState]).sort();
                distSelect.innerHTML = `<option value="">Level 2: All Districts in ${esc(selectedDashState)}</option>` +
                    districts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
            } else {
                distSelect.innerHTML = `<option value="">Level 2: All Districts</option>`;
            }
            distSelect.value = "";
        }

        if (areaSelect) {
            areaSelect.innerHTML = `<option value="">Level 3: All Areas</option>`;
            areaSelect.value = "";
        }

        renderDashboardAreaTabs();
        const input = $("dashboardSearch");
        renderDashboardProviders(input ? input.value : "");
    };

    window.onDashDistrictChange = function(distVal) {
        selectedDashDistrict = distVal || "";
        selectedDashArea = "";
        currentDashboardArea = "";

        const areaSelect = $("dashAreaSelect");
        if (areaSelect) {
            if (selectedDashState && selectedDashDistrict && locationHierarchy[selectedDashState]?.[selectedDashDistrict]) {
                const areas = locationHierarchy[selectedDashState][selectedDashDistrict].sort();
                areaSelect.innerHTML = `<option value="">Level 3: All Areas in ${esc(selectedDashDistrict)}</option>` +
                    areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
            } else {
                areaSelect.innerHTML = `<option value="">Level 3: All Areas</option>`;
            }
            areaSelect.value = "";
        }

        renderDashboardAreaTabs();
        const input = $("dashboardSearch");
        renderDashboardProviders(input ? input.value : "");
    };

    window.onDashAreaChange = function(areaVal) {
        selectedDashArea = areaVal || "";
        currentDashboardArea = selectedDashArea;

        renderDashboardAreaTabs();
        const input = $("dashboardSearch");
        renderDashboardProviders(input ? input.value : "");
    };

    window.resetDashLocationFilters = function() {
        selectedDashState = "";
        selectedDashDistrict = "";
        selectedDashArea = "";
        currentDashboardArea = "";

        const stateSelect = $("dashStateSelect");
        const distSelect = $("dashDistrictSelect");
        const areaSelect = $("dashAreaSelect");

        if (stateSelect) stateSelect.value = "";
        if (distSelect) {
            distSelect.innerHTML = `<option value="">Level 2: All Districts</option>`;
            distSelect.value = "";
        }
        if (areaSelect) {
            areaSelect.innerHTML = `<option value="">Level 3: All Areas</option>`;
            areaSelect.value = "";
        }

        renderDashboardAreaTabs();
        const input = $("dashboardSearch");
        renderDashboardProviders(input ? input.value : "");
    };

    function renderDashboardAreaTabs() {
        const tabsContainer = $("dashboardAreaTabs");
        if (!tabsContainer) return;

        // Collect available areas
        let availableAreas = [];
        if (selectedDashState && selectedDashDistrict && locationHierarchy[selectedDashState]?.[selectedDashDistrict]) {
            availableAreas = locationHierarchy[selectedDashState][selectedDashDistrict];
        } else if (selectedDashState && locationHierarchy[selectedDashState]) {
            Object.values(locationHierarchy[selectedDashState]).forEach(arr => {
                availableAreas = availableAreas.concat(arr);
            });
            availableAreas = Array.from(new Set(availableAreas)).sort();
        } else {
            availableAreas = Array.from(new Set(dashboardProvidersList.map(p => p.area).filter(Boolean))).sort();
        }

        let tabsHtml = "";
        const isAllActive = !currentDashboardArea && !selectedDashArea;
        tabsHtml += `<button type="button" class="filter-tab ${isAllActive ? 'active' : ''}" onclick="window.selectDashboardArea('', this)">All Areas</button>`;

        availableAreas.forEach(a => {
            const isActive = (currentDashboardArea && currentDashboardArea.toLowerCase() === a.toLowerCase()) ||
                             (selectedDashArea && selectedDashArea.toLowerCase() === a.toLowerCase());
            tabsHtml += `<button type="button" class="filter-tab ${isActive ? 'active' : ''}" onclick="window.selectDashboardArea('${esc(a)}', this)">${esc(a)}</button>`;
        });

        tabsContainer.innerHTML = tabsHtml;
    }

    window.selectDashboardArea = function(area, btn) {
        currentDashboardArea = area || "";
        selectedDashArea = area || "";

        // Sync Level 3 dropdown
        const areaSelect = $("dashAreaSelect");
        if (areaSelect) areaSelect.value = selectedDashArea;

        const tabs = document.querySelectorAll("#dashboardAreaTabs .filter-tab");
        tabs.forEach(t => t.classList.remove("active"));
        if (btn) {
            btn.classList.add("active");
        } else {
            tabs.forEach(t => {
                const text = t.textContent || "";
                if ((!area && text === "All Areas") || (area && text.includes(area))) {
                    t.classList.add("active");
                }
            });
        }

        const input = $("dashboardSearch");
        const term = input ? input.value : "";
        renderDashboardProviders(term);
    };

    const COVER_THEMES = ["cover-gold", "cover-sand", "cover-rose"];
    const COVER_LABELS = {
        "Plumbing": "PLUMBING",
        "Electrical": "ELECTRICAL",
        "Home Cleaning": "CLEANING",
        "AC Repair": "AC REPAIR",
        "Appliance Repair": "APPLIANCES",
        "Painting": "PAINT & FINISH",
        "Carpentry": "CARPENTRY",
        "Pest Control": "PEST CONTROL",
        "RO Service": "RO WATER",
        "Computer Repair": "TECH SERVICE"
    };

    function renderDashboardProviders(filterTerm = "") {
        const container = $("dashboardProviders");
        if (!container) return;

        const term = filterTerm.trim().toLowerCase();
        const areaFilter = (selectedDashArea || currentDashboardArea).trim().toLowerCase();
        const distFilter = selectedDashDistrict.trim().toLowerCase();
        const stateFilter = selectedDashState.trim().toLowerCase();
        const isLocFiltered = Boolean(stateFilter || distFilter || areaFilter);

        const list = dashboardProvidersList.filter(p => {
            const svcs = (Array.isArray(p.services) ? p.services.join(" ") : (p.services || "")).toLowerCase();
            const nm = (p.name || "").toLowerCase();
            const pArea = (p.area || "").trim().toLowerCase();
            const pDist = (p.district || "").trim().toLowerCase();
            const pState = (p.state || "").trim().toLowerCase();

            // Strict exact field matching after normalization
            const matchesState = !stateFilter || (pState && pState === stateFilter);
            const matchesDistrict = !distFilter || (pDist && pDist === distFilter);
            const matchesArea = !areaFilter || (pArea && pArea === areaFilter);

            if (!matchesState || !matchesDistrict || !matchesArea) return false;

            const matchesTerm = !term || nm.includes(term) || svcs.includes(term);
            return matchesTerm;
        });

        // Update eyebrow & heading
        const heading = $("dashSectionHeading");
        const eyebrow = $("dashSectionEyebrow");
        if (heading && eyebrow) {
            if (areaFilter) {
                eyebrow.textContent = `VERIFIED PROFESSIONALS IN ${(selectedDashArea || currentDashboardArea).toUpperCase()} (${list.length} FOUND)`;
                heading.innerHTML = `Pros in <em>${esc(selectedDashArea || currentDashboardArea)}.</em>`;
            } else if (distFilter) {
                eyebrow.textContent = `VERIFIED PROFESSIONALS IN ${selectedDashDistrict.toUpperCase()} DISTRICT (${list.length} FOUND)`;
                heading.innerHTML = `Pros in <em>${esc(selectedDashDistrict)} District.</em>`;
            } else if (stateFilter) {
                eyebrow.textContent = `VERIFIED PROFESSIONALS IN ${selectedDashState.toUpperCase()} (${list.length} FOUND)`;
                heading.innerHTML = `Pros in <em>${esc(selectedDashState)}.</em>`;
            } else {
                eyebrow.textContent = `A GOOD PLACE TO START (${list.length} AVAILABLE)`;
                heading.innerHTML = `Recommended <em>for you.</em>`;
            }
        }

        const empty = $("dashboardEmpty");
        if (empty) {
            if (list.length === 0) {
                empty.classList.remove("hidden");
                empty.textContent = isLocFiltered
                    ? "No service providers found in the selected location."
                    : "No service providers found matching your search criteria.";
            } else {
                empty.classList.add("hidden");
            }
        }

        container.innerHTML = list.map((p, idx) => {
            const theme = COVER_THEMES[idx % COVER_THEMES.length];
            const primarySvc = Array.isArray(p.services) && p.services[0] ? p.services[0] : (p.services || "Service");
            const label = COVER_LABELS[primarySvc] || "LOCAL PRO";
            const rating = Number(p.rating || 0).toFixed(1);
            const exp = p.experience ? `${p.experience} years exp` : "Verified Pro";
            const servicesText = Array.isArray(p.services) ? p.services.join(", ") : (p.services || "General");
            const fullLocation = [p.doorNo, p.area, p.district, p.state].filter(Boolean).join(", ") || p.address;
            const isLocal = customerArea && fullLocation.toLowerCase().includes(customerArea.toLowerCase());
            const isOnline = isProviderAvailableNow(p);

            return `
                <article class="pro-card" data-service="${esc(servicesText.toLowerCase())}">
                    <div class="pro-cover ${theme}">
                        <span class="cover-label">${esc(label)}</span>
                        <span class="cover-symbol">★</span>
                        <span class="cover-number">0${(idx % 9) + 1}</span>
                    </div>
                    <div class="pro-card-body">
                        <div class="pro-title-row">
                            <div class="pro-avatar">${initials(p.name)}</div>
                            <span class="available-pill ${isOnline ? '' : 'away'}" style="${isOnline ? '' : 'background:#eee;color:#777'}">
                                <i class="live-dot" style="${isOnline ? '' : 'background:#888'}"></i>
                                ${isOnline ? 'Available' : 'Unavailable'}
                            </span>
                        </div>
                        <h3>${esc(p.name)}</h3>
                        <p class="pro-specialty">${esc(primarySvc)} · <b style="color:var(--ind)">📍 ${esc(p.area || p.address || "Local")}</b></p>
                        <div class="pro-rating">
                            ★★★★★ <b>${rating}</b>
                            <span title="Working hours: ${esc(p.availability || '9 AM - 6 PM')}">${exp} · ${esc(p.availability || '9 AM - 6 PM')}</span>
                            ${isLocal ? `<span style="font-size:0.75rem;font-weight:700;color:var(--ok);background:#e6f5ef;padding:2px 8px;border-radius:99px;margin-left:auto">✓ In your area</span>` : ""}
                        </div>
                        <p class="pro-summary" style="font-size:0.82rem;color:var(--mute);line-height:1.4">
                            <b>${esc(p.doorNo ? p.doorNo + ', ' : '')}${esc(p.area || '')}</b>, ${esc(p.district || '')}, ${esc(p.state || '')}<br>
                            ${esc(servicesText)}
                        </p>
                        <div class="pro-actions">
                            <a class="btn btn-outline-dark" href="provider-profile.html?id=${esc(p.ProviderId)}">Profile</a>
                            <a class="btn btn-gold" href="booking.html?providerId=${esc(p.ProviderId)}">Book now ↗</a>
                            <a class="btn btn-icon" href="messages.html?providerId=${esc(p.ProviderId)}" aria-label="Message ${esc(p.name)}">✉</a>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    function dashboardSearch(event) {
        if (event) event.preventDefault();
        const input = $("dashboardSearch");
        const term = input ? input.value : "";
        renderDashboardProviders(term);
        const container = $("dashboardProviders");
        if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.dashboardSearch = dashboardSearch;

    function searchDashboardService(service) {
        const input = $("dashboardSearch");
        if (input) input.value = service;
        renderDashboardProviders(service);
        const container = $("dashboardProviders");
        if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.searchDashboardService = searchDashboardService;

    // ==========================================
    // 2. PROVIDER BOOKING REQUESTS (booking-requests.html)
    // ==========================================
    let providerRequests = [];
    let currentRequestFilter = "Pending";

    async function initProviderRequests() {
        const u = guard("provider");
        if (!u) return;

        setupRequestFilters();
        await loadProviderRequests(u.ProviderId);
    }

    async function loadProviderRequests(providerId) {
        const container = $("providerRequestsContainer");
        const empty = $("requestsEmpty");
        if (container) container.innerHTML = `<p class="muted">Loading requests from database...</p>`;

        try {
            const res = await fetch(`${API_BASE}/api/bookings?providerId=${encodeURIComponent(providerId)}`);
            if (!res.ok) throw new Error("Could not fetch requests");
            providerRequests = await res.json();
            renderProviderRequests();
        } catch (err) {
            console.error("Requests load error:", err);
            if (container) container.innerHTML = `<p class="muted">Error: ${esc(err.message)}</p>`;
        }
    }

    function renderProviderRequests() {
        const container = $("providerRequestsContainer");
        const empty = $("requestsEmpty");
        const countEl = $("requestResultCount");
        if (!container) return;

        const filtered = providerRequests.filter(b => {
            if (currentRequestFilter === "All") return true;
            return b.status === currentRequestFilter;
        });

        if (countEl) {
            countEl.textContent = `${filtered.length} request${filtered.length === 1 ? "" : "s"}`;
        }

        if (empty) empty.classList.toggle("hidden", filtered.length > 0);
        container.classList.toggle("hidden", filtered.length === 0);

        container.innerHTML = filtered.map(b => {
            const isPending = b.status === "Pending";
            const isAccepted = b.status === "Accepted";

            return `
                <article class="request-card">
                    <div class="request-info">
                        <div class="request-head">
                            <h3>${esc(b.customerName || ("Customer " + b.customerId))} · ${esc(b.service)}</h3>
                            <span class="status-pill ${statusClass(b.status)}">${esc(b.status)}</span>
                        </div>
                        <div class="request-meta">
                            <span>📅 ${friendlyDate(b.date)}</span>
                            <span>⏰ ${friendlyTime(b.time)}</span>
                            <span>📞 ${esc(b.customerMobile || "N/A")}</span>
                            <span>📍 ${esc(b.customerAddress || "N/A")}</span>
                        </div>
                        <div class="request-details">
                            Booking ID: <code>${esc(b.BookingID)}</code> | Customer ID: <code>${esc(b.customerId)}</code>
                        </div>
                    </div>
                    <div class="request-actions">
                        ${isPending ? `
                            <button class="btn btn-gold" onclick="window.updateBookingStatus('${esc(b.BookingID)}', 'accept')">Accept ↗</button>
                            <button class="btn btn-outline-dark" onclick="window.updateBookingStatus('${esc(b.BookingID)}', 'cancel')">Decline</button>
                        ` : ""}
                        ${isAccepted ? `
                            <button class="btn btn-outline-dark" onclick="window.updateBookingStatus('${esc(b.BookingID)}', 'complete')">Mark completed</button>
                        ` : ""}
                        <a class="btn btn-icon" href="messages.html?bookingId=${esc(b.BookingID)}" title="Message Customer">✉</a>
                    </div>
                </article>
            `;
        }).join("");
    }

    function setupRequestFilters() {
        const tabs = document.querySelectorAll("#requestFilters .filter-tab");
        tabs.forEach(btn => {
            btn.onclick = () => {
                tabs.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentRequestFilter = btn.dataset.filter || "All";
                renderProviderRequests();
            };
        });
    }

    async function updateBookingStatus(bookingId, action) {
        const u = getUser();
        if (!u || u.role !== "provider") return;

        const actionText = action === "accept" ? "accept" : (action === "complete" ? "mark completed" : "decline");
        if (action === "cancel" && !confirm("Decline this booking request?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/bookings/${action}/${encodeURIComponent(bookingId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ providerId: u.ProviderId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to ${actionText} booking`);

            toast(`Booking request ${action}ed successfully.`);
            await loadProviderRequests(u.ProviderId);
        } catch (err) {
            alert("Error: " + err.message);
        }
    }
    window.updateBookingStatus = updateBookingStatus;

    // ==========================================
    // 3. PROVIDER BOOKING HISTORY (provider-booking-history.html)
    // ==========================================
    async function initProviderHistory() {
        const u = guard("provider");
        if (!u) return;

        const container = $("providerHistoryContainer");
        const empty = $("historyEmpty");
        if (container) container.innerHTML = `<p class="muted">Loading history from database...</p>`;

        try {
            const res = await fetch(`${API_BASE}/api/bookings?providerId=${encodeURIComponent(u.ProviderId)}`);
            if (!res.ok) throw new Error("Could not load history");
            const allBookings = await res.json();

            // Stats
            const total = allBookings.length;
            const completed = allBookings.filter(b => b.status === "Completed").length;
            const rejected = allBookings.filter(b => b.status === "Cancelled").length;
            const accepted = allBookings.filter(b => b.status === "Accepted").length;

            if ($("historyAll")) $("historyAll").textContent = total;
            if ($("historyCompleted")) $("historyCompleted").textContent = completed;
            if ($("historyRejected")) $("historyRejected").textContent = rejected;
            if ($("historyAccepted")) $("historyAccepted").textContent = accepted;

            // Render all bookings (or non-pending)
            const items = allBookings;

            if (empty) empty.classList.toggle("hidden", items.length > 0);
            if (container) container.classList.toggle("hidden", items.length === 0);

            if (container) {
                container.innerHTML = items.map(b => {
                    const isAccepted = b.status === "Accepted";
                    return `
                        <article class="booking-item">
                            <div class="booking-item-main">
                                <div class="booking-avatar">${initials(b.customerName || b.customerId)}</div>
                                <div>
                                    <h3>${esc(b.customerName || ("Customer " + b.customerId))}</h3>
                                    <p><strong>${esc(b.service)}</strong></p>
                                    <p>⏰ ${friendlyDate(b.date)} · ${friendlyTime(b.time)}</p>
                                    <p>📞 Phone: ${esc(b.customerMobile || "N/A")}</p>
                                    <p>📍 Address: ${esc(b.customerAddress || "N/A")}</p>
                                    <p style="font-size:0.8rem;color:var(--mute)">Booking ID: <code>${esc(b.BookingID)}</code></p>
                                </div>
                            </div>
                            <div class="booking-item-actions">
                                <span class="status-pill ${statusClass(b.status)}">${esc(b.status)}</span>
                                ${isAccepted ? `
                                    <button class="btn btn-outline-dark" onclick="window.completeFromHistory('${esc(b.BookingID)}')">Mark completed</button>
                                ` : ""}
                                <a class="btn btn-icon" href="messages.html?bookingId=${esc(b.BookingID)}" title="Message">✉</a>
                            </div>
                        </article>
                    `;
                }).join("");
            }
        } catch (err) {
            console.error("History load error:", err);
            if (container) container.innerHTML = `<p class="muted">Error: ${esc(err.message)}</p>`;
        }
    }

    async function completeFromHistory(bid) {
        const u = getUser();
        if (!u || u.role !== "provider") return;

        try {
            const res = await fetch(`${API_BASE}/api/bookings/complete/${encodeURIComponent(bid)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ providerId: u.ProviderId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to mark booking completed");

            toast("Booking marked as Completed.");
            initProviderHistory();
        } catch (err) {
            alert("Error: " + err.message);
        }
    }
    window.completeFromHistory = completeFromHistory;

    // ==========================================
    // 4. CUSTOMER REVIEWS (review.html)
    // ==========================================
    let targetBooking = null;

    async function initReviewPage() {
        const u = guard("customer");
        if (!u) return;

        const q = new URLSearchParams(window.location.search);
        const bookingId = q.get("bookingId");
        const providerId = q.get("providerId");

        // Fetch customer's completed bookings
        try {
            const res = await fetch(`${API_BASE}/api/bookings?customerId=${encodeURIComponent(u.CustomerID)}`);
            if (!res.ok) throw new Error("Could not load bookings");
            const bookings = await res.json();

            const completed = bookings.filter(b => b.status === "Completed");

            if (bookingId) {
                targetBooking = bookings.find(b => b.BookingID === bookingId);
            } else if (providerId) {
                targetBooking = completed.find(b => b.providerId === providerId);
            } else if (completed.length) {
                targetBooking = completed[0];
            }

            if (!targetBooking) {
                const formCard = document.querySelector(".review-form-card");
                if (formCard) {
                    formCard.innerHTML = `
                        <div class="empty-state">
                            <h3>No Eligible Completed Bookings</h3>
                            <p style="margin:12px 0">You can only submit reviews for bookings that have been marked as Completed.</p>
                            <a class="btn btn-gold" href="my-bookings.html">View My Bookings</a>
                        </div>
                    `;
                }
                return;
            }

            if (targetBooking.status !== "Completed") {
                const formCard = document.querySelector(".review-form-card");
                if (formCard) {
                    formCard.innerHTML = `
                        <div class="empty-state">
                            <h3>Booking Not Completed Yet</h3>
                            <p style="margin:12px 0">Booking <code>${esc(targetBooking.BookingID)}</code> is currently <b>${esc(targetBooking.status)}</b>. Reviews are permitted only after completion.</p>
                            <a class="btn btn-outline-dark" href="my-bookings.html">Back to Bookings</a>
                        </div>
                    `;
                }
                return;
            }

            // Populate provider details
            if ($("reviewProviderName")) $("reviewProviderName").textContent = targetBooking.providerName || ("Provider " + targetBooking.providerId);
            if ($("reviewProviderService")) $("reviewProviderService").textContent = `${targetBooking.service} · Booking ${targetBooking.BookingID}`;
            if ($("reviewPhoto")) $("reviewPhoto").textContent = initials(targetBooking.providerName || "Provider");

        } catch (err) {
            console.error("Review page load error:", err);
        }
    }

    async function submitReview(event) {
        event.preventDefault();
        const u = getUser();
        if (!u || u.role !== "customer") return;

        if (!targetBooking) {
            alert("No eligible completed booking selected.");
            return;
        }

        const ratingEl = document.querySelector('input[name="rating"]:checked');
        const rating = ratingEl ? ratingEl.value : null;
        const reviewText = $("reviewText") ? $("reviewText").value.trim() : "";

        if (!rating) {
            alert("Please choose a star rating.");
            return;
        }

        if (reviewText.length < 8) {
            alert("Please write at least 8 characters about your experience.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/reviews/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId: u.CustomerID,
                    providerId: targetBooking.providerId,
                    BookingID: targetBooking.BookingID,
                    rating: Number(rating),
                    comment: reviewText
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to submit review");

            alert("Thank you! Your review has been saved and the provider's rating has been updated.");
            window.location.href = "my-bookings.html";
        } catch (err) {
            alert("Review submission error: " + err.message);
        }
    }
    window.submitReview = submitReview;

    // ==========================================
    // DOMContentLoaded Router
    // ==========================================
    document.addEventListener("DOMContentLoaded", () => {
        const path = window.location.pathname.toLowerCase();

        if (path.endsWith("customer-dashboard.html")) {
            initCustomerDashboard();
        } else if (path.endsWith("booking-requests.html")) {
            initProviderRequests();
        } else if (path.endsWith("provider-booking-history.html")) {
            initProviderHistory();
        } else if (path.endsWith("review.html")) {
            initReviewPage();
        }
    });

})();
