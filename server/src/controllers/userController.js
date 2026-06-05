const userService = require('../services/userService');

class UserController {
  getAll(req, res, next) {
    try {
      res.json({ success: true, data: userService.getAll() });
    } catch (err) {
      next(err);
    }
  }

  // Public list for the login screen (usernames only)
  getLoginList(req, res, next) {
    try {
      res.json({ success: true, data: userService.getLoginList() });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      res.json({ success: true, data: userService.getById(parseInt(req.params.id)) });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      res.status(201).json({ success: true, data: userService.create(req.body) });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      res.json({ success: true, data: userService.update(parseInt(req.params.id), req.body) });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      userService.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  login(req, res, next) {
    try {
      const { username, password } = req.body;
      const user = userService.authenticate(username, password);
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(401).json({ success: false, message: err.message });
    }
  }
}

module.exports = new UserController();
