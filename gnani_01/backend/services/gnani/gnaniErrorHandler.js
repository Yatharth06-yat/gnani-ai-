function handleGnaniError(serviceName, error, correlationId = 'N/A') {
  const timestamp = new Date().toISOString();
  
  // Never expose secret keys in logs
  let sanitizedMessage = error.message || 'Unknown error';
  if (error.config && error.config.headers && error.config.headers.Authorization) {
    error.config.headers.Authorization = 'Bearer [REDACTED]';
  }

  const statusCode = error.response ? error.response.status : (error.code === 'ECONNABORTED' ? 504 : 502);
  const isAuthError = statusCode === 401 || statusCode === 403;
  const isQuotaError = statusCode === 429;
  const isTimeout = error.code === 'ECONNABORTED' || statusCode === 504;

  let publicReason = 'Gnani AI service temporarily unavailable.';
  if (isAuthError) {
    publicReason = 'Gnani AI authentication rejected. Verify GNANI_API_KEY configuration.';
  } else if (isQuotaError) {
    publicReason = 'Gnani AI rate or quota limit reached.';
  } else if (isTimeout) {
    publicReason = 'Gnani AI request timed out.';
  }

  console.error(`❌ [${timestamp}] [Gnani:${serviceName}] [Correlation:${correlationId}] Error (${statusCode}):`, sanitizedMessage);

  return {
    success: false,
    service: `gnani_${serviceName}`,
    statusCode,
    correlationId,
    timestamp,
    message: publicReason,
    canFallbackToText: true
  };
}

module.exports = {
  handleGnaniError
};

