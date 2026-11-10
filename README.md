# IIIT Bhubaneswar Mess Management System

A web app for the IIIT Bhubaneswar mess. Students pre-order meals and show one QR code at the counter. Mess staff scan it to serve the meal, and the admin tracks payments, analytics and grievances. It works on phones and can be added to the home screen like an app.

## Features

**Student** (`/`)
- **Menu & Order:** see the weekly menu, pick from options such as *Chicken Curry or Paneer Curry*, and order breakfast, lunch or dinner up to 7 days ahead.
- **Payment:** UPI or Card (both simulated), or Cash (paid at the counter when the meal is served).
- **My Orders & QR:** order history, total spent, and one permanent personal QR code (`STU-XXXXXXXX`).
- **Notice Board:** notices from the mess and the admin.
- **Grievance / Contact:** raise a complaint with up to 3 photos or videos and track whether it has been resolved.

**Mess staff** (`/mess`)
- **Verify QR:** scan a student's QR with the camera, or type the code or roll number. This shows the student's orders, nearest meal first, and you tick an order to mark it served.
- **Menu / Update Menu:** view and edit the menu for each day and meal.
- **Notices** and **Grievances:** post notices, and view and resolve complaints.

**Admin** (`/admin`)
- **Analytics:** revenue, orders, meals served vs pending, veg/non-veg split, payment methods, daily revenue and grievance stats (charts made with Chart.js).
- **Payments:** every order with its payment status, plus the cash still to be collected.
- **Update Menu & Prices**, **Notices** and **Grievances**.

## Meal rules

| Meal | Serving time (IST) | Ordering closes | Default price |
|---|---|---|---|
| Breakfast | 7:30am to 9:00am | 7 hours before start | ₹30 |
| Lunch | 12:30pm to 2:30pm | 1 hour before start | ₹65 |
| Dinner | 7:30pm to 9:00pm | 1 hour before start | ₹55 |

- A meal can be marked served only from 30 minutes before it starts until 30 minutes after it ends.
- Each meal can be ordered once per student per day.
- A cash order shows as *cash due* until the meal is served, then it becomes *paid*. Admin revenue counts only money already collected.

## Tech stack

- **Backend:** Node.js and Express, with Multer for file uploads. Data is stored in PostgreSQL (e.g. a free [Neon](https://neon.tech) database).
- **Frontend:** plain HTML, CSS and JavaScript (no build step). It also uses Chart.js, qrcodejs and html5-qrcode, loaded from a CDN.
- **Hosting:** runs locally with `npm start`, or on Vercel as a serverless function.

## Project structure

```
iiit-bh-mess-lab-project/
├── backend/
│   ├── server.js        Express REST API (also serves the frontend locally)
│   ├── data.json        menu, prices, orders, notices, grievances
│   └── package.json
├── public/              frontend (Vercel serves this folder as-is)
│   ├── index.html       student page
│   ├── mess.html        mess staff page
│   ├── admin.html       admin page
│   ├── app.js           shared UI logic for all three pages
│   ├── style.css
│   ├── manifest.json    "Add to Home Screen" support
│   └── assets/logo.png
├── api/index.js         Vercel entry point (loads backend/server.js)
├── vercel.json          Vercel routing
└── package.json         dependencies that Vercel installs
```

## Run locally

Requires Node.js 18 or newer.

```bash
cd backend
npm install
echo 'DATABASE_URL="postgresql://..."' > .env    # your Postgres connection string; .env is git-ignored
npm start
```

On first start the server creates its tables. If the database is empty, it imports `backend/data.json` once. After that, `data.json` is no longer used.

Open http://localhost:3000. At startup the server also prints an address like `http://<your-ip>:3000`, which you can open on a phone connected to the same Wi-Fi.

## Logins (demo mode)

| Role | URL | How to log in |
|---|---|---|
| Student | `/` | Roll number in the format `BXYYZZZ`: B, a branch code, a 2-digit joining year and a 3-digit number (e.g. `B522001`) |
| Mess staff | `/mess` | Click "Enter mess dashboard" (no password) |
| Admin | `/admin` | Click "Enter admin dashboard" (no password) |

> ⚠️ Demo mode lets anyone who opens `/mess` or `/admin` get in. To require passwords, start the server with `STAFF_PASSWORD_LOGIN=1 npm start`. The staff logins are then `admin@test.in` / `@Admin123` and `mess1@test.in` / `@Mess001`.

## Deploy on Vercel

1. Import this GitHub repository at [vercel.com](https://vercel.com). Choose the framework preset **Other** and keep the root directory as the repo root.
2. Add the environment variables:
   - `DATABASE_URL`: your Neon **pooled** connection string (the host contains `-pooler`).
   - `SESSION_SECRET`: any long random string. Without it, users get logged out at random.
3. Deploy. The student, mess and admin pages are at `/`, `/mess` and `/admin`.

**Limitations on Vercel**
- Vercel rejects requests larger than 4.5 MB, so grievance uploads are limited to 4 MB in total.
- Every request reads all the data from the database. This is fine for a semester of orders. With much more data, the handlers should switch to targeted SQL queries.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. **Required** |
| `PORT` | Local server port (default `3000`) |
| `SESSION_SECRET` | Key used to sign login tokens. **Required on Vercel** |
| `STAFF_PASSWORD_LOGIN=1` | Turns off demo login and requires staff passwords |

## Notes

- Scanning a QR with the camera needs HTTPS or localhost. Over plain `http` on a phone, type the code instead.
- Payment is simulated in `POST /api/orders`. A real gateway such as Razorpay or PhonePe can be connected there.
- Grievance uploads accept JPG, PNG, GIF, WEBP and HEIC images and MP4, WEBM and MOV videos, up to 3 files and 4 MB in total. They are stored in the database. Only the student who uploaded them, the mess staff and the admin can view them.
- Menu format: one dish per line. `A | B` means the student picks one, and `(NV)` marks a non-veg dish.
