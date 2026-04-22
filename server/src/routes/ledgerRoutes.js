const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

router.get('/outstanding',             (req, res, next) => ledgerController.getOutstanding(req, res, next));
router.get('/outstanding/type/:typeId',(req, res, next) => ledgerController.getOutstandingByType(req, res, next));
router.get('/pending-interest',        (req, res, next) => ledgerController.getPendingInterest(req, res, next));
router.get('/counts',                  (req, res, next) => ledgerController.getCounts(req, res, next));
router.get('/:id',                     (req, res, next) => ledgerController.getById(req, res, next));
router.get('/',                        (req, res, next) => ledgerController.getAll(req, res, next));
router.post('/bulk',                   (req, res, next) => ledgerController.bulkCreate(req, res, next));
router.post('/',                       (req, res, next) => ledgerController.create(req, res, next));
router.put('/:id',                     (req, res, next) => ledgerController.update(req, res, next));
router.delete('/:id',                  (req, res, next) => ledgerController.delete(req, res, next));

module.exports = router;
