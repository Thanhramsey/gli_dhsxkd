import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorDetails {
  message?: string | string[];
  errorCode?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const details = this.getErrorDetails(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Request failed: ${request.method} ${request.originalUrl}`,
        stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message: details.message ?? 'Internal server error',
      ...(details.errorCode ? { errorCode: details.errorCode } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private getErrorDetails(exception: unknown): ErrorDetails {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response };
    }

    const details = response as ErrorDetails;
    return {
      message: details.message ?? exception.message,
      errorCode: details.errorCode,
    };
  }
}