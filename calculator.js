'use strict';

/* =========================================================
   CONSTANTS & HELPERS
   ========================================================= */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const $ = (id) => document.getElementById(id);
const setText = (id, text) => { $(id).textContent = text; };
const formatNumber = (n) => n.toLocaleString('en-US');
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const pad = (n) => String(n).padStart(2, '0');

/* =========================================================
   DATE ENGINE (date-only, timezone safe)
   A date is an object: { y, m, d } where m is 1-12.
   ========================================================= */

/** Returns today's date using the user's local calendar. */
function getToday() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** Converts a date object to "YYYY-MM-DD" for date inputs. */
function toISO({ y, m, d }) {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Parses "YYYY-MM-DD" and validates it. Returns null if invalid. */
function parseISODate(str) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Converts a date to a whole day number (UTC based, so no timezone/DST errors). */
function toDayNumber({ y, m, d }) {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return Math.round(dt.getTime() / 86400000);
}

/** Number of calendar days from date a to date b. */
function daysBetween(a, b) {
  return toDayNumber(b) - toDayNumber(a);
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
function compareDates(a, b) {
  return (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
}

/** Adds n months to (year, month) and clamps the day to the month length. */
function addMonths(year, month, n, day) {
  const total = year * 12 + (month - 1) + n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return { y: newYear, m: newMonth, d: Math.min(day, daysInMonth(newYear, newMonth)) };
}

function getWeekday(date) {
  return WEEKDAY_NAMES[(((toDayNumber(date) + 4) % 7) + 7) % 7]; // 1 Jan 1970 was Thursday
}

function formatDate({ y, m, d }) {
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/* =========================================================
   AGE CALCULATIONS
   ========================================================= */

/**
 * Birthday date in a given year.
 * Handles Feb 29 using the chosen convention ('feb28' or 'mar1').
 */
function getBirthdayInYear(birth, year, convention) {
  if (birth.m === 2 && birth.d === 29 && !isLeapYear(year)) {
    return convention === 'mar1' ? { y: year, m: 3, d: 1 } : { y: year, m: 2, d: 28 };
  }
  return { y: year, m: birth.m, d: birth.d };
}

/** Completed years, then completed months, then remaining days. */
function calculateAge(birth, ref, convention) {
  let years = ref.y - birth.y;
  if (compareDates(getBirthdayInYear(birth, birth.y + years, convention), ref) > 0) years--;

  const anchor = getBirthdayInYear(birth, birth.y + years, convention);
  const candidateFor = (n) => (n === 0 ? anchor : addMonths(anchor.y, anchor.m, n, birth.d));

  let months = (ref.y - anchor.y) * 12 + (ref.m - anchor.m);
  while (months > 0 && compareDates(candidateFor(months), ref) > 0) months--;

  const days = daysBetween(candidateFor(months), ref);
  return { years, months, days };
}

/** Totals based on elapsed calendar days. */
function calculateTotals(birth, ref, age) {
  const totalDays = daysBetween(birth, ref);
  return {
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    extraDays: totalDays % 7,
    totalMonths: age.years * 12 + age.months,
    totalHours: totalDays * 24,
    totalMinutes: totalDays * 1440
  };
}

/** Next birthday relative to the reference date. */
function getNextBirthday(birth, ref, convention) {
  let year = ref.y;
  let next = getBirthdayInYear(birth, year, convention);

  // Birth year itself is not a birthday, so skip to next year.
  if (year === birth.y || compareDates(next, ref) < 0) {
    year++;
    next = getBirthdayInYear(birth, year, convention);
  }

  const daysLeft = daysBetween(ref, next);

  // Remaining months and days between ref and next birthday
  let months = (next.y - ref.y) * 12 + (next.m - ref.m);
  const candidateFor = (n) => (n === 0 ? ref : addMonths(ref.y, ref.m, n, ref.d));
  while (months > 0 && compareDates(candidateFor(months), next) > 0) months--;
  const extraDays = daysBetween(candidateFor(months), next);

  return {
    date: next,
    weekday: getWeekday(next),
    turningAge: next.y - birth.y,
    daysLeft,
    months,
    extraDays
  };
}

/** Western zodiac (entertainment only). */
function getZodiac({ m, d }) {
  const md = m * 100 + d;
  const signs = [
    [120, 'Aquarius ♒'], [219, 'Pisces ♓'], [321, 'Aries ♈'], [420, 'Taurus ♉'],
    [521, 'Gemini ♊'], [621, 'Cancer ♋'], [723, 'Leo ♌'], [823, 'Virgo ♍'],
    [923, 'Libra ♎'], [1023, 'Scorpio ♏'], [1122, 'Sagittarius ♐'], [1222, 'Capricorn ♑']
  ];
  let sign = 'Capricorn ♑';
  for (const [start, name] of signs) {
    if (md >= start) sign = name;
  }
  return sign;
}

/* =========================================================
   VALIDATION
   ========================================================= */
function validateInputs() {
  const dobValue = dobInput.value;
  const refValue = refInput.value;

  if (!dobValue) return { error: 'Please select your date of birth.', field: dobInput };
  const birth = parseISODate(dobValue);
  if (!birth) return { error: 'The date of birth is not a valid date.', field: dobInput };

  if (!refValue) return { error: 'Please select the "Calculate Age As Of" date.', field: refInput };
  const ref = parseISODate(refValue);
  if (!ref) return { error: 'The reference date is not a valid date.', field: refInput };

  if (compareDates(birth, getToday()) > 0) {
    return { error: 'Date of birth cannot be in the future.', field: dobInput };
  }
  if (compareDates(ref, birth) < 0) {
    return { error: 'The reference date cannot be earlier than the date of birth.', field: refInput };
  }
  return { birth, ref };
}

/* =========================================================
   UI
   ========================================================= */
const form = $('ageForm');
const dobInput = $('dob');
const refInput = $('refDate');
const leapSelect = $('leapRule');
const errorBox = $('errorMsg');
const resultsSection = $('results');
const navToggle = $('navToggle');
const mainNav = $('mainNav');
const toastEl = $('toast');

let lastCopyText = '';
let toastTimer = null;

function showError(message, field) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  [dobInput, refInput].forEach((i) => i.classList.remove('invalid'));
  if (field) { field.classList.add('invalid'); field.focus(); }
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
  [dobInput, refInput].forEach((i) => i.classList.remove('invalid'));
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function renderResults(birth, ref, convention) {
  const age = calculateAge(birth, ref, convention);
  const totals = calculateTotals(birth, ref, age);
  const next = getNextBirthday(birth, ref, convention);

  const exactText = `${plural(age.years, 'Year')}, ${plural(age.months, 'Month')}, ${plural(age.days, 'Day')}`;
  const nextDateText = formatDate(next.date);
  const remainingText = next.daysLeft === 0
    ? 'Today is your birthday! 🎉'
    : `${plural(next.daysLeft, 'Day')} Remaining!`;
  const monthsDaysText = `${plural(next.months, 'Month')}, ${plural(next.extraDays, 'Day')}`;
  const zodiac = getZodiac(birth);
  const birthWeekday = getWeekday(birth);

  // Main result
  setText('exactAge', exactText);
  setText('asOfLabel', `Age as of ${formatDate(ref)}`);

  // Stat cards
  setText('statYears', formatNumber(age.years));
  setText('statMonths', formatNumber(age.months));
  setText('statDays', formatNumber(age.days));
  setText('statTotalMonths', formatNumber(totals.totalMonths));
  setText('statTotalWeeks', formatNumber(totals.totalWeeks));
  setText('statTotalDays', formatNumber(totals.totalDays));
  setText('statTotalHours', formatNumber(totals.totalHours));
  setText('statTotalMinutes', formatNumber(totals.totalMinutes));

  // Next birthday
  setText('nbDate', nextDateText);
  setText('nbWeekday', next.weekday);
  setText('nbTurning', next.daysLeft === 0
    ? `You turn ${next.turningAge} years old today.`
    : `You will turn ${next.turningAge} years old.`);
  setText('nbRemaining', remainingText);
  setText('nbCurrentAge', plural(age.years, 'year'));
  setText('nbTurningAge', plural(next.turningAge, 'year'));
  setText('nbDays', plural(next.daysLeft, 'day'));
  setText('nbMonthsDays', monthsDaysText);

  // Additional info
  setText('infoWeekday', birthWeekday);
  setText('infoMonth', MONTH_NAMES[birth.m - 1]);
  setText('infoYear', String(birth.y));
  setText('infoCalMonths', formatNumber(totals.totalMonths));
  setText('infoWeeks', `${formatNumber(totals.totalWeeks)} (+${totals.extraDays} day${totals.extraDays === 1 ? '' : 's'})`);
  setText('infoDays', formatNumber(totals.totalDays));
  setText('infoZodiac', zodiac);

  // Text for the Copy button
  lastCopyText = [
    'AGE CALCULATOR RESULT',
    '---------------------',
    `Date of Birth: ${formatDate(birth)} (${birthWeekday})`,
    `Age As Of: ${formatDate(ref)}`,
    '',
    `Exact Age: ${exactText}`,
    `Total Months Lived: ${formatNumber(totals.totalMonths)}`,
    `Total Weeks Lived: ${formatNumber(totals.totalWeeks)}`,
    `Total Days Lived: ${formatNumber(totals.totalDays)}`,
    `Total Hours Lived: ${formatNumber(totals.totalHours)}`,
    `Total Minutes Lived: ${formatNumber(totals.totalMinutes)}`,
    '',
    `Next Birthday: ${nextDateText} (${next.weekday})`,
    `Turning Age: ${next.turningAge}`,
    `Remaining: ${next.daysLeft === 0 ? 'Today!' : `${plural(next.daysLeft, 'day')} (${monthsDaysText})`}`,
    '',
    `Zodiac (just for fun): ${zodiac}`
  ].join('\n');

  resultsSection.hidden = false;
  // Restart animation each time
  resultsSection.style.animation = 'none';
  void resultsSection.offsetWidth;
  resultsSection.style.animation = '';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* =========================================================
   EVENT HANDLERS
   ========================================================= */
function handleSubmit(event) {
  event.preventDefault();
  clearError();
  const result = validateInputs();
  if (result.error) {
    resultsSection.hidden = true;
    showError(result.error, result.field);
    return;
  }
  renderResults(result.birth, result.ref, leapSelect.value);
}

function setRefToToday() {
  refInput.value = toISO(getToday());
}

function handleReset() {
  dobInput.value = '';
  setRefToToday();
  leapSelect.value = 'feb28';
  clearError();
  resultsSection.hidden = true;
  lastCopyText = '';
  dobInput.focus();
}

/** Copies text with the Clipboard API, falling back to execCommand (works on file://). */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* use fallback below */ }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(area);
  return ok;
}

async function handleCopy() {
  if (!lastCopyText) return;
  const ok = await copyText(lastCopyText);
  showToast(ok ? 'Result copied to clipboard ✓' : 'Could not copy. Please copy manually.');
}

function handlePrint() {
  if (resultsSection.hidden) return;
  window.print();
}

function closeMenu() {
  mainNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
}

function toggleMenu() {
  const open = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
}

/* =========================================================
   INIT
   ========================================================= */
function init() {
  dobInput.max = toISO(getToday());   // block future birth dates
  setRefToToday();

  form.addEventListener('submit', handleSubmit);
  $('resetBtn').addEventListener('click', handleReset);
  $('todayBtn').addEventListener('click', () => { setRefToToday(); clearError(); });
  $('copyBtn').addEventListener('click', handleCopy);
  $('printBtn').addEventListener('click', handlePrint);

  [dobInput, refInput].forEach((input) => input.addEventListener('input', clearError));

  navToggle.addEventListener('click', toggleMenu);
  mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMenu(); });
}

init();