/* Easy Hire — Main Frontend Integration Script (app.js)
   Connects to existing Express / MongoDB Atlas backend and Socket.IO
*/

(function () {
    // API Configuration
    const API_BASE = window.API_BASE_URL || (window.location.origin.includes(":500") ? window.location.origin : "http://localhost:500");
    window.API_BASE = API_BASE;

    // Helper functions
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Session Management (shared between app.js and script.js)
    function user() {
        try {
            return JSON.parse(localStorage.getItem("eh_user") || localStorage.getItem("easyHireCurrentUserV2")) || null;
        } catch (e) {
            return null;
        }
    }
    window.getCurrentUser = user;

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

    function out() {
        setUser(null);
        window.location.href = "login.html";
    }
    window.logout = out;

    function guard(role) {
        const u = user();
        if (!u) {
            const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
            window.location.href = "login.html?next=" + next;
            return null;
        }
        if (role && u.role !== role) {
            toast(`Access restricted: please sign in as a ${role}`);
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

    // UI Formatting helpers
    const Q = new URLSearchParams(window.location.search);
    const page = document.body.dataset.page;

    const init = (n) => String(n || "EH").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const hue = (n) => [...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const av = (n, c = "") => `<span class="av ${c}" style="--h:${hue(n)}">${init(n)}</span>`;
    const stars = (r) => {
        const num = Math.max(0, Math.min(5, Math.round(Number(r) || 0)));
        return "★".repeat(num) + "☆".repeat(5 - num);
    };

    function parseTimeStrToMinutes(tStr) {
        if (!tStr) return null;
        const clean = tStr.trim().toUpperCase();
        const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3];
        if (ampm === "PM" && hour < 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        return hour * 60 + minute;
    }

    function isProviderAvailableNow(provider, now = new Date()) {
        if (!provider) return false;
        // 1. Explicit manual toggle override
        if (provider.manualStatus === "Unavailable" || provider.isAvailable === false) {
            return false;
        }
        if (provider.manualStatus === "Available") {
            return true;
        }

        // 2. Working hours check
        const availStr = provider.availability;
        if (!availStr) return true;

        const parts = availStr.split("-");
        if (parts.length !== 2) return true;

        const startMins = parseTimeStrToMinutes(parts[0]);
        const endMins = parseTimeStrToMinutes(parts[1]);

        if (startMins === null || endMins === null) return true;

        const currentMins = now.getHours() * 60 + now.getMinutes();

        if (startMins <= endMins) {
            return currentMins >= startMins && currentMins <= endMins;
        } else {
            return currentMins >= startMins || currentMins <= endMins;
        }
    }
    window.isProviderAvailableNow = isProviderAvailableNow;

    const SV_ICONS = {
        "Plumbing": "⌁",
        "Electrical": "ϟ",
        "Home Cleaning": "✦",
        "AC Repair": "❄",
        "Appliance Repair": "⚙",
        "Painting": "◒",
        "Carpentry": "⌘",
        "Pest Control": "𖢥",
        "RO Service": "💧",
        "Computer Repair": "💻",
        "Tutor": "▤",
        "Mechanic": "⚙"
    };

    const m = (html) => {
        const main = $("#m");
        if (main) main.innerHTML = html;
    };

    // Navigation Shell
    function shell() {
        const u = user();
        const isProvider = u && u.role === "provider";
        const isCustomer = u && u.role === "customer";

        let navLinks = [];
        if (isProvider) {
            navLinks = [
                ["provider-dashboard.html", "Dashboard", "dash"],
                ["booking-requests.html", "Requests", "req"],
                ["provider-booking-history.html", "History", "hist"],
                ["provider-profile.html", "Profile", "profile"],
                ["messages.html", "Messages", "msg"]
            ];
        } else if (isCustomer) {
            navLinks = [
                ["customer-dashboard.html", "Discover", "cust-dash"],
                ["services.html", "Find a pro", "services"],
                ["my-bookings.html", "My bookings", "bookings"],
                ["messages.html", "Messages", "msg"]
            ];
        } else {
            navLinks = [
                ["services.html", "Find a pro", "services"]
            ];
        }

        const navHtml = navLinks.map(l => `<a class="${page === l[2] ? "on" : ""}" href="${l[0]}">${l[1]}</a>`).join("");
        const authHtml = u
            ? `<a href="#" onclick="window.logout(); return false;">Log out (${esc((u.name || "").split(" ")[0])})</a>`
            : `<a href="login.html">Sign in</a><a class="btn sm" href="register.html">Join</a>`;

        document.body.innerHTML = `
            <header class="top">
                <div class="in">
                    <a class="brand" href="index.html"><i>E</i>Easy Hire</a>
                    <nav>${navHtml}${u ? `<span style="opacity:0.3;margin:0 4px">|</span>` : ""}${authHtml}</nav>
                </div>
            </header>
            <main id="m"></main>
            <footer class="ft">
                <a href="index.html">Home</a>
                <a href="services.html">Find a pro</a>
                ${u ? (isProvider ? `<a href="provider-dashboard.html">Dashboard</a>` : `<a href="customer-dashboard.html">Discover</a>`) : `<a href="login.html">Sign in</a><a href="register.html">Register</a>`}
                <p style="margin-top:10px">© 2026 Easy Hire · Local skills, thoughtfully connected.</p>
            </footer>
        `;
    }

    // Provider Card Generator
    function card(p) {
        const u = user();
        const fullLocation = [p.doorNo, p.area, p.district, p.state].filter(Boolean).join(", ") || p.address;
        const customerArea = u ? (u.area || u.address || "") : "";
        const isInUserArea = u && customerArea && customerArea !== "N/A" && fullLocation.toLowerCase().includes(customerArea.toLowerCase());

        const rating = Number(p.rating || 0).toFixed(1);
        const servicesList = Array.isArray(p.services) ? p.services.join(", ") : (p.services || "General Service");
        const exp = p.experience ? `${p.experience} yrs exp` : "Experienced";
        const pid = esc(p.ProviderId);
        const isOnline = isProviderAvailableNow(p);

        return `
            <article class="card">
                <div class="ct">
                    ${av(p.name)}
                    <div>
                        <h3>${esc(p.name)}</h3>
                        <p>${esc(servicesList)}</p>
                    </div>
                </div>
                <div>
                    <b>★ ${rating}</b> <span class="st">${stars(rating)}</span>
                    <small>(${p.availability || "9 AM - 6 PM"})</small>
                </div>
                <div class="meta" style="flex-wrap:wrap">
                    <span style="font-weight:700;color:var(--ind);background:#e8ebff;border-radius:6px;padding:3px 8px" title="${esc(fullLocation)}">📍 ${esc(p.area || 'N/A')}, ${esc(p.district || 'N/A')}, ${esc(p.state || 'N/A')}</span>
                    ${isInUserArea ? `<span style="font-weight:700;color:var(--ok);background:#e6f5ef;border-radius:6px;padding:3px 8px">✓ In your area</span>` : ""}
                    <span>${exp}</span>
                    <span class="pill ${isOnline ? '' : 'off'}" style="${isOnline ? '' : 'background:#eee;color:#777'}">${isOnline ? "Available" : "Unavailable"}</span>
                </div>
                <p class="mute" style="margin:2px 0;font-size:0.83rem">
                    <strong>Address:</strong> ${esc(p.address || fullLocation || 'N/A')}${p.pincode ? ` | <strong>PIN:</strong> ${esc(p.pincode)}` : ''}
                </p>
                <div class="row">
                    <a class="btn ghost" href="provider-profile.html?id=${pid}">View Profile</a>
                    <a class="btn" href="booking.html?providerId=${pid}">Book Service</a>
                    <a class="btn sm ghost" href="messages.html?providerId=${pid}" title="Message">✉</a>
                </div>
            </article>
        `;
    }

    // Tab generator helper
    function tabsUI(list, cur, fn) {
        return `<div class="tabs">${list.map(t => `<button class="${t === cur ? "on" : ""}" onclick="${fn}('${t}')">${t}</button>`).join("")}</div>`;
    }

    // PAGE HANDLERS
    const PG = {
        // 1. Home / Index Page
        async home() {
            m(`
                <section class="hero">
                    <div>
                        <h1>Skilled help from people down the road.</h1>
                        <p class="lead">Plumbers, electricians, painters, and more. Verified local professionals, transparent ratings, direct chat, and real-time bookings.</p>
                        <form class="search" onsubmit="event.preventDefault(); window.location.href='services.html?search=' + encodeURIComponent(this.q.value)">
                            <input name="q" placeholder="Try “Plumbing” or “Electrical”" aria-label="Search services">
                            <button class="btn" type="submit">Search</button>
                        </form>
                        <div class="chips" id="homeChips">
                            <a href="services.html?search=Plumbing">⌁ Plumbing</a>
                            <a href="services.html?search=Electrical">ϟ Electrical</a>
                            <a href="services.html?search=Home Cleaning">✦ Cleaning</a>
                            <a href="services.html?search=Painting">◒ Painting</a>
                            <a href="services.html?search=AC Repair">❄ AC Repair</a>
                            <a href="services.html?search=Carpentry">⌘ Carpentry</a>
                        </div>
                    </div>
                    <aside class="slip" id="homeSlip">
                        <h3>Featured Pros Today</h3>
                        <div id="slipList"><p class="mute" style="color:#ffffff99">Loading available professionals...</p></div>
                    </aside>
                </section>
                <section class="sec">
                    <h2>Browse by trade</h2>
                    <div class="cats" id="homeCategories">
                        <a class="cat" href="services.html?search=Plumbing"><span class="sy">⌁</span><span><b>Plumbing</b><small>Pipe leaks & fittings</small></span></a>
                        <a class="cat" href="services.html?search=Electrical"><span class="sy">ϟ</span><span><b>Electrical</b><small>Wiring & repairs</small></span></a>
                        <a class="cat" href="services.html?search=Home Cleaning"><span class="sy">✦</span><span><b>Home Cleaning</b><small>Deep cleaning & sanitization</small></span></a>
                        <a class="cat" href="services.html?search=AC Repair"><span class="sy">❄</span><span><b>AC Repair</b><small>Cooling service & gas refill</small></span></a>
                        <a class="cat" href="services.html?search=Painting"><span class="sy">◒</span><span><b>Painting</b><small>Interior & exterior finishes</small></span></a>
                        <a class="cat" href="services.html?search=Carpentry"><span class="sy">⌘</span><span><b>Carpentry</b><small>Woodwork & custom cabinets</small></span></a>
                    </div>
                </section>
                <section class="sec">
                    <div class="sechead">
                        <h2>Top rated professionals</h2>
                        <a href="services.html"><b>See all professionals ↗</b></a>
                    </div>
                    <div class="grid" id="homeTopGrid"><div class="empty" style="grid-column:1/-1">Loading professionals from database...</div></div>
                </section>
                <section class="sec" id="how">
                    <h2>How it works</h2>
                    <ol class="steps">
                        <li><h3>Find</h3><p class="mute">Search by trade, service, or area, and check ratings and availability.</p></li>
                        <li><h3>Book</h3><p class="mute">Select your convenient date, time, and address. Your request is sent directly to the pro.</p></li>
                        <li><h3>Chat</h3><p class="mute">Coordinate details in real-time through direct chat for active bookings.</p></li>
                        <li><h3>Review</h3><p class="mute">After completion, submit your review and rating to help fellow neighbors choose.</p></li>
                    </ol>
                    <div class="cta">
                        <div>
                            <h2>Are you a skilled professional?</h2>
                            <p>Register your trade on Easy Hire and receive booking requests from nearby customers.</p>
                        </div>
                        <a class="btn" href="register.html?role=provider">Join as a professional</a>
                    </div>
                </section>
            `);

            try {
                const res = await fetch(`${API_BASE}/api/search/providers`);
                if (!res.ok) throw new Error("Could not load providers");
                const providers = await res.json();

                // Sort by rating descending
                const sorted = [...providers].sort((a, b) => (b.rating || 0) - (a.rating || 0));
                const top6 = sorted.slice(0, 6);
                const slipPros = sorted.slice(0, 4);

                // Populate Slip
                const slipContainer = $("#slipList");
                if (slipContainer) {
                    slipContainer.innerHTML = slipPros.map(p => `
                        <a href="provider-profile.html?id=${esc(p.ProviderId)}">
                            ${av(p.name)}
                            <span>${esc(p.name)}<small>${esc(Array.isArray(p.services) ? p.services[0] : p.services)} · ${esc(p.address || "Local")}</small></span>
                            <b>★ ${Number(p.rating || 0).toFixed(1)}</b>
                        </a>
                    `).join("");
                }

                // Populate Grid
                const gridContainer = $("#homeTopGrid");
                if (gridContainer) {
                    gridContainer.innerHTML = top6.length ? top6.map(card).join("") : `<div class="empty" style="grid-column:1/-1">No providers found in database.</div>`;
                }

            } catch (err) {
                console.error("Home load error:", err);
                const gridContainer = $("#homeTopGrid");
                if (gridContainer) gridContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">Unable to connect to backend: ${esc(err.message)}</div>`;
            }
        },

        // 2. Strict Location-Based Provider Search
        async services() {
            const initialQuery = Q.get("search") || Q.get("q") || "";
            const initialArea = Q.get("area") || "";
            const initialDistrict = Q.get("district") || "";
            const initialState = Q.get("state") || "";
            const initialSkill = Q.get("skill") || Q.get("service") || "";

            m(`
                <div class="pagehead">
                    <h1>Find a professional</h1>
                    <p>Search verified local tradespeople matching your exact location.</p>
                </div>

                <!-- Strict Location and Skill Search Section -->
                <section class="location-search-panel" style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px 24px;margin-bottom:24px;box-shadow:0 4px 14px rgba(0,0,0,0.03)">
                    <div style="margin-bottom:16px">
                        <span class="eyebrow" style="font-size:0.75rem;font-weight:800;color:var(--ind);letter-spacing:1px;display:block;margin-bottom:4px">STRICT LOCATION SEARCH</span>
                        <h2 style="font-size:1.35rem;margin:0">Search by Location & Service</h2>
                        <p class="mute" style="margin:4px 0 0;font-size:0.88rem">Select any combination of State, District, Area, and Skill. Only providers matching every specified location field will be displayed.</p>
                    </div>

                    <form id="locationSearchForm" onsubmit="window.handleLocationSearch(event)">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
                            <div>
                                <label for="searchState" style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px">State</label>
                                <input id="searchState" list="stateOptions" placeholder="e.g. Andhra Pradesh" value="${esc(initialState)}" autocomplete="off" oninput="window.onStateInputChange(this.value)">
                                <datalist id="stateOptions"></datalist>
                            </div>
                            <div>
                                <label for="searchDistrict" style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px">District</label>
                                <input id="searchDistrict" list="districtOptions" placeholder="e.g. Chittoor" value="${esc(initialDistrict)}" autocomplete="off" oninput="window.onDistrictInputChange(this.value)">
                                <datalist id="districtOptions"></datalist>
                            </div>
                            <div>
                                <label for="searchArea" style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px">Area / Locality</label>
                                <input id="searchArea" list="areaOptions" placeholder="e.g. Tirupati or Kompally" value="${esc(initialArea)}" autocomplete="off">
                                <datalist id="areaOptions"></datalist>
                            </div>
                            <div>
                                <label for="searchSkill" style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px">Service / Skill</label>
                                <input id="searchSkill" list="skillOptions" placeholder="e.g. Plumber or Electrician" value="${esc(initialSkill || initialQuery)}" autocomplete="off">
                                <datalist id="skillOptions">
                                    <option value="Plumbing">
                                    <option value="Plumber">
                                    <option value="Electrical">
                                    <option value="Electrician">
                                    <option value="Home Cleaning">
                                    <option value="AC Repair">
                                    <option value="Appliance Repair">
                                    <option value="Painting">
                                    <option value="Painter">
                                    <option value="Carpentry">
                                    <option value="Carpenter">
                                    <option value="Pest Control">
                                    <option value="RO Service">
                                    <option value="Computer Repair">
                                </datalist>
                            </div>
                        </div>

                        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                            <button type="submit" class="btn" id="btnSearchLocation" style="padding:10px 24px">Search</button>
                            <button type="button" class="btn ghost" id="btnClearFilters" onclick="window.clearLocationFilters()" style="padding:10px 20px">Clear Filters</button>

                            <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
                                <label for="sortResults" style="margin:0;font-size:0.85rem;color:var(--mute)">Sort by:</label>
                                <select id="sortResults" style="width:auto;padding:8px 14px;border-radius:10px" onchange="window.sortCurrentProviders()">
                                    <option value="rating">Top rated</option>
                                    <option value="experience">Most experienced</option>
                                    <option value="name">Name (A-Z)</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </section>

                <p class="mute" id="cn" style="margin-bottom:16px">Loading service providers...</p>
                <div class="grid" id="res"><div class="empty" style="grid-column:1/-1">Loading from database...</div></div>
            `);

            let currentProviders = [];
            let locationData = {};

            const updateDatalists = (selectedState = "", selectedDistrict = "") => {
                const stateDatalist = $("#stateOptions");
                const districtDatalist = $("#districtOptions");
                const areaDatalist = $("#areaOptions");

                if (stateDatalist) {
                    const states = Object.keys(locationData).sort();
                    stateDatalist.innerHTML = states.map(s => `<option value="${esc(s)}">`).join("");
                }

                if (districtDatalist) {
                    let districts = [];
                    const st = selectedState.trim();
                    if (st && locationData[st]) {
                        districts = Object.keys(locationData[st]).sort();
                    } else {
                        const dSet = new Set();
                        Object.values(locationData).forEach(stObj => {
                            Object.keys(stObj).forEach(d => dSet.add(d));
                        });
                        districts = Array.from(dSet).sort();
                    }
                    districtDatalist.innerHTML = districts.map(d => `<option value="${esc(d)}">`).join("");
                }

                if (areaDatalist) {
                    let areas = [];
                    const st = selectedState.trim();
                    const dt = selectedDistrict.trim();

                    if (st && dt && locationData[st]?.[dt]) {
                        areas = locationData[st][dt].sort();
                    } else if (dt) {
                        const aSet = new Set();
                        Object.values(locationData).forEach(stObj => {
                            if (stObj[dt]) stObj[dt].forEach(a => aSet.add(a));
                        });
                        areas = Array.from(aSet).sort();
                    } else if (st && locationData[st]) {
                        const aSet = new Set();
                        Object.values(locationData[st]).forEach(arr => arr.forEach(a => aSet.add(a)));
                        areas = Array.from(aSet).sort();
                    } else {
                        const aSet = new Set();
                        Object.values(locationData).forEach(stObj => {
                            Object.values(stObj).forEach(arr => arr.forEach(a => aSet.add(a)));
                        });
                        areas = Array.from(aSet).sort();
                    }
                    areaDatalist.innerHTML = areas.map(a => `<option value="${esc(a)}">`).join("");
                }
            };

            window.onStateInputChange = (val) => {
                const distInput = $("#searchDistrict");
                updateDatalists(val, distInput ? distInput.value : "");
            };

            window.onDistrictInputChange = (val) => {
                const stateInput = $("#searchState");
                updateDatalists(stateInput ? stateInput.value : "", val);
            };

            const executeSearch = async () => {
                const state = ($("#searchState")?.value || "").trim();
                const district = ($("#searchDistrict")?.value || "").trim();
                const area = ($("#searchArea")?.value || "").trim();
                const skill = ($("#searchSkill")?.value || "").trim();
                const isLocationSearch = Boolean(state || district || area);

                const resContainer = $("#res");
                const countContainer = $("#cn");

                if (resContainer) {
                    resContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">Searching matching professionals from database...</div>`;
                }
                if (countContainer) {
                    countContainer.textContent = "Searching database...";
                }

                const params = new URLSearchParams();
                if (state) params.set("state", state);
                if (district) params.set("district", district);
                if (area) params.set("area", area);
                if (skill) params.set("skill", skill);

                try {
                    const res = await fetch(`${API_BASE}/api/search/providers?${params.toString()}`);
                    if (!res.ok) throw new Error("Search failed with status " + res.status);
                    currentProviders = await res.json();

                    window.sortCurrentProviders(false);

                    if (currentProviders.length === 0) {
                        if (isLocationSearch) {
                            resContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">No service providers found in the selected location.</div>`;
                            countContainer.textContent = "0 service providers found in the selected location.";
                        } else {
                            resContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">No service providers found matching your search criteria.</div>`;
                            countContainer.textContent = "0 service providers found.";
                        }
                    } else {
                        resContainer.innerHTML = currentProviders.map(card).join("");
                        const locLabels = [area, district, state].filter(Boolean).join(", ");
                        countContainer.innerHTML = `Found <b>${currentProviders.length}</b> service provider${currentProviders.length === 1 ? '' : 's'}${locLabels ? ` matching <b>${esc(locLabels)}</b>` : ""}${skill ? ` for <b>${esc(skill)}</b>` : ""}.`;
                    }
                } catch (err) {
                    console.error("Search error:", err);
                    if (resContainer) {
                        resContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">Failed to load service providers: ${esc(err.message)}</div>`;
                    }
                    if (countContainer) countContainer.textContent = "Connection error";
                }
            };

            window.handleLocationSearch = (event) => {
                if (event) event.preventDefault();
                executeSearch();
            };

            window.sortCurrentProviders = (reRender = true) => {
                const sortVal = $("#sortResults")?.value || "rating";
                if (sortVal === "rating") {
                    currentProviders.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                } else if (sortVal === "experience") {
                    currentProviders.sort((a, b) => (Number(b.experience) || 0) - (Number(a.experience) || 0));
                } else if (sortVal === "name") {
                    currentProviders.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                }
                if (reRender && currentProviders.length > 0) {
                    const resContainer = $("#res");
                    if (resContainer) resContainer.innerHTML = currentProviders.map(card).join("");
                }
            };

            window.clearLocationFilters = () => {
                if ($("#searchState")) $("#searchState").value = "";
                if ($("#searchDistrict")) $("#searchDistrict").value = "";
                if ($("#searchArea")) $("#searchArea").value = "";
                if ($("#searchSkill")) $("#searchSkill").value = "";
                updateDatalists("", "");
                executeSearch();
            };

            // Fetch locations hierarchy and execute initial search
            try {
                const locRes = await fetch(`${API_BASE}/api/search/locations`);
                if (locRes.ok) {
                    locationData = await locRes.json();
                    updateDatalists(initialState, initialDistrict);
                }
            } catch (e) {
                console.error("Locations hierarchy fetch error:", e);
            }

            executeSearch();
        },

        // 3. Provider Profile Page
        async profile() {
            const u = user();
            const providerId = Q.get("id") || Q.get("providerId") || (u && u.role === "provider" ? u.ProviderId : "P001");

            m(`<p class="mute" style="padding:40px 0">Loading provider profile...</p>`);

            try {
                const res = await fetch(`${API_BASE}/api/providers/profile/${encodeURIComponent(providerId)}`);
                if (!res.ok) throw new Error("Provider profile not found");
                const provider = await res.json();

                // Fetch reviews for this provider
                let reviews = [];
                try {
                    const rRes = await fetch(`${API_BASE}/api/reviews/${encodeURIComponent(providerId)}`);
                    if (rRes.ok) reviews = await rRes.json();
                } catch (e) {
                    console.log("No reviews yet");
                }

                const isOwner = u && u.role === "provider" && u.ProviderId === provider.ProviderId;
                const servicesList = Array.isArray(provider.services) ? provider.services : [provider.services || "General"];
                const rating = Number(provider.rating || 0).toFixed(1);

                if (isOwner) {
                    // Editable Profile Form for the Provider
                    m(`
                        <div class="pagehead">
                            <a class="back" href="provider-dashboard.html">← Back to Dashboard</a>
                            <h1>Your Professional Profile</h1>
                            <p>Update your trade details, experience, and availability. Changes are saved to MongoDB.</p>
                        </div>
                        <div class="two">
                            <form class="form" id="editProfileForm" style="margin:0" onsubmit="window.saveProviderProfile(event, '${esc(provider.ProviderId)}')">
                                <label for="pfName">Full Name</label>
                                <input id="pfName" value="${esc(provider.name)}" required>

                                <label for="pfMobile">Mobile Number</label>
                                <input id="pfMobile" value="${esc(provider.mobile || '')}" required>

                                <label for="pfDoorNo">Door / Plot / Workshop No</label>
                                <input id="pfDoorNo" value="${esc(provider.doorNo || '')}" placeholder="e.g. H.No 12-4/A, Plot 3">

                                <div class="c3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                                    <div>
                                        <label for="pfState">State *</label>
                                        <input id="pfState" list="pfStateList" value="${esc(provider.state || '')}" placeholder="State" required>
                                        <datalist id="pfStateList">
                                            <option value="Telangana">
                                            <option value="Andhra Pradesh">
                                            <option value="Karnataka">
                                            <option value="Tamil Nadu">
                                            <option value="Maharashtra">
                                        </datalist>
                                    </div>
                                    <div>
                                        <label for="pfDistrict">District *</label>
                                        <input id="pfDistrict" value="${esc(provider.district || '')}" placeholder="District" required>
                                    </div>
                                    <div>
                                        <label for="pfArea">Area / Locality *</label>
                                        <input id="pfArea" value="${esc(provider.area || '')}" placeholder="Area / Locality" required>
                                    </div>
                                </div>

                                <div class="c2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                                    <div>
                                        <label for="pfPincode">PIN Code (optional)</label>
                                        <input id="pfPincode" value="${esc(provider.pincode || provider.pinCode || '')}" placeholder="e.g. 500001">
                                    </div>
                                    <div>
                                        <label for="pfAddress">Complete Address (optional)</label>
                                        <input id="pfAddress" value="${esc(provider.address || '')}" placeholder="Complete Street Address">
                                    </div>
                                </div>

                                <label for="pfServices">Services (comma separated)</label>
                                <input id="pfServices" value="${esc(servicesList.join(', '))}" required placeholder="Plumbing, Electrical, AC Repair">

                                <div class="c2">
                                    <div>
                                        <label for="pfExp">Experience (years)</label>
                                        <input id="pfExp" type="number" min="0" max="60" value="${esc(provider.experience || 1)}" required>
                                    </div>
                                    <div>
                                        <label for="pfAvail">Working Hours</label>
                                        <input id="pfAvail" value="${esc(provider.availability || '9 AM - 6 PM')}" required>
                                    </div>
                                </div>

                                <label for="pfManualStatus" style="margin-top:10px">Online / Availability Status</label>
                                <select id="pfManualStatus" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:0.95rem;margin-bottom:14px">
                                    <option value="Auto" ${(provider.manualStatus === 'Auto' || !provider.manualStatus) ? 'selected' : ''}>Auto (Follows working hours: ${esc(provider.availability || '9 AM - 6 PM')})</option>
                                    <option value="Available" ${provider.manualStatus === 'Available' ? 'selected' : ''}>Available (Accepting bookings now)</option>
                                    <option value="Unavailable" ${provider.manualStatus === 'Unavailable' ? 'selected' : ''}>Unavailable / On Break (Do not show as available)</option>
                                </select>

                                <button class="btn" style="width:100%;margin-top:10px" type="submit">Save Changes to Database</button>
                            </form>

                            <div class="panel">
                                <h2>Customer Reviews (${reviews.length})</h2>
                                <div class="rt" style="margin-bottom:14px">
                                    <b>★ ${rating}</b> <span class="st">${stars(rating)}</span> average rating
                                </div>
                                <div id="profReviews">
                                    ${reviews.length ? reviews.map(r => `
                                        <div class="rev">
                                            <b>${esc(r.customerName || r.customerId || 'Verified Customer')}</b> <span class="st">${stars(r.rating)}</span>
                                            <small style="display:block;color:var(--mute)">Date: ${esc(r.date || '')} · Booking ${esc(r.BookingID || '')}</small>
                                            <p style="margin-top:6px">${esc(r.comment)}</p>
                                        </div>
                                    `).join("") : `<p class="mute">No reviews recorded in database yet.</p>`}
                                </div>
                            </div>
                        </div>
                    `);

                    window.saveProviderProfile = async (event, pid) => {
                        event.preventDefault();
                        const name = $("#pfName").value.trim();
                        const mobile = $("#pfMobile").value.trim();
                        const doorNo = ($("#pfDoorNo")?.value || "").trim();
                        const state = ($("#pfState")?.value || "").trim();
                        const district = ($("#pfDistrict")?.value || "").trim();
                        const area = ($("#pfArea")?.value || "").trim();
                        const pincode = ($("#pfPincode")?.value || "").trim();
                        const customAddress = ($("#pfAddress")?.value || "").trim();
                        const address = customAddress || [doorNo, area, district, state, pincode].filter(Boolean).join(", ");
                        const servicesInput = $("#pfServices").value.trim();
                        const experience = Number($("#pfExp").value) || 1;
                        const availability = $("#pfAvail").value.trim();
                        const manualStatus = ($("#pfManualStatus")?.value || "Auto");

                        if (!state || !district || !area) {
                            alert("State, District, and Area/Locality are required location fields.");
                            return;
                        }

                        const services = servicesInput.split(",").map(s => s.trim()).filter(Boolean);

                        try {
                            const putRes = await fetch(`${API_BASE}/api/providers/profile/${encodeURIComponent(pid)}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    name, mobile, doorNo, area, district, state, pincode, address,
                                    services, experience, availability, manualStatus,
                                    isAvailable: manualStatus !== "Unavailable"
                                })
                            });

                            const data = await putRes.json();
                            if (!putRes.ok) throw new Error(data.message || "Failed to update profile");

                            // Update session
                            const updatedUser = { ...u, ...data.provider };
                            setUser(updatedUser);
                            toast("Profile updated successfully!");
                            setTimeout(() => { PG.profile(); }, 800);
                        } catch (err) {
                            alert("Profile update error: " + err.message);
                        }
                    };

                } else {
                    // Public View of Provider
                    const isOnline = isProviderAvailableNow(provider);
                    const fullLoc = [provider.doorNo, provider.area, provider.district, provider.state].filter(Boolean).join(", ") || provider.address || "Local Area";
                    m(`
                        <a class="back" href="services.html">← Back to All Professionals</a>
                        <section class="prof">
                            <div class="pa">${av(provider.name, "xl")}</div>
                            <div>
                                <span class="pill ${isOnline ? '' : 'off'}" style="${isOnline ? '' : 'background:#eee;color:#777'}">${isOnline ? "● Available for requests" : "○ Currently Unavailable"}</span>
                                <h1 style="margin-top:8px">${esc(provider.name)}</h1>
                                <p class="lead" style="margin:6px 0">${esc(servicesList.join(" · "))} · <b style="color:var(--ind)">📍 ${esc(provider.area || '')}, ${esc(provider.district || '')}, ${esc(provider.state || '')}</b></p>
                                <div class="rt">
                                    <b>★ ${rating}</b> <span class="st">${stars(rating)}</span>
                                    <small>(${reviews.length} reviews)</small>
                                </div>
                                <p>${provider.experience ? provider.experience + " years of verified experience" : "Professional service provider"}. Working hours: ${esc(provider.availability || "9 AM - 6 PM")}. Contact: ${esc(provider.mobile || "Available on booking")}.</p>
                                <p class="mute"><b>Location:</b> ${esc(fullLoc)}${provider.pincode ? ` | PIN: ${esc(provider.pincode)}` : ''}</p>
                                <div class="row">
                                    <a class="btn" href="booking.html?providerId=${esc(provider.ProviderId)}">Book Service</a>
                                    <a class="btn ghost" href="messages.html?providerId=${esc(provider.ProviderId)}">Message ${esc(provider.name.split(" ")[0])}</a>
                                </div>
                            </div>
                        </section>
                        <section class="two">
                            <div class="panel">
                                <h2>Offered Services</h2>
                                <div class="tags">
                                    ${servicesList.map(s => `<span>${esc(s)}</span>`).join("")}
                                </div>
                                <h3 style="margin-top:16px">Area Coverage</h3>
                                <p class="mute">${esc(provider.address || "Serving your local district and surrounding locations.")}</p>
                            </div>
                            <div class="panel" id="review">
                                <h2>Customer Reviews (${reviews.length})</h2>
                                ${reviews.length ? reviews.map(r => `
                                    <div class="rev">
                                        <b>${esc(r.customerName || r.customerId || "Verified Customer")}</b> <span class="st">${stars(r.rating)}</span>
                                        <small style="display:block;color:var(--mute)">Date: ${esc(r.date || "Recent")}</small>
                                        <p style="margin-top:6px">${esc(r.comment)}</p>
                                    </div>
                                `).join("") : `<p class="mute">No reviews yet for this provider. Be the first to book and leave a review!</p>`}
                            </div>
                        </section>
                    `);
                }

            } catch (err) {
                console.error("Profile load error:", err);
                m(`<div class="empty">Provider not found: ${esc(err.message)}. <a href="services.html">Browse all providers</a></div>`);
            }
        },

        // 4. Booking Creation Page
        async booking() {
            const u = guard("customer");
            if (!u) return;

            const providerId = Q.get("providerId") || Q.get("id");
            if (!providerId) {
                m(`<div class="empty">Please select a provider to book. <a href="services.html">Browse all providers ↗</a></div>`);
                return;
            }

            m(`<p class="mute" style="padding:40px 0">Loading booking request form...</p>`);

            try {
                const res = await fetch(`${API_BASE}/api/providers/profile/${encodeURIComponent(providerId)}`);
                if (!res.ok) throw new Error("Provider not found");
                const provider = await res.json();

                const today = new Date().toISOString().slice(0, 10);
                const servicesList = Array.isArray(provider.services) ? provider.services : [provider.services || "General Service"];

                m(`
                    <a class="back" href="provider-profile.html?id=${esc(provider.ProviderId)}">← Back to provider profile</a>
                    <form class="form" id="bookingForm" onsubmit="window.createBooking(event, '${esc(provider.ProviderId)}')">
                        <div class="ct">
                            ${av(provider.name)}
                            <div>
                                <h2>Book ${esc(provider.name)}</h2>
                                <p>${esc(servicesList.join(", "))} · ${esc(provider.address || "Local area")}</p>
                            </div>
                        </div>

                        <div id="bookingAlert" style="margin-top:14px"></div>

                        <label for="sv">Service needed</label>
                        <select id="sv" required>
                            ${servicesList.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
                        </select>

                        <div class="c2">
                            <div>
                                <label for="dt">Date</label>
                                <input id="dt" type="date" min="${today}" required>
                            </div>
                            <div>
                                <label for="tm">Time</label>
                                <input id="tm" type="time" required>
                            </div>
                        </div>

                        <label for="ad">Complete Service Address</label>
                        <textarea id="ad" rows="2" required placeholder="Door/Flat No, Area, District, State">${esc(u.address !== "N/A" ? u.address : [u.doorNo, u.area, u.district, u.state].filter(Boolean).join(", "))}</textarea>

                        <button class="btn" style="margin-top:20px;width:100%" type="submit">Submit Booking Request</button>
                        <p class="mute" style="margin-top:10px;text-align:center">The request will be sent to ${esc(provider.name)}. You will see updates on your bookings dashboard.</p>
                    </form>
                `);

                window.createBooking = async (event, pid) => {
                    event.preventDefault();
                    const service = $("#sv").value;
                    const date = $("#dt").value;
                    const time = $("#tm").value;
                    const address = $("#ad").value.trim();

                    const alertBox = $("#bookingAlert");
                    alertBox.innerHTML = "";

                    try {
                        const postRes = await fetch(`${API_BASE}/api/bookings/create`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                customerId: u.CustomerID,
                                providerId: pid,
                                service,
                                date,
                                time,
                                address,
                                doorNo: u.doorNo || "",
                                area: u.area || "",
                                district: u.district || "",
                                state: u.state || ""
                            })
                        });

                        const data = await postRes.json();
                        if (!postRes.ok) throw new Error(data.message || "Failed to create booking");

                        toast("Booking request sent successfully!");
                        setTimeout(() => {
                            window.location.href = "my-bookings.html";
                        }, 1000);
                    } catch (err) {
                        alertBox.innerHTML = `<div class="pill s-Rejected" style="display:block;padding:8px 12px;margin-bottom:10px">${esc(err.message)}</div>`;
                    }
                };

            } catch (err) {
                console.error("Booking load error:", err);
                m(`<div class="empty">Unable to load booking details: ${esc(err.message)}. <a href="services.html">Browse all providers</a></div>`);
            }
        },

        // 5. Customer Bookings Page
        async bookings() {
            const u = guard("customer");
            if (!u) return;

            window.bf = window.bf || "All";
            m(`<p class="mute" style="padding:40px 0">Loading your bookings from database...</p>`);

            try {
                const res = await fetch(`${API_BASE}/api/bookings?customerId=${encodeURIComponent(u.CustomerID)}`);
                if (!res.ok) throw new Error("Could not load bookings");
                const all = await res.json();

                const count = (status) => all.filter(b => b.status === status).length;
                const filtered = window.bf === "All" ? all : all.filter(b => b.status === window.bf);

                const renderBookingItem = (b) => {
                    let actions = "";
                    if (b.status === "Pending") {
                        actions = `<button class="btn sm red" onclick="window.cancelCustomerBooking('${esc(b.BookingID)}')">Cancel request</button>`;
                    } else if (b.status === "Completed") {
                        actions = `<a class="btn sm" href="review.html?bookingId=${esc(b.BookingID)}&providerId=${esc(b.providerId)}">Leave a review ↗</a>`;
                    }

                    return `
                        <article class="bk">
                            <div class="ct">
                                ${av(b.providerName || "Provider")}
                                <div>
                                    <h3>${esc(b.providerName || ("Provider " + b.providerId))}</h3>
                                    <p>${esc(b.service)} · ${esc(b.date)} at ${esc(b.time)}</p>
                                </div>
                                <span class="pill s-${b.status}">${esc(b.status)}</span>
                            </div>
                            <p class="mute"><strong>Address:</strong> ${esc(b.customerAddress || "N/A")} | <strong>Mobile:</strong> ${esc(b.providerMobile || "N/A")}</p>
                            <p class="mute">Booking ID: <code>${esc(b.BookingID)}</code></p>
                            <div class="row">
                                ${actions}
                                <a class="btn sm ghost" href="messages.html?bookingId=${esc(b.BookingID)}">Message Pro</a>
                            </div>
                        </article>
                    `;
                };

                m(`
                    <div class="pagehead">
                        <h1>My bookings</h1>
                        <p>Track your service requests from pending to completion.</p>
                    </div>
                    <div class="stats">
                        <div>All<b>${all.length}</b></div>
                        <div>Pending<b>${count("Pending")}</b></div>
                        <div>Accepted<b>${count("Accepted")}</b></div>
                        <div>Completed<b>${count("Completed")}</b></div>
                    </div>
                    ${tabsUI(["All", "Pending", "Accepted", "Completed", "Cancelled"], window.bf, "window.filterBookings")}
                    <div class="list">
                        ${filtered.length ? filtered.map(renderBookingItem).join("") : `<div class="empty">No bookings found in this status category. <a href="services.html"><b>Find a professional</b></a> to make a booking.</div>`}
                    </div>
                `);

                window.filterBookings = (tab) => {
                    window.bf = tab;
                    PG.bookings();
                };

                window.cancelCustomerBooking = async (bid) => {
                    if (!confirm("Are you sure you want to cancel this booking request?")) return;
                    try {
                        const cRes = await fetch(`${API_BASE}/api/bookings/cancel/${encodeURIComponent(bid)}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customerId: u.CustomerID })
                        });
                        const data = await cRes.json();
                        if (!cRes.ok) throw new Error(data.message || "Failed to cancel booking");
                        toast("Booking cancelled");
                        PG.bookings();
                    } catch (err) {
                        alert("Cancellation error: " + err.message);
                    }
                };

            } catch (err) {
                console.error("Bookings load error:", err);
                m(`<div class="empty">Error loading your bookings: ${esc(err.message)}</div>`);
            }
        },

        // 6. Provider Dashboard Page
        async dash() {
            const u = guard("provider");
            if (!u) return;

            window.pt = window.pt || "Pending";
            m(`<p class="mute" style="padding:40px 0">Loading professional dashboard from database...</p>`);

            try {
                // Fetch latest provider profile and bookings in parallel
                const [pRes, bRes] = await Promise.all([
                    fetch(`${API_BASE}/api/providers/profile/${encodeURIComponent(u.ProviderId)}`),
                    fetch(`${API_BASE}/api/bookings?providerId=${encodeURIComponent(u.ProviderId)}`)
                ]);

                const provider = pRes.ok ? await pRes.json() : u;
                const all = bRes.ok ? await bRes.json() : [];

                const count = (status) => all.filter(b => b.status === status).length;
                const filtered = window.pt === "All" ? all : all.filter(b => b.status === window.pt);

                const rating = Number(provider.rating || 0).toFixed(1);
                const servicesStr = Array.isArray(provider.services) ? provider.services.join(", ") : (provider.services || "General");
                const isOnline = isProviderAvailableNow(provider);
                const statusMode = provider.manualStatus === "Available"
                    ? "Manually Set: Available"
                    : (provider.manualStatus === "Unavailable"
                        ? "Manually Set: Unavailable"
                        : `Auto Schedule (${provider.availability || "9 AM - 6 PM"})`);

                m(`
                    <div class="pagehead">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
                            <div>
                                <h1>Welcome, ${esc(provider.name)}</h1>
                                <p>${esc(servicesStr)} · ${esc(provider.address || "Local Area")} · Provider ID: <b>${esc(provider.ProviderId)}</b></p>
                            </div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap">
                                <a class="btn sm ghost" href="booking-requests.html">All Requests</a>
                                <a class="btn sm ghost" href="provider-booking-history.html">History</a>
                                <a class="btn sm" href="provider-profile.html">Edit Profile</a>
                            </div>
                        </div>
                    </div>

                    <div class="status-banner" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#fff;border-radius:12px;border:1px solid var(--line);margin:14px 0 20px;box-shadow:0 2px 6px rgba(0,0,0,0.02);flex-wrap:wrap;gap:12px">
                        <div style="display:flex;align-items:center;gap:12px">
                            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${isOnline ? 'var(--ok)' : '#888'}"></span>
                            <div>
                                <div style="display:flex;align-items:center;gap:8px">
                                    <strong style="font-size:1rem;color:${isOnline ? 'var(--ok)' : '#555'}">
                                        Availability: ${isOnline ? 'Available for Requests' : 'Currently Unavailable'}
                                    </strong>
                                    <span class="pill ${isOnline ? '' : 'off'}" style="${isOnline ? '' : 'background:#eee;color:#777'}">${esc(statusMode)}</span>
                                </div>
                                <p class="mute" style="margin:2px 0 0;font-size:0.83rem">
                                    ${isOnline
                                        ? 'You are active and visible as available to customers right now.'
                                        : 'Current time is outside your working hours or you are paused. Customers see you as unavailable.'}
                                </p>
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center">
                            ${isOnline ? `
                                <button class="btn sm ghost" style="color:var(--bad);border-color:#f5c6cb" onclick="window.toggleProviderStatus('Unavailable')">Switch to Unavailable ⚪</button>
                            ` : `
                                <button class="btn sm" style="background:var(--ok);border-color:var(--ok);color:#fff" onclick="window.toggleProviderStatus('Available')">Switch to Available 🟢</button>
                            `}
                            ${provider.manualStatus && provider.manualStatus !== 'Auto' ? `
                                <button class="btn sm ghost" onclick="window.toggleProviderStatus('Auto')" title="Revert to scheduled working hours">Reset to Auto</button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="stats">
                        <div>New requests<b>${count("Pending")}</b></div>
                        <div>Accepted<b>${count("Accepted")}</b></div>
                        <div>Completed<b>${count("Completed")}</b></div>
                        <div>Rating<b>★ ${rating}</b></div>
                    </div>

                    ${tabsUI(["Pending", "Accepted", "Completed", "Cancelled", "All"], window.pt, "window.filterProviderDash")}

                    <div class="list">
                        ${filtered.length ? filtered.map(b => `
                            <article class="bk">
                                <div class="ct">
                                    ${av(b.customerName || "Customer")}
                                    <div>
                                        <h3>${esc(b.customerName || ("Customer " + b.customerId))} · ${esc(b.service)}</h3>
                                        <p>Date: ${esc(b.date)} at ${esc(b.time)} | Phone: ${esc(b.customerMobile || "N/A")}</p>
                                    </div>
                                    <span class="pill s-${b.status}">${esc(b.status)}</span>
                                </div>
                                <p class="mute"><strong>Address:</strong> ${esc(b.customerAddress || "N/A")}</p>
                                <p class="mute">Booking ID: <code>${esc(b.BookingID)}</code></p>
                                <div class="row">
                                    ${b.status === "Pending" ? `
                                        <button class="btn sm" onclick="window.providerAction('${esc(b.BookingID)}', 'accept')">Accept Request</button>
                                        <button class="btn sm red" onclick="window.providerAction('${esc(b.BookingID)}', 'cancel')">Decline</button>
                                    ` : ""}
                                    ${b.status === "Accepted" ? `
                                        <button class="btn sm" onclick="window.providerAction('${esc(b.BookingID)}', 'complete')">Mark as Completed</button>
                                    ` : ""}
                                    <a class="btn sm ghost" href="messages.html?bookingId=${esc(b.BookingID)}">Open Chat</a>
                                </div>
                            </article>
                        `).join("") : `<div class="empty">No requests found in this category.</div>`}
                    </div>
                `);

                window.filterProviderDash = (tab) => {
                    window.pt = tab;
                    PG.dash();
                };

                window.toggleProviderStatus = async (newStatus) => {
                    try {
                        const res = await fetch(`${API_BASE}/api/providers/status/${encodeURIComponent(u.ProviderId)}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ manualStatus: newStatus })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || "Failed to update status");

                        const updatedUser = { ...u, manualStatus: data.manualStatus, isAvailable: data.isAvailable };
                        setUser(updatedUser);
                        toast(`Availability set to ${data.manualStatus}!`);
                        PG.dash();
                    } catch (err) {
                        alert("Status update error: " + err.message);
                    }
                };

                window.providerAction = async (bid, act) => {
                    try {
                        const url = `${API_BASE}/api/bookings/${act}/${encodeURIComponent(bid)}`;
                        const res = await fetch(url, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ providerId: u.ProviderId })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || "Action failed");
                        toast(`Booking ${act}ed successfully!`);
                        PG.dash();
                    } catch (err) {
                        alert("Error: " + err.message);
                    }
                };

            } catch (err) {
                console.error("Provider dash error:", err);
                m(`<div class="empty">Error loading provider dashboard: ${esc(err.message)}</div>`);
            }
        },

        // 7. Real-Time Messages Page (Socket.IO + MongoDB)
        async msg() {
            const u = guard();
            if (!u) return;

            const isCustomer = u.role === "customer";
            const targetBookingId = Q.get("bookingId");
            const targetProviderId = Q.get("providerId");

            m(`<p class="mute" style="padding:40px 0">Loading conversations from database...</p>`);

            try {
                const bookUrl = isCustomer
                    ? `${API_BASE}/api/bookings?customerId=${encodeURIComponent(u.CustomerID)}`
                    : `${API_BASE}/api/bookings?providerId=${encodeURIComponent(u.ProviderId)}`;

                const res = await fetch(bookUrl);
                if (!res.ok) throw new Error("Could not load your bookings");
                const bookings = await res.json();

                if (!bookings.length) {
                    m(`
                        <div class="pagehead">
                            <h1>Messages</h1>
                            <p>Direct live chat with your service counterpart.</p>
                        </div>
                        <div class="empty">
                            You don't have any bookings yet. Chat is opened automatically once a booking is created.
                            <br><br>
                            ${isCustomer ? `<a class="btn" href="services.html">Find a professional & book</a>` : `<a class="btn" href="provider-dashboard.html">Go to dashboard</a>`}
                        </div>
                    `);
                    return;
                }

                // Choose active booking
                let activeBooking = null;
                if (targetBookingId) {
                    activeBooking = bookings.find(b => b.BookingID === targetBookingId);
                } else if (targetProviderId) {
                    activeBooking = bookings.find(b => b.providerId === targetProviderId);
                }
                if (!activeBooking) activeBooking = bookings[0];

                m(`
                    <div class="pagehead">
                        <h1>Messages</h1>
                        <p>Live chat for active bookings powered by Socket.IO & MongoDB.</p>
                    </div>
                    <div class="chat">
                        <aside>
                            <input id="cs" placeholder="Filter conversations..." aria-label="Search conversation">
                            <div id="cl"></div>
                        </aside>
                        <section>
                            <header id="ch"></header>
                            <div class="msgs" id="cm" aria-live="polite"></div>
                            <form id="cf">
                                <input id="ci" placeholder="Write a message…" maxlength="1000" autocomplete="off" aria-label="Message">
                                <button class="btn" type="submit">Send</button>
                            </form>
                        </section>
                    </div>
                `);

                // Setup Socket.IO Client
                let socket = null;
                if (typeof io !== "undefined") {
                    socket = io(API_BASE);
                }

                const renderConversationsList = () => {
                    const filter = ($("#cs")?.value || "").toLowerCase();
                    const listEl = $("#cl");
                    if (!listEl) return;

                    const filtered = bookings.filter(b => {
                        const otherName = isCustomer ? (b.providerName || b.providerId) : (b.customerName || b.customerId);
                        return otherName.toLowerCase().includes(filter) || (b.service || "").toLowerCase().includes(filter);
                    });

                    listEl.innerHTML = filtered.map(b => {
                        const otherName = isCustomer ? (b.providerName || ("Provider " + b.providerId)) : (b.customerName || ("Customer " + b.customerId));
                        const isCurrent = b.BookingID === activeBooking.BookingID;
                        return `
                            <div class="ci ${isCurrent ? "on" : ""}" onclick="window.selectBookingConversation('${esc(b.BookingID)}')">
                                ${av(otherName)}
                                <div>
                                    <b>${esc(otherName)}</b>
                                    <small>${esc(b.service)} · <span class="pill s-${b.status}" style="font-size:0.65rem;padding:2px 6px">${esc(b.status)}</span></small>
                                </div>
                            </div>
                        `;
                    }).join("");
                };

                const loadMessagesForActiveBooking = async () => {
                    const otherName = isCustomer ? (activeBooking.providerName || ("Provider " + activeBooking.providerId)) : (activeBooking.customerName || ("Customer " + activeBooking.customerId));
                    const isClosed = activeBooking.status === "Completed" || activeBooking.status === "Cancelled";

                    // Update header
                    $("#ch").innerHTML = `
                        <div class="ct" style="display:flex;justify-content:space-between;align-items:center;width:100%">
                            <div style="display:flex;gap:12px;align-items:center">
                                ${av(otherName)}
                                <div>
                                    <h3>${esc(otherName)}</h3>
                                    <p>${esc(activeBooking.service)} · Booking <code>${esc(activeBooking.BookingID)}</code> (${esc(activeBooking.date)})</p>
                                </div>
                            </div>
                            <span class="pill s-${activeBooking.status}">${esc(activeBooking.status)}</span>
                        </div>
                    `;

                    // Handle input disable if closed
                    const form = $("#cf");
                    const input = $("#ci");
                    if (isClosed) {
                        input.disabled = true;
                        input.placeholder = `Chat is closed: this booking is ${activeBooking.status}.`;
                        form.querySelector("button").disabled = true;
                    } else {
                        input.disabled = false;
                        input.placeholder = "Write a message…";
                        form.querySelector("button").disabled = false;
                    }

                    // Join Socket Room
                    if (socket) {
                        socket.emit("joinRoom", activeBooking.BookingID);
                    }

                    // Fetch previous messages from MongoDB
                    try {
                        const mRes = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(activeBooking.BookingID)}`);
                        const msgs = mRes.ok ? await mRes.json() : [];

                        const box = $("#cm");
                        box.innerHTML = msgs.length ? msgs.map(renderBubble).join("") : `<div class="mute" style="text-align:center;padding:30px">No previous messages yet. Send a greeting to start the conversation!</div>`;
                        box.scrollTop = box.scrollHeight;
                    } catch (e) {
                        console.error("Message load error:", e);
                    }
                };

                const myId = isCustomer ? u.CustomerID : u.ProviderId;
                const receiverId = isCustomer ? activeBooking.providerId : activeBooking.customerId;

                function renderBubble(mObj) {
                    const isMe = mObj.senderid === myId;
                    const timeStr = mObj.timestamp ? new Date(mObj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now";
                    return `
                        <div class="m ${isMe ? "me" : ""}">
                            <div>${esc(mObj.message)}</div>
                            <small style="opacity:0.6;font-size:0.7rem;display:block;margin-top:4px;text-align:${isMe ? "right" : "left"}">${esc(timeStr)}</small>
                        </div>
                    `;
                }

                // Handle incoming socket message
                if (socket) {
                    socket.off("receiveMessage");
                    socket.on("receiveMessage", (newMsg) => {
                        if (activeBooking && newMsg.bookingid === activeBooking.BookingID) {
                            const box = $("#cm");
                            const emptyPlaceholder = box.querySelector(".mute");
                            if (emptyPlaceholder) emptyPlaceholder.remove();
                            box.insertAdjacentHTML("beforeend", renderBubble(newMsg));
                            box.scrollTop = box.scrollHeight;
                        }
                    });
                }

                // Handle form submission
                $("#cf").onsubmit = async (e) => {
                    e.preventDefault();
                    const input = $("#ci");
                    const text = input.value.trim();
                    if (!text) return;

                    const payload = {
                        bookingid: activeBooking.BookingID,
                        senderid: myId,
                        receiverid: receiverId,
                        message: text
                    };

                    input.value = "";

                    // Emit via Socket.IO
                    if (socket && socket.connected) {
                        socket.emit("sendMessage", payload);
                    } else {
                        // Fallback to HTTP POST
                        try {
                            const sendRes = await fetch(`${API_BASE}/api/messages/send`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload)
                            });
                            const saved = await sendRes.json();
                            if (saved && saved.data) {
                                const box = $("#cm");
                                box.insertAdjacentHTML("beforeend", renderBubble(saved.data));
                                box.scrollTop = box.scrollHeight;
                            }
                        } catch (err) {
                            console.error("HTTP send error:", err);
                        }
                    }
                };

                window.selectBookingConversation = (bid) => {
                    activeBooking = bookings.find(b => b.BookingID === bid) || activeBooking;
                    renderConversationsList();
                    loadMessagesForActiveBooking();
                };

                $("#cs").oninput = renderConversationsList;
                renderConversationsList();
                loadMessagesForActiveBooking();

            } catch (err) {
                console.error("Chat setup error:", err);
                m(`<div class="empty">Error initializing chat: ${esc(err.message)}</div>`);
            }
        },

        // 8. Login Page (Name & Password, Customer or Provider)
        login() {
            const isReg = window.location.pathname.includes("register");
            if (isReg) {
                PG.register();
                return;
            }

            const role0 = Q.get("role") || "customer";
            const next = Q.get("next") || "";

            m(`
                <form class="form" id="loginForm" onsubmit="window.submitLogin(event)">
                    <h1 style="font-size:2.2rem">Sign in to Easy Hire</h1>
                    <p class="mute" style="margin-top:6px">Access your customer desk or professional studio using your account name and password.</p>

                    <div id="loginAlert" style="margin-top:14px"></div>

                    <label>I am signing in as</label>
                    <div class="tabs">
                        <label class="chk" style="cursor:pointer">
                            <input type="radio" name="role" value="customer" ${role0 === "customer" ? "checked" : ""}> Customer
                        </label>
                        <label class="chk" style="cursor:pointer">
                            <input type="radio" name="role" value="provider" ${role0 === "provider" ? "checked" : ""}> Service Provider
                        </label>
                    </div>

                    <label for="nm">Account Name</label>
                    <input id="nm" name="name" required placeholder="e.g. Aarav Kumar or Rajesh Kumar" autocomplete="username">

                    <label for="pw">Password</label>
                    <input id="pw" name="password" type="password" required placeholder="Your account password" autocomplete="current-password">

                    <button class="btn" style="width:100%;margin-top:16px" type="submit">Sign In</button>

                    <p class="mute" style="margin-top:18px;text-align:center">
                        Don't have an account? <a href="register.html"><b>Create an account</b></a>
                    </p>
                </form>
            `);

            window.submitLogin = async (e) => {
                e.preventDefault();
                const role = e.target.role.value;
                const name = $("#nm").value.trim();
                const password = $("#pw").value;
                const alertBox = $("#loginAlert");
                alertBox.innerHTML = "";

                const endpoint = role === "provider"
                    ? `${API_BASE}/api/providers/login`
                    : `${API_BASE}/api/customers/login`;

                try {
                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, password })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Invalid credentials");

                    const userObj = role === "provider" ? data.provider : data.customer;
                    setUser(userObj);

                    toast(`Welcome back, ${userObj.name}!`);

                    setTimeout(() => {
                        if (next) {
                            window.location.href = decodeURIComponent(next);
                        } else if (role === "provider") {
                            window.location.href = "provider-dashboard.html";
                        } else {
                            window.location.href = "customer-dashboard.html";
                        }
                    }, 600);

                } catch (err) {
                    alertBox.innerHTML = `<div class="pill s-Rejected" style="display:block;padding:8px 12px;margin-bottom:10px">${esc(err.message)}</div>`;
                }
            };
        },

        // 9. Register Page
        register() {
            const role0 = Q.get("role") || "customer";

            m(`
                <form class="form" id="registerForm" onsubmit="window.submitRegister(event)">
                    <h1 style="font-size:2.2rem">Create an Account</h1>
                    <p class="mute" style="margin-top:6px">Join the neighborhood marketplace to book services or offer your skills.</p>

                    <div id="regAlert" style="margin-top:14px"></div>

                    <label>I want to</label>
                    <div class="tabs">
                        <label class="chk" style="cursor:pointer">
                            <input type="radio" name="role" value="customer" ${role0 === "customer" ? "checked" : ""} onchange="window.toggleRegFields()"> Hire professionals
                        </label>
                        <label class="chk" style="cursor:pointer">
                            <input type="radio" name="role" value="provider" ${role0 === "provider" ? "checked" : ""} onchange="window.toggleRegFields()"> Offer my trade
                        </label>
                    </div>

                    <label for="rName">Full Name</label>
                    <input id="rName" required minlength="2" placeholder="Your full name">

                    <label for="rPass">Password</label>
                    <input id="rPass" type="password" required minlength="4" placeholder="Choose a secure password">

                    <label for="rPhone">Mobile Number</label>
                    <input id="rPhone" placeholder="10-digit mobile number">

                    <label for="rDoorNo">Door No / Flat / House</label>
                    <input id="rDoorNo" placeholder="e.g. Flat 302, Green Meadows or H.No 4-12">

                    <div class="c3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                        <div>
                            <label for="rState">State</label>
                            <select id="rState" onchange="window.updateRegDistricts()">
                                <option value="Telangana">Telangana</option>
                                <option value="Andhra Pradesh">Andhra Pradesh</option>
                                <option value="Karnataka">Karnataka</option>
                                <option value="Tamil Nadu">Tamil Nadu</option>
                            </select>
                        </div>
                        <div>
                            <label for="rDistrict">District</label>
                            <select id="rDistrict" onchange="window.updateRegAreas()">
                                <option value="Hyderabad">Hyderabad</option>
                                <option value="Medchal-Malkajgiri">Medchal-Malkajgiri</option>
                                <option value="Rangareddy">Rangareddy</option>
                            </select>
                        </div>
                        <div>
                            <label for="rArea">Area / Locality</label>
                            <select id="rArea">
                                <option value="Central Hyderabad">Central Hyderabad</option>
                                <option value="Begumpet">Begumpet</option>
                                <option value="Secunderabad">Secunderabad</option>
                            </select>
                        </div>
                    </div>

                    <div class="c2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                        <div>
                            <label for="rPincode">PIN Code (optional)</label>
                            <input id="rPincode" placeholder="e.g. 500001">
                        </div>
                        <div>
                            <label for="rAddress">Complete Address (optional)</label>
                            <input id="rAddress" placeholder="Full street address">
                        </div>
                    </div>

                    <label for="rEmail">Email (optional)</label>
                    <input id="rEmail" type="email" placeholder="Optional email address">

                    <div id="providerSpecificFields" style="${role0 === 'provider' ? '' : 'display:none'}">
                        <label for="rSkill">Primary Trade / Skill</label>
                        <select id="rSkill">
                            <option value="Plumbing">Plumbing</option>
                            <option value="Electrical">Electrical</option>
                            <option value="Home Cleaning">Home Cleaning</option>
                            <option value="AC Repair">AC Repair</option>
                            <option value="Appliance Repair">Appliance Repair</option>
                            <option value="Painting">Painting</option>
                            <option value="Carpentry">Carpentry</option>
                            <option value="Pest Control">Pest Control</option>
                            <option value="RO Service">RO Service</option>
                            <option value="Computer Repair">Computer Repair</option>
                        </select>

                        <div class="c2">
                            <div>
                                <label for="rExp">Experience (years)</label>
                                <input id="rExp" type="number" min="0" max="60" value="1">
                            </div>
                            <div>
                                <label for="rAvail">Availability</label>
                                <input id="rAvail" value="9 AM - 6 PM">
                            </div>
                        </div>
                    </div>

                    <button class="btn" style="width:100%;margin-top:20px" type="submit">Create Account</button>
                    <p class="mute" style="margin-top:16px;text-align:center">
                        Already have an account? <a href="login.html"><b>Sign in</b></a>
                    </p>
                </form>
            `);

            const REG_LOCATIONS = {
                "Telangana": {
                    "Hyderabad": ["Central Hyderabad", "Begumpet", "Secunderabad"],
                    "Medchal-Malkajgiri": ["Kompally", "Kukatpally", "Medchal", "Miyapur", "Uppal"],
                    "Rangareddy": ["LB Nagar"]
                },
                "Andhra Pradesh": {
                    "Chittoor": ["Chittoor Town", "Gandhi Road"]
                },
                "Karnataka": {
                    "Bengaluru Urban": ["Koramangala", "Indiranagar", "Whitefield"]
                },
                "Tamil Nadu": {
                    "Vellore": ["Katpadi", "Gandhi Nagar"]
                }
            };

            window.updateRegDistricts = () => {
                const st = $("#rState")?.value || "Telangana";
                const dtSelect = $("#rDistrict");
                if (dtSelect && REG_LOCATIONS[st]) {
                    const dists = Object.keys(REG_LOCATIONS[st]).sort();
                    dtSelect.innerHTML = dists.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
                    window.updateRegAreas();
                }
            };

            window.updateRegAreas = () => {
                const st = $("#rState")?.value || "Telangana";
                const dt = $("#rDistrict")?.value || "Hyderabad";
                const arSelect = $("#rArea");
                if (arSelect && REG_LOCATIONS[st]?.[dt]) {
                    const areas = REG_LOCATIONS[st][dt].sort();
                    arSelect.innerHTML = areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
                }
            };

            window.toggleRegFields = () => {
                const role = document.querySelector('input[name="role"]:checked')?.value;
                const box = $("#providerSpecificFields");
                if (box) box.style.display = role === "provider" ? "block" : "none";
            };

            window.submitRegister = async (e) => {
                e.preventDefault();
                const role = document.querySelector('input[name="role"]:checked')?.value || "customer";
                const name = $("#rName").value.trim();
                const password = $("#rPass").value;
                const mobile = $("#rPhone").value.trim();
                const doorNo = ($("#rDoorNo")?.value || "").trim();
                const state = ($("#rState")?.value || "").trim();
                const district = ($("#rDistrict")?.value || "").trim();
                const area = ($("#rArea")?.value || "").trim();
                const pincode = ($("#rPincode")?.value || "").trim();
                const customAddress = ($("#rAddress")?.value || "").trim();
                const address = customAddress || [doorNo, area, district, state, pincode].filter(Boolean).join(", ");
                const email = $("#rEmail").value.trim();
                const alertBox = $("#regAlert");
                alertBox.innerHTML = "";

                if (role === "provider" && (!state || !district || !area)) {
                    alertBox.innerHTML = `<div class="pill s-Rejected" style="display:block;padding:8px 12px;margin-bottom:10px">State, District, and Area/Locality are required for service providers.</div>`;
                    return;
                }

                let payload = { name, password, mobile, doorNo, area, district, state, pincode, address, email };
                let endpoint = `${API_BASE}/api/customers/register`;

                if (role === "provider") {
                    endpoint = `${API_BASE}/api/providers/register`;
                    const skill = $("#rSkill").value;
                    const experience = Number($("#rExp").value) || 1;
                    const availability = $("#rAvail").value.trim();
                    payload = { ...payload, services: [skill], skill, experience, availability };
                }

                try {
                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Registration failed");

                    toast("Account created successfully! Signing in...");

                    // Auto-login
                    const loginEndpoint = role === "provider" ? `${API_BASE}/api/providers/login` : `${API_BASE}/api/customers/login`;
                    const logRes = await fetch(loginEndpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, password })
                    });
                    const logData = await logRes.json();
                    if (logRes.ok) {
                        const userObj = role === "provider" ? logData.provider : logData.customer;
                        setUser(userObj);
                        setTimeout(() => {
                            window.location.href = role === "provider" ? "provider-dashboard.html" : "customer-dashboard.html";
                        }, 800);
                    } else {
                        window.location.href = `login.html?role=${role}`;
                    }
                } catch (err) {
                    alertBox.innerHTML = `<div class="pill s-Rejected" style="display:block;padding:8px 12px;margin-bottom:10px">${esc(err.message)}</div>`;
                }
            };
        }
    };

    // Initialize Page
    shell();
    if (page && PG[page]) {
        PG[page]();
    }
})();
