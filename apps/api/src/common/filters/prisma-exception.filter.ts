import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isDev = process.env.NODE_ENV !== 'production';

    // If it's already an HTTP exception, let it through
    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    // Handle Prisma validation errors
    if (exception instanceof PrismaClientValidationError) {
      const message = exception.message || 'Validation error';
      const statusCode = HttpStatus.BAD_REQUEST;
      return response.status(statusCode).json({
        statusCode,
        message: isDev ? message : 'Invalid request data',
        ...(isDev && { error: 'Prisma Validation Error', code: 'P2002' }),
      });
    }

    // Handle Prisma known request errors
    if (exception instanceof PrismaClientKnownRequestError) {
      const { code, meta } = exception;

      // Unique constraint violation
      if (code === 'P2002') {
        const target = (meta?.target as string[]) || ['field'];
        const field = target.join(', ');
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${field} already exists`,
          ...(isDev && { code, target }),
        });
      }

      // Record not found
      if (code === 'P2025') {
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          ...(isDev && { code }),
        });
      }

      // Foreign key constraint violation
      if (code === 'P2003') {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference: related record does not exist',
          ...(isDev && { code, meta }),
        });
      }

      // Generic Prisma error
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database operation failed',
        ...(isDev && { code, message: exception.message }),
      });
    }

    // Log unexpected errors in dev
    if (isDev && exception instanceof Error) {
      console.error('Unhandled exception:', exception);
      console.error('Stack:', exception.stack);
    }

    // Generic 500 error
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isDev && exception instanceof Error ? exception.message : 'Internal server error',
      ...(isDev && exception instanceof Error && { stack: exception.stack }),
    });
  }
}
