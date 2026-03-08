// Ledger type routes (formerly account routes)
const express = require('express');
const router = express.Router();
const ledgerTypeController = require('../controllers/accountController');

router.get('/',    (req, res, next) => ledgerTypeController.getAll(req, res, next));
router.get('/:id', (req, res, next) => ledgerTypeController.getById(req, res, next));
router.post('/',   (req, res, next) => ledgerTypeController.create(req, res, next));
router.put('/:id', (req, res, next) => ledgerTypeController.update(req, res, next));
router.delete('/:id', (req, res, next) => ledgerTypeController.delete(req, res, next));

module.exports = router;
