import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: false,
  trimValues: false,
  isArray: (tagName) => tagName === 'entry' || tagName === 'item'
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true
});

function toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function parsePrimitive(type, text) {
  const raw = text == null ? '' : String(text);
  if (type === 'number') {
    const normalized = raw.trim();
    if (normalized.length === 0) {
      return 0;
    }
    return Number(normalized);
  }
  if (type === 'boolean') {
    return raw.trim().toLowerCase() === 'true';
  }
  return raw;
}

function ensureMeta(meta, path, type, description) {
  const key = path.join('.');
  const current = meta[key] || {};
  meta[key] = {
    type: current.type || type,
    description: description ?? current.description ?? ''
  };
}

function parseArray(items, path, meta) {
  const nodes = toArray(items);
  return nodes.map((item, index) => {
    const itemType = item['@_type'] || (item.entry ? 'object' : item.item ? 'array' : 'string');
    const description = item['@_description'] || '';
    const nextPath = path.concat(String(index));
    ensureMeta(meta, nextPath, itemType, description);
    if (itemType === 'object') {
      return parseEntries(item.entry, nextPath, meta);
    }
    if (itemType === 'array') {
      return parseArray(item.item, nextPath, meta);
    }
    return parsePrimitive(itemType, item['#text']);
  });
}

function parseEntries(entries, path, meta) {
  const nodes = toArray(entries);
  const result = {};
  for (const node of nodes) {
    const key = node['@_key'];
    if (!key) {
      continue;
    }
    const type = node['@_type'] || (node.entry ? 'object' : node.item ? 'array' : 'string');
    const description = node['@_description'] || '';
    const nextPath = path.concat(key);
    ensureMeta(meta, nextPath, type, description);
    if (type === 'object') {
      result[key] = parseEntries(node.entry, nextPath, meta);
    } else if (type === 'array') {
      ensureMeta(meta, nextPath, 'array', description);
      result[key] = parseArray(node.item, nextPath, meta);
    } else {
      result[key] = parsePrimitive(type, node['#text']);
    }
  }
  return result;
}

function inferType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'string';
  }
  const type = typeof value;
  if (type === 'number' || type === 'boolean' || type === 'string') {
    return type;
  }
  return 'object';
}

function formatPrimitive(value, type) {
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (type === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  return value == null ? '' : String(value);
}

function buildItems(values, path, meta) {
  return values.map((item, index) => {
    const nextPath = path.concat(String(index));
    const metaEntry = meta[nextPath.join('.')] || {};
    const type = metaEntry.type || inferType(item);
    const description = metaEntry.description || '';
    const node = {
      '@_type': type
    };
    if (description) {
      node['@_description'] = description;
    }
    if (type === 'object') {
      node.entry = buildEntries(item, nextPath, meta);
    } else if (type === 'array') {
      node.item = buildItems(item, nextPath, meta);
    } else {
      node['#text'] = formatPrimitive(item, type);
    }
    return node;
  });
}

function buildEntries(values, path, meta) {
  const entries = [];
  for (const [key, value] of Object.entries(values)) {
    const nextPath = path.concat(key);
    const metaEntry = meta[nextPath.join('.')] || {};
    const type = metaEntry.type || inferType(value);
    const description = metaEntry.description || '';
    const node = {
      '@_key': key,
      '@_type': type
    };
    if (description) {
      node['@_description'] = description;
    }
    if (type === 'object') {
      node.entry = buildEntries(value, nextPath, meta);
    } else if (type === 'array') {
      node.item = buildItems(value, nextPath, meta);
    } else {
      node['#text'] = formatPrimitive(value, type);
    }
    entries.push(node);
  }
  return entries;
}

export function parseConfigXml(xmlSource) {
  const parsed = parser.parse(xmlSource);
  const root = parsed?.config;
  if (!root) {
    throw new Error('Неверный формат XML-конфига: отсутствует тег <config>.');
  }
  const meta = {};
  const data = parseEntries(root.entry, [], meta);
  return {
    name: root['@_name'] || '',
    title: root['@_title'] || root['@_name'] || '',
    data,
    meta
  };
}

export function serializeConfigXml(name, data, meta) {
  const root = {
    config: {
      '@_name': name,
      entry: buildEntries(data, [], meta)
    }
  };
  return `${builder.build(root)}\n`;
}

export function cloneMeta(meta) {
  const copy = {};
  for (const [key, value] of Object.entries(meta || {})) {
    copy[key] = { ...value };
  }
  return copy;
}
