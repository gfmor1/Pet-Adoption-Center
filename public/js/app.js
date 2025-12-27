const state = {
  me: { loggedIn: false, username: "" },
  pets: []
};

function $(sel) {
  return document.querySelector(sel);
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => {
    t.classList.add("hidden");
  }, 2600);
}

function setView(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));

  document.querySelector(`.tab[data-view="${name}"]`).classList.add("active");
  document.querySelector(`#view-${name}`).classList.remove("hidden");
}

function setAuthUI() {
  const status = $("#authStatus");
  const btnLogout = $("#btnLogout");

  if (state.me.loggedIn) {
    status.textContent = `Logged in as ${state.me.username}`;
    status.classList.remove("pill-muted");
    btnLogout.style.display = "inline-block";
  } else {
    status.textContent = "Not logged in";
    status.classList.add("pill-muted");
    btnLogout.style.display = "none";
  }
}

function buildQueryFromFilters(form) {
  const fd = new FormData(form);

  const animal = fd.get("animal") || "";
  const ageGroup = fd.get("ageGroup") || "";
  const gender = fd.get("gender") || "";
  const breed = (fd.get("breed") || "").trim();
  const status = fd.get("status") || "";

  const compat = [];
  document.querySelectorAll('input[name="compat"]:checked').forEach(cb => compat.push(cb.value));

  const params = new URLSearchParams();
  if (animal) params.set("animal", animal);
  if (ageGroup) params.set("ageGroup", ageGroup);
  if (gender) params.set("gender", gender);
  if (breed) params.set("breed", breed);
  if (status) params.set("status", status);
  if (compat.length > 0) params.set("compat", compat.join(","));

  return params.toString();
}

function renderPets(pets) {
  const cards = $("#cards");
  const count = $("#count");

  count.textContent = `${pets.length} pets`;
  cards.innerHTML = "";

  if (pets.length === 0) {
    cards.innerHTML = `<div class="muted">No results. Adjust filters.</div>`;
    return;
  }

  for (const p of pets) {
    const compat = p.compatibility.map(x => `<span class="badge">${x}</span>`).join("");
    const safeImg = p.imageUrl && p.imageUrl.startsWith("/images/") ? p.imageUrl : "/images/dog2.svg";

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${safeImg}" alt="${p.animal} image" onerror="this.src='/images/dog2.svg'">
      <div class="body">
        <h3>#${p.id} • ${p.animal.toUpperCase()} • ${p.breed}</h3>
        <div class="kv"><div>Age</div><div>${p.ageGroup}</div></div>
        <div class="kv"><div>Gender</div><div>${p.gender}</div></div>
        <div class="kv"><div>Status</div><div>${p.status}</div></div>
        <div class="kv"><div>Owner</div><div>${p.ownerUsername}</div></div>
        <div class="kv"><div>About</div><div>${escapeHtml(p.description)}</div></div>
        <div class="badges">${compat}</div>
        ${state.me.loggedIn && state.me.username === p.ownerUsername ? ownerControls(p) : ""}
      </div>
    `;
    cards.appendChild(card);
  }
}

function ownerControls(p) {
  if (p.status === "available") {
    return `<div class="actions"><button class="btn" data-adopt="${p.id}">Mark Adopted</button></div>`;
  }
  return `<div class="actions"><button class="btn" data-available="${p.id}">Mark Available</button></div>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshMe() {
  const me = await apiGet("/api/auth/me");
  state.me = me;
  setAuthUI();
}

async function loadPetsFromFilters() {
  const q = buildQueryFromFilters($("#filterForm"));
  const url = q ? `/api/pets?${q}` : "/api/pets";
  const pets = await apiGet(url);
  state.pets = pets;
  renderPets(pets);
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      setView(btn.dataset.view);
    });
  });
}

function wireBrowse() {
  $("#filterForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await loadPetsFromFilters();
    } catch (err) {
      showToast(err.message);
    }
  });

  $("#btnReset").addEventListener("click", async () => {
    $("#filterForm").reset();
    document.querySelectorAll('input[name="compat"]').forEach(cb => cb.checked = false);
    try {
      await loadPetsFromFilters();
    } catch (err) {
      showToast(err.message);
    }
  });

  $("#cards").addEventListener("click", async (e) => {
    const adoptId = e.target.getAttribute("data-adopt");
    const availId = e.target.getAttribute("data-available");

    try {
      if (adoptId) {
        await apiPatch(`/api/pets/${adoptId}/status`, { status: "adopted" });
        showToast("Updated.");
        await loadPetsFromFilters();
      }
      if (availId) {
        await apiPatch(`/api/pets/${availId}/status`, { status: "available" });
        showToast("Updated.");
        await loadPetsFromFilters();
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

function wireAuth() {
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");

    try {
      await apiPost("/api/auth/register", { username, password });
      showToast("Registered. Now login.");
      e.target.reset();
      setView("auth");
    } catch (err) {
      showToast(err.message);
    }
  });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");

    try {
      await apiPost("/api/auth/login", { username, password });
      await refreshMe();
      showToast("Logged in.");
      e.target.reset();
      setView("browse");
      await loadPetsFromFilters();
    } catch (err) {
      showToast(err.message);
    }
  });

  $("#btnLogout").addEventListener("click", async () => {
    try {
      await apiPost("/api/auth/logout", {});
      await refreshMe();
      showToast("Logged out.");
    } catch (err) {
      showToast(err.message);
    }
  });
}

function wireAddPet() {
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const payload = {
      animal: fd.get("animal"),
      breed: fd.get("breed"),
      ageGroup: fd.get("ageGroup"),
      gender: fd.get("gender"),
      description: fd.get("description"),
      imageUrl: fd.get("imageUrl") || "",
      compatibility: []
    };

    document.querySelectorAll('input[name="compatibility"]:checked').forEach(cb => {
      payload.compatibility.push(cb.value);
    });

    try {
      await apiPost("/api/pets", payload);
      showToast("Listing created.");
      e.target.reset();
      setView("browse");
      await loadPetsFromFilters();
    } catch (err) {
      showToast(err.message);
      if (err.message.includes("Not logged in")) setView("auth");
    }
  });
}

async function boot() {
  wireTabs();
  wireBrowse();
  wireAuth();
  wireAddPet();

  setView("browse");

  try {
    await refreshMe();
  } catch (err) {
    showToast(err.message);
  }

  try {
    await loadPetsFromFilters();
  } catch (err) {
    showToast(err.message);
  }
}

boot();
