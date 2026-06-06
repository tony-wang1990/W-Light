export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试') {
  const err = error as {
    message?: string;
    response?: {
      data?: {
        message?: string | string[];
        error?: string;
      };
    };
  };

  const message = err.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return message.join('；');
  if (typeof message === 'string' && message.trim()) return message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return fallback;
}
