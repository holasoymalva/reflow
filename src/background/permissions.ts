/**
 * Permission management for Chrome Request Manager
 * Handles checking and requesting Chrome extension permissions
 */

/**
 * Required permissions for basic functionality
 */
const BASIC_PERMISSIONS: chrome.permissions.Permissions = {
  permissions: [
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
    'storage',
    'tabs'
  ],
  origins: ['<all_urls>']
};

/**
 * Additional permissions required for HTTPS interception
 */
const HTTPS_PERMISSIONS: chrome.permissions.Permissions = {
  permissions: [
    'webRequest',
    'webRequestBlocking'
  ]
};

/**
 * Check if all required permissions are granted
 */
export async function checkRequiredPermissions(): Promise<{
  hasBasic: boolean;
  hasHTTPS: boolean;
}> {
  try {
    const hasBasic = await chrome.permissions.contains(BASIC_PERMISSIONS);
    const hasHTTPS = await chrome.permissions.contains(HTTPS_PERMISSIONS);
    
    return { hasBasic, hasHTTPS };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return { hasBasic: false, hasHTTPS: false };
  }
}

/**
 * Request HTTPS interception permissions
 * This should be called when the user enables HTTPS interception in settings
 */
export async function requestHTTPSPermissions(): Promise<boolean> {
  try {
    const granted = await chrome.permissions.request(HTTPS_PERMISSIONS);
    
    if (granted) {
      console.log('HTTPS permissions granted');
    } else {
      console.log('HTTPS permissions denied by user');
    }
    
    return granted;
  } catch (error) {
    console.error('Error requesting HTTPS permissions:', error);
    return false;
  }
}

/**
 * Remove HTTPS interception permissions
 * This should be called when the user disables HTTPS interception
 */
export async function removeHTTPSPermissions(): Promise<boolean> {
  try {
    const removed = await chrome.permissions.remove(HTTPS_PERMISSIONS);
    
    if (removed) {
      console.log('HTTPS permissions removed');
    } else {
      console.log('Failed to remove HTTPS permissions');
    }
    
    return removed;
  } catch (error) {
    console.error('Error removing HTTPS permissions:', error);
    return false;
  }
}

/**
 * Check if HTTPS permissions are currently granted
 */
export async function hasHTTPSPermissions(): Promise<boolean> {
  try {
    return await chrome.permissions.contains(HTTPS_PERMISSIONS);
  } catch (error) {
    console.error('Error checking HTTPS permissions:', error);
    return false;
  }
}

/**
 * Set up permission change listener
 * This will be called when permissions are added or removed
 */
export function setupPermissionListener(
  onPermissionChange: (hasHTTPS: boolean) => void
): void {
  chrome.permissions.onAdded.addListener(async (permissions) => {
    console.log('Permissions added:', permissions);
    
    // Check if HTTPS permissions were added
    const hasHTTPS = await hasHTTPSPermissions();
    onPermissionChange(hasHTTPS);
  });
  
  chrome.permissions.onRemoved.addListener(async (permissions) => {
    console.log('Permissions removed:', permissions);
    
    // Check if HTTPS permissions were removed
    const hasHTTPS = await hasHTTPSPermissions();
    onPermissionChange(hasHTTPS);
  });
}
