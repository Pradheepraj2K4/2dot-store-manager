const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Public — login screen helpers
router.get('/login-list', (req, res, next) => userController.getLoginList(req, res, next));
router.post('/login',      (req, res, next) => userController.login(req, res, next));

// Management
router.get('/',        (req, res, next) => userController.getAll(req, res, next));
router.get('/:id',     (req, res, next) => userController.getById(req, res, next));
router.post('/',       (req, res, next) => userController.create(req, res, next));
router.put('/:id',     (req, res, next) => userController.update(req, res, next));
router.delete('/:id',  (req, res, next) => userController.delete(req, res, next));

module.exports = router;
