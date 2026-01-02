/**
 * Utility functions for Canadian holidays
 */

/**
 * Calculate Easter date for a given year using the Computus algorithm
 * @param {number} year - The year
 * @returns {Date} - Easter Sunday date
 */
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Get the nth occurrence of a weekday in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @param {number} weekday - The weekday (0=Sunday, 1=Monday, etc.)
 * @param {number} n - Which occurrence (1=first, 2=second, etc., -1=last)
 * @returns {Date} - The date
 */
function getNthWeekday(year, month, weekday, n) {
  if (n === -1) {
    // Last occurrence
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    const diff = (lastWeekday - weekday + 7) % 7;
    return new Date(year, month, lastDay.getDate() - diff);
  } else {
    // Nth occurrence
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const diff = (weekday - firstWeekday + 7) % 7;
    const day = 1 + diff + (n - 1) * 7;
    return new Date(year, month, day);
  }
}

/**
 * Get all Canadian holidays for a given year
 * @param {number} year - The year
 * @returns {Map<string, string>} - Map of date strings (YYYY-MM-DD) to holiday names
 */
export function getCanadianHolidays(year) {
  const holidays = new Map();

  // Fixed date holidays
  holidays.set(`${year}-01-01`, "New Year's Day");
  holidays.set(`${year}-07-01`, "Canada Day");
  holidays.set(`${year}-11-11`, "Remembrance Day");
  holidays.set(`${year}-12-25`, "Christmas");
  holidays.set(`${year}-12-26`, "Boxing Day");

  // Easter-based holidays
  const easter = calculateEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  
  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };
  
  holidays.set(formatDate(goodFriday), "Good Friday");
  holidays.set(formatDate(easterMonday), "Easter Monday");

  // Victoria Day - Last Monday before May 25
  const may24 = new Date(year, 4, 24); // May 24 (month is 0-indexed)
  const may24Weekday = may24.getDay();
  let victoriaDay;
  if (may24Weekday === 1) {
    // May 24 is a Monday, so Victoria Day is May 24
    victoriaDay = new Date(year, 4, 24);
  } else {
    // Find the Monday before May 24
    const daysToMonday = (may24Weekday === 0 ? 6 : may24Weekday - 1);
    victoriaDay = new Date(year, 4, 24 - daysToMonday);
  }
  holidays.set(formatDate(victoriaDay), "Victoria Day");

  // Civic Holiday - First Monday in August
  const civicHoliday = getNthWeekday(year, 7, 1, 1); // August is month 7
  holidays.set(formatDate(civicHoliday), "Civic Holiday");

  // Labour Day - First Monday in September
  const labourDay = getNthWeekday(year, 8, 1, 1); // September is month 8
  holidays.set(formatDate(labourDay), "Labour Day");

  // Thanksgiving - Second Monday in October
  const thanksgiving = getNthWeekday(year, 9, 1, 2); // October is month 9
  holidays.set(formatDate(thanksgiving), "Thanksgiving");

  return holidays;
}

/**
 * Get holiday name for a specific date
 * @param {Date} date - The date
 * @returns {string|null} - Holiday name or null if not a holiday
 */
export function getHolidayForDate(date) {
  const year = date.getFullYear();
  const holidays = getCanadianHolidays(year);
  const formatDate = (d) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };
  return holidays.get(formatDate(date)) || null;
}

