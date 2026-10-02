# Backend change: separate taxi and private rates

The mobile app lets managers set a **private rate** and a **taxi rate** for each service. Staff
pick **Private** or **Taxi** on every new wash. The API only stores one price today, so the
server needs the changes below. The app is already built for them and turns them on
automatically. It checks for the `taxiPrice` key in service responses, so no app release
is needed.

Every change is additive and optional. Existing clients keep working.

## 1. Services: add `taxiPrice`

| Field | Type | Rules |
|---|---|---|
| `taxiPrice` | decimal(10,2), nullable | `null` means "same as `price`". Must be ≥ 0 when set. |

- **Accept** `taxiPrice` (a number or `null`) in `POST /services` and `PATCH /services/{id}`.
- **Return** `taxiPrice` on every service object: `GET /services`, `GET /services/{id}`, and the
  create/update responses. **Always include the key, even when it's `null`.** The app uses the
  key's presence to detect that the feature is live.
- Also include `taxiPrice` in the nested `service` object on booking and order responses.

## 2. Bookings: add `vehicleCategory` and a price snapshot

| Field | Type | Rules |
|---|---|---|
| `vehicleCategory` | enum `PRIVATE` \| `TAXI` | Optional on create, default `PRIVATE`. |
| `price` | decimal(10,2) | Set by the server on create; never taken from the client. |

- **Accept** `vehicleCategory` in `POST /bookings`, and in `PATCH /bookings/{id}` while the booking is editable.
- On create, the **server computes** `price`:
  `vehicleCategory === 'TAXI' && service.taxiPrice != null ? service.taxiPrice : service.price`.
  Store it on the booking, so later rate changes don't alter past bookings.
  If the service or category changes through PATCH, recompute it.
- **Return** `vehicleCategory` and `price` on booking objects, including the `booking` nested in
  `GET /orders` and `GET /orders/{id}`.
- Use the booking's `price` for `orders.totalAmount` and for revenue in `GET /reports/summary`.

## 3. Services: allow reactivation

`DELETE /services/{id}` deactivates a service. The app reactivates one with
`PATCH /services/{id}` and body `{ "status": "ACTIVE" }`. Please accept `status`
(`ACTIVE` | `INACTIVE`) in that PATCH body.

## 4. Rate limit (separate issue, same release if possible)

The API currently allows **100 requests per 15 minutes per IP** (`RateLimit-Policy: 100;w=900`)
across every endpoint. All phones on the car wash's Wi-Fi share one public IP, so a few staff
using the app together run out within minutes and get `429 Too Many Requests`.

- Keep strict per-IP limits only on `POST /auth/login`, `/auth/forgot-password` and `/auth/reset-password`.
- For all other endpoints, limit **per authenticated user** at a much higher rate (for example
  1000 requests per 15 minutes).

## Checklist

- [ ] `GET /services` returns `"taxiPrice": null` for existing services.
- [ ] `PATCH /services/{id}` with `{ "taxiPrice": 349 }` persists it, and `{ "taxiPrice": null }` clears it.
- [ ] `POST /bookings` with `"vehicleCategory": "TAXI"` returns `price` equal to the taxi rate
      (or the regular price when `taxiPrice` is null).
- [ ] `POST /bookings` without `vehicleCategory` behaves as today and returns `"vehicleCategory": "PRIVATE"`.
- [ ] Changing a service's rates doesn't change `price` on existing bookings.
- [ ] `GET /orders` nests `vehicleCategory` and `price` inside `booking`.
- [ ] Revenue in `GET /reports/summary` uses booking prices.
- [ ] `PATCH /services/{id}` with `{ "status": "ACTIVE" }` reactivates a deactivated service.
