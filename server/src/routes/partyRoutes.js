const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');

router.get('/', (req, res, next) => partyController.getAll(req, res, next));
router.get('/counts', (req, res, next) => partyController.getCounts(req, res, next));
router.get('/:id', (req, res, next) => partyController.getById(req, res, next));
router.post('/', (req, res, next) => partyController.create(req, res, next));
router.put('/:id', (req, res, next) => partyController.update(req, res, next));
router.delete('/:id', (req, res, next) => partyController.delete(req, res, next));

module.exports = router;
