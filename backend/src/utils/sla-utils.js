/**
 * SLA Utilities — Timezone-aware business hours calculations
 *
 * Calculates SLA due dates respecting global defaults.
 */

const LOCATION_TIMEZONES = {
    'Philippines': 'Asia/Manila',
    'Indonesia': 'Asia/Jakarta',
    'China': 'Asia/Shanghai',
    'US': 'America/New_York', // Default to Eastern Time
    'Default': 'UTC'
};

function getTimezoneForLocation(location) {
    return LOCATION_TIMEZONES[location] || LOCATION_TIMEZONES['Default'];
}

/**
 * Parse a TIME string (HH:MM) into { hours, minutes }.
 */
function parseTime(timeStr) {
    const [hours, minutes] = (timeStr || '08:00').split(':').map(Number);
    return { hours, minutes };
}

/**
 * Get the current time in a specific IANA timezone as a Date-like object.
 * Returns a Date object adjusted to represent the wall-clock time in that timezone.
 */
function getDateInTimezone(date, timezone) {
    const options = {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);

    const get = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? parseInt(part.value, 10) : 0;
    };

    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
        second: get('second'),
        dayOfWeek: new Date(
            get('year'), get('month') - 1, get('day')
        ).getDay(), // 0=Sun, 1=Mon, ... 6=Sat
    };
}

/**
 * Convert JS Date.getDay() (0=Sun) to ISO day (1=Mon ... 7=Sun)
 * to match the business_days array format.
 */
function jsToIsoDayOfWeek(jsDay) {
    return jsDay === 0 ? 7 : jsDay;
}

/**
 * Check if a given date/time falls within business hours.
 */
function isBusinessTime(date, location = 'Default') {
    const tz = getTimezoneForLocation(location);
    const localTime = getDateInTimezone(date, tz);
    const isoDay = jsToIsoDayOfWeek(localTime.dayOfWeek);
    const businessDays = [1, 2, 3, 4, 5];

    if (!businessDays.includes(isoDay)) return false;

    const start = parseTime('08:00');
    const end = parseTime('17:00');
    const currentMinutes = localTime.hour * 60 + localTime.minute;
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get the remaining business minutes in the current business day from a given UTC date.
 * Returns 0 if outside business hours.
 */
function getRemainingBusinessMinutesToday(date, location = 'Default') {
    const tz = getTimezoneForLocation(location);
    const localTime = getDateInTimezone(date, tz);
    const isoDay = jsToIsoDayOfWeek(localTime.dayOfWeek);
    const businessDays = [1, 2, 3, 4, 5];

    if (!businessDays.includes(isoDay)) return 0;

    const start = parseTime('08:00');
    const end = parseTime('17:00');
    const currentMinutes = localTime.hour * 60 + localTime.minute;
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    if (currentMinutes < startMinutes) return endMinutes - startMinutes;
    if (currentMinutes >= endMinutes) return 0;
    return endMinutes - currentMinutes;
}

/**
 * Get the total business minutes in a single business day.
 */
function getBusinessMinutesPerDay() {
    const start = parseTime('08:00');
    const end = parseTime('17:00');
    return (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
}

/**
 * Add business hours to a start date, respecting timezone and business days.
 *
 * @param {Date} startDate - UTC start date
 * @param {number} hours - Number of business hours to add
 * @returns {Date} - UTC date when the SLA is due
 */
function addBusinessHours(startDate, hours, location = 'Default') {
    let remainingMinutes = hours * 60;
    const current = new Date(startDate.getTime());
    const tz = getTimezoneForLocation(location);

    // Safety limit: prevent infinite loops (max 365 days)
    const maxIterations = 365 * 24 * 60;
    let iterations = 0;

    while (remainingMinutes > 0 && iterations < maxIterations) {
        iterations++;

        const remainingToday = getRemainingBusinessMinutesToday(current, location);

        if (remainingToday <= 0) {
            // Not in business hours — advance to next minute
            current.setMinutes(current.getMinutes() + 1);

            // Optimization: if we're past end of business day, skip to next day's start
            const localTime = getDateInTimezone(current, tz);
            const end = parseTime('17:00');
            const endMinutes = end.hours * 60 + end.minutes;
            const currentMinutes = localTime.hour * 60 + localTime.minute;

            if (currentMinutes >= endMinutes) {
                // Jump to start of next day
                const start = parseTime('08:00');
                const hoursToAdd = 24 - localTime.hour + start.hours;
                current.setHours(current.getHours() + hoursToAdd);
                current.setMinutes(start.minutes);
                current.setSeconds(0);
            }
            continue;
        }

        if (remainingToday >= remainingMinutes) {
            // Enough time left today
            current.setMinutes(current.getMinutes() + remainingMinutes);
            remainingMinutes = 0;
        } else {
            // Use today's remaining time and continue tomorrow
            remainingMinutes -= remainingToday;
            current.setMinutes(current.getMinutes() + remainingToday);
        }
    }

    return current;
}

/**
 * Add business days to a start date, respecting timezone and business days.
 *
 * @param {Date} startDate - UTC start date
 * @param {number} businessDays - Number of business days to add
 * @returns {Date} - UTC date after adding business days
 */
function addBusinessDays(startDate, businessDays, location = 'Default') {
    const tz = getTimezoneForLocation(location);
    const result = new Date(startDate);
    const bizDays = [1, 2, 3, 4, 5];
    let added = 0;

    while (added < businessDays) {
        result.setDate(result.getDate() + 1);
        const localTime = getDateInTimezone(result, tz);
        const isoDay = jsToIsoDayOfWeek(localTime.dayOfWeek);
        if (bizDays.includes(isoDay)) {
            added += 1;
        }
    }

    return result;
}

/**
 * Compute SLA status for a ticket, respecting business hours.
 */
function computeSlaStatus(ticket, rule) {
    if (!ticket || !ticket.sla_due_date || !rule) {
        return {
            response_remaining_minutes: null,
            resolution_remaining_minutes: null,
            response_breached: false,
            resolution_breached: false,
            escalated: false,
        };
    }

    // Stop SLA countdown for Resolved/Closed tickets
    if (['Resolved', 'Closed'].includes(ticket.status)) {
        return {
            response_remaining_minutes: null,
            resolution_remaining_minutes: null,
            response_breached: false,
            resolution_breached: false,
            escalated: false,
        };
    }

    const now = new Date();
    const responseDue = ticket.sla_response_due ? new Date(ticket.sla_response_due) : null;
    const resolutionDue = new Date(ticket.sla_due_date);

    const responseRemaining = responseDue ? Math.ceil((responseDue - now) / 60000) : null;
    const resolutionRemaining = Math.ceil((resolutionDue - now) / 60000);

    const responseBreached = responseDue ? now > responseDue : false;
    const resolutionBreached = now > resolutionDue;

    // Escalation check
    const createdAt = new Date(ticket.created_at);
    const totalWindowMs = resolutionDue - createdAt;
    const elapsedMs = now - createdAt;
    const elapsedPercent = totalWindowMs > 0 ? (elapsedMs / totalWindowMs) * 100 : 0;
    const escalated = elapsedPercent >= (rule.escalation_threshold_percent || 100);

    return {
        response_remaining_minutes: responseRemaining,
        resolution_remaining_minutes: resolutionRemaining,
        response_breached: responseBreached,
        resolution_breached: resolutionBreached,
        escalated,
    };
}

module.exports = {
    addBusinessHours,
    addBusinessDays,
    computeSlaStatus,
    isBusinessTime,
    getBusinessMinutesPerDay,
    getRemainingBusinessMinutesToday,
    getDateInTimezone,
    parseTime,
};
