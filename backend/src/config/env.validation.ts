
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];
  const text = (key: string): string => {
    const value = config[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  for (const key of ['DATABASE_URL', 'FRONTEND_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!text(key)) problems.push(`${key} is missing in .env`);
  }

  const databaseUrl = text('DATABASE_URL');
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL must start with postgresql://');
  }
  if (/[\[\]<>]/.test(databaseUrl)) {
    problems.push('DATABASE_URL still contains placeholder characters such as [ ] < >. Replace them with real values');
  }

  const access = text('JWT_ACCESS_SECRET');
  const refresh = text('JWT_REFRESH_SECRET');
  if (access && access.length < 32) {
    problems.push('JWT_ACCESS_SECRET must be at least 32 characters (use the generator command in .env.example)');
  }
  if (refresh && refresh.length < 32) {
    problems.push('JWT_REFRESH_SECRET must be at least 32 characters (use the generator command in .env.example)');
  }
  if (access && access === refresh) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const accessTtl = Number(text('ACCESS_TOKEN_TTL_SECONDS') || 900);
  const refreshDays = Number(text('REFRESH_TOKEN_TTL_DAYS') || 7);
  if (!Number.isFinite(accessTtl) || accessTtl < 60) {
    problems.push('ACCESS_TOKEN_TTL_SECONDS must be a number of at least 60');
  }
  if (!Number.isFinite(refreshDays) || refreshDays < 1) {
    problems.push('REFRESH_TOKEN_TTL_DAYS must be a number of at least 1');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }
  return config;
}
