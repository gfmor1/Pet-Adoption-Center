const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";

const DATA_DIR = path.join(__dirname, "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const PETS_PATH = path.join(DATA_DIR, "pets.json");

ensureFile(USERS_PATH, "[]");
ensureFile(PETS_PATH, "[]");

/* Middleware */
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" }
  })
);

/* Static */
app.use(express.static(path.join(__dirname, "public")));

/* Helpers */
function ensureFile(filePath, defaultContent) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, defaultContent, "utf-8");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return data;
}

function writeJsonAtomic(filePath, value) {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function isLoggedIn(req) {
  return Boolean(req.session && req.session.user);
}

function requireAuth(req, res) {
  if (isLoggedIn(req)) return true;
  res.status(401).json({ error: "Not logged in." });
  return false;
}

function normalizeLowerDash(s) {
  return String(s || "").trim().toLowerCase();
}

function validateUsername(username) {
  const u = String(username || "");
  const ok = /^[a-zA-Z0-9_]{3,20}$/.test(u);
  return ok;
}

function validatePassword(password) {
  const p = String(password || "");
  const okLen = p.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(p);
  const hasDigit = /[0-9]/.test(p);
  return okLen && hasLetter && hasDigit;
}

function validatePet(payload) {
  const errors = [];

  const animal = normalizeLowerDash(payload.animal);
  const breed = normalizeLowerDash(payload.breed);
  const ageGroup = normalizeLowerDash(payload.ageGroup);
  const gender = normalizeLowerDash(payload.gender);

  const allowedAnimals = ["dog", "cat"];
  const allowedAges = ["puppy/kitten", "young", "adult", "senior"];
  const allowedGender = ["male", "female"];

  if (!allowedAnimals.includes(animal)) errors.push("animal must be dog or cat.");
  if (breed.length < 2) errors.push("breed is required (>= 2 chars).");
  if (!allowedAges.includes(ageGroup)) errors.push("ageGroup is invalid.");
  if (!allowedGender.includes(gender)) errors.push("gender is invalid.");

  const compat = Array.isArray(payload.compatibility) ? payload.compatibility : [];
  const allowedCompat = ["dogs", "cats", "children"];
  const cleanCompat = [];
  for (const item of compat) {
    const v = normalizeLowerDash(item);
    if (allowedCompat.includes(v) && !cleanCompat.includes(v)) cleanCompat.push(v);
  }

  const description = String(payload.description || "").trim();
  if (description.length < 10) errors.push("description must be at least 10 characters.");
  if (description.length > 300) errors.push("description must be <= 300 characters.");

  const imageUrl = String(payload.imageUrl || "").trim();
  const safeImage =
    imageUrl === "" ||
    imageUrl.startsWith("/images/");

  if (!safeImage) errors.push("imageUrl must be empty or start with /images/.");

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      animal,
      breed,
      ageGroup,
      gender,
      compatibility: cleanCompat,
      description,
      imageUrl: imageUrl || "/images/dog2.svg"
    }
  };
}

/* Auth API */
app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!validateUsername(username)) {
    res.status(400).json({ error: "Username must be 3-20 chars: letters, digits, underscore." });
    return;
  }

  if (!validatePassword(password)) {
    res.status(400).json({ error: "Password must be >= 6 chars and include letters + digits." });
    return;
  }

  const users = readJson(USERS_PATH);
  const exists = users.some(u => u.username === username);
  if (exists) {
    res.status(409).json({ error: "Username already exists." });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  users.push({ username, passwordHash: hash, createdAt: new Date().toISOString() });
  writeJsonAtomic(USERS_PATH, users);

  res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const users = readJson(USERS_PATH);
  const user = users.find(u => u.username === username);

  if (!user) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  req.session.user = { username };
  res.json({ ok: true, username });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!isLoggedIn(req)) {
    res.json({ loggedIn: false });
    return;
  }
  res.json({ loggedIn: true, username: req.session.user.username });
});

/* Pets API */
app.get("/api/pets", (req, res) => {
  const pets = readJson(PETS_PATH);

  const animal = normalizeLowerDash(req.query.animal);
  const ageGroup = normalizeLowerDash(req.query.ageGroup);
  const gender = normalizeLowerDash(req.query.gender);
  const breed = normalizeLowerDash(req.query.breed);
  const status = normalizeLowerDash(req.query.status);

  const compatCsv = String(req.query.compat || "").trim();
  const compatWanted = compatCsv
    .split(",")
    .map(s => normalizeLowerDash(s))
    .filter(Boolean);

  const filtered = pets.filter(p => {
    if (status && p.status !== status) return false;
    if (animal && p.animal !== animal) return false;
    if (ageGroup && p.ageGroup !== ageGroup) return false;
    if (gender && p.gender !== gender) return false;
    if (breed && breed !== "any" && p.breed !== breed) return false;

    if (compatWanted.length > 0) {
      for (const c of compatWanted) {
        if (!p.compatibility.includes(c)) return false;
      }
    }
    return true;
  });

  res.json(filtered);
});

app.post("/api/pets", (req, res) => {
  const okAuth = requireAuth(req, res);
  if (!okAuth) return;

  const check = validatePet(req.body);
  if (!check.ok) {
    res.status(400).json({ error: "Validation failed.", details: check.errors });
    return;
  }

  const pets = readJson(PETS_PATH);
  const nextId = pets.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;

  const pet = {
    id: nextId,
    ownerUsername: req.session.user.username,
    ...check.normalized,
    status: "available",
    createdAt: new Date().toISOString()
  };

  pets.push(pet);
  writeJsonAtomic(PETS_PATH, pets);

  res.json(pet);
});

app.patch("/api/pets/:id/status", (req, res) => {
  const okAuth = requireAuth(req, res);
  if (!okAuth) return;

  const id = Number(req.params.id);
  const status = normalizeLowerDash(req.body.status);

  if (!["available", "adopted"].includes(status)) {
    res.status(400).json({ error: "status must be available or adopted." });
    return;
  }

  const pets = readJson(PETS_PATH);
  const idx = pets.findIndex(p => Number(p.id) === id);

  if (idx === -1) {
    res.status(404).json({ error: "Pet not found." });
    return;
  }

  const pet = pets[idx];
  if (pet.ownerUsername !== req.session.user.username) {
    res.status(403).json({ error: "You can only update your own listings." });
    return;
  }

  pets[idx] = { ...pet, status };
  writeJsonAtomic(PETS_PATH, pets);
  res.json(pets[idx]);
});

/* SPA fallback */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
