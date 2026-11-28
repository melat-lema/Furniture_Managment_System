# Gorgeous Furniture: public website

A separate website (React + Vite + Tailwind + Framer Motion + Three.js) that shows the catalog from your system.
Only products you switch on with **"Show on website"** appear. Stock numbers, costs and customer data are never sent.

## Run it
```bash
cd website
npm install
cp .env.example .env     # on Windows Git Bash this works too
npm run dev              # http://localhost:5174
```
The backend must be running (port 3000). If it is not, the website still opens with demo pieces.

## Backend settings (backend/.env)
```
# add the website address next to the staff app (comma separated)
FRONTEND_URL=http://localhost:5173,http://localhost:5174

# optional: used by the website and the chatbot
SITE_PHONE=+251 911 000000
SITE_WHATSAPP=251911000000
SITE_OPENING_HOURS=Monday to Saturday, 8:30 AM to 6:30 PM
PUBLIC_SHOW_PRICES=true        # false hides every price on the website and in the chatbot
```
Restart the backend after changing it.

## What to edit
| What | Where |
|---|---|
| Phone, WhatsApp, email, social links | `website/.env` (or the backend `.env` for phone, WhatsApp and hours) |
| Headline and texts | `src/sections/Hero.tsx`, `Craft.tsx`, `Process.tsx` |
| Colours and fonts | `src/index.css` (the `@theme` block) |
| Chatbot answers and words it understands | `backend/src/public/chatbot.service.ts` |
| Which pieces appear | In the staff system: edit a product and switch on "Show on website" |

## Build for production
```bash
npm run build     # creates the dist folder
```
Upload `dist` to any static host (Netlify, Vercel, Cloudflare Pages are free). In `website/.env` set
`VITE_API_URL=https://your-backend-address/api` before building, and add the website address to `FRONTEND_URL` on the backend.
