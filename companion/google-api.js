const { HttpError } = require('./server');

// Maps Google failures to companion errors. A 401 is thrown as kind 'google_401'
// so routes can force one token refresh before giving up as signed_out.
async function gcall(fetch, token, url, init = {}) {
  let res;
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  } catch {
    throw new HttpError(502, 'google');
  }
  if (res.status === 401) throw new HttpError(401, 'google_401');
  if (res.status === 404) throw new HttpError(404, 'not_found');
  if (!res.ok) throw new HttpError(502, 'google');
  return res.json();
}

module.exports = { gcall };
