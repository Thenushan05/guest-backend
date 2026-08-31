# Guest House Management System — Backend API

A production-ready REST API for a Guest House Management System, built with **NestJS**, **TypeScript**, **Prisma ORM** and **MySQL**. Two roles are supported — **ADMIN** and **CUSTOMER** — covering room management, image uploads (Cloudinary), offers/discounts, and a fully server-validated booking lifecycle with double-booking prevention.

## Tech stack

- NestJS 10 + TypeScript (strict mode)
- MySQL via Prisma ORM
- JWT auth (access + rotating refresh tokens) with Passport.js
- bcrypt password hashing
- class-validator / class-transformer DTO validation
- Swagger / OpenAPI docs
- Multer + Cloudinary for room image uploads
- Helmet, CORS, rate limiting (`@nestjs/throttler`)

## Project structure

```
src/
├── auth/            # register, login, refresh, logout, me — JWT strategy
├── users/           # admin: list/view/activate-block customers
├── room-types/      # Standard / Deluxe / Family / Suite, etc.
├── facilities/      # WiFi, AC, TV, ... (many-to-many with Room)
├── rooms/           # CRUD + images (upload/delete/reorder/primary)
├── uploads/         # Cloudinary abstraction used by rooms (swappable)
├── availability/    # overlap-checking engine shared by search + bookings
├── bookings/        # create/list/cancel (customer) + approve/reject/cancel (admin)
├── offers/          # public offers + admin CRUD, discount calculation
├── dashboard/        # admin operational statistics
├── prisma/          # PrismaService/PrismaModule (single shared client)
├── common/          # guards, decorators, filters, interceptors, utils, DTOs
├── config/          # ConfigModule setup + env validation (Joi)
└── main.ts
```

Every module follows the same shape: `dto/`, a thin `*.controller.ts`, a `*.service.ts` holding all business logic, and a `*.module.ts`. Prisma is the only place that talks to the database.

## Getting started

### 1. Prerequisites

- Node.js 18+
- A running MySQL 8 server
- (Optional for production images) A Cloudinary account

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in at least:

- `DATABASE_URL` — e.g. `mysql://root:password@localhost:3306/guest_house`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — long random strings (never reuse the placeholders)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — required for room image uploads
- `FRONTEND_URL` — the origin allowed by CORS (comma-separate multiple origins)

### 4. Create the database schema

```bash
npm run prisma:migrate     # creates/updates tables from prisma/schema.prisma (dev)
```

For a first-time production deploy use `npm run prisma:migrate:deploy` instead (applies existing migrations without prompting).

### 5. Seed sample data (optional but recommended)

```bash
npm run prisma:seed
```

Creates an admin account (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, defaults to `admin@guesthouse.com` / `Admin@12345`), a sample customer, room types, facilities, a handful of rooms (including one under maintenance) and a sample offer.

### 6. Run the API

```bash
npm run start:dev     # http://localhost:3000/api/v1, watches for changes
```

Swagger docs (non-production only): **http://localhost:3000/api/docs**

### Production

```bash
npm run build
npm run prisma:migrate:deploy
npm run start:prod
```

The server binds to `process.env.PORT` (falls back to 3000), so it works as-is behind Hostinger's Node.js hosting / a reverse proxy.

## npm scripts

| Script | Purpose |
| --- | --- |
| `build` | Compile TypeScript to `dist/` |
| `start` / `start:dev` / `start:debug` | Run the app (dev has file-watch) |
| `start:prod` | Run the compiled `dist/main.js` |
| `prisma:generate` | Regenerate the Prisma client (also runs automatically via `postinstall`/`prebuild`) |
| `prisma:migrate` | Create/apply a dev migration |
| `prisma:migrate:deploy` | Apply existing migrations (production) |
| `prisma:studio` | Open Prisma Studio |
| `prisma:seed` | Run `prisma/seed.ts` |
| `lint` | ESLint (auto-fix) |

## Key design decisions

- **Every response is wrapped consistently**: `{ success, message, data }` on success, `{ success: false, message, errorCode, ... }` on failure (see `common/interceptors/response.interceptor.ts` and `common/filters/all-exceptions.filter.ts`). Stack traces are never leaked in production.
- **`@Public()` + a global `JwtAuthGuard`**: every route requires a valid access token by default; routes are opted *out* explicitly, so a forgotten guard can never accidentally expose a private route.
- **Role comes only from the verified JWT** (`JwtStrategy.validate` → `request.user`), never from the request body — enforced by `RolesGuard` + `@Roles(...)`.
- **Booking overlap prevention** (the core business rule): `AvailabilityService.hasOverlappingBooking` implements `existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn` against `PENDING`/`APPROVED` bookings only. It is reused, unchanged, by:
  - room availability search (`GET /availability`)
  - single-room availability check (`GET /rooms/:id/availability`)
  - booking creation
  - booking approval (re-checked, so a booking approved after another one can no longer double-book the room)
  
  Booking creation and approval both run inside a Prisma transaction that first takes a `SELECT ... FOR UPDATE` row lock on the room, so two concurrent requests for the same room serialize instead of racing past the overlap check together.
- **Pricing is always server-computed**: subtotal = live `room.pricePerNight × nights`; the best matching `Offer` (if any) is looked up and its discount computed server-side (`OffersService.calculateDiscount`); the client can never submit `subtotal`, `discountAmount`, `totalAmount` or `status`.
- **Dates are normalized to UTC midnight** (`common/utils/date.util.ts`) before any comparison, storage, or overlap check, to avoid the classic "booking shifts by one day" timezone bug.
- **Soft delete for rooms**: `DELETE /rooms/:id` deactivates a room (`isActive = false`, `status = INACTIVE`) rather than removing the row, so historical bookings referencing it remain intact and queryable.
- **Storage is abstracted**: `RoomsService` depends only on `UploadsService`'s interface (`uploadImage`/`uploadImages`/`deleteImage`); Cloudinary is an implementation detail behind it (`uploads/cloudinary.provider.ts`), so swapping providers later doesn't touch room logic.
- **Refresh tokens are hashed** (bcrypt) before being stored, rotated on every use, and can be revoked individually or all-at-once on logout.

## API overview

All routes are prefixed with `/api/v1`. Full request/response schemas are in Swagger at `/api/docs`.

- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- **Rooms**: `GET/POST /rooms`, `GET/PATCH/DELETE /rooms/:id`, image management under `/rooms/:id/images...`, `GET /rooms/:id/availability`
- **Room types**: `GET/POST /room-types`, `PATCH/DELETE /room-types/:id`
- **Facilities**: `GET/POST /facilities`, `PATCH/DELETE /facilities/:id`
- **Availability**: `GET /availability?checkIn=...&checkOut=...&guests=...&roomTypeId=...`
- **Bookings (customer)**: `POST /bookings`, `GET /bookings/my`, `GET /bookings/:id`, `PATCH /bookings/:id/cancel`
- **Bookings (admin)**: `GET /admin/bookings`, `GET /admin/bookings/:id`, `PATCH /admin/bookings/:id/{approve,reject,cancel}`
- **Offers**: `GET /offers`, `GET /offers/:id`; admin: `POST/PATCH/DELETE /admin/offers...`
- **Users (admin)**: `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status`
- **Dashboard (admin)**: `GET /admin/dashboard`

## Note on the existing `frontend/` app

This backend implements the detailed specification provided (JWT-based customer accounts, `/api/v1` prefix, admin approval workflow, etc.), which is more complete than the current `frontend/` code. The frontend today runs against **mock data** (`NEXT_PUBLIC_USE_MOCK=true`) with a different, simpler contract — guest-checkout bookings (name/email/phone with no account), a `/api` base URL, and endpoints/shapes such as `/rooms/available`, `/bookings/reference/:ref`, `/blocked-dates`, `/gallery`, `/amenities`, `/settings`, `role: "ADMIN" | "STAFF" | "GUEST"`.

To connect the two, the frontend will need updates (tracked separately, not made here):

1. Set `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` and `NEXT_PUBLIC_USE_MOCK=false`.
2. Update `src/lib/api/endpoints.ts` to match this API's routes (e.g. `/availability` instead of `/rooms/available`, `/facilities` instead of `/amenities`, booking lookups via `/bookings/:id` with auth instead of a public `/bookings/lookup`).
3. Add a real registration/login flow for customers (this API requires an authenticated `CUSTOMER` to create a booking, rather than accepting guest name/email/phone directly on the booking).
4. Adjust `src/types/*.ts` field names where they differ (e.g. `bookingNumber` vs `bookingReference`, `pricePerNight`/`maximumGuests`/`numberOfBeds` naming, room `facilities` vs `amenities`).

Everything under `/room-types`, `/facilities`, `/rooms` (including images), `/availability`, `/offers` and the admin dashboard maps closely to what the frontend already expects conceptually, so most of the above is renaming rather than a redesign.
