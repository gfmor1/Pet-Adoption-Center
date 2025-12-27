# Pet Adoption Center (Paw & Home Pro)

A simple, internship-ready full-stack web app for browsing and managing pet adoption listings.  
Built with **Node.js + Express** and a clean **vanilla HTML/CSS/JS** frontend.

## What it does
- **Browse pets** with **server-backed filters** (animal, age group, gender, status, breed slug, compatibility)
- **List a pet** (creates a new listing that appears in Browse)
- **Login/Register** with session-based auth
- Data persists in JSON files (easy to run locally)

## Tech Stack
- Backend: Node.js, Express
- Frontend: HTML, CSS, Vanilla JS (fetch/AJAX)
- Storage: JSON files (`/data/users.json`, `/data/pets.json`)

## Project Structure
Pet-Adoption-Center/
server.js
package.json
package-lock.json
.env.example
data/
users.json
pets.json
public/
index.html
css/
styles.css
js/
api.js
app.js
images/
dog1.jpg (or .svg/.png)
cat1.jpg (or .svg/.png)


## Setup (Windows PowerShell)
From the repo folder:

```powershell
npm install
npm start


Open:

http://localhost:3000

Environment Variables

Create a .env file based on .env.example:

Copy-Item .env.example .env


Do not commit .env (it contains secrets/config). This repo should include .gitignore with .env.

Images (important)

If a pet has:

"imageUrl": "/images/dog1.jpg"


Then the file must exist at:

public/images/dog1.jpg


Quick test:

http://localhost:3000/images/dog1.jpg

Data Notes

Users stored in: data/users.json

Pets stored in: data/pets.json

Listing a pet appends a new object into pets.json

API Endpoints (typical)

(These may vary depending on your server.js, but the app expects routes like these.)

GET /api/pets → list pets (supports query filters)

POST /api/pets → create a pet listing (requires login)

POST /api/register → create user

POST /api/login → login

POST /api/logout → logout

GET /api/me → current session user

Scripts

npm start → runs the server (production-style)

npm run dev → runs the server (same as start for now)

Deployment (Render)

High-level:

Push this repo to GitHub

Create a Render Web Service

Build command: npm install

Start command: npm start

Note: JSON file storage is simplest locally. For real deployments, a DB (SQLite/Postgres) is better.

Roadmap / Ideas

Favorites (save pets you like)

Contact owner (messages stored server-side)

Admin moderation (approve listings)

Image uploads (instead of typing /images/...)

Replace JSON storage with SQLite

License

MIT (or remove this section if you don’t want a license)


If you paste your `server.js` routes (or just the top part where endpoints are defined), I’ll make the “API Endpoints” section match your project exactly so it looks professional and accurate.
::contentReference[oaicite:0]{index=0}
