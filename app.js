import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import {
  getMessaging,
  getToken,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const vapidKey = "YOUR_FIREBASE_WEB_PUSH_CERTIFICATE_KEY_PAIR";

const majorCities = [
  ["all", "All major cities"],
  ["atlanta-ga", "Atlanta, GA"],
  ["baltimore-md", "Baltimore, MD"],
  ["boston-ma", "Boston, MA"],
  ["charlotte-nc", "Charlotte, NC"],
  ["chicago-il", "Chicago, IL"],
  ["dallas-tx", "Dallas, TX"],
  ["detroit-mi", "Detroit, MI"],
  ["houston-tx", "Houston, TX"],
  ["los-angeles-ca", "Los Angeles, CA"],
  ["miami-fl", "Miami, FL"],
  ["new-orleans-la", "New Orleans, LA"],
  ["new-york-ny", "New York, NY"],
  ["oakland-ca", "Oakland, CA"],
  ["philadelphia-pa", "Philadelphia, PA"],
  ["washington-dc", "Washington, DC"],
];

const starterListings = [
  {
    id: "nmaahc",
    listingType: "business",
    name: "National Museum of African American History and Culture",
    category: "museum",
    blackOwned: false,
    verified: true,
    address: "1400 Constitution Ave NW",
    city: "Washington",
    state: "DC",
    citySlug: "washington-dc",
    website: "https://nmaahc.si.edu/",
    tags: ["black history", "museum", "family-friendly"],
    photos: [],
    sourceUrl: "https://nmaahc.si.edu/",
    lastVerified: "2026-06-19",
    rating: 4.9,
    lat: 38.8911,
    lng: -77.0328,
  },
  {
    id: "studio-museum",
    listingType: "business",
    name: "The Studio Museum in Harlem",
    category: "museum",
    blackOwned: false,
    verified: true,
    address: "144 W 125th St",
    city: "New York",
    state: "NY",
    citySlug: "new-york-ny",
    website: "https://www.studiomuseum.org/",
    tags: ["black art", "museum", "harlem"],
    photos: [],
    sourceUrl: "https://www.studiomuseum.org/",
    lastVerified: "2026-06-19",
    rating: 4.8,
    lat: 40.8099,
    lng: -73.9474,
  },
  {
    id: "whitney-plantation",
    listingType: "business",
    name: "Whitney Plantation",
    category: "cultural_site",
    blackOwned: false,
    verified: true,
    address: "5099 LA-18",
    city: "Edgard",
    state: "LA",
    citySlug: "new-orleans-la",
    website: "https://www.whitneyplantation.org/",
    tags: ["black history", "memorial", "louisiana"],
    photos: [],
    sourceUrl: "https://www.whitneyplantation.org/",
    lastVerified: "2026-06-19",
    rating: 4.8,
    lat: 30.0389,
    lng: -90.6631,
  },
];

const hasFirebaseConfig = !Object.values(firebaseConfig).some((value) =>
  value.startsWith("YOUR_"),
);

const $ = (selector) => document.querySelector(selector);
const placeTemplate = $("#place-card-template");
const savedTemplate = $("#saved-card-template");
const guideGrid = $("#guide-grid");
const guideCount = $("#guide-count");
const cityFilter = $("#city-filter");
const guideSearch = $("#guide-search");
const mapTitle = $("#map-title");
const mapCopy = $("#map-copy");
const mapFrame = $("#map-frame");
const filters = document.querySelectorAll("[data-filter]");
const authForm = $("#auth-form");
const googleLogin = $("#google-login");
const appleLogin = $("#apple-login");
const logoutButton = $("#logout-button");
const accountCopy = $("#account-copy");
const statusEl = $("#status");
const savedList = $("#saved-list");
const savedCount = $("#saved-count");
const tripForm = $("#trip-form");
const aiForm = $("#ai-form");
const profileForm = $("#profile-form");
const notificationButton = $("#notification-button");
const listingForm = $("#listing-form");
const reviewForm = $("#review-form");
const reviewListing = $("#review-listing");
const reviewsList = $("#reviews-list");
const journalForm = $("#journal-form");
const journalList = $("#journal-list");
const adminList = $("#admin-list");
const adminCount = $("#admin-count");

let app = null;
let auth = null;
let db = null;
let storage = null;
let messaging = null;
let currentUser = null;
let isAdmin = false;
let activeFilter = "all";
let activeCity = "all";
let publicListings = [];
let adminSubmissions = [];
let favoritesCollection = null;
let tripsCollection = null;
let submissionsCollection = null;
let itinerariesCollection = null;
let journalCollection = null;

hydrateCityFilter();
renderGuide();
renderSelectOptions();
setDisabledState(!hasFirebaseConfig);

if (!hasFirebaseConfig) {
  setStatus("Add your Firebase config in app.js to enable publish-ready features.");
} else {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  messaging = getMessaging(app);

  watchPublicListings();
  watchReviews();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    isAdmin = false;
    setDisabledState(!user);

    if (!user) {
      accountCopy.textContent = "You are logged out.";
      savedList.innerHTML = "";
      journalList.innerHTML = "";
      adminList.innerHTML = '<div class="empty-state">Admin login required.</div>';
      savedCount.textContent = "0";
      adminCount.textContent = "0";
      setStatus("Login to save places, submit listings, and build trips.");
      return;
    }

    const token = await user.getIdTokenResult();
    isAdmin = Boolean(token.claims.admin);
    accountCopy.textContent = `Logged in as ${user.email || user.displayName || "traveler"}.`;
    favoritesCollection = collection(db, "users", user.uid, "favorites");
    tripsCollection = collection(db, "users", user.uid, "trips");
    submissionsCollection = collection(db, "submissions");
    itinerariesCollection = collection(db, "users", user.uid, "itineraries");
    journalCollection = collection(db, "users", user.uid, "journal");

    await ensureUserProfile(user);
    watchSavedPlans();
    watchJournal();
    if (isAdmin) watchAdminSubmissions();
    setStatus("Connected to Firebase.");
  });
}

cityFilter.addEventListener("change", () => {
  activeCity = cityFilter.value;
  renderGuide();
});

guideSearch.addEventListener("input", renderGuide);

filters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    activeFilter = filterButton.dataset.filter;
    filters.forEach((button) => button.classList.remove("active"));
    filterButton.classList.add("active");
    renderGuide();
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;

  const formData = new FormData(authForm);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    if (event.submitter.dataset.authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
      setStatus("Account created.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus("Logged in.");
    }
    authForm.reset();
  } catch (error) {
    setStatus(`Authentication failed: ${error.message}`);
  }
});

googleLogin.addEventListener("click", () => signInWithProvider(new GoogleAuthProvider()));
appleLogin.addEventListener("click", () => signInWithProvider(new OAuthProvider("apple.com")));
logoutButton.addEventListener("click", () => {
  if (!auth) return;
  signOut(auth)
    .then(() => setStatus("Logged out."))
    .catch((error) => setStatus(`Logout failed: ${error.message}`));
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const formData = new FormData(profileForm);
  await setDoc(
    doc(db, "users", currentUser.uid),
    {
      displayName: formData.get("displayName").trim(),
      homeCity: formData.get("homeCity").trim(),
      preferences: {
        interests: splitTags(formData.get("interests")),
        travelNotes: formData.get("travelNotes").trim(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  setStatus("Profile saved.");
});

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!tripsCollection) return;
  const formData = new FormData(tripForm);
  await addDoc(tripsCollection, {
    type: "trip",
    title: formData.get("tripName").trim(),
    city: formData.get("city").trim(),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes").trim(),
    createdAt: serverTimestamp(),
  });
  tripForm.reset();
  setStatus("Trip saved.");
});

aiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!itinerariesCollection) return;
  const prompt = new FormData(aiForm).get("prompt").trim();
  await addDoc(itinerariesCollection, {
    prompt,
    itinerary: buildDraftItinerary(prompt),
    modelStatus: "draft_saved",
    createdAt: serverTimestamp(),
  });
  aiForm.reset();
  setStatus("AI itinerary draft saved.");
});

listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!submissionsCollection || !currentUser) return;
  const formData = new FormData(listingForm);
  await addDoc(submissionsCollection, {
    ...buildListingFromForm(formData),
    submittedBy: currentUser.uid,
    status: "pending_review",
    createdAt: serverTimestamp(),
  });
  listingForm.reset();
  setStatus("Listing submitted for admin approval.");
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !storage) return;
  const formData = new FormData(reviewForm);
  const photo = formData.get("photo");
  const photoUrl = photo?.size ? await uploadUserFile(photo, "reviews") : "";
  await addDoc(collection(db, "reviews"), {
    listingId: formData.get("listingId"),
    userId: currentUser.uid,
    rating: Number(formData.get("rating")),
    comment: formData.get("comment").trim(),
    photoUrl,
    createdAt: serverTimestamp(),
  });
  reviewForm.reset();
  setStatus("Review posted.");
});

journalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!journalCollection || !storage) return;
  const formData = new FormData(journalForm);
  const photoUrls = [];
  for (const file of journalForm.elements.photos.files) {
    photoUrls.push(await uploadUserFile(file, "journal"));
  }
  await addDoc(journalCollection, {
    title: formData.get("title").trim(),
    favoritePlaces: splitTags(formData.get("favoritePlaces")),
    notes: formData.get("notes").trim(),
    photoUrls,
    createdAt: serverTimestamp(),
  });
  journalForm.reset();
  setStatus("Journal entry saved.");
});

notificationButton.addEventListener("click", async () => {
  if (!currentUser || !messaging || vapidKey.startsWith("YOUR_")) {
    setStatus("Add a Firebase web push certificate key to enable notifications.");
    return;
  }
  const token = await getToken(messaging, { vapidKey });
  await setDoc(
    doc(db, "users", currentUser.uid),
    { notificationToken: token, notificationsEnabled: true },
    { merge: true },
  );
  setStatus("Notifications enabled.");
});

async function signInWithProvider(provider) {
  if (!auth) return;
  try {
    await signInWithPopup(auth, provider);
    setStatus("Logged in.");
  } catch (error) {
    setStatus(`Provider login failed: ${error.message}`);
  }
}

function hydrateCityFilter() {
  cityFilter.innerHTML = majorCities
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
}

function watchPublicListings() {
  onSnapshot(collection(db, "businesses"), (businessSnapshot) => {
    const businesses = businessSnapshot.docs.map((businessDoc) => ({
      id: businessDoc.id,
      listingType: "business",
      ...businessDoc.data(),
    }));

    onSnapshot(collection(db, "events"), (eventSnapshot) => {
      const events = eventSnapshot.docs.map((eventDoc) => ({
        id: eventDoc.id,
        listingType: "event",
        category: "event",
        ...eventDoc.data(),
      }));
      publicListings = [...businesses, ...events];
      renderGuide();
      renderSelectOptions();
      setDisabledState(!currentUser);
    });
  });
}

function watchReviews() {
  onSnapshot(query(collection(db, "reviews"), orderBy("createdAt", "desc")), (snapshot) => {
    const reviews = snapshot.docs.slice(0, 6).map((reviewDoc) => reviewDoc.data());
    reviewsList.innerHTML = reviews.length
      ? reviews
          .map(
            (review) =>
              `<article class="saved-card"><div><h3>${review.rating} stars</h3><p>${escapeHtml(
                review.comment || "No comment.",
              )}</p></div></article>`,
          )
          .join("")
      : '<div class="empty-state">No reviews yet.</div>';
  });
}

function watchSavedPlans() {
  const favoritesQuery = query(favoritesCollection, orderBy("createdAt", "desc"));
  const tripsQuery = query(tripsCollection, orderBy("createdAt", "desc"));
  const itinerariesQuery = query(itinerariesCollection, orderBy("createdAt", "desc"));
  const state = { favorites: [], trips: [], itineraries: [] };

  onSnapshot(favoritesQuery, (snapshot) => {
    state.favorites = snapshot.docs.map((item) => ({
      id: item.id,
      collectionName: "favorites",
      ...item.data(),
    }));
    renderSavedPlans(state);
  });
  onSnapshot(tripsQuery, (snapshot) => {
    state.trips = snapshot.docs.map((item) => ({
      id: item.id,
      collectionName: "trips",
      ...item.data(),
    }));
    renderSavedPlans(state);
  });
  onSnapshot(itinerariesQuery, (snapshot) => {
    state.itineraries = snapshot.docs.map((item) => ({
      id: item.id,
      collectionName: "itineraries",
      ...item.data(),
    }));
    renderSavedPlans(state);
  });
}

function watchJournal() {
  onSnapshot(query(journalCollection, orderBy("createdAt", "desc")), (snapshot) => {
    const entries = snapshot.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }));
    journalList.innerHTML = entries.length
      ? entries
          .map(
            (entry) =>
              `<article class="saved-card"><div><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(
                entry.notes || "No notes.",
              )}</p></div></article>`,
          )
          .join("")
      : '<div class="empty-state">No journal memories yet.</div>';
  });
}

function watchAdminSubmissions() {
  onSnapshot(
    query(collection(db, "submissions"), where("status", "==", "pending_review")),
    (snapshot) => {
      adminSubmissions = snapshot.docs.map((submissionDoc) => ({
        id: submissionDoc.id,
        ...submissionDoc.data(),
      }));
      renderAdminSubmissions();
    },
  );
}

function renderGuide() {
  const searchTerm = guideSearch.value.trim().toLowerCase();
  const listings = [...starterListings, ...publicListings]
    .map(normalizeListing)
    .filter((listing) => {
      const matchesCity = activeCity === "all" || listing.citySlug === activeCity;
      const matchesFilter =
        activeFilter === "all" ||
        listing.listingType === activeFilter ||
        listing.category === activeFilter;
      const searchable = [
        listing.name,
        listing.city,
        listing.state,
        listing.category,
        listing.listingType,
        ...(listing.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCity && matchesFilter && searchable.includes(searchTerm);
    });

  guideGrid.innerHTML = "";
  guideCount.textContent = listings.length;

  if (!listings.length) {
    guideGrid.innerHTML =
      '<div class="empty-state">No verified businesses or events found for this city yet.</div>';
    return;
  }

  listings.forEach((listing) => {
    const card = placeTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector("[data-category]").textContent = formatCategory(listing.category);
    card.querySelector("[data-verified]").textContent = listing.verified
      ? "Verified"
      : listing.blackOwned
        ? "Black-owned"
        : "Listed";
    card.querySelector("[data-name]").textContent = listing.name;
    card.querySelector("[data-location]").textContent = formatLocation(listing);
    card.querySelector("[data-tags]").textContent = (listing.tags || []).join(" / ");
    card.querySelector("[data-type]").textContent = formatCategory(listing.listingType);
    card.querySelector("[data-last-verified]").textContent =
      listing.eventDate || listing.lastVerified || "Pending";

    const sourceLink = card.querySelector("[data-source]");
    sourceLink.href = listing.sourceUrl || listing.website || "#";
    sourceLink.textContent = formatHost(listing.sourceUrl || listing.website);

    card.querySelector("[data-save-place]").addEventListener("click", () => savePlace(listing));
    card.querySelector("[data-map-place]").addEventListener("click", () => showMap(listing));
    guideGrid.append(card);
  });
}

function renderSelectOptions() {
  const listings = [...starterListings, ...publicListings].map(normalizeListing);
  reviewListing.innerHTML = listings
    .map((listing) => `<option value="${listing.id}">${escapeHtml(listing.name)}</option>`)
    .join("");
}

function renderSavedPlans(state) {
  const plans = [...state.favorites, ...state.trips, ...state.itineraries];
  savedList.innerHTML = "";
  savedCount.textContent = plans.length;
  if (!plans.length) {
    savedList.innerHTML = '<div class="empty-state">No saved plans yet.</div>';
    return;
  }
  plans.forEach((plan) => {
    const card = savedTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector("[data-title]").textContent = plan.title || plan.prompt;
    card.querySelector("[data-detail]").textContent =
      plan.type === "trip"
        ? `${plan.city} / ${formatDateRange(plan.startDate, plan.endDate)}`
        : plan.itinerary || `${formatCategory(plan.category)} / ${plan.city || ""}`;
    card.querySelector("[data-delete]").addEventListener("click", () => deleteSavedPlan(plan));
    savedList.append(card);
  });
}

function renderAdminSubmissions() {
  adminCount.textContent = adminSubmissions.length;
  adminList.innerHTML = adminSubmissions.length
    ? adminSubmissions
        .map(
          (submission) => `<article class="place-card">
            <h3>${escapeHtml(submission.name)}</h3>
            <p>${escapeHtml(formatLocation(submission))}</p>
            <p>${escapeHtml(submission.category)} / ${escapeHtml(submission.status)}</p>
            <div class="button-row">
              <button class="button button-primary" data-approve="${submission.id}">Approve</button>
              <button class="button button-secondary" data-reject="${submission.id}">Reject</button>
            </div>
          </article>`,
        )
        .join("")
    : '<div class="empty-state">No pending submissions.</div>';

  adminList.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => approveSubmission(button.dataset.approve));
  });
  adminList.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => rejectSubmission(button.dataset.reject));
  });
}

async function savePlace(listing) {
  if (!favoritesCollection) {
    setStatus("Login to save favorite places.");
    return;
  }
  await addDoc(favoritesCollection, {
    type: listing.listingType,
    title: listing.name,
    listingId: listing.id,
    city: listing.city,
    state: listing.state,
    category: listing.category,
    sourceUrl: listing.sourceUrl || listing.website || "",
    createdAt: serverTimestamp(),
  });
  setStatus(`${listing.name} saved.`);
}

async function approveSubmission(id) {
  if (!isAdmin) return;
  const submission = adminSubmissions.find((item) => item.id === id);
  const targetCollection = submission.listingType === "event" ? "events" : "businesses";
  await addDoc(collection(db, targetCollection), {
    ...submission,
    verified: true,
    status: "published",
    approvedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "submissions", id), {
    status: "approved",
    approvedAt: serverTimestamp(),
  });
  setStatus("Listing approved.");
}

async function rejectSubmission(id) {
  if (!isAdmin) return;
  await updateDoc(doc(db, "submissions", id), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });
  setStatus("Submission rejected.");
}

async function deleteSavedPlan(plan) {
  const refs = {
    favorites: favoritesCollection,
    trips: tripsCollection,
    itineraries: itinerariesCollection,
  };
  await deleteDoc(doc(refs[plan.collectionName], plan.id));
}

async function ensureUserProfile(user) {
  const profileRef = doc(db, "users", user.uid);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      createdAt: serverTimestamp(),
      preferences: { interests: [], travelNotes: "" },
    });
  }
}

async function uploadUserFile(file, folder) {
  const fileRef = ref(storage, `${folder}/${currentUser.uid}/${Date.now()}-${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

function buildListingFromForm(formData) {
  const city = formData.get("city").trim();
  const state = formData.get("state").trim().toUpperCase();
  return {
    name: formData.get("name").trim(),
    listingType: formData.get("listingType"),
    category: formData.get("category"),
    blackOwned: formData.get("blackOwned") === "true",
    proof: formData.get("proof").trim(),
    ownershipSource: formData.get("ownershipSource").trim(),
    address: formData.get("address").trim(),
    city,
    state,
    citySlug: slugifyCity(city, state),
    website: formData.get("website").trim(),
    phone: formData.get("phone").trim(),
    hours: formData.get("hours").trim(),
    eventDate: formData.get("eventDate"),
    priceRange: formData.get("priceRange").trim(),
    tags: splitTags(formData.get("tags")),
    lat: Number(formData.get("latitude")) || null,
    lng: Number(formData.get("longitude")) || null,
    photos: [],
    sourceUrl: formData.get("sourceUrl").trim(),
    lastVerified: new Date().toISOString().slice(0, 10),
    verified: false,
    rating: 0,
  };
}

function normalizeListing(listing) {
  return {
    listingType: listing.listingType || "business",
    category: listing.category || "cultural_site",
    tags: listing.tags || [],
    citySlug: listing.citySlug || slugifyCity(listing.city, listing.state),
    verified: Boolean(listing.verified),
    ...listing,
  };
}

function showMap(listing) {
  mapTitle.textContent = listing.name;
  mapCopy.textContent = formatLocation(listing);
  if (!listing.lat || !listing.lng) {
    mapFrame.removeAttribute("src");
    mapCopy.textContent = "Map coordinates are not available yet.";
    return;
  }
  const delta = 0.01;
  const bbox = [
    listing.lng - delta,
    listing.lat - delta,
    listing.lng + delta,
    listing.lat + delta,
  ].join(",");
  mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${listing.lat},${listing.lng}`;
}

function buildDraftItinerary(prompt) {
  return `Draft itinerary saved for: ${prompt}. Connect this form to an AI endpoint to replace this placeholder with generated day-by-day plans.`;
}

function setDisabledState(disabled) {
  const protectedButtons = [
    ...document.querySelectorAll(
      "#trip-form button, #ai-form button, #profile-form button, #listing-form button, #review-form button, #journal-form button, #logout-button, #notification-button",
    ),
  ];
  protectedButtons.forEach((button) => {
    button.disabled = disabled;
  });
  document.querySelectorAll("#auth-form button, #google-login, #apple-login").forEach((button) => {
    button.disabled = !hasFirebaseConfig;
  });
  document.querySelectorAll("[data-save-place]").forEach((button) => {
    button.disabled = disabled;
  });
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatCategory(value) {
  return String(value || "").replace("_", " ");
}

function formatDateRange(startDate, endDate) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!startDate || !endDate) return "Dates TBD";
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

function formatHost(url) {
  if (!url) return "Pending";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "Open";
  }
}

function formatLocation(listing) {
  const cityState = [listing.city, listing.state].filter(Boolean).join(", ");
  if (listing.eventDate) return `${cityState} / ${listing.eventDate}`;
  return cityState;
}

function slugifyCity(city, state) {
  return [city, state]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message) {
  statusEl.textContent = message;
}
