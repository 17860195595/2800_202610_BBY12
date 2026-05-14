/**
 * @file routes/reports.js
 *
 * Express router for crowd-sourced map reports.
 *
 *   GET  /api/reports          → list the most recent reports (default 500)
 *   POST /api/reports          → persist one report; body must contain
 *                                reportType + lat + lng (+ accuracyM)
 *
 * Both endpoints degrade gracefully when MongoDB is offline: GET returns
 * an empty list with a note, POST returns 503 so the client can show an
 * inline error instead of crashing.
 *
 * @author Jiahao
 */

const express = require('express');
const mongoose = require('mongoose');
const { Report, VALID_TYPES } = require('../models/Report');

const router = express.Router();

/** Hard cap on the list endpoint so a typo can't accidentally pull every
 *  document in the collection. */
const MAX_LIST_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 500;

/**
 * @returns {boolean} true when mongoose has an open connection.
 */
function isDbReady() {
    return mongoose.connection.readyState === 1;
}

router.get('/', async (req, res) => {
    try {
        if (!isDbReady()) {
            return res.json({ reports: [], note: 'database offline' });
        }
        const requested = parseInt(req.query.limit, 10);
        const limit = Math.min(
            Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIST_LIMIT,
            MAX_LIST_LIMIT
        );
        const reports = await Report.find({}, {
            reportType: 1,
            lat: 1,
            lng: 1,
            accuracyM: 1,
            createdAt: 1,
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.json({ reports });
    } catch (err) {
        console.error('[reports] list failed:', err);
        res.status(500).json({ error: 'Failed to list reports' });
    }
});

router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const reportType = body.reportType;
        const lat = body.lat;
        const lng = body.lng;
        const accuracyM = body.accuracyM;

        if (!VALID_TYPES.includes(reportType)) {
            return res.status(400).json({
                error: 'Invalid reportType. Expected one of: ' + VALID_TYPES.join(', '),
            });
        }
        if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({ error: 'Invalid lat' });
        }
        if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid lng' });
        }

        if (!isDbReady()) {
            return res
                .status(503)
                .json({ error: 'Database unavailable; report not saved.' });
        }

        const doc = await Report.create({
            reportType,
            lat,
            lng,
            accuracyM:
                typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM >= 0
                    ? accuracyM
                    : null,
            user:
                req.session && req.session.user && req.session.user.username
                    ? req.session.user.username
                    : null,
        });

        res.status(201).json({
            report: {
                _id: doc._id,
                reportType: doc.reportType,
                lat: doc.lat,
                lng: doc.lng,
                accuracyM: doc.accuracyM,
                createdAt: doc.createdAt,
            },
        });
    } catch (err) {
        console.error('[reports] create failed:', err);
        res.status(500).json({ error: 'Failed to save report' });
    }
});

module.exports = router;
