# Intelligence Platform

This folder now contains a real full-stack project rebuilt from the loose files you were given.

## Project structure

```text
ip/
|-- backend/   Django REST API, scraper, and RAG pipeline
`-- frontend/  React + Vite interface
```

## What was fixed

- turned the loose Python files into a runnable Django project
- added missing serializers, URLs, settings, admin config, and migrations
- turned the loose React pages into a real Vite app with routing and shared components
- added local fallback logic so the app still works without an Anthropic API key
- added Windows-friendly setup files and environment examples

## Run on Windows

### Backend

Open a terminal in:

```powershell
C:\Users\Soham\Downloads\ip\backend
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create the environment file:

```powershell
Copy-Item .env.example .env
```

If you have an Anthropic API key, edit `.env` and set:

```env
ANTHROPIC_API_KEY=your_key_here
```

Run migrations:

```powershell
python manage.py migrate
```

Start the backend:

```powershell
python manage.py runserver
```

Backend URL: `http://127.0.0.1:8000/api/`

### Frontend

Open a second terminal in:

```powershell
C:\Users\Soham\Downloads\ip\frontend
```

Install packages:

```powershell
npm.cmd install
```

Create the frontend env file:

```powershell
Copy-Item .env.example .env
```

Start the frontend:

```powershell
npm.cmd run dev
```

Frontend URL: `http://127.0.0.1:5173`

## How to use it

1. Open the frontend.
2. Click `Scrape books`.
3. Keep the default URL `https://books.toscrape.com`.
4. Choose how many pages to scrape.
5. Wait for the library to populate.
6. Browse books or open `Q and A` to ask questions.

## Important AI note

If `ANTHROPIC_API_KEY` is empty, the app still runs.

In that mode:

- scraping works
- summaries, genres, and sentiment use local fallback logic
- Q and A uses database-backed fallback answers
- answers are simpler than the Claude-powered version

## Quick troubleshooting

- confirm `python --version` works
- confirm `node --version` works
- start the backend before the frontend
- check that the frontend `.env` points at `http://127.0.0.1:8000/api`

## Hosting

The project is now prepared for:

- `Render` for the Django backend
- `Vercel` for the React frontend

### Backend on Render

Files already added:

- [render.yaml](</C:/Users/Soham/Downloads/ip/render.yaml>)
- [backend/build.sh](</C:/Users/Soham/Downloads/ip/backend/build.sh>)
- [backend/runtime.txt](</C:/Users/Soham/Downloads/ip/backend/runtime.txt>)

Steps:

1. Push this project to GitHub.
2. Open Render and create a new Blueprint using the repo.
3. Render will read `render.yaml` and create:
   - a PostgreSQL database
   - a Python web service
4. In Render, set the missing secret env vars:
   - `NVIDIA_API_KEY`
   - if needed, custom `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`
5. After deploy, copy your backend URL.

### Frontend on Vercel

Files already added:

- [frontend/vercel.json](</C:/Users/Soham/Downloads/ip/frontend/vercel.json>)
- [frontend/.env.production.example](</C:/Users/Soham/Downloads/ip/frontend/.env.production.example>)

Steps:

1. Import the same GitHub repo into Vercel.
2. Set the project root directory to `frontend`.
3. Add environment variable:
   - `VITE_API_BASE_URL=https://your-render-backend-url/api`
4. Deploy.

### Before you deploy

- regenerate your NVIDIA key because the old one was pasted in chat
- update `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to your real Vercel URL
- keep `DEBUG=False` in production

## Original loose files

The original source files are still in the root folder for reference.
