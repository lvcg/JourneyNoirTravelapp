import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

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
    city: "Washington",
    state: "DC",
    citySlug: "washington-dc",
    website: "https://nmaahc.si.edu/",
    tags: ["black history", "museum", "family-friendly"],
    sourceUrl: "https://nmaahc.si.edu/",
    lastVerified: "2026-06-19",
  },
  {
    id: "studio-museum",
    listingType: "business",
    name: "The Studio Museum in Harlem",
    category: "museum",
    blackOwned: false,
    city: "New York",
    state: "NY",
    citySlug: "new-york-ny",
    website: "https://www.studiomuseum.org/",
    tags: ["black art", "museum", "harlem"],
    sourceUrl: "https://www.studiomuseum.org/",
    lastVerified: "2026-06-19",
  },
  {
    id: "whitney-plantation",
    listingType: "business",
    name: "Whitney Plantation",
    category: "cultural_site",
    blackOwned: false,
    city: "New Orleans",
    state: "LA",
    citySlug: "new-orleans-la",
    website: "https://www.whitneyplantation.org/",
    tags: ["black history", "memorial", "louisiana"],
    sourceUrl: "https://www.whitneyplantation.org/",
    lastVerified: "2026-06-19",
  },
];

const hasFirebaseConfig = !Object.values(firebaseConfig).some((value) =>
  value.startsWith("YOUR_"),
);

const placeTemplate = document.querySelector("#place-card-template");
const savedTemplate = document.querySelector("#saved-card-template");
const guideGrid = document.querySelector("#guide-grid");
const guideCount = document.querySelector("#guide-count");
const cityFilter = document.querySelector("#city-filter");
const guideSearch = document.querySelector("#guide-search");
const filters = document.querySelectorAll("[data-filter]");
const authForm = document.querySelector("#auth-form");
const logoutButton = document.querySelector("#logout-button");
const accountCopy = document.querySelector("#account-copy");
const statusEl = document.querySelector("#status");
const savedList = document.querySelector("#saved-list");
const savedCount = document.querySelector("#saved-count");
const tripForm = document.querySelector("#trip-form");
const listingForm = document.querySelector("#listing-form");

let auth = null;
let db = null;
let currentUser = null;
let activeFilter = "all";
let activeCity = "all";
let publicListings = [];
let savedPlacesCollection = null;
let tripsCollection = null;
let listingsCollection = null;

hydrateCityFilter();
renderGuide();
setDisabledState(!hasFirebaseConfig);

if (!hasFirebaseConfig) {
  setStatus("Add your Firebase config in app.js to enable login and saved plans.");
} else {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  watchPublicListings();

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    setDisabledState(!user);

    if (!user) {
      accountCopy.textContent = "You are logged out.";
      savedList.innerHTML = "";
      savedCount.textContent = "0";
      setStatus("Login to save businesses, events, and trips.");
      return;
    }

    accountCopy.textContent = `Logged in as ${user.email}.`;
    savedPlacesCollection = collection(db, "users", user.uid, "savedPlaces");
    tripsCollection = collection(db, "users", user.uid, "trips");
    listingsCollection = collection(db, "userSubmittedListings");
    watchSavedPlans();
    setStatus("Connected to Firebase.");
  });
}

cityFilter.addEventListener("change", () => {
  activeCity = cityFilter.value;
  renderGuide();
  setDisabledState(!currentUser || !hasFirebaseConfig);
});

guideSearch.addEventListener("input", () => {
  renderGuide();
  setDisabledState(!currentUser || !hasFirebaseConfig);
});

filters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    activeFilter = filterButton.dataset.filter;
    filters.forEach((button) => button.classList.remove("active"));
    filterButton.classList.add("active");
    renderGuide();
    setDisabledState(!currentUser || !hasFirebaseConfig);
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;

  const submitter = event.submitter;
  const formData = new FormData(authForm);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    if (submitter.dataset.authMode === "signup") {
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

logoutButton.addEventListener("click", () => {
  if (!auth) return;
  signOut(auth)
    .then(() => setStatus("Logged out."))
    .catch((error) => setStatus(`Logout failed: ${error.message}`));
});

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!tripsCollection) return;

  const formData = new FormData(tripForm);
  const trip = {
    type: "trip",
    title: formData.get("tripName").trim(),
    city: formData.get("city").trim(),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes").trim(),
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(tripsCollection, trip);
    tripForm.reset();
    setStatus("Trip saved.");
  } catch (error) {
    setStatus(`Could not save trip: ${error.message}`);
  }
});

listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!listingsCollection || !currentUser) return;

  const formData = new FormData(listingForm);
  const listing = buildListingFromForm(formData);

  try {
    await addDoc(listingsCollection, {
      ...listing,
      submittedBy: currentUser.uid,
      status: "pending_review",
      createdAt: serverTimestamp(),
    });
    listingForm.reset();
    setStatus("Listing submitted for review.");
  } catch (error) {
    setStatus(`Could not submit listing: ${error.message}`);
  }
});

function hydrateCityFilter() {
  cityFilter.innerHTML = majorCities
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
}

function watchPublicListings() {
  onSnapshot(collection(db, "publicListings"), (snapshot) => {
    publicListings = snapshot.docs.map((listingDoc) => ({
      id: listingDoc.id,
      ...listingDoc.data(),
    }));
    renderGuide();
    setDisabledState(!currentUser);
  });
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
    card.querySelector("[data-verified]").textContent = listing.blackOwned
      ? "Black-owned"
      : listing.listingType === "event"
        ? "Event"
        : "Cultural source";
    card.querySelector("[data-name]").textContent = listing.name;
    card.querySelector("[data-location]").textContent = formatLocation(listing);
    card.querySelector("[data-tags]").textContent = (listing.tags || []).join(" / ");
    card.querySelector("[data-type]").textContent = formatCategory(listing.listingType);
    card.querySelector("[data-last-verified]").textContent =
      listing.eventDate || listing.lastVerified || "Pending";

    const sourceLink = card.querySelector("[data-source]");
    sourceLink.href = listing.sourceUrl || listing.website || "#";
    sourceLink.textContent = formatHost(listing.sourceUrl || listing.website);

    card.querySelector("[data-save-place]").addEventListener("click", () => {
      savePlace(listing);
    });

    guideGrid.append(card);
  });
}

async function savePlace(listing) {
  if (!savedPlacesCollection) {
    setStatus("Login to save businesses and events.");
    return;
  }

  try {
    await addDoc(savedPlacesCollection, {
      type: listing.listingType,
      title: listing.name,
      city: listing.city,
      state: listing.state,
      category: listing.category,
      sourceUrl: listing.sourceUrl || listing.website || "",
      createdAt: serverTimestamp(),
    });
    setStatus(`${listing.name} saved.`);
  } catch (error) {
    setStatus(`Could not save item: ${error.message}`);
  }
}

function watchSavedPlans() {
  const savedQuery = query(savedPlacesCollection, orderBy("createdAt", "desc"));
  const tripsQuery = query(tripsCollection, orderBy("createdAt", "desc"));
  const state = { places: [], trips: [] };

  onSnapshot(savedQuery, (snapshot) => {
    state.places = snapshot.docs.map((item) => ({
      id: item.id,
      collectionName: "savedPlaces",
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
}

function renderSavedPlans(state) {
  const plans = [...state.places, ...state.trips];
  savedList.innerHTML = "";
  savedCount.textContent = plans.length;

  if (!plans.length) {
    savedList.innerHTML = '<p class="status">No saved plans yet.</p>';
    return;
  }

  plans.forEach((plan) => {
    const card = savedTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector("[data-title]").textContent = plan.title;
    card.querySelector("[data-detail]").textContent =
      plan.type === "trip"
        ? `${plan.city} / ${formatDateRange(plan.startDate, plan.endDate)}`
        : `${formatCategory(plan.category)} / ${plan.city}, ${plan.state}`;
    card.querySelector("[data-delete]").addEventListener("click", () => {
      const collectionRef =
        plan.collectionName === "trips" ? tripsCollection : savedPlacesCollection;
      deleteDoc(doc(collectionRef, plan.id)).catch((error) =>
        setStatus(`Could not delete saved item: ${error.message}`),
      );
    });
    savedList.append(card);
  });
}

function buildListingFromForm(formData) {
  const city = formData.get("city").trim();
  const state = formData.get("state").trim().toUpperCase();

  return {
    name: formData.get("name").trim(),
    listingType: formData.get("listingType"),
    category: formData.get("category"),
    blackOwned: formData.get("blackOwned") === "true",
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
    tags: formData
      .get("tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    sourceUrl: formData.get("sourceUrl").trim(),
    lastVerified: new Date().toISOString().slice(0, 10),
  };
}

function normalizeListing(listing) {
  return {
    listingType: listing.listingType || "business",
    category: listing.category || "cultural_site",
    tags: listing.tags || [],
    citySlug: listing.citySlug || slugifyCity(listing.city, listing.state),
    ...listing,
  };
}

function setDisabledState(disabled) {
  [
    ...document.querySelectorAll("#trip-form button, #listing-form button, #logout-button"),
  ].forEach((button) => {
    button.disabled = disabled;
  });

  document.querySelectorAll("#auth-form button").forEach((button) => {
    button.disabled = !hasFirebaseConfig;
  });

  document.querySelectorAll("[data-save-place]").forEach((button) => {
    button.disabled = disabled;
  });
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
  return `${formatter.format(new Date(startDate))} - ${formatter.format(
    new Date(endDate),
  )}`;
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

function setStatus(message) {
  statusEl.textContent = message;
}
