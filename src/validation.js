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

  // Check for dangerous keywords before parsing
  if (DANGEROUS_KEYWORDS.test(where)) {
    return { valid: false, error: 'WHERE clause contains disallowed SQL keyword' }
  }

  // Attempt to parse as valid SQL
  try {
    const ast = parser.parse(`SELECT * FROM t WHERE ${where}`)

    // Reject if the parser produced a UNION or other compound statement
    if (ast && ast.value && ast.value.type !== 'Select') {
      return { valid: false, error: 'WHERE clause contains disallowed compound statement' }
    }

    // Walk AST to reject subqueries (nested SELECT nodes)
    if (containsSubquery(ast)) {
      return { valid: false, error: 'WHERE clause contains disallowed subquery' }
    }
  } catch (e) {
    return { valid: false, error: 'WHERE clause failed SQL parsing validation' }
  }

  return { valid: true, error: null }
}

/**
 * Recursively check AST for subquery nodes (nested SELECT).
 */
function containsSubquery (node) {
  if (!node || typeof node !== 'object') return false

  // If this is a sub-select inside the WHERE, reject
  if (node.type === 'Select' && node !== arguments[1]) {
    // We need to skip the top-level Select
  }

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
