import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../constants'
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.auth';

function parseCookie(cookieString): any {
    const cookies = {};
    if (!cookieString) return cookies;
  
    const cookieArray = cookieString.split(';');
    for (const cookie of cookieArray) {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = decodeURIComponent(value);
    }
  
    return cookies;
}

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService, private reflector: Reflector) { }
    

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true
        }
        const request = context.switchToHttp().getRequest()
        const token = this.extractTokenFromHeader(request)
        if (!token) {
            throw new UnauthorizedException()
        }
        try {
            const payload = this.jwtService.verify(token);
            // 💡 We're assigning the payload to the request object here
            // so that we can access it in our route handlers
            console.log(payload)
            request['user'] = payload
        } catch {
            throw new UnauthorizedException()
        }
        return true
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? parseCookie(request.headers.cookie).auth?.split(' ') ?? []
        return type === 'Bearer' ? token : undefined;
    }
}