const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/', (req, res, next) => dashboardController.getSummary(req, res, next));

module.exports = router;
