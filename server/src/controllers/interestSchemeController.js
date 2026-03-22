const interestSchemeRepository = require('../repositories/interestSchemeRepository');
const { AppError } = require('../middleware/errorHandler');

class InterestSchemeController {
  getAll(req, res, next) {
    try {
      const schemes = interestSchemeRepository.findAll();
      res.json({ success: true, data: schemes });
    } catch (err) {
      next(err);
    }
  }

  getById(req, res, next) {
    try {
      const scheme = interestSchemeRepository.findById(parseInt(req.params.id));
      if (!scheme) throw new AppError('Interest scheme not found', 404);
      res.json({ success: true, data: scheme });
    } catch (err) {
      next(err);
    }
  }

  create(req, res, next) {
    try {
      const { name, nature } = req.body;
      if (!name || !name.trim()) throw new AppError('Name is required', 400);
      if (!['DAILY', 'MONTHLY'].includes(nature))
        throw new AppError('Nature must be DAILY or MONTHLY', 400);
      const existing = interestSchemeRepository.findByName(name.trim());
      if (existing) throw new AppError('A scheme with this name already exists', 409);
      const scheme = interestSchemeRepository.create({ name: name.trim(), nature });
      res.status(201).json({ success: true, data: scheme });
    } catch (err) {
      next(err);
    }
  }

  update(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      const { name, nature } = req.body;
      if (!name || !name.trim()) throw new AppError('Name is required', 400);
      const scheme = interestSchemeRepository.findById(id);
      if (!scheme) throw new AppError('Interest scheme not found', 404);
      // System schemes: only name can change, nature is locked
      if (scheme.is_system) {
        const updated = interestSchemeRepository.updateName(id, name.trim());
        return res.json({ success: true, data: updated });
      }
      if (!['DAILY', 'MONTHLY'].includes(nature))
        throw new AppError('Nature must be DAILY or MONTHLY', 400);
      const existing = interestSchemeRepository.findByName(name.trim());
      if (existing && existing.id !== id) throw new AppError('A scheme with this name already exists', 409);
      const updated = interestSchemeRepository.update(id, { name: name.trim(), nature });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  delete(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      const scheme = interestSchemeRepository.findById(id);
      if (!scheme) throw new AppError('Interest scheme not found', 404);
      if (scheme.is_system) throw new AppError('Cannot delete system schemes', 403);
      const count = interestSchemeRepository.countLedgers(id);
      if (count > 0)
        throw new AppError(`Cannot delete: ${count} ledger(s) use this scheme`, 409);
      interestSchemeRepository.delete(id);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InterestSchemeController();
