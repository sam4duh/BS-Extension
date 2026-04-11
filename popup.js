const CACHE_KEY = 'nepali_date_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const nepaliDateEl = document.getElementById('nepali-date');
const englishDateEl = document.getElementById('english-date');
const errorEl = document.getElementById('error');
const retryBtn = document.getElementById('retry-btn');

// Nepali (Devanagari) digit to ASCII
const NEPALI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

// Handles common spelling variants found on hamropatro
const NEPALI_MONTHS = {
  'बैशाख': 'Baishakh', 'वैशाख': 'Baishakh',
  'जेठ': 'Jestha',     'जेष्ठ': 'Jestha',
  'असार': 'Ashadh',    'आषाढ': 'Ashadh',
  'साउन': 'Shrawan',   'श्रावण': 'Shrawan',
  'भदौ': 'Bhadra',     'भाद्र': 'Bhadra',
  'असोज': 'Ashwin',    'आश्विन': 'Ashwin',
  'कार्तिक': 'Kartik',
  'मंसिर': 'Mangsir',  'मङ्सिर': 'Mangsir', 'मार्गशीर्ष': 'Mangsir',
  'पुस': 'Poush',      'पौष': 'Poush',
  'माघ': 'Magh',
  'फागुन': 'Falgun',   'फाल्गुन': 'Falgun',
  'चैत': 'Chaitra',    'चैत्र': 'Chaitra',
};

const NEPALI_DAYS = {
  'आइतबार': 'Sunday',   'आइत': 'Sunday',
  'सोमबार': 'Monday',   'सोम': 'Monday',
  'मंगलबार': 'Tuesday', 'मङ्गल': 'Tuesday',
  'बुधबार': 'Wednesday','बुध': 'Wednesday',
  'बिहिबार': 'Thursday','बिहि': 'Thursday',
  'शुक्रबार': 'Friday',  'शुक्र': 'Friday',
  'शनिबार': 'Saturday', 'शनि': 'Saturday',
};

loadDate();
retryBtn.addEventListener('click', () => {
  showLoading();
  fetchAndDisplay();
});

function loadDate() {
  const cached = getCache();
  if (cached) {
    display(cached.nepali, cached.english);
    // refresh in the background if cache is old
    if (isCacheStale(cached.timestamp)) fetchAndDisplay();
  } else {
    showLoading();
    fetchAndDisplay();
  }
}

async function fetchAndDisplay() {
  try {
    const html = await fetchPage('https://www.hamropatro.com/');
    const { nepali, english } = parseDates(html);
    if (!nepali) throw new Error('Could not parse date from page');
    saveCache({ nepali, english, timestamp: Date.now() });
    display(nepali, english);
  } catch (err) {
    const cached = getCache();
    if (cached) {
      display(cached.nepali, cached.english);
      englishDateEl.textContent += '  (cached)';
    } else {
      showError();
    }
  }
}

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseDates(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent) : '';

  // looking for something like "२८ चैत २०८२" optionally with day name after comma
  const nepaliRaw = bodyText.match(
    /([०-९]{1,2})\s+([\u0900-\u097F]+)\s+([०-९]{4})(?:[,\s]+([\u0900-\u097F]+))?/
  );

  let nepali = null;
  if (nepaliRaw) {
    const day = convertDigits(nepaliRaw[1]);
    const month = translateMonth(nepaliRaw[2]);
    const year = convertDigits(nepaliRaw[3]);
    const dow = nepaliRaw[4] ? translateDay(nepaliRaw[4]) : null;
    nepali = dow ? `${day} ${month} ${year}, ${dow}` : `${day} ${month} ${year}`;
  }

  // try to grab english date from the page, fall back to system date
  const englishMatch = bodyText.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i
  );
  const english = englishMatch
    ? englishMatch[0].trim()
    : new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return { nepali, english };
}

function convertDigits(str) {
  return str.replace(/[०-९]/g, d => NEPALI_DIGITS[d] || d);
}

function translateMonth(word) {
  if (NEPALI_MONTHS[word]) return NEPALI_MONTHS[word];
  for (const [key, val] of Object.entries(NEPALI_MONTHS)) {
    if (word.includes(key) || key.includes(word)) return val;
  }
  return word;
}

function translateDay(word) {
  if (NEPALI_DAYS[word]) return NEPALI_DAYS[word];
  for (const [key, val] of Object.entries(NEPALI_DAYS)) {
    if (word.includes(key) || key.includes(word)) return val;
  }
  return word;
}

function showLoading() {
  nepaliDateEl.textContent = 'Loading...';
  englishDateEl.textContent = '';
  errorEl.hidden = true;
  retryBtn.hidden = true;
}

function showError() {
  nepaliDateEl.textContent = '';
  englishDateEl.textContent = '';
  errorEl.hidden = false;
  retryBtn.hidden = false;
}

function display(nepali, english) {
  nepaliDateEl.textContent = nepali || '—';
  englishDateEl.textContent = english || '';
  errorEl.hidden = true;
  retryBtn.hidden = true;
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function isCacheStale(ts) {
  return (Date.now() - ts) > CACHE_TTL;
}
