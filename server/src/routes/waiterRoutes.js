const express = require('express');
const router = express.Router();
const waiterController = require('../controllers/waiterController');

router.get('/', (req, res, next) => waiterController.getAll(req, res, next));
router.get('/:id', (req, res, next) => waiterController.getById(req, res, next));
router.post('/', (req, res, next) => waiterController.create(req, res, next));
router.put('/:id', (req, res, next) => waiterController.update(req, res, next));
router.put('/:id/default', (req, res, next) => waiterController.setDefault(req, res, next));
router.delete('/:id', (req, res, next) => waiterController.delete(req, res, next));

module.exports = router;
