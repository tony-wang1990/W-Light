import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface HttpRequestInfo {
  method?: string
  url?: string
}

interface JsonResponse {
  status(code: number): { json(body: unknown): void }
}

interface HttpExceptionPayload {
  message?: string | string[]
  error?: string
}

function isHttpExceptionPayload(value: unknown): value is HttpExceptionPayload {
  return Boolean(value && typeof value === 'object')
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<JsonResponse>();
    const request = ctx.getRequest<HttpRequestInfo>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (isHttpExceptionPayload(exceptionResponse)) {
        message = exceptionResponse.message
          ? Array.isArray(exceptionResponse.message)
            ? exceptionResponse.message.join('; ')
            : exceptionResponse.message
          : exceptionResponse.error || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      code: status,
      data: null,
      msg: message,
    });
  }
}
