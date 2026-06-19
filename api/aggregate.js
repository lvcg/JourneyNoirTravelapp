const CITY_COORDS = {
  "atlanta-ga": { label: "Atlanta, GA", city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  "baltimore-md": { label: "Baltimore, MD", city: "Baltimore", state: "MD", lat: 39.2904, lng: -76.6122 },
  "boston-ma": { label: "Boston, MA", city: "Boston", state: "MA", lat: 42.3601, lng: -71.0589 },
  "charlotte-nc": { label: "Charlotte, NC", city: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431 },
  "chicago-il": { label: "Chicago, IL", city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  "dallas-tx": { label: "Dallas, TX", city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
  "detroit-mi": { label: "Detroit, MI", city: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458 },
  "houston-tx": { label: "Houston, TX", city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  "los-angeles-ca": { label: "Los Angeles, CA", city: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437 },
  "miami-fl": { label: "Miami, FL", city: "Miami", state: "FL", lat: 25.7617, lng: -80.1918 },
  "new-orleans-la": { label: "New Orleans, LA", city: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715 },
  "new-york-ny": { label: "New York, NY", city: "New York", state: "NY", lat: 40.7128, lng: -74.006 },
  "oakland-ca": { label: "Oakland, CA", city: "Oakland", state: "CA", lat: 37.8044, lng: -122.2712 },
  "philadelphia-pa": { label: "Philadelphia, PA", city: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
  "washington-dc": { label: "Washington, DC", city: "Washington", state: "DC", lat: 38.9072, lng: -77.0369 },
};

const DEFAULT_TERMS = [
  "Black-owned",
  "soul food",
  "jazz",
  "museum",
  "culture",
  "hip-hop",
  "festival",
];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

  const citySlug = String(req.query.city || "chicago-il");
  const city = CITY_COORDS[citySlug] || CITY_COORDS["chicago-il"];
  const customQuery = String(req.query.q || "").trim();
  const query = (customQuery || DEFAULT_TERMS.join(" ")).slice(0, 120);
  const limit = Math.min(Number(req.query.limit) || 12, 25);

  const settled = await Promise.allSettled([
    fetchFoursquare(city, query, limit),
    fetchGeoapify(city, query, limit, Boolean(customQuery)),
    fetchEventbrite(city, query, limit),
  ]);

  const providers = ["foursquare", "geoapify", "eventbrite"];
  const errors = [];
  const results = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    errors.push({
      provider: providers[index],
      message: friendlyProviderError(result.reason?.message || "Failed"),
    });
    return [];
  });

  res.status(200).json({
    city: city.label,
    query,
    count: results.length,
    results: dedupeListings(results),
    errors,
  });
}

async function fetchFoursquare(city, query, limit) {
  if (!process.env.FOURSQUARE_API_KEY) return [];
  const url = new URL("https://api.foursquare.com/v3/places/search");
  url.searchParams.set("near", city.label);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "fsq_id,name,location,geocodes,categories,website,tel,price,rating");

  const json = await fetchJson(url, {
    headers: {
      Accept: "application/json",
      Authorization: process.env.FOURSQUARE_API_KEY,
      "X-Places-Api-Version": "1970-01-01",
    },
  });

  return (json.results || []).map((place) => ({
    id: `foursquare-${place.fsq_id}`,
    provider: "Foursquare",
    listingType: "business",
    name: place.name,
    category: inferCategory(place.categories?.[0]?.name),
    blackOwned: false,
    verified: false,
    address: place.location?.formatted_address || "",
    city: place.location?.locality || city.city,
    state: place.location?.region || city.state,
    citySlug: slugifyCity(place.location?.locality || city.city, place.location?.region || city.state),
    website: place.website || "",
    phone: place.tel || "",
    tags: [place.categories?.[0]?.name, "Foursquare"].filter(Boolean),
    sourceUrl: place.website || "https://foursquare.com/",
    lat: place.geocodes?.main?.latitude || null,
    lng: place.geocodes?.main?.longitude || null,
    rating: place.rating || 0,
  }));
}

async function fetchGeoapify(city, query, limit, hasCustomQuery = false) {
  if (!process.env.GEOAPIFY_API_KEY) return [];
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set(
    "categories",
    "catering.restaurant,accommodation.hotel,entertainment.museum,entertainment.culture",
  );
  url.searchParams.set("filter", `circle:${city.lng},${city.lat},25000`);
  url.searchParams.set("bias", `proximity:${city.lng},${city.lat}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);

  const json = await fetchJson(url);
  return (json.features || [])
    .filter((feature) => {
      const searchable = [
        feature.properties?.name,
        feature.properties?.categories?.join(" "),
        feature.properties?.formatted,
      ]
        .join(" ")
        .toLowerCase();
      if (!hasCustomQuery) return true;
      return query
        .toLowerCase()
        .split(/\s+/)
        .some((term) => searchable.includes(term));
    })
    .map((feature) => ({
      id: `geoapify-${feature.properties?.place_id}`,
      provider: "Geoapify",
      listingType: "business",
      name: feature.properties?.name || "Unnamed place",
      category: inferCategory(feature.properties?.categories?.join(" ")),
      blackOwned: false,
      verified: false,
      address: feature.properties?.formatted || "",
      city: feature.properties?.city || city.city,
      state: feature.properties?.state_code || city.state,
      citySlug: slugifyCity(feature.properties?.city || city.city, feature.properties?.state_code || city.state),
      website: feature.properties?.website || "",
      phone: feature.properties?.contact?.phone || "",
      tags: [...(feature.properties?.categories || []).slice(0, 3), "Geoapify"],
      sourceUrl: feature.properties?.website || "https://www.geoapify.com/",
      lat: feature.properties?.lat || feature.geometry?.coordinates?.[1] || null,
      lng: feature.properties?.lon || feature.geometry?.coordinates?.[0] || null,
      rating: 0,
    }));
}

async function fetchEventbrite(city, query, limit) {
  if (!process.env.EVENTBRITE_PRIVATE_TOKEN) return [];
  const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
  url.searchParams.set("q", query);
  url.searchParams.set("location.address", city.label);
  url.searchParams.set("location.within", "25mi");
  url.searchParams.set("expand", "venue,logo");
  url.searchParams.set("sort_by", "date");

  const json = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${process.env.EVENTBRITE_PRIVATE_TOKEN}`,
    },
  });

  return (json.events || []).slice(0, limit).map((event) => ({
    id: `eventbrite-${event.id}`,
    provider: "Eventbrite",
    listingType: "event",
    name: event.name?.text || "Untitled event",
    category: "event",
    blackOwned: false,
    verified: false,
    address: event.venue?.address?.localized_address_display || "",
    city: event.venue?.address?.city || city.city,
    state: event.venue?.address?.region || city.state,
    citySlug: slugifyCity(event.venue?.address?.city || city.city, event.venue?.address?.region || city.state),
    website: event.url || "",
    photos: [event.logo?.url].filter(Boolean),
    tags: ["event", "Eventbrite"],
    sourceUrl: event.url || "https://www.eventbrite.com/",
    eventDate: event.start?.local?.slice(0, 10) || "",
    lat: Number(event.venue?.latitude) || null,
    lng: Number(event.venue?.longitude) || null,
    rating: 0,
  }));
}

function friendlyProviderError(message) {
  if (message.includes("401") || message.includes("403")) return "Check provider API key permissions.";
  if (message.includes("400")) return "Provider rejected request parameters.";
  if (message.includes("404")) return "Provider endpoint or token access was not accepted.";
  return message;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function inferCategory(value = "") {
  const text = value.toLowerCase();
  if (text.includes("hotel") || text.includes("accommodation")) return "hotel";
  if (text.includes("museum")) return "museum";
  if (text.includes("restaurant") || text.includes("food") || text.includes("catering")) return "restaurant";
  if (text.includes("event") || text.includes("concert") || text.includes("festival")) return "event";
  return "cultural_site";
}

function slugifyCity(city, state) {
  return [city, state]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dedupeListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    const key = `${listing.name}-${listing.city}-${listing.state}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
