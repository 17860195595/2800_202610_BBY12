const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const READY = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

router.get('/', (req, res) => {
  const rs = mongoose.connection.readyState;
  const cfg = req.app.locals.mongo || {};

  res.json({
    ok: true,
    service: 'project-template',
    mongo: {
      startup: cfg.mode,
      startupDetail: cfg.detail,
      mongooseReadyState: rs,
      mongooseStatus: READY[rs] || 'unknown',
    },
  });
});

module.exports = router;
