const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/', (req, res, next) => customerController.getAll(req, res, next));
router.get('/:id', (req, res, next) => customerController.getById(req, res, next));
router.post('/', (req, res, next) => customerController.create(req, res, next));
router.put('/:id', (req, res, next) => customerController.update(req, res, next));
router.delete('/:id', (req, res, next) => customerController.delete(req, res, next));

module.exports = router;
