/*
  validation.js

  SQL input validation to prevent injection attacks.
  Uses js-sql-parser (available via @koopjs/winnow dependency) for WHERE clause parsing.
*/

const parser = require('js-sql-parser')

// Keywords that should never appear in a WHERE clause as whole words
const DANGEROUS_KEYWORDS = /\b(DROP|CREATE|ALTER|TRUNCATE|INSERT|UPDATE|DELETE|UNION|EXEC|GRANT|REVOKE)\b/i

/**
 * Validate a WHERE clause string for SQL injection.
 * Rejects dangerous keywords, unparseable SQL, and subqueries.
 * @param {string} where - The WHERE clause to validate
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateWhereClause (where) {
  if (!where || typeof where !== 'string') {
    return { valid: false, error: 'WHERE clause must be a non-empty string' }
  }

  // Check for dangerous keywords before parsing (outside literals: status = 'Pending Update' is a filter)
  if (DANGEROUS_KEYWORDS.test(withoutLiterals(where))) {
    return { valid: false, error: 'WHERE clause contains disallowed SQL keyword' }
  }

  // Comments are where this parser and Databricks could read a clause differently; ArcGIS clients never send them
  if (/--|\/\*|#/.test(withoutLiterals(where))) {
    return { valid: false, error: 'WHERE clause contains a disallowed comment' }
  }

  // Attempt to parse as valid SQL
  try {
    const ast = parser.parse(`SELECT * FROM t WHERE ${forParser(where)}`)

    // Reject if the parser produced a UNION or other compound statement
    if (ast && ast.value && ast.value.type !== 'Select') {
      return { valid: false, error: 'WHERE clause contains disallowed compound statement' }
    }

    // Only a condition: no GROUP BY / HAVING / ORDER BY / LIMIT riding along after it
    if (ast.value.groupBy || ast.value.having || ast.value.orderBy || ast.value.limit) {
      return { valid: false, error: 'WHERE clause may only contain a condition' }
    }

    // Walk AST to reject subqueries (nested SELECT nodes)
    if (containsSubquery(ast)) {
      return { valid: false, error: 'WHERE clause contains disallowed subquery' }
    }

    const fn = disallowedFunction(ast.value.where)
    if (fn) {
      return { valid: false, error: `WHERE clause uses disallowed function ${fn}` }
    }
  } catch (e) {
    return { valid: false, error: 'WHERE clause failed SQL parsing validation' }
  }

  return { valid: true, error: null }
}

// Quoted literals as Databricks reads them: backslash escapes a character ('a\'' is one literal), '' is a quote.
// One left-to-right scan finds every literal and quoted identifier, so a keyword inside a literal ('INTERVAL')
// is never taken for the start of a typed literal: the parser and Databricks agree on where each literal ends.
const QUOTED = "'(?:[^'\\\\]|\\\\.|'')*'"
const DOUBLE_QUOTED = '"(?:[^"\\\\]|\\\\.|"")*"'
const BACKTICKED = '`(?:[^`]|``)*`'
const TOKENS = new RegExp([
  `\\bINTERVAL\\s*${QUOTED}\\s*(?:YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)S?\\b`, // interval (group-less)
  `\\b(?:TIMESTAMP|DATE|TIME)\\s*(${QUOTED})`, // 1: typed literal
  `(${QUOTED})`, // 2: string literal
  `(${DOUBLE_QUOTED}|${BACKTICKED})` // 3: double-quoted string or quoted identifier
].join('|'), 'gi')

// A doubled quote inside a literal ('O''Brien', as ArcGIS escapes it) is read as \' so the parser takes it
const forParserLiteral = lit => `'${lit.slice(1, -1).replace(/''/g, "\\'")}'`

// What the parser reads: typed literals and intervals (which Databricks runs but the parser doesn't know) as
// the plain literal or number they stand for. Only what is parsed changes; the clause that runs is the one received.
function forParser (where) {
  return where.replace(TOKENS, (m, typed, lit, other) => typed ? forParserLiteral(typed) : lit ? forParserLiteral(lit) : other || '0')
}

// The clause with its literals and quoted identifiers blanked out, for checks on the SQL itself
function withoutLiterals (where) {
  return where.replace(TOKENS, (m, typed, lit, other) => typed || lit || other ? "''" : '0')
}

// Functions a filter has no business calling, that read beyond the table or cost money: secrets (an oracle
// for anything the querying identity can read, which is the service principal for open tables), Java
// reflection, outbound HTTP, file and federated reads, and model calls (ai_query, ai_gen, ...)
const DISALLOWED_FUNCTIONS = /^(secret|try_secret|list_secrets|reflect|try_reflect|java_method|http_request|read_files|read_kafka|read_kinesis|read_pubsub|read_pulsar|read_statestore|remote_query|vector_search|ai_\w+)$/i
function disallowedFunction (node) {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'FunctionCall') {
    const name = String(node.name || '').replace(/`/g, '').split('.').pop()
    if (DISALLOWED_FUNCTIONS.test(name)) return name
  }
  for (const child of Object.values(node)) {
    const hit = Array.isArray(child) ? child.map(disallowedFunction).find(Boolean) : disallowedFunction(child)
    if (hit) return hit
  }
  return null
}

/**
 * Recursively check AST for subquery nodes (nested SELECT).
 * Walks the children of the root so the top-level Select is not counted.
 */
function containsSubquery (node) {
  if (!node || typeof node !== 'object') return false

  // Check all child properties
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'object' && item !== null && hasNestedSelect(item)) {
          return true
        }
      }
    } else if (typeof child === 'object' && child !== null) {
      if (hasNestedSelect(child)) return true
    }
  }

  return false
}

/**
 * Check if a node (below the top-level WHERE) contains a SELECT.
 */
function hasNestedSelect (node, depth) {
  if (!node || typeof node !== 'object') return false
  depth = depth || 0

  if (node.type === 'Select' && depth > 0) return true

  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'object' && item !== null && hasNestedSelect(item, depth + 1)) {
          return true
        }
      }
    } else if (typeof child === 'object' && child !== null) {
      if (hasNestedSelect(child, depth + 1)) return true
    }
  }

  return false
}

/**
 * Validate a single column name (alphanumeric + underscores, must start with letter/underscore).
 * @param {string} name - Column name to validate
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateColumnName (name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Column name must be a non-empty string' }
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim())) {
    return { valid: false, error: `Invalid column name: ${name}` }
  }

  return { valid: true, error: null }
}

/**
 * Validate a comma-separated list of column names.
 * @param {string} fieldList - Comma-separated column names (e.g., "name, status, type")
 * @returns {{ valid: boolean, error: string|null, fields: string[] }}
 */
function validateColumnList (fieldList) {
  if (!fieldList || typeof fieldList !== 'string') {
    return { valid: false, error: 'Field list must be a non-empty string', fields: [] }
  }

  const fields = fieldList.split(',').map(f => f.trim()).filter(f => f)

  if (fields.length === 0) {
    return { valid: false, error: 'Field list is empty', fields: [] }
  }

  for (const field of fields) {
    const result = validateColumnName(field)
    if (!result.valid) {
      return { valid: false, error: result.error, fields: [] }
    }
  }

  return { valid: true, error: null, fields }
}

module.exports = {
  validateWhereClause,
  validateColumnName,
  validateColumnList
}
