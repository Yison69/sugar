const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

const readJsonBody = async (req) => {
  const raw = await readRawBody(req)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const sendJson = (res, status, obj) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

const methodNotAllowed = (res) => sendJson(res, 405, { error: 'Method Not Allowed' })

module.exports = {
  readJsonBody,
  sendJson,
  methodNotAllowed,
}

