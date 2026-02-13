const required = (name) => {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const optional = (name, fallback = '') => {
  const v = (process.env[name] || '').trim()
  return v || fallback
}

module.exports = {
  required,
  optional,
}

