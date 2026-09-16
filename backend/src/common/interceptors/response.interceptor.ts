import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();
    const suppliedRequestId = request.headers['x-request-id'];
    const requestId =
      (Array.isArray(suppliedRequestId)
        ? suppliedRequestId[0]
        : suppliedRequestId) || randomUUID();

    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}