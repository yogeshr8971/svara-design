# SVARA upgrade notes

## Install
```
cd backend  && npm install        # adds nodemailer, web-push
cd frontend && npm install
cp backend/.env.example backend/.env   # then fill in SMTP, SMS, VAPID, UPI
cd backend && npm run vapid            # prints VAPID keys -> .env
cd backend && npm run migrate:verification   # ONCE: grandfather existing users as email-verified
```

## What changed
| Area | Behaviour |
|---|---|
| Register | name + email + **mobile** + password -> codes sent by **email and SMS** -> both verified -> session. Sellers use the same flow, then wait for admin approval. |
| Login | email + password -> **email OTP** -> session. Set `LOGIN_EMAIL_OTP=false` for password-only. |
| Session | Server-side `Session` (httpOnly cookie, sliding 365 days). Stays until Logout; logout revokes it server-side. `POST /api/auth/logout-all` signs out every device. |
| Notifications | In-app bell (30 s poll) + **Web Push** (works with the site closed) + **email** for important events. |
| Seller alerts | Product submitted / approved / rejected / removed, seller approved / rejected / suspended, profile-change result, new order to fulfil. |
| Customer alerts | Order placed, payment received, shipped (courier + tracking), delivered, cancelled, UPI verification result. |
| Orders | `/orders/:id` tracking page with timeline. `statusHistory` stored on the order. |
| Payment status | `pending` -> `confirmed` (COD) -> `paid`. COD orders start **confirmed** and become **paid** when delivered. Online/UPI become **paid** when verified. |
| UPI | Direct UPI: customer pays `UPI_VPA`, enters 12-digit UTR, **admin verifies** in Admin > Orders. Razorpay checkout also still offers UPI. |
| Curate Look | Each stage is a Category. `GET /api/curate-categories/:slug/products` returns the same products Shop All shows for that category (shared rules in `backend/utils/productQuery.js`). The stage slug must match exactly - an unknown slug is a 404, never "every product". |

## Things you must do / know
* **SMS in India needs DLT registration** (sender ID + approved template). MSG91 or Twilio are wired; `console` is dev-only and refused in production.
* **Web Push needs HTTPS** and user permission. iPhone/iPad only after "Add to Home Screen" (iOS 16.4+). Never guaranteed, so email is the reliable fallback.
* Cross-domain hosting (e.g. Vercel + Render): set `CROSS_SITE_COOKIES=true`.
* `orderExpiry` runs in-process every 5 min. On serverless (backend/vercel.json) call `expireStaleOrders()` from a cron.
* Direct UPI is **manual verification**. Fully automatic UPI confirmation requires a gateway (use the Razorpay option).
* Refunds for paid-then-cancelled orders are flagged to admins ("Refund needed") but not issued automatically.
* Not run end-to-end here (no MongoDB/network in this sandbox): backend modules load and the order/phone logic was unit-checked; frontend JSX parses. Run `npm run dev` in both and test: register, login OTP, COD, UPI, notifications.
