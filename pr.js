const DurationToElement = Object.freeze({ 30: "#interval-30", 45: "#interval-45", 60: "#interval-60", 90: "#interval-90" });

const selectDuration = function (duration) {
    const selector = DurationToElement[duration];
    document.querySelector(selector).click();
}

const daysFromToday = function (days) {
    const current = new Date();
    current.addDays(days);
    return current;
}

const openDatePicker = function () {
    document.querySelector(".reserve-court-new .ca-date-picker-field a").click();
}

const isMonth = function (monthAsString) {
    return document.querySelectorAll(".datepickerMonth a")[2].text.includes(monthAsString)
}

const selectToday = function () {
    document.querySelector(".datepickerToday a").click();
    openDatePicker();
}

const selectNextMonth = function () {
    document.querySelector(".datepickerGoNext a").click();
}

const selectMonth = function (date) {
    const options = { month: 'long' };
    const monthAsString = new Intl.DateTimeFormat('en-US', options).format(date);
    if (!isMonth(monthAsString)) {
        selectToday();
        if (!isMonth(monthAsString)) {
            selectNextMonth();
        }
        if (!isMonth(monthAsString)) {
            selectNextMonth();
            throw "Failed to select month";
        }
    }
}

const selectDayOfTheMonth = function (date) {
    const days = document.querySelector('div[style*="display: block"].datepicker').querySelectorAll(".datepickerDays td");
    for (const element of days) {
        if (!element.classList.contains('datepickerNotInMonth') && element.textContent == date.getDate()) {
            element.querySelector('a').click();
            return;
        }
    }
    throw "Failed to select Day";
}

const selectDate = function (date) {
    openDatePicker();
    selectMonth(date);
    selectDayOfTheMonth(date);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const waitUntilTime = async function (bookingTime) {
    const current = new Date();
    const timeToPrebookMs = bookingTime - current;
    if (timeToPrebookMs < 0) {
        return;
    }
    await sleep(timeToPrebookMs);
}

const runSearch = function () {
    document.querySelector("#reserve-court-search").click();
}

const waitForReservationOrNotAvailableText = async function (selector, timeoutMs) {
    const endTime = new Date(new Date().getTime() + timeoutMs);
    while (new Date() < endTime) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            return elements;
        }
        await sleep(20);
    }
    const notAvailable = document.querySelectorAll(".court-not-available-text");
    if (notAvailable) {
        throw "No courts available";
    }
    throw "Unable to find element";
}

const waitForElement = async function (selector, timeoutMs) {
    const endTime = new Date(new Date().getTime() + timeoutMs);
    while (new Date() < endTime) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await sleep(20);
    }
    console.log("Unable to find element: ");
    console.log(selector);
    return null;
}

const waitForLoadingToPass = async function () {
    await sleep(500);
    // waitForElement('div[style*="display: block"]#overlay_layer', 500);
    // waitForElement('div[style*="display: none"]#overlay_layer', 500);
}

const getCourtTable = async function (sport) {
    const columns = await waitForReservationOrNotAvailableText("#times-to-reserve td", 1000);
    for (const element of columns) {
        if (element.querySelector('b').textContent === sport) {
            return element;
        }
    }
    throw 'Failed to find an available court';
}

const getTimes = function (courtTable) {
    const elements = courtTable.querySelectorAll('a');
    let times = {};
    elements.forEach((element) => { times[element.textContent.trim()] = element; });
    return times;
}

const determineBestTime = function (courtTable, bestTimes) {
    const timesToElements = getTimes(courtTable);
    for (const time of bestTimes) {
        if (time in timesToElements) {
            return timesToElements[time];
        }
    }
    throw 'Failed to find a time';
}

const selectTime = function (element) {
    element.click();
}

const bookCourt = async function (button) {
    const bookingDetails = document.querySelectorAll("#confirm-reservation-popup .left td")
    button.click();
    console.log("Successfully Booked:");
    bookingDetails.forEach((element) => { console.log(element.textContent); });
}

const attemptToBookCourt = async function (sport, bestTimes) {
    let retries = 10;
    let successfullyBooked = false;
    while(retries > 0 && successfullyBooked === false)
    {
        runSearch();
        await waitForLoadingToPass();
        const courtTable = await getCourtTable(sport);
        const bestTimeElement = determineBestTime(courtTable, bestTimes);    
        selectTime(bestTimeElement);
        const button = await waitForElement("#confirm", 5000);
        if(button === null) {
            const cancelButton = await waitForElement("#button-ok");
            cancelButton.click();
        } else {
            await bookCourt(button);
            successfullyBooked = true;
        }
        retries = retries - 1;
    }
}

const repeatedlyAttemptToBookCourt = async function (refreshIntervalMs, timeoutMs, sport, bestTimes) {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + timeoutMs);
    let successfullyBooked = false;
    while (new Date() < endTime && !successfullyBooked) {
        try {
            await attemptToBookCourt(sport, bestTimes);
            successfullyBooked = true;
        } catch (error) {
            console.log(error);
        }
        await sleep(refreshIntervalMs);
    }
    if (!successfullyBooked) {
        console.log("Failed to book");
    }
}

const waitAndBookCourt = async function () {
    const courtDurationMinutes = 90; // Options: 30, 45, 60, 90
    const date = daysFromToday(8);
    const sport = "Pickleball / Mini Tennis"; // Options: 'Pickleball / Mini Tennis', 'Tennis'
    const bestTimes = ['8:00pm', '8:30pm', '7:30pm', '7:00pm', '9:00pm'];

    // Booking time is as 12:30. Wait untl 45 secs before booking time to start refreshing
    let bookingTime = new Date();
    bookingTime.setHours(12);
    bookingTime.setMinutes(29);
    bookingTime.setSeconds(45);
    const refreshIntervalMs = 500;
    const timeoutMs = 30 * 1000;

    selectDuration(courtDurationMinutes);
    selectDate(date);
    await waitUntilTime(bookingTime);
    await repeatedlyAttemptToBookCourt(refreshIntervalMs, timeoutMs, sport, bestTimes);
}

const getTimesForDate = async function(date, sport) {
    selectDate(date);
    runSearch();
    await waitForLoadingToPass();
    try {
        const courtTable = await getCourtTable(sport);
        return getTimes(courtTable);
    } catch (error) {
        return {};
    }
}

const datesAvailable = async function () {
    const courtDurationMinutes = 90; // Options: 30, 45, 60, 90
    const sport = "Pickleball / Mini Tennis"; // Options: 'Pickleball / Mini Tennis', 'Tennis'
    selectDuration(courtDurationMinutes);
    for(let i = 0; i < 8; i++) {
        date = daysFromToday(i)
        console.log(date)
        timesForElements = await getTimesForDate(date, sport);
        console.log(timesForElements);
    }
}

waitAndBookCourt();
