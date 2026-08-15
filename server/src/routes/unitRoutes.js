const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

router.get('/', (req, res, next) => unitController.getAll(req, res, next));
router.get('/:id', (req, res, next) => unitController.getById(req, res, next));
router.post('/', (req, res, next) => unitController.create(req, res, next));
router.put('/:id', (req, res, next) => unitController.update(req, res, next));
router.delete('/:id', (req, res, next) => unitController.delete(req, res, next));

module.exports = router;
