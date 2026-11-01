# Easy Hire — Classy Frontend Prototype

## Open the project
1. Extract `Easy-Hire-Classy-Frontend.zip`.
2. Open the extracted `Easy Hire` folder in VS Code.
3. Keep the folder structure exactly as provided:
   - HTML pages in the root folder
   - `css/style.css`
   - `js/script.js`
4. Open `index.html` in a browser. Recommended: VS Code Live Server.

## Included pages
- `index.html` — landing page and service discovery
- `login.html`, `register.html` — demo authentication and role selection
- `customer-dashboard.html` — customer discovery dashboard
- `provider-profile.html` — dynamic provider profile, services and reviews
- `booking.html`, `my-bookings.html` — booking request and customer tracking
- `messages.html` — conversation UI for multiple providers
- `provider-dashboard.html` — availability and professional overview
- `booking-requests.html` — accept/decline booking requests
- `provider-booking-history.html` — provider-side history
- `review.html` — star rating and review submission
- `css/style.css` — black, warm gold, ivory and white responsive design
- `js/script.js` — frontend interactions and demo persistence

## Functional demo behaviours
- Search and service category navigation
- Provider profile pages with query-string selected provider
- Booking requests saved to browser localStorage
- Customer can cancel a pending request and mark accepted requests completed
- Provider can accept or decline pending requests
- Provider availability toggle persists in the same browser
- Multi-provider chat UI; messages persist in localStorage
- Star rating and review submission; reviews appear on the provider profile
- Demo registration/login role-based routing
- Responsive layout for desktop and mobile

## Important limitations
This is a frontend-only prototype. Login/registration is not secure authentication. Booking data and chat messages are stored only in the current browser's localStorage and do not synchronize across different users/devices. The chat is not Socket.IO/WebSocket yet. To make it a real multi-user application, add a Node.js server with Socket.IO and a database, or integrate Firebase Authentication and Firestore. Sample professionals and seeded sample bookings/reviews are demo data, not a collected external dataset.
