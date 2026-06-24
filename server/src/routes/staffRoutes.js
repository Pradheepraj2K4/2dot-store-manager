const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', (req, res, next) => staffController.getAll(req, res, next));
router.get('/:id', (req, res, next) => staffController.getById(req, res, next));
router.post('/', (req, res, next) => staffController.create(req, res, next));
router.put('/:id', (req, res, next) => staffController.update(req, res, next));
router.delete('/:id', (req, res, next) => staffController.delete(req, res, next));

module.exports = router;
