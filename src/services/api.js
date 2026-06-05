const BASE_URL = 'http://localhost:8000';

async function post(path, body, timeoutMs = 35000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || `Request failed (${res.status})`);
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out after 35 seconds.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const testConnection = (conn) =>
  post('/test-connection', conn);

export const getProcedures = (conn) =>
  post('/get-procedures', conn);

export const getParameters = (conn, procedureName) =>
  post('/get-parameters', { ...conn, procedure_name: procedureName });

export const fetchRecords = (conn, procedureName, inParams = []) =>
  post('/fetch-records', { ...conn, procedure_name: procedureName, in_params: inParams });

/** Transform API response → { records, columns } usable by Step 2 */
export function transformApiResponse(apiResp) {
  const cols = (apiResp.columns || []).map(c => String(c).toLowerCase());
  const records = (apiResp.rows || []).map((row, i) => {
    const obj = { id: i + 1 };
    cols.forEach((col, ci) => { obj[col] = row[ci] ?? ''; });
    return obj;
  });
  return { records, columns: apiResp.columns || [] };
}
