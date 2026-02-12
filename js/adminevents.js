// Admin Events Page - Map initialization and event display with admin controls
let map;
let markers = [];
let infoWindow;

async function initMap() {
    // Default center - Singapore
    const defaultCenter = { lat: 1.3521, lng: 103.8198 };
    
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    // Replace the placeholder with actual map div
    mapContainer.innerHTML = '<div id="map" style="width: 100%; height: 500px; border-radius: 12px;"></div>';
    
    // Initialize the map
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: defaultCenter,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });
    
    infoWindow = new google.maps.InfoWindow();
    
    // Load and display events
    await loadAdminEventsFromAPI();
}

async function loadAdminEventsFromAPI() {
    try {
        console.log('Loading admin events...');
        const response = await fetch('/api/admin/events?limit=200');
        const data = await response.json();
        
        console.log('API Response:', data);
        
        if (data.ok && data.events && data.events.length > 0) {
            const eventsWithCoords = data.events.filter(e => e.latitude && e.longitude);
            const eventsWithoutCoords = data.events.filter(e => !e.latitude || !e.longitude);
            
            if (eventsWithCoords.length > 0) {
                displayEventsOnMap(eventsWithCoords);
                
                // Fit map to show all markers
                const bounds = new google.maps.LatLngBounds();
                eventsWithCoords.forEach(event => {
                    bounds.extend(new google.maps.LatLng(event.latitude, event.longitude));
                });
                map.fitBounds(bounds);
            }
            
            // Display all events in list (with and without coords)
            displayAdminEventsList(data.events);
        } else {
            console.log('No events found');
            displayAdminEventsList([]);
        }
    } catch (error) {
        console.error('Error loading events:', error);
        const grid = document.getElementById('adminEventsGrid');
        if (grid) {
            const isFileProtocol = window.location.protocol === 'file:';
            const errorMessage = isFileProtocol 
                ? 'Page must be accessed through Flask server (http://127.0.0.1:5010/adminevents.html), not opened as a file.'
                : 'Please refresh and try again.';
            
            grid.innerHTML = `<div class="card empty-state">
                <h3>Unable to load events</h3>
                <p class="mb-2">${errorMessage}</p>
                <p style="font-size:0.9rem;color:tomato;">Error: ${error.message}</p>
                ${isFileProtocol ? '<p style="font-size:0.85rem;margin-top:1rem;">💡 Make sure your Flask server is running and access the page at:<br><strong>http://127.0.0.1:5010/adminevents.html</strong></p>' : ''}
            </div>`;
        }
    }
}

function displayEventsOnMap(events) {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    events.forEach(event => {
        const marker = new google.maps.Marker({
            position: { lat: event.latitude, lng: event.longitude },
            map: map,
            title: event.title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#6366f1",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });
        
        // Create info window content with admin controls
        const contentString = `
            <div style="padding: 12px; max-width: 300px;">
                <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #1f2937;">${escapeHtml(event.title)}</h3>
                <p style="margin: 4px 0; color: #6b7280;">
                    <strong>📅 Date:</strong> ${formatDate(event.start_date)}
                    ${event.start_time ? ` at ${event.start_time}` : ''}
                </p>
                <p style="margin: 4px 0; color: #6b7280;">
                    <strong>📍 Location:</strong> ${escapeHtml(event.location || 'Not specified')}
                </p>
                ${event.description ? `<p style="margin: 8px 0 0 0; color: #4b5563;">${escapeHtml(event.description)}</p>` : ''}
                ${event.link ? `<p style="margin: 8px 0 0 0;"><a href="${event.link}" target="_blank" style="color: #6366f1; text-decoration: none;">Learn More →</a></p>` : ''}
            </div>
        `;
        
        marker.addListener('click', () => {
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
        });
        
        markers.push(marker);
    });
}

function displayAdminEventsList(events) {
    const eventsGrid = document.getElementById('adminEventsGrid');
    if (!eventsGrid) return;
    
    if (events.length === 0) {
        eventsGrid.innerHTML = `
            <div class="card empty-state">
                <h3>No upcoming events yet</h3>
                <p class="mb-2">Click the + button to create your first event.</p>
            </div>
        `;
        return;
    }
    
    eventsGrid.innerHTML = events.map(event => `
        <div class="card event-card" data-event-id="${event.id}">
            <div class="event-header">
                <h3>${escapeHtml(event.title)}</h3>
                <span class="event-date">${formatDate(event.start_date)}</span>
            </div>
            ${event.start_time ? `<p class="event-time">⏰ ${event.start_time}</p>` : ''}
            <p class="event-location">📍 ${escapeHtml(event.location || 'Location not specified')}</p>
            ${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ''}
            <div class="event-actions" style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                ${event.link ? `<a href="${event.link}" target="_blank" class="btn btn-secondary" style="flex: 1;">Learn More</a>` : ''}
                ${event.latitude && event.longitude ? `
                    <button class="btn btn-secondary" onclick="focusEventOnMap(${event.latitude}, ${event.longitude}, '${escapeHtml(event.title).replace(/'/g, "\\'")}')">
                        View on Map
                    </button>
                ` : ''}
                <button class="btn btn-primary" onclick="adminDeleteEvent(${event.id})" style="background: tomato;">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

function focusEventOnMap(lat, lng, title) {
    if (!map) return;
    
    map.setCenter({ lat, lng });
    map.setZoom(15);
    
    // Find and click the marker
    const marker = markers.find(m => 
        m.getPosition().lat() === lat && 
        m.getPosition().lng() === lng
    );
    
    if (marker) {
        google.maps.event.trigger(marker, 'click');
    }
    
    // Scroll to map
    document.querySelector('.map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function adminDeleteEvent(eventId) {
    const ok = confirm('Delete this event? This will remove it for all users.');
    if (!ok) return;

    try {
        const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, { 
            method: 'DELETE'
        });
        
        const data = await res.json().catch(() => ({}));
        
        if (!res.ok || !data?.ok) {
            throw new Error('Delete failed');
        }

        console.log('Event deleted successfully');
        
        // Reload events to refresh both map and list
        await loadAdminEventsFromAPI();
        
    } catch (e) {
        console.error('Error deleting event:', e);
        alert('Unable to delete event. Please try again.');
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make initMap available globally for Google Maps callback
window.initMap = initMap;