const userRepository = require('../repositories/userRepository');

class UserService {
  getAll() {
    return userRepository.getAll();
  }

  getLoginList() {
    return userRepository.getLoginList();
  }

  getById(id) {
    const user = userRepository.getById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  create(data) {
    const { username, password } = data;
    if (!username || !username.trim()) throw new Error('Username is required');
    if (!password || !password.trim()) throw new Error('Password is required');
    if (userRepository.getByUsername(username.trim())) {
      throw new Error('A user with this name already exists');
    }
    return userRepository.create({ ...data, username: username.trim(), password: password.trim() });
  }

  update(id, data) {
    const { username } = data;
    if (!username || !username.trim()) throw new Error('Username is required');
    const existing = userRepository.getByUsername(username.trim());
    if (existing && existing.id !== id) {
      throw new Error('A user with this name already exists');
    }
    const updated = userRepository.update(id, {
      ...data,
      username: username.trim(),
      password: data.password ? data.password.trim() : '',
    });
    if (!updated) throw new Error('User not found');
    return updated;
  }

  delete(id) {
    return userRepository.delete(id);
  }

  authenticate(username, password) {
    if (!username || !password) throw new Error('Username and password are required');
    const user = userRepository.authenticate(username, password);
    if (!user) throw new Error('Invalid username or password');
    return user;
  }
}

module.exports = new UserService();
