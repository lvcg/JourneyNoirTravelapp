# Rooted Routes

A simple Firebase-powered Black travel guide, major-city business/event
aggregator, and trip planner.

## Screenshots

![Rooted Routes homepage](docs/screenshots/home.png)

![Mobile layout](docs/screenshots/mobile.png)

## Features

- Public guide page for major-city businesses, events, and cultural attractions.
- City, search, type, and category filters.
- Email/password login and logout with Firebase Authentication.
- Save businesses, events, and guide entries to a signed-in user's Firestore account.
- Create private trip plans with city, dates, and notes.
- Submit business or event listing candidates with verification fields.
- Firestore rules for private user data and pending user-submitted listings.
- Public `publicListings` collection support for reviewed aggregate listings.

## Data model

Submitted listings collect this shape:

```json
{
  "name": "",
  "listingType": "business | event",
  "category": "restaurant | hotel | museum | cultural_site",
  "blackOwned": true,
  "ownershipSource": "",
  "address": "",
  "city": "",
  "state": "",
  "website": "",
  "phone": "",
  "hours": "",
  "eventDate": "",
  "priceRange": "",
  "tags": ["soul food", "brunch", "historic", "family-friendly"],
  "latitude": "",
  "longitude": "",
  "sourceUrl": "",
  "lastVerified": ""
}
```

User-submitted listings are written to `userSubmittedListings` with
`status: "pending_review"` so they can be reviewed before publication.
Reviewed listings can be published to `publicListings` for the city aggregator.

## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Add a web app in Project settings.
3. Copy the web app config into `app.js`.
4. Enable Authentication, then enable the Email/Password provider.
5. Create a Cloud Firestore database.
6. Publish the rules from `firestore.rules`.

The app disables account-dependent actions until the Firebase placeholders in
`app.js` are replaced.

## Run locally

Serve the folder with any static server.

```bash
python -m http.server 3005 --bind 127.0.0.1
```

Then open <http://127.0.0.1:3005/>.
