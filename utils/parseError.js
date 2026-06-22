function parseError(err) {
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return first?.message || 'Validation failed';
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return `${field} already exists`;
  }
  return err.message;
}

module.exports = { parseError };
