/**
 * Environment Variable Validation
 * Checks that all required environment variables are set and provides helpful error messages
 */

export function validateEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GROQ_API_KEY',
  ];

  const optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_APP_NAME',
    'RATE_LIMIT_REQUESTS_PER_MINUTE',
    'ADMIN_EMAIL',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const variable of requiredVars) {
    const value = process.env[variable];
    if (!value || value.includes('your-')) {
      missing.push(variable);
    }
  }

  // Check optional variables
  for (const variable of optionalVars) {
    const value = process.env[variable];
    if (!value || value.includes('your-')) {
      warnings.push(variable);
    }
  }

  // Provide detailed error message if required vars are missing
  if (missing.length > 0) {
    const errorMessage = `
🔴 MISSING REQUIRED ENVIRONMENT VARIABLES

The following environment variables are required to run ForgeGuard AI:
${missing.map((v) => `  ❌ ${v}`).join('\n')}

📋 SETUP INSTRUCTIONS:

1. Copy .env.example to .env.local
2. Get your credentials from:
   - Supabase: https://app.supabase.com/project/_/settings/api
   - Groq: https://console.groq.com/keys
3. Update .env.local with your credentials
4. Restart the development server

For more information, see the QUICKSTART.md file.
    `;
    console.error(errorMessage);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about missing optional variables
  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    const warningMessage = `
⚠️  OPTIONAL ENVIRONMENT VARIABLES NOT SET

The following optional environment variables are not configured:
${warnings.map((v) => `  ⚠️  ${v}`).join('\n')}

These features will have limited functionality until configured.
Check .env.example for their purposes.
    `;
    console.warn(warningMessage);
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Log environment configuration status
 * Safe to call - only logs public variables (non-secrets)
 */
export function logEnvironmentStatus() {
  const config = {
    'Supabase URL': process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Configured' : '❌ Missing',
    'Supabase Anon Key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Configured' : '❌ Missing',
    'Groq API Key': process.env.GROQ_API_KEY ? '✓ Configured' : '❌ Missing',
    'App URL': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'App Name': process.env.NEXT_PUBLIC_APP_NAME || 'ForgeGuard AI',
    'Node Environment': process.env.NODE_ENV,
  };

  console.log('\n📊 ForgeGuard AI Configuration Status:');
  Object.entries(config).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log('');
}
