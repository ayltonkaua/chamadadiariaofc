/**
 * Alert Routes — Index
 *
 * Mounts all alert sub-routes into a single Express router.
 *
 * Routes:
 *   POST /sendRiskAlert
 *   POST /sendMonthlySummary
 *   POST /sendDailyAbsences
 *   GET  /absence-progress
 *   POST /sendEscalation
 *   POST /sendDailyAbsencesToGroup
 */

const express = require('express');
const router = express.Router();

router.use(require('./riskAlert'));
router.use(require('./monthlySummary'));
router.use(require('./dailyAbsences'));
router.use(require('./escalation'));
router.use(require('./groupAlert'));

module.exports = router;
