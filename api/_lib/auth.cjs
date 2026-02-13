const jwt = require('jsonwebtoken')
const { required } = require('./env.cjs')

const signAdminToken = (payload) => {
  const secret = required('JWT_SECRET')
  return jwt.sign(payload, secret, { expiresIn: '30d' })
}

const verifyAdminToken = (token) => {
  const secret = required('JWT_SECRET')
  return jwt.verify(token, secret)
}

const getBearerTokenFromReq = (req) => {
  const auth = String(req.headers.authorization || '')
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7)
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  getBearerTokenFromReq,
}

