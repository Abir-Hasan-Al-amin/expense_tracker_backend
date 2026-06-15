# Expense Tracker Backend

A RESTful API backend for a personal expense tracking application. Built with Node.js, Express, and MongoDB.

## Features

- JWT-based user authentication
- Track income and expenses with custom categories
- Monthly budget management with real-time spending tracking
- Recurring transactions (daily, weekly, monthly)
- Financial statistics with 6-month trend data and category breakdowns
- Bulk export and import of transactions
- Per-user data isolation

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MongoDB with Mongoose
- **Auth:** JSON Web Tokens (JWT)
- **Password Hashing:** bcryptjs

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)

### Installation

```bash
git clone https://github.com/your-username/expense_tracker_backend.git
cd expense_tracker_backend
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable      | Description                              | Default                                     |
|---------------|------------------------------------------|---------------------------------------------|
| `PORT`        | Port the server listens on               | `5000`                                      |
| `MONGODB_URI` | MongoDB connection string                | `mongodb://localhost:27017/expense-tracker` |
| `JWT_SECRET`  | Secret key for signing JWT tokens        | *(required)*                                |
| `NODE_ENV`    | Environment (`development`/`production`) | `development`                               |

### Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:5000`.

### Seed Demo Data

```bash
npm run seed
```

---

## Deploying to Vercel

### 1. Prerequisites

- A [Vercel](https://vercel.com) account
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (Vercel is serverless — local MongoDB won't work)

### 2. Deploy

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo in the Vercel dashboard and it will deploy automatically on every push.

### 3. Set Environment Variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable      | Value                              |
|---------------|------------------------------------|
| `MONGODB_URI` | Your Atlas connection string       |
| `JWT_SECRET`  | A long random secret               |
| `NODE_ENV`    | `production`                       |

### 4. Allow Vercel IPs in MongoDB Atlas

In Atlas → **Network Access**, add `0.0.0.0/0` to allow connections from Vercel's dynamic IPs.

### 5. Verify the deployment

Visit your deployment URL in a browser — you should see:

```json
{
  "name": "Expense Tracker API",
  "version": "1.0.0",
  "status": "running",
  "endpoints": ["/api/auth", "/api/expenses", "/api/categories", "/api/budgets", "/api/health"]
}
```

If you see that, the API is live and connected.

---

## API Reference

All protected routes require an `Authorization: Bearer <token>` header.

### Health

| Method | Endpoint      | Auth | Description         |
|--------|---------------|------|---------------------|
| GET    | `/api/health` | No   | Server health check |

---

### Auth — `/api/auth`

| Method | Endpoint            | Auth | Description           |
|--------|---------------------|------|-----------------------|
| POST   | `/register`         | No   | Create a new account  |
| POST   | `/login`            | No   | Login and get a token |
| POST   | `/change-password`  | Yes  | Change password       |

**Register / Login body:**

```json
{ "username": "alice", "password": "secret123" }
```

**Response:**

```json
{ "token": "<jwt>", "username": "alice" }
```

---

### Expenses — `/api/expenses`

All endpoints require auth.

| Method | Endpoint               | Description                        |
|--------|------------------------|------------------------------------|
| GET    | `/`                    | List expenses (with filters)       |
| POST   | `/`                    | Create an expense or income entry  |
| GET    | `/:id`                 | Get a single expense               |
| PUT    | `/:id`                 | Update an expense                  |
| DELETE | `/:id`                 | Delete an expense                  |
| DELETE | `/all`                 | Delete all expenses for the user   |
| GET    | `/stats`               | Monthly statistics & trends        |
| GET    | `/recurring`           | List all recurring templates       |
| POST   | `/process-recurring`   | Generate due recurring entries     |
| GET    | `/export`              | Export all transactions as JSON    |
| POST   | `/bulk-import`         | Import transactions from JSON      |

**GET `/` query params:**

| Param       | Type   | Description                                    |
|-------------|--------|------------------------------------------------|
| `type`      | string | `expense` or `income`                          |
| `category`  | string | Category ID                                    |
| `startDate` | string | ISO date (inclusive)                           |
| `endDate`   | string | ISO date (inclusive)                           |
| `page`      | number | Page number (default: `1`)                     |
| `limit`     | number | Results per page (default: `50`, max: `500`)   |
| `sort`      | string | `date` or `amount` (default: `date`)           |
| `order`     | string | `asc` or `desc` (default: `desc`)              |

**POST `/` body:**

```json
{
  "title": "Netflix",
  "amount": 15.99,
  "type": "expense",
  "category": "<category_id>",
  "date": "2024-06-01",
  "note": "Monthly subscription",
  "isRecurring": true,
  "recurringFrequency": "monthly"
}
```

`recurringFrequency` accepts: `daily`, `weekly`, `monthly`.

**GET `/stats` query params:**

| Param   | Type   | Description                     |
|---------|--------|---------------------------------|
| `month` | number | Month (1–12, default: current)  |
| `year`  | number | Year (default: current)         |

Response includes: `totalIncome`, `totalExpense`, `balance`, `categoryBreakdown`, and `monthlyData` (last 6 months).

**POST `/bulk-import` body:**

```json
{
  "mode": "append",
  "transactions": [ /* array from /export */ ]
}
```

Set `mode` to `"replace"` to wipe existing data before importing. Max 10,000 transactions per import.

---

### Categories — `/api/categories`

All endpoints require auth.

| Method | Endpoint | Description                          |
|--------|----------|--------------------------------------|
| GET    | `/`      | List all categories                  |
| POST   | `/`      | Create a custom category             |
| PUT    | `/:id`   | Update a category                    |
| DELETE | `/:id`   | Delete a category                    |
| DELETE | `/all`   | Delete all categories                |
| POST   | `/seed`  | Seed default categories for the user |

**POST `/` body:**

```json
{
  "name": "Groceries",
  "icon": "cart",
  "color": "#00B894",
  "type": "expense"
}
```

`type` can be `"expense"`, `"income"`, or `"both"`.

`POST /seed` inserts 15 default categories (Food & Dining, Transport, Salary, etc.) if the user has none.

---

### Budgets — `/api/budgets`

All endpoints require auth.

| Method | Endpoint | Description                               |
|--------|----------|-------------------------------------------|
| GET    | `/`      | List budgets with real spending per month |
| POST   | `/`      | Set a budget (upserts by category+month)  |
| DELETE | `/:id`   | Delete a budget                           |

**GET `/` query params:**

| Param   | Type   | Description                    |
|---------|--------|--------------------------------|
| `month` | number | Month (1–12, default: current) |
| `year`  | number | Year (default: current)        |

**POST `/` body:**

```json
{
  "category": "<category_id>",
  "amount": 300,
  "month": 6,
  "year": 2024
}
```

Each budget in the GET response includes a `spent` field reflecting actual spending for that category and month.

---

## Project Structure

```text
expense_tracker_backend/
├── config/
│   └── db.js              # MongoDB connection
├── middleware/
│   ├── auth.js            # JWT verification
│   └── errorHandler.js    # Global error handler
├── models/
│   ├── User.js
│   ├── Expense.js
│   ├── Category.js
│   └── Budget.js
├── routes/
│   ├── auth.js
│   ├── expenses.js
│   ├── categories.js
│   └── budgets.js
├── seed.js                # Demo data seeder
├── server.js              # App entry point
└── .env.example
```

## License

MIT
