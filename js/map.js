// ================================
// Google Map + Events Display
// ================================

let map;
let markers = [];
let infoWindow;

// Singapore default center
const DEFAULT_CENTER = { lat: 1.3521, lng: 103.8198 };

async function initMap() {
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    mapContainer.innerHTML = `
        <div id="map" style="width: 100%; height: 500px; border-radius: 12px;"></div>
    `;

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: DEFAULT_CENTER,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
    });

    infoWindow = new google.maps.InfoWindow();

    await loadMapEvents();
}

async function loadMapEvents() {
    try {
        const res = await fetch('http://127.0.0.1:5010/api/events/map');
        const data = await res.json();

        if (!data.ok || !Array.isArray(data.events)) {
            console.warn("Invalid API response");
            return;
        }

        if (!data.events.length) {
            console.log("No events to display");
            return;
        }

        const validEvents = data.events.filter(ev =>
            Number.isFinite(ev.latitude) &&
            Number.isFinite(ev.longitude)
        );

        if (!validEvents.length) {
            console.warn("No events with valid coordinates");
            return;
        }

        renderMarkers(validEvents);
        displayEventsList(validEvents);
        fitMapToMarkers(validEvents);

    } catch (err) {
        console.error("Map event loading error:", err);
    }
}

function renderMarkers(events) {
    clearMarkers();

    events.forEach(event => {
        const marker = new google.maps.Marker({
            map,
            position: { lat: event.latitude, lng: event.longitude },
            title: event.title,
            optimized: true,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: "#6366f1",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });

        marker.__eventId = event.id;

        marker.addListener('click', () => {
            infoWindow.setContent(buildInfoWindow(event));
            infoWindow.open(map, marker);
        });

        markers.push(marker);
    });
}

function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers.length = 0;
}

function fitMapToMarkers(events) {
    const bounds = new google.maps.LatLngBounds();

    events.forEach(ev => {
        bounds.extend({ lat: ev.latitude, lng: ev.longitude });
    });

    map.fitBounds(bounds);

    if (events.length === 1) {
        map.setZoom(14);
    }
}

function buildInfoWindow(event) {
    return `
        <div style="padding: 12px; max-width: 280px;">
            <h3 style="margin:0 0 6px;font-size:1.1rem;color:#1f2937;">${event.title}</h3>

            <p style="margin:4px 0;color:#6b7280;">
                <strong>📅</strong> ${formatDate(event.start_date)}
                ${event.start_time ? ` at ${event.start_time}` : ""}
            </p>

            <p style="margin:4px 0;color:#6b7280;">
                <strong>📍</strong> ${event.location}
            </p>

            ${event.description ? `<p style="margin:6px 0;color:#4b5563;">${event.description}</p>` : ""}

            ${event.link ? `<a href="${event.link}" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:500;">Learn More →</a>` : ""}
        </div>
    `;
}

// ================================
// Events Grid UI
// ================================

function displayEventsList(events) {
    const grid = document.getElementById("eventsGrid");
    if (!grid) return;

    grid.innerHTML = events.map(ev => `
        <div class="card event-card">
            <div class="event-header">
                <h3>${ev.title}</h3>
                <span class="event-date">${formatDate(ev.start_date)}</span>
            </div>

            ${ev.start_time ? `<p class="event-time">⏰ ${ev.start_time}</p>` : ""}

            <p class="event-location">📍 ${ev.location}</p>

            ${ev.description ? `<p class="event-description">${ev.description}</p>` : ""}

            <div class="event-actions">
                ${ev.link ? `<a href="${ev.link}" target="_blank" class="btn btn-primary">Learn More</a>` : ""}
                <button class="btn btn-secondary" onclick="focusEventOnMap(${ev.latitude}, ${ev.longitude}, ${ev.id})">
                    View on Map
                </button>
            </div>
        </div>
    `).join("");
}

// ================================
// Map Focus Helper
// ================================

function focusEventOnMap(lat, lng, eventId) {
    map.panTo({ lat, lng });
    map.setZoom(15);

    const marker = markers.find(m => m.__eventId === eventId);
    if (marker) google.maps.event.trigger(marker, 'click');

    document.querySelector('.map-container')?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// ================================
// Utilities
// ================================

function formatDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-SG", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// Google Maps callback
window.initMap = initMap;
