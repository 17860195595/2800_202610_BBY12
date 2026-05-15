/**
 * @file models/Report.js
 *
 * Mongoose schema for crowd-sourced "what does it feel like here right now"
 * reports submitted from the map page's Report FAB. The frontend captures
 * the user's GPS via navigator.geolocation, lets them tag the spot with one
 * of three categories, and POSTs the record to /api/reports.
 *
 * VALID_TYPES is re-exported so routes/reports.js can validate the request
 * body without hard-coding the enum a second time.
 *
 * @author Jiahao
 */

const mongoose = require('mongoose');

const VALID_TYPES = ['too_hot', 'great_shade', 'needs_shade_structure'];

const reportSchema = new mongoose.Schema({
    reportType: {
        type: String,
        enum: VALID_TYPES,
        required: true,
    },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    // GPS accuracy in meters as reported by the browser. Optional — older
    // devices / fallback paths may omit it.
    accuracyM: { type: Number, default: null },
    // Captured from req.session.user.username when the submitter is logged
    // in. Anonymous submissions stay supported, so this is nullable.
    user: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
});

const Report = mongoose.model('Report', reportSchema);

module.exports = { Report, VALID_TYPES };
