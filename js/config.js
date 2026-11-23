/**
 * Mark Cars inventory feed.
 *
 * Paste the Apps Script web app URL (the one ending in /exec) below.
 * Leave it as an empty string to use sample-feed.json and the local
 * photos in sample-photos/ (MC-001-01.jpg, MC-001-02.jpg, and so on).
 */
var FEED_URL = "https://script.google.com/macros/s/AKfycbyortKeH4KJ9Pql-0ddda-GB6Kc2qtbfphmF-IzOP7hC53jvkEg-Y20RXlh2SZpLe3k/exec";

/**
 * Editable contact details. Replace every placeholder before you send buyers here.
 * phoneDisplay is the number people read.
 * phoneTel is used for the Call and Text buttons (digits, with a country code).
 * address is the line shown on the page.
 * mapsQuery is what Get directions searches for.
 */
var CONTACT = {
  phoneDisplay: "(000) 000-0000",
  phoneTel: "+10000000000",
  address: "123 Example Street, Your City",
  mapsQuery: "123 Example Street, Your City",
  smsBody: "Hello Mark Cars, I'm asking about a car on your site."
};

/**
 * Starting point for the monthly payment estimator. This is not a loan offer.
 * Buyers can change the down payment, term, and APR on a car's details.
 */
var FINANCE = {
  apr: 6.9,
  termMonths: 60,
  downPercent: 10
};
