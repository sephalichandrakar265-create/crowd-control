var map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

let reports = [];
let offlineReports = [];
let volunteers = [];
let crisisMode = false;
let allMarkers = [];
let volunteerMarkers = [];

const icons = {
  Flood: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/727/727790.png", iconSize: [32, 32] }),
  Fire: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/9356/9356286.png", iconSize: [32, 32] }),
  Earthquake: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/7606/7606169.png", iconSize: [32, 32] }),
  Cyclone: L.icon({ iconUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiVWWiXSAxEk4PQ9kqLvtkVJaUUCkOHfS25A&s", iconSize: [32, 32] }),
  Other: L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png", iconSize: [32, 32] })
};

const reportForm = document.getElementById("reportForm");
const reportList = document.getElementById("reportList");
const volunteerBtn = document.getElementById("volunteerBtn");
const volunteerList = document.getElementById("volunteerList");
const crisisBtn = document.getElementById("crisisBtn");
const syncBtn = document.getElementById("syncBtn");
const crisisStatus = document.getElementById("crisisStatus");

const modal = document.getElementById("volunteerModal");
const volNameInput = document.getElementById("volName");
const volLocationInput = document.getElementById("volLocation");
const volSubmitBtn = document.getElementById("volSubmit");
const volCancelBtn = document.getElementById("volCancel");

if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById("location").placeholder =
      `Detected Location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
  });
}

crisisBtn.addEventListener("click", () => {
  crisisMode = !crisisMode;
  crisisBtn.textContent = crisisMode ? "Deactivate Crisis Mode" : "Activate Crisis Mode";
  crisisStatus.textContent = crisisMode ? "Offline Mode: Reports will be saved locally." : "";
  crisisStatus.style.color = "#e67e22";
  syncBtn.style.display = crisisMode ? "inline-block" : "none";
});

syncBtn.addEventListener("click", () => {
  if (offlineReports.length > 0) {
    reports = reports.concat(offlineReports);
    offlineReports.forEach(addMarkerToMap);
    offlineReports = [];
    displayReports();
    alert("Offline reports synced successfully!");
  } else alert("No offline reports to sync.");
});

reportForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const type = document.getElementById("type").value;
  const severity = document.getElementById("severity").value;
  const location = document.getElementById("location").value;
  const details = document.getElementById("details").value;
  const photoInput = document.getElementById("photo");

  let mediaURL = "";
  if (photoInput.files.length > 0) mediaURL = URL.createObjectURL(photoInput.files[0]);

  const report = { name, type, severity, location, details, mediaURL };

  if (crisisMode) {
    offlineReports.push(report);
    displayReports();
    alert("Report saved locally (offline mode). Sync later.");
    reportForm.reset();
    return;
  }

  reports.push(report);
  await geocodeAndAddMarker(report);
  displayReports();
  reportForm.reset();
});

async function geocodeAndAddMarker(report) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(report.location)}`
    );
    const data = await res.json();
    if (data.length > 0) {
      report.lat = data[0].lat;
      report.lon = data[0].lon;
      addMarkerToMap(report);
    } else alert("Location not found! Try entering village + district.");
  } catch (e) { alert("Could not fetch location data."); }
}

function addMarkerToMap(r) {
  if (!r.lat || !r.lon) return;
  const icon = icons[r.type] || icons.Other;
  const googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`;

  const marker = L.marker([r.lat, r.lon], { icon }).addTo(map)
    .bindPopup(
      `<b>${r.type}</b> (<span style="color:${getSeverityColor(r.severity)}">${r.severity}</span>)<br>
       ${r.location}<br>${r.details}<br>
       <a href="${googleMapsLink}" target="_blank" style="color:blue;">Get Directions</a>`
    );
  allMarkers.push(marker);
  fitMapToAllMarkers();
}

function getSeverityColor(severity) {
  switch (severity) {
    case "Low": return "green";
    case "Medium": return "orange";
    case "High": return "red";
    default: return "black";
  }
}

function displayReports() {
  reportList.innerHTML = "";
  [...reports, ...offlineReports].forEach(r => {
    const div = document.createElement("div");
    div.className = "report-item";

    let mediaHTML = r.mediaURL ? (r.mediaURL.endsWith(".mp4") ?
      `<video src="${r.mediaURL}" controls></video>` :
      `<img src="${r.mediaURL}" alt="media">`) : "";

    let severityClass = r.severity ? `severity-${r.severity.toLowerCase()}` : "";
    let offlineTag = offlineReports.includes(r) ? "<span style='color:red;'>(Offline)</span>" : "";

    div.innerHTML = `<b>${r.type}</b> - <span class="${severityClass}">${r.severity}</span> ${offlineTag}<br>
                     Reported by <b>${r.name}</b> at <i>${r.location}</i><br>${r.details}${mediaHTML}`;
    reportList.appendChild(div);
  });
}

volunteerBtn.addEventListener("click", () => {
  modal.style.display = "flex";
});
volCancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

volSubmitBtn.addEventListener("click", async () => {
  const name = volNameInput.value.trim();
  const location = volLocationInput.value.trim();

  if (!name || !location) {
    alert("Please enter both name and location.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/volunteer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location })
    });

    const result = await response.json();
    if (response.ok) {
      volunteers.push(result.volunteer);  
      await geocodeVolunteer(result.volunteer);
      displayVolunteers();
      alert(`Thank you ${name}! You have been registered as a volunteer.`);
      modal.style.display = "none";
      volNameInput.value = "";
      volLocationInput.value = "";
    } else {
      alert("Error: " + result.error);
    }
  } catch (err) {
    console.error("Error registering volunteer:", err);
    alert("Failed to register volunteer.");
  }
});

async function geocodeVolunteer(vol) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(vol.location)}`
    );
    const data = await res.json();
    if (data.length > 0) {
      vol.lat = data[0].lat;
      vol.lon = data[0].lon;

      const marker = L.marker([vol.lat, vol.lon], {
        icon: L.icon({
          iconUrl: "https://cdn-icons-png.flaticon.com/512/4329/4329445.png",
          iconSize: [28, 28]
        })
      }).addTo(map).bindPopup(`<b>Volunteer:</b> ${vol.name}<br>Location: ${vol.location}`);

      volunteerMarkers.push({ marker, vol });
      allMarkers.push(marker);
      fitMapToAllMarkers();
    }
  } catch (e) { console.log("Volunteer geocoding failed", e); }
}

function displayVolunteers() {
  volunteerList.innerHTML = "";

  if (volunteers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No volunteers registered yet.";
    volunteerList.appendChild(li);
    return;
  }

  volunteers.forEach((v, index) => {
    const li = document.createElement("li");
    li.textContent = `${v.name} (${v.location})`;
    li.style.cursor = "pointer";
    li.onclick = () => {
      if (volunteerMarkers[index]) {
        const m = volunteerMarkers[index].marker;
        map.setView(m.getLatLng(), 12);
        m.openPopup();
      }
    };
    volunteerList.appendChild(li);
  });
}

function fitMapToAllMarkers() {
  if (allMarkers.length === 0) return;
  const group = L.featureGroup(allMarkers);
  map.fitBounds(group.getBounds(), { padding: [50, 50] });
}

async function loadReports() {
  try {
    const res = await fetch("http://localhost:3000/api/reports");
    const reportsFromServer = await res.json();
    reportsFromServer.forEach(r => {
      addMarkerToMap(r);
      const div = document.createElement("div");
      div.className = "report-item";
      div.innerHTML = `
        <b>${r.type}</b> - <span class="severity-${r.severity.toLowerCase()}">${r.severity}</span><br>
        Reported by <b>${r.name}</b> at <i>${r.location}</i><br>
        ${r.details}
      `;
      reportList.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading reports:", err);
  }
}

async function loadVolunteers() {
  try {
    const res = await fetch("http://localhost:3000/api/volunteers");
    const volunteersFromServer = await res.json();
    volunteers = volunteersFromServer;
    for (let v of volunteers) {
      await geocodeVolunteer(v);
    }
    displayVolunteers();
  } catch (err) {
    console.error("Error loading volunteers:", err);
  }
}

loadReports();
loadVolunteers();
