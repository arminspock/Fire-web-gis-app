// Global variables
let currentLayer = null;
let routeLayer = null;
let hydrantsLayer = null;
let firehallsLayer = null;
const minScoreInput = document.getElementById('minScore');
const maxScoreInput = document.getElementById('maxScore');
const minScoreValue = document.getElementById('minScoreValue');
const maxScoreValue = document.getElementById('maxScoreValue');
const applyFilterBtn = document.getElementById('applyFilter');

// Initialize the map
const map = L.map('map').setView([49.2827, -123.1207], 12);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Create custom icons
const firehallIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Update score display values
minScoreInput.addEventListener('input', () => {
    minScoreValue.textContent = minScoreInput.value;
});

maxScoreInput.addEventListener('input', () => {
    maxScoreValue.textContent = maxScoreInput.value;
});

// Color function for risk scores
function getColor(score) {
    return score > 80 ? '#d73027' :
           score > 60 ? '#fc8d59' :
           score > 40 ? '#fee08b' :
           score > 20 ? '#d9ef8b' :
                       '#91cf60';
}

// Function to get hydrant icon based on color
function getHydrantIcon(color) {
    const size = 8;
    return L.divIcon({
        html: `<div style="
            background-color: ${color.toLowerCase()};
            border: 2px solid #000;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
        "></div>`,
        className: 'hydrant-icon',
        iconSize: [size, size]
    });
}

// Style function for grid cells
function style(feature) {
    return {
        fillColor: getColor(feature.properties.final_score),
        weight: 1,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7
    };
}

// Function to fetch and display route
function fetchAndDisplayRoute(gridId) {
    // Remove existing route if any
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    fetch(`/api/get-route?grid_id=${gridId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching route:', data.error);
                return;
            }
            
            // Create route layer
            routeLayer = L.geoJSON(data, {
                style: {
                    color: '#FF0000',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 10'  // Creates a dashed line
                }
            }).addTo(map);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Function to handle feature interactions
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: function(e) {
            const layer = e.target;
            layer.setStyle({
                weight: 3,
                color: '#666',
                fillOpacity: 0.9
            });
        },
        mouseout: function(e) {
            currentLayer.resetStyle(e.target);
        },
        click: function(e) {
            const props = e.target.feature.properties;
            
            // Update info panel
            document.getElementById('areaInfo').innerHTML = `
                <p><strong>Grid ID:</strong> ${props.grid_id}</p>
                <p><strong>Risk Score:</strong> ${props.final_score.toFixed(2)}</p>
                <p><strong>Hydrant Count:</strong> ${props.hydrant_count}</p>
            `;
            
            // Get and display route
            fetchAndDisplayRoute(props.grid_id);
        }
    });
}

// Function to load hydrants
function loadHydrants() {
    fetch('/api/hydrants')
        .then(response => response.json())
        .then(data => {
            if (hydrantsLayer) {
                map.removeLayer(hydrantsLayer);
            }
            
            hydrantsLayer = L.geoJSON(data, {
                pointToLayer: function(feature, latlng) {
                    return L.marker(latlng, {
                        icon: getHydrantIcon(feature.properties.color)
                    });
                },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(`
                        <b>Hydrant ID:</b> ${feature.properties.id}<br>
                        <b>Flow Capacity:</b> ${feature.properties.color}
                    `);
                }
            }).addTo(map);
        });
}

// Function to load fire halls
function loadFirehalls() {
    fetch('/api/firehalls')
        .then(response => response.json())
        .then(data => {
            if (firehallsLayer) {
                map.removeLayer(firehallsLayer);
            }
            
            firehallsLayer = L.geoJSON(data, {
                pointToLayer: function(feature, latlng) {
                    return L.marker(latlng, {icon: firehallIcon});
                },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(`
                        <b>${feature.properties.name}</b><br>
                        ${feature.properties.address}
                    `);
                }
            }).addTo(map);
        });
}

// Function to add legend
function addLegend() {
    const legend = L.control({position: 'bottomright'});
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        
        div.innerHTML = `
            <h4>Legend</h4>
            <div style="margin-bottom: 5px;"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" height="20"> Fire Hall</div>
            <div style="margin-bottom: 5px;">Hydrants:</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:blue;border:1px solid #000;"></span> High Flow</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:green;border:1px solid #000;"></span> Medium-High Flow</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:yellow;border:1px solid #000;"></span> Medium Flow</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:red;border:1px solid #000;"></span> Low Flow</div>
            <div style="margin-top: 10px;">Risk Score:</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:20px;height:10px;background:#d73027;"></span> Very High</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:20px;height:10px;background:#fc8d59;"></span> High</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:20px;height:10px;background:#fee08b;"></span> Medium</div>
            <div style="margin-bottom: 3px;"><span style="display:inline-block;width:20px;height:10px;background:#d9ef8b;"></span> Low</div>
            <div><span style="display:inline-block;width:20px;height:10px;background:#91cf60;"></span> Very Low</div>
        `;
        return div;
    };
    
    legend.addTo(map);
}

// Function to load grid data
function loadGridData(minScore = 0, maxScore = 100) {
    console.log('Loading grid data...');
    fetch(`/api/grid?min_score=${minScore}&max_score=${maxScore}`)
        .then(response => response.json())
        .then(data => {
            if (currentLayer) {
                map.removeLayer(currentLayer);
            }
            if (routeLayer) {
                map.removeLayer(routeLayer);
            }
            
            currentLayer = L.geoJSON(data, {
                style: style,
                onEachFeature: onEachFeature
            }).addTo(map);
            
            if (currentLayer.getBounds) {
                map.fitBounds(currentLayer.getBounds());
            }
        })
        .catch(error => {
            console.error('Error loading grid data:', error);
        });
}

// Apply filter button click handler
applyFilterBtn.addEventListener('click', () => {
    loadGridData(minScoreInput.value, maxScoreInput.value);
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadGridData();
    loadHydrants();
    loadFirehalls();
    addLegend();
});