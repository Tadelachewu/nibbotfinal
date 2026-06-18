export interface PasswordStrength {
  score: number;       // 0-4
  label: string;       // "Very Weak" | "Weak" | "Fair" | "Good" | "Strong"
  color: string;       // Tailwind color class
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

// Top 100 most common passwords (to block)
const COMMON_PASSWORDS = new Set([
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111",
  "1234567", "dragon", "123123", "baseball", "iloveyou", "trustno1", "sunshine", "princess",
  "qwerty123", "admin", "welcome", "shadow", "ashley", "666666", "abc123", "654321",
  "7777777", "123321", "password1", "1234567890", "michael", "password123", "superman",
  "987654321", "master", "121212", "000000", "a123456", "555555", "1q2w3e4r", "888888",
  "123qwe", "123abc", "password12", "monkey", "123456a", "123abc123", "lovely", "1q2w3e",
  "hello", "charlie", "aa123456", "donald", "qwerty12", "letmein", "password1234", "123",
  "87654321", "test123", "test", "qwe123", "1111", "football", "12345678910", "12345a",
  "11111111", "12341234", "iloveyou123", "abc12345", "123456789a", "123456abc", "123456789012",
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "123456789a123", "password123456", "admin123", "admin1234",
  "Admin@123", "Admin@1234", "admin12345", "welcome123", "welcome1", "welcome1234", "test1234",
  "test12345", "test1", "password12345", "password1", "1234567891011", "admin1", "admin@123",
  "admin@1234", "password12", "password123", "123456789a12", "abc123456", "111222", "123123123",
  "qweasd", "1q2w3e4r5t", "qazwsx", "123qweasd", "asdf1234", "1234asdf", "adminadmin", "passwordpassword"
]);

async function sha1(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    // Step 1: Hash the password with SHA-1
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    // Step 2: Call HIBP k-Anonymity API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'User-Agent': 'NibChatBot/1.0' }
    });

    if (!response.ok) {
      // If API fails (e.g., network down), default to no breach to avoid blocking users
      console.warn('HIBP API request failed');
      return false;
    }

    const text = await response.text();
    const lines = text.split('\n');

    // Step 3: Check if our suffix is in the results
    for (const line of lines) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('Error checking password breach status:', e);
    return false;
  }
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed <= 1) return { score: 0, label: 'Very Weak', color: 'bg-red-500', checks };
  if (passed === 2) return { score: 1, label: 'Weak', color: 'bg-orange-500', checks };
  if (passed === 3) return { score: 2, label: 'Fair', color: 'bg-yellow-500', checks };
  if (passed === 4) return { score: 3, label: 'Good', color: 'bg-blue-500', checks };
  return { score: 4, label: 'Strong', color: 'bg-green-500', checks };
}

export function isStrongPassword(password: string): boolean {
  const { checks } = evaluatePasswordStrength(password);
  return Object.values(checks).every(Boolean);
}

export function isCommonPassword(password: string): boolean {
  const normalized = password.toLowerCase().trim();
  return COMMON_PASSWORDS.has(normalized);
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for common password
  if (isCommonPassword(password)) {
    errors.push("This password is too common or has been compromised in data breaches.");
  }

  const { checks } = evaluatePasswordStrength(password);

  if (!checks.minLength) errors.push("at least 12 characters");
  if (!checks.hasUppercase) errors.push("at least one uppercase letter");
  if (!checks.hasLowercase) errors.push("at least one lowercase letter");
  if (!checks.hasNumber) errors.push("at least one number");
  if (!checks.hasSpecial) errors.push("at least one special character (!@#$%^&*()_+-=[]{};':\"|,.<>/?)");

  return { valid: errors.length === 0, errors };
}

export async function validatePasswordFull(password: string): Promise<{ valid: boolean; errors: string[] }> {
  const syncResult = validatePassword(password);
  if (!syncResult.valid) return syncResult;

  const breached = await isPasswordBreached(password);
  if (breached) {
    return {
      valid: false,
      errors: ['This password has appeared in known data breaches. Choose a different password.'],
    };
  }
  return { valid: true, errors: [] };
}
