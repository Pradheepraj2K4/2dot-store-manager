/**
 * Minimal vCard (.vcf) parser.
 * Handles vCard 2.1, 3.0, and 4.0.
 * Returns an array of contact objects compatible with the ledger schema.
 */

function unfoldLines(text) {
  // vCard line folding: continuation lines start with a space or tab
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r\n/g, '')
    .replace(/=\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
      try { return decodeURIComponent('%' + hex); } catch { return ''; }
    });
}

function decodeBase64Utf8(str) {
  try {
    return decodeURIComponent(escape(atob(str.trim())));
  } catch {
    return str;
  }
}

function parsePropertyLine(line) {
  // Split property name+params from value at the first unescaped ':'
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const namePart = line.substring(0, colonIdx).toUpperCase();
  const rawValue = line.substring(colonIdx + 1);

  // Extract encoding and charset from params
  const paramParts = namePart.split(';');
  const propName = paramParts[0].trim();
  const params = {};
  for (let i = 1; i < paramParts.length; i++) {
    const [k, v] = paramParts[i].split('=');
    if (k && v !== undefined) params[k.trim()] = v.trim();
    else if (k) params[k.trim()] = '';
  }

  let value = rawValue;
  const encoding = params['ENCODING'] || '';
  if (encoding === 'QUOTED-PRINTABLE') {
    value = decodeQuotedPrintable(value);
    const charset = params['CHARSET'] || 'UTF-8';
    if (charset.toUpperCase() !== 'UTF-8') {
      // best-effort: leave as-is for non-UTF8 charsets
    }
  } else if (encoding === 'BASE64' || encoding === 'B') {
    value = decodeBase64Utf8(value);
  }

  return { propName, params, value };
}

function extractPhone(value) {
  // Strip all non-digit characters
  const digits = value.replace(/\D/g, '');
  // Indian 10-digit number or strip +91 prefix
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  if (digits.length === 10) return digits;
  // Return last 10 digits if longer
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function parseVCards(text) {
  const unfolded = unfoldLines(text);
  const lines = unfolded.split(/\r?\n/);

  const contacts = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === 'BEGIN:VCARD') {
      current = { name: '', phone: '', place: '', address: '' };
      continue;
    }
    if (line.toUpperCase() === 'END:VCARD') {
      if (current && current.name.trim()) {
        contacts.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parsePropertyLine(line);
    if (!parsed) continue;
    const { propName, params, value } = parsed;

    if (propName === 'FN') {
      current.name = value.trim();
    } else if (propName === 'N' && !current.name) {
      // Fallback: "Last;First;Middle;Prefix;Suffix"
      const parts = value.split(';');
      const last  = (parts[0] || '').trim();
      const first = (parts[1] || '').trim();
      current.name = [first, last].filter(Boolean).join(' ');
    } else if (propName === 'TEL' || propName.startsWith('TEL;')) {
      if (!current.phone) {
        current.phone = extractPhone(value);
      }
    } else if (propName === 'ADR' || propName.startsWith('ADR;')) {
      // "PO Box;Extended;Street;City;Region;PostalCode;Country"
      const parts = value.split(';');
      const street  = (parts[2] || '').trim();
      const city    = (parts[3] || '').trim();
      const region  = (parts[4] || '').trim();
      const postal  = (parts[5] || '').trim();
      const country = (parts[6] || '').trim();
      current.place   = city || region || '';
      const addrParts = [street, city, region, postal, country].filter(Boolean);
      current.address = addrParts.join(', ');
    } else if (propName === 'ORG' && !current.org) {
      current.org = value.split(';')[0].trim();
    }
  }

  return contacts;
}

/**
 * Parse a .vcf file content string.
 * @param {string} text - raw file content
 * @returns {{ name: string, phone: string, place: string, address: string }[]}
 */
export function parseVCF(text) {
  return parseVCards(text);
}
