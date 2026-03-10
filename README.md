<div align="center">

<img src="./public/coats_login.png" alt="CoATS Logo" width="420" />

<br/>
<br/>

# **CoATS V2**
### **Co**mplaint **A**dministration & **T**racking **S**ystem

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

<br/>

> **A modern, secure, full-stack complaint & case tracking platform built for law enforcement agencies.**  
> Empowering officers and supervisors with real-time visibility, enterprise-grade authentication, and data-driven dashboards.

<br/>

[📋 Features](#-features) • [🔐 Security](#-security--authentication) • [🏗 Architecture](#-architecture) • [⚡ Getting Started](#-getting-started) • [📊 Dashboard](#-analytics--dashboard) • [🗂 Database Schema](#-database-schema) • [🚀 Deployment](#-deployment)

</div>

---

<br/>

## 🌟 What is CoATS?

**CoATS (Complaint Administration & Tracking System)** is a purpose-built internal platform for law enforcement departments to efficiently **register, manage, track, and analyse** criminal complaints and cases across multiple branches. 

Built from the ground up as a **V2 rewrite**, CoATS replaces legacy manual workflows with a secure, auditable, and scalable digital system — delivering a unified experience for both field officers and supervisory personnel.

<br/>

---

## 📋 Features

### 🗂 Case Management
| Feature | Description |
|---|---|
| **Case Registration** | Register new complaints with crime number, complainant details, and branch assignment |
| **Stage Tracking** | Cases progress through defined legal stages (e.g., Under Investigation, Charge-sheeted, etc.) |
| **Case Actions** | Add discrete, completable action items against each case |
| **Progress Logs** | Log detailed progress entries with reminder dates and further action notes |
| **Officer Assignment** | Assign and reassign cases to specific investigating officers |
| **Branch Scope** | Officers see only their branch cases; supervisors see all |

### 👤 Role-Based Access Control
| Role Type | Access Level |
|---|---|
| **Officer** | View & manage own branch cases, log progress, complete actions |
| **Supervisory** | Access all branches, full dashboard analytics, all-cases view |

### 📊 Analytics & Dashboard
- **Multi-chart visual dashboard** — Bar, Line, Area, Pie, Radar, and Radial charts
- Stage-wise and branch-wise case distribution at a glance
- Date-range filtering for trend analysis
- Real-time counts powered by server-side aggregation

### 🔐 Security & Authentication
- **Password + TOTP (Two-Factor)** authentication flow
- **Passkey / WebAuthn (FIDO2)** — biometric & hardware key login  
- **JWT access & refresh tokens** with automatic rotation
- **Rate limiting** on all auth endpoints
- **Full audit logging** — every login, 2FA event, and passkey event is recorded with IP address

<br/>

---

## 🔐 Security & Authentication

CoATS implements a **layered, defense-in-depth authentication architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                         │
│                                                         │
│  Username + Password  ──►  bcrypt verify               │
│         │                                               │
│         ▼                                               │
│   2FA Pending JWT  ──►  TOTP / Passkey challenge       │
│         │                                               │
│         ▼                                               │
│   Access Token (15m)  +  Refresh Token (7d)            │
│         │                                               │
│         ▼                                               │
│   Edge Middleware validates JWT on every request       │
└─────────────────────────────────────────────────────────┘
```

### 🔑 Authentication Methods

#### 1. Password Authentication
- Passwords hashed with **bcryptjs** (salted, adaptive cost)
- Protected by a **sliding-window rate limiter** (in-memory, production-swappable to Redis)

#### 2. TOTP (Time-Based One-Time Password)
- RFC 6238-compliant TOTP via **otpauth**
- TOTP secrets encrypted at rest using **AES-256-GCM** (see `crypto.ts`)
- **Backup codes** stored as bcrypt hashes — single-use recovery
- **Account lockout** after repeated TOTP failures (`totpFailedCount`, `totpLockedUntil`)
- QR code setup flow powered by **qrcode** library
- Compatible with Google Authenticator, Authy, and any TOTP app

#### 3. Passkey / WebAuthn (FIDO2)
- Full **WebAuthn Level 2** implementation via **@simplewebauthn/server**
- Supports **platform authenticators** (Face ID, Touch ID, Windows Hello) and **roaming authenticators** (YubiKey, etc.)
- Credential challenges stored in the DB (survives serverless cold starts & HMR reloads)
- Challenge TTL: **5 minutes** — expired challenges are automatically rejected
- Supports `singleDevice` and `multiDevice` credential types
- Transports tracked per credential (`internal`, `usb`, `ble`, `nfc`)

### 🛡 JWT Token Strategy
```
Access Token  — HS256, 15-minute TTL, carries full user context
Refresh Token — HS256, 7-day TTL, carries only userId
2FA Pending   — Short-lived intermediate token between password and OTP step
```
All tokens are verified at the **Edge via Next.js Middleware** — zero latency, zero database roundtrips for route protection.

### 📝 Audit Logging
Every security event is logged to the `audit_logs` table with:
- `userId` — who triggered the event
- `action` — `LOGIN_SUCCESS`, `PASSKEY_REGISTERED`, `TOTP_VERIFY_FAILED`, etc.
- `detail` — contextual metadata
- `ipAddress` — extracted from `x-forwarded-for` / `x-real-ip` headers (proxy-aware)

<br/>

---

## 🏗 Architecture

```
CoATS V2
├── Next.js 16 App Router (React Server + Client Components)
│
├── src/app/
│   ├── (auth)/              # Public: Login, Two-Factor
│   ├── (app)/               # Protected: Dashboard, Cases, Progress
│   └── api/                 # REST API routes (Route Handlers)
│       ├── auth/            # Login, Logout, 2FA, Passkey, Refresh
│       ├── cases/           # CRUD + pagination + stage filtering
│       ├── branches/        # Branch lookup
│       ├── stages/          # Stage lookup
│       ├── dashboard/       # Aggregated analytics
│       └── actions/         # Case action completion
│
├── src/lib/
│   ├── auth.ts              # JWT sign / verify utilities
│   ├── passkey.ts           # WebAuthn registration & authentication
│   ├── totp.ts              # TOTP setup, verify, backup codes
│   ├── crypto.ts            # AES-256-GCM encryption/decryption
│   ├── audit.ts             # Audit log writer (fire-and-forget)
│   ├── rate-limit.ts        # Sliding-window rate limiter
│   ├── api-auth.ts          # API route auth helpers
│   └── prisma.ts            # Prisma client singleton
│
├── src/middleware.ts         # Edge JWT guard + RBAC route protection
│
├── prisma/
│   ├── schema.prisma         # Full DB schema
│   └── seed.ts              # Seed data for dev
│
└── src/components/
    ├── AuthProvider.tsx      # Client-side auth context
    ├── layout/              # Header, Sidebar
    └── ui/                  # shadcn/ui + custom components
```

<br/>

---

## 📊 Analytics & Dashboard

The supervisory dashboard renders **6 distinct chart types** using **Recharts** + shadcn chart wrappers:

| Chart Type | Data Shown |
|---|---|
| **Bar Chart** | Case counts per branch, grouped by stage |
| **Pie Chart** | Overall stage distribution across all branches |
| **Area Chart** | Cumulative case trends over time |
| **Line Chart** | Stage progression timelines |
| **Radar Chart** | Branch performance comparison across stages |
| **Radial Bar Chart** | Case completion / resolution rate |

All charts support **date-range filtering** and render responsively across screen sizes.

<br/>

---

## 🗂 Database Schema

CoATS uses **PostgreSQL** with a fully normalised schema managed by **Prisma**:

```
branches          → offices / regional units
roles             → officer roles (supervisory flag)
users             → officers + auth fields (TOTP, Passkey, JWT state)
passkeys          → WebAuthn credentials (FIDO2, per-device)
cases             → core case entity (crime number, stage, officer, branch)
case_actions      → discrete tasks per case (completable)
case_progress     → dated progress entries with reminders
audit_logs        → immutable security event log
case_stages       → lookup table for case lifecycle stages
```

Key design decisions:
- `webauthnChallenge` stored **on the user row** (not in-memory) — safe for serverless & multi-replica deployments
- TOTP secrets stored **AES-256-GCM encrypted** — never in plaintext
- Backup codes stored as **bcrypt hashes** — usable only once
- All timestamps are `createdAt` tracked; `lastUsedAt` is tracked per passkey credential
- Composite uniqueness on `(crimeNumber, branchId)` — same crime number can exist in different branches

<br/>

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** database (local or cloud, e.g. Supabase / Neon)
- `npm` / `pnpm` / `yarn`

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd "CoATS V2"
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# ── Database ─────────────────────────────────────────
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB"

# ── JWT ──────────────────────────────────────────────
JWT_SECRET="your-super-secret-at-least-32-chars"

# ── WebAuthn / Passkey ────────────────────────────────
NEXT_PUBLIC_APP_NAME="CoATS"
WEBAUTHN_RP_ID="localhost"               # your domain in prod (e.g. coats.yourdomain.com)
WEBAUTHN_ORIGIN="http://localhost:3000"  # your origin in prod (e.g. https://coats.yourdomain.com)

# ── TOTP Encryption ───────────────────────────────────
TOTP_ENCRYPTION_KEY="32-byte-hex-key"    # AES-256 key for TOTP secret encryption
```

### 3. Database Setup

```bash
# Push schema to your database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access CoATS.

<br/>

---

## 🚀 Deployment

CoATS is optimised for deployment on **Vercel** with **Prisma Accelerate**:

### Build

```bash
npm run build   # Runs `prisma generate` then `next build`
npm run start   # Start production server
```

### Vercel Deployment

1. Push to GitHub and connect the repo to Vercel
2. Add all environment variables in the Vercel dashboard
3. Set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to your production domain
4. Enable **Prisma Accelerate** for connection pooling at scale

### Database

- Recommended: **Supabase** or **Neon** (serverless PostgreSQL)
- Use `DATABASE_URL` with connection pooling and `DIRECT_DATABASE_URL` for migrations

<br/>

---

## 🛠 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server (webpack mode) |
| `npm run build` | Generate Prisma client + production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema changes (no migration files) |
| `npm run db:seed` | Seed the database with initial data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:reset` | Reset and re-run all migrations |

<br/>

---

## 📦 Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS 4 + shadcn/ui + Radix UI |
| **Charts** | Recharts 2 |
| **ORM** | Prisma 6 + Prisma Accelerate |
| **Database** | PostgreSQL |
| **Auth — Tokens** | jose (JWT HS256) |
| **Auth — Passwords** | bcryptjs |
| **Auth — TOTP** | otpauth + qrcode |
| **Auth — Passkeys** | @simplewebauthn/server & browser |
| **Encryption** | Node.js `crypto` (AES-256-GCM) |
| **Date Handling** | date-fns 4 |
| **Notifications** | sonner |
| **Deployment** | Vercel |

</div>

<br/>

---

## 🤝 Why We Built This

Law enforcement departments often rely on paper-based or spreadsheet-driven case tracking — leading to:
- **Lost or misfiled cases** with no audit trail
- **No visibility** for supervisors across branches
- **Zero accountability** on action items
- **Insecure access** with no multi-factor authentication

CoATS V2 was built to solve all of this. By digitising the entire case lifecycle — from registration to resolution — and wrapping it in enterprise-grade security (FIDO2, TOTP, audit logs, RBAC), CoATS gives agencies a **single source of truth** that is fast, auditable, and accessible on any device.

<br/>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

<br/>

---

<div align="center">

<img src="./public/coats_icon_header.png" alt="CoATS Icon" width="64" />

<br/>

**CoATS V2** — Built with precision, secured by design.

</div>
