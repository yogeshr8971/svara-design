# SVARA — Wear Your Voice (Production-Ready MERN Fashion Marketplace)

A modern, production-ready multi-vendor fashion marketplace and luxury atelier combining curated designer collections with virtual try-on, wardrobe management, credit subscriptions, multi-role governance (Customer, Seller, Admin), exact 60-second OTP verification, automated discount calculation, and an independent Administrator portal.

---

## 🌟 Architecture & Features

- **Decoupled 3-Tier Multi-App Architecture**:
  - `backend/`: Shared Node.js / Express REST API with MongoDB Atlas, Mongoose, and JWT authentication.
  - `frontend/`: Customer storefront and Atelier Seller Studio built with React + Vite.
  - `admin/`: Completely independent React + Vite administration application running on its own port and build pipeline.
- **Role-Based Governance**:
  - **Customer**: Browse, search, curate looks, virtual try-on, cart, checkout with Razorpay/COD, view orders and delivery status.
  - **Seller**: Dedicated Seller Studio, submit catalog products with up to 4 photos, view sales, revenue, and item delivery info. Forbidden from modifying customer order status.
  - **Administrator**: Dedicated independent admin app (`admin/`), product approvals with mandatory shipping fee assignment, order lifecycle control (`Ordered` -> `Shipped` -> `Delivered`), COD collection recording, seller audits, and settlement reports.
- **Exact 60-Second Verification Codes (§5)**:
  - Cryptographically secure OTPs expiring in exactly 60 seconds (`EMAIL_CODE_EXPIRY_MS = 60 * 1000`).
  - Frontend visual countdown timer (`00:59`), submission blocking on expiry, single-use invalidation, and rate limits.
  - Forgot password and reset password flow with multi-session revocation.
- **Visual Box-Style Product Uploader (§6)**:
  - 4 visual upload boxes with drag-and-drop, instant preview, replace, remove, enlarge modal, and magic-byte format validation (JPEG, PNG, WEBP).
- **Mandatory Shipping Fee Assignment (§7)**:
  - Admin must assign a valid shipping fee before approving seller products.
  - Checkout strictly blocks purchase if any product lacks an assigned shipping fee.
- **Automatic Discount Calculation & Display (§8)**:
  - Genuine discount formula: `Discount % = ((Original - Selling) / Original) * 100`.
  - Prominent selling price, strikethrough original price, and badge `↓ X% OFF`.
- **Strict 3-Stage Order Lifecycle (§9)**:
  - Exactly three fulfillment statuses: `Ordered` -> `Shipped` -> `Delivered`.
  - COD payment status tracked independently (`pending` until admin records collection).
- **Automated Itemized Order Notifications (§10)**:
  - Responsive HTML + plain-text email templates for Order Confirmed, Order Shipped (with expected delivery calculation), and Order Delivered.

---

## 🏗 Repository Structure

```text
svara/
├── frontend/                  # Customer storefront & Seller Studio (Vite @ port 5173)
│   ├── public/
│   ├── src/
│   │   ├── components/        # UI primitives, product card, box uploader, try-on
│   │   ├── context/           # Auth, Cart, Wishlist, Credit providers
│   │   ├── pages/             # Shop, ProductDetail, Checkout, Orders, SellerDashboard
│   │   ├── services/          # Customer & Seller API clients
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── admin/                     # Independent Administrator Application (Vite @ port 5174)
│   ├── public/
│   ├── src/
│   │   ├── components/        # Admin UI, layout, navbar, sidebar, box uploader
│   │   ├── context/           # AdminAuthContext
│   │   ├── pages/             # Dashboard, Approvals, Orders, Catalog, Sellers, Settlements
│   │   ├── services/          # Admin API client
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # Shared REST API (Express @ port 5000)
│   ├── config/                # Database & Cloudinary configurations
│   ├── controllers/           # Auth, Product, Order, Admin, Seller controllers
│   ├── middleware/            # Auth, AdminGuard, SellerGuard, Multer, Rate limiters
│   ├── models/                # User, Product, Order, Otp schemas
│   ├── routes/                # API routes
│   ├── services/              # OTP, Order emails, Razorpay, Cloudinary
│   ├── tests/                 # Architectural test suite
│   ├── utils/                 # Magic-byte validation, discount calculation, ApiError
│   ├── server.js              # Server entry point with multi-origin CORS
│   └── package.json
│
├── README.md
└── UPGRADE_NOTES.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites

- **Node.js** v18+ or v20+
- **MongoDB** running locally or a MongoDB Atlas connection string
- **Cloudinary** account (for image storage)
- **SMTP credentials** (Gmail, Brevo, SendGrid, etc. for OTP & order emails)

---

### 2. Backend Setup

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Configure `.env` with your credentials:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/svara
   JWT_SECRET=your_jwt_secret_here
   CLIENT_URL=http://localhost:5173
   ADMIN_URL=http://localhost:5174
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   ```
5. Seed initial data (optional):
   ```bash
   npm run seed
   ```
6. Run the automated architectural verification test suite:
   ```bash
   npm test
   ```
7. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will boot up at `http://localhost:5000`.*

---

### 3. Customer & Seller Frontend Setup

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The customer storefront and seller studio will be live at `http://localhost:5173`.*

---

### 4. Independent Admin Application Setup

1. Open a third terminal and navigate to `admin/`:
   ```bash
   cd admin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
   *Verify `VITE_API_URL=http://localhost:5000/api`.*
4. Start the Admin Vite development server:
   ```bash
   npm run dev
   ```
   *The SVARA Admin Portal will run independently at `http://localhost:5174`.*

---

## 🔑 Default Credentials

- **Administrator**:
  - Access portal: `http://localhost:5174`
  - Email: `admin@svara.in`
  - Password: `Admin@123`
- **Seller**:
  - Access studio: `http://localhost:5173/seller/login`
  - Can apply at: `http://localhost:5173/seller/register` (approved by admin)
- **Customer**:
  - Access storefront: `http://localhost:5173`

---

## 🧪 Testing & Verification

Run the comprehensive automated test suite inside `backend/`:
```bash
cd backend
npm test
```
Verifies:
- 60-second OTP expiry and countdown mechanics
- Automatic discount calculation formula and compareAtPrice validation
- 4-photo upload limit and magic-byte validation
- Strict 3-stage order status transitions (`Ordered` -> `Shipped` -> `Delivered`)
- Independent Cash on Delivery payment status tracking
- Mandatory admin shipping fee assignment and checkout enforcement

To verify production builds:
```bash
# In frontend/
npm run build

# In admin/
npm run build
```
