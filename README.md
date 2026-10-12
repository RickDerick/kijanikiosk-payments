# kijanikiosk-payments

The KijaniKiosk payments service. It validates payment requests (amount, currency,
Kenyan mobile number, order reference) and exposes a small HTTP API.

Week 5 uses this repository as the application that Jenkins builds and tests.

## Run

```bash
npm ci
npm test       # Jest unit and API tests
npm start      # listens on PORT (default 3001)
```

## API

| Method | Path | Result |
|---|---|---|
| GET | `/health` | `200` with `{"service":"kk-payments","status":"ok"}` |
| POST | `/payments` | `202` accepted, or `400` with a list of validation errors |

Example:

```bash
curl -X POST localhost:3001/payments \
  -H 'Content-Type: application/json' \
  -d '{"amount":1500,"currency":"KES","phone":"0712345678","reference":"ORDER-1001"}'
```

## Validation rules

- Amount: more than 0, at most 150,000 KES, at most two decimal places (stored as integer cents)
- Currency: KES only
- Phone: Kenyan mobile number (07…, 01…, +254…, 254…), normalised to `254XXXXXXXXX`
- Reference: 1 to 20 characters
