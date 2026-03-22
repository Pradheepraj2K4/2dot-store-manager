const express = require('express');
const router = express.Router();
const interestSchemeController = require('../controllers/interestSchemeController');

router.get('/',       (req, res, next) => interestSchemeController.getAll(req, res, next));
router.get('/:id',    (req, res, next) => interestSchemeController.getById(req, res, next));
router.post('/',      (req, res, next) => interestSchemeController.create(req, res, next));
router.put('/:id',    (req, res, next) => interestSchemeController.update(req, res, next));
router.delete('/:id', (req, res, next) => interestSchemeController.delete(req, res, next));

module.exports = router;
