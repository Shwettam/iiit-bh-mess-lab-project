# IIIT Bhubaneswar Mess Management System
```
iiit-mess/
├── backend/   Express REST API + JSON datastore (data.json auto-created)
└── frontend/  Static HTML/CSS/JS (served by backend, or host anywhere)
```
## Run
```
cd backend && npm install && npm start      # http://localhost:3000
```
## Logins (three separate pages)
| Role | URL | Access |
|---|---|---|
| Student | `/` | **Demo mode:** roll number only, format `BXYYZZZ` (B + branch code + 2-digit joining year + 3-digit number, e.g. `B522001`) |
| Mess staff | `/mess` | **Demo mode:** one-click "Enter mess dashboard" (no password) |
| Admin | `/admin` | **Demo mode:** one-click "Enter admin dashboard" (no password) |

Demo mode is for development only: anyone who can reach `/admin` or `/mess` gets in. When passwords are added later, start with `STAFF_PASSWORD_LOGIN=1 npm start` to bring back the email/password form (admin@test.in / @Admin123, mess1@test.in / @Mess001) and disable the demo endpoint.

## Notes
- QR scanning needs camera permission and HTTPS (or localhost). On a phone, host with HTTPS (e.g. ngrok/Render). A manual code box is a fallback.
- Payment is a simulated UPI/Card step (`POST /api/orders`); plug Razorpay/PhonePe verification in there.
- Grievance photos/videos are stored in `backend/uploads/` (JPG/PNG/GIF/WEBP/HEIC, MP4/WEBM/MOV; 3 files, 25 MB each) and only viewable by the owning student, mess and admin.
- Charts use Chart.js from a CDN.
- Each student has ONE permanent QR (`STU-XXXXXXXX`). Mess scans it and sees that student's orders, nearest meal first; the mess ticks a checkbox next to each order to mark it fulfilled, only within its window (30 min before start to 30 min after end).
- **Phone:** the server prints an `Open on your phone (same Wi-Fi): http://<ip>:3000` address at startup. Camera QR scanning needs HTTPS (e.g. ngrok/Render) on a phone; typing the code works over plain http.
- Add to Home Screen on the phone to install it like an app.
- Payment methods: UPI, Card (simulated) and Cash. A cash order is `cash due` until the mess ticks the meal as fulfilled, at which point it becomes `paid` (the mess collects the cash at the counter). Admin revenue counts collected payments only and shows "Cash to collect" separately.
