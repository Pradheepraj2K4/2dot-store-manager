const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/next-number', (req, res, next) => serviceController.getNextNumber(req, res, next));
router.get('/', (req, res, next) => serviceController.getAll(req, res, next));
router.get('/:id', (req, res, next) => serviceController.getById(req, res, next));
router.post('/', (req, res, next) => serviceController.create(req, res, next));
router.put('/:id', (req, res, next) => serviceController.update(req, res, next));
router.post('/:id/close', (req, res, next) => serviceController.close(req, res, next));
router.delete('/:id', (req, res, next) => serviceController.delete(req, res, next));

module.exports = router;
