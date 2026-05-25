const express = require('express');
const router = express.Router();
const estimationController = require('../controllers/estimationController');

router.get('/next-number', (req, res, next) => estimationController.getNextNumber(req, res, next));
router.get('/',            (req, res, next) => estimationController.getAll(req, res, next));
router.get('/:id',         (req, res, next) => estimationController.getById(req, res, next));
router.post('/',           (req, res, next) => estimationController.create(req, res, next));
router.post('/:id/convert',(req, res, next) => estimationController.convert(req, res, next));
router.put('/:id',         (req, res, next) => estimationController.update(req, res, next));
router.delete('/:id',      (req, res, next) => estimationController.delete(req, res, next));

module.exports = router;
