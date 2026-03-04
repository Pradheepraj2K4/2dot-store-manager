const express = require('express');
const router = express.Router();
const interestController = require('../controllers/interestController');

router.get('/enabled', (req, res, next) => interestController.isEnabled(req, res, next));
router.get('/summary', (req, res, next) => interestController.getSummary(req, res, next));
router.get('/party/:partyId', (req, res, next) => interestController.getByParty(req, res, next));
router.get('/party/:partyId/total', (req, res, next) => interestController.getTotalPending(req, res, next));
router.get('/', (req, res, next) => interestController.getAll(req, res, next));
router.post('/generate', (req, res, next) => interestController.generate(req, res, next));
router.put('/:id/adjust', (req, res, next) => interestController.adjust(req, res, next));
router.put('/:id/waive', (req, res, next) => interestController.waive(req, res, next));

module.exports = router;
