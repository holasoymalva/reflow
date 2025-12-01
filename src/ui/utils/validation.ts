/**
 * Validates if a string is a valid URL pattern (regex or wildcard)
 */
export function isValidURLPattern(pattern: string): boolean {
  if (!pattern || pattern.trim() === '') {
    return false;
  }

  // Try to parse as regex
  try {
    new RegExp(pattern);
    return true;
  } catch {
    // If not a valid regex, check if it's a valid wildcard pattern
    // Wildcard patterns can contain *, ?, and regular URL characters
    const wildcardPattern = /^[a-zA-Z0-9:\/\.\-_\*\?]+$/;
    return wildcardPattern.test(pattern);
  }
}

/**
 * Validates if a string is a valid HTTP header name
 */
export function isValidHeaderName(name: string): boolean {
  if (!name || name.trim() === '') {
    return false;
  }

  // HTTP header names must be tokens (RFC 7230)
  // token = 1*tchar
  // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / 
  //         "0"-"9" / "A"-"Z" / "^" / "_" / "`" / "a"-"z" / "|" / "~"
  const headerNamePattern = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
  return headerNamePattern.test(name);
}

/**
 * Validates if a string is a valid URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid JSON path
 */
export function isValidJSONPath(path: string): boolean {
  if (!path || path.trim() === '') {
    return false;
  }

  // Basic JSON path validation (supports dot notation and bracket notation)
  const jsonPathPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\]|\['[^']+'\]|\["[^"]+"\])*$/;
  return jsonPathPattern.test(path);
}
