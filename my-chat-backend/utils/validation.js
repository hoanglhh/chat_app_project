const getTrimmedText = value =>
  typeof value === 'string' ? value.trim() : ''

module.exports = { getTrimmedText }
