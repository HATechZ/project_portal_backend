import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { JwtService } from '@nestjs/jwt';
import { sign, verify, SignOptions, VerifyOptions } from 'jsonwebtoken';
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
import { SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthController } from '../../auth/auth.controller';
import { AuthService } from '../../auth/auth.service';
import { ActorProfileController } from '../../auth/actor-profile.controller';
import { ActorProfileService } from '../../auth/actor-profile.service';
import { AuthTokenProvider } from '../../auth/providers/auth-token.provider';
import { AuthSessionRepository } from '../../auth/repositories';
import { UserController } from '../../user/user.controller';
import { UserService } from '../../user/user.service';
import { RolePermissionController } from '../../role-permission/role-permission.controller';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { AppConfiguration } from '../../config/configuration';
import { configureApplication } from '../../config/app-bootstrap';
import { RequestContext } from '../context/request-context';
import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { buildOpenApiConfig } from '../swagger/openapi.module';
import { TenantActivationService } from '../tenant/tenant-activation.service';
import { TenantContextGuard } from '../tenant/tenant-context.guard';
import { TenantContextMiddleware } from '../tenant/tenant-context.middleware';
import { AccessTokenGuard } from './access-token.guard';
import { AuthenticationGuard } from './authentication.guard';
import { SystemAdminGuard } from './system-admin.guard';
import { SESSION_AUTHENTICATOR } from './session-authenticator.port';

describe('authenticated-tenant HTTP boundary', () => {
  const tenantA = '10000000-0000-4000-8000-000000000001';
  const tenantB = '10000000-0000-4000-8000-000000000002';
  const userId = '20000000-0000-4000-8000-000000000001';
  const actorId = '30000000-0000-4000-8000-000000000001';
  const secret = 'authenticated-tenant-test-secret';
  // Use the same cryptographic implementation without Jest loading Nest JWT's ESM wrapper.
  const jwt = {
    sign: (payload: object, options: SignOptions & { secret?: string }) => {
      const { secret: key, ...settings } = options;
      return sign(payload, key ?? secret, settings);
    },
    verifyAsync: (
      token: string,
      options: VerifyOptions & { secret?: string },
    ) => {
      const { secret: key, ...settings } = options;
      return Promise.resolve(verify(token, key ?? secret, settings));
    },
  };
  let app: INestApplication;
  let token: string;
  let revoked: boolean;
  let activeUser: boolean;
  let activeActor: boolean;
  let admin: boolean;
  const checkedTenants: string[] = [];
  const scoped = () => ({
    tenantId: RequestContext.requireTenantId(),
    actorId: RequestContext.actorId(),
  });
  const config = new ConfigService({
    app: { apiPrefix: 'api', corsOrigins: [] },
    jwt: { secret, issuer: 'test', audience: 'test' },
  });
  const repository = {
    isSessionActive: () =>
      Promise.resolve(!revoked && RequestContext.requireTenantId() === tenantA),
    findActiveUser: () => Promise.resolve(activeUser ? { id: userId } : null),
    findActiveActor: () =>
      Promise.resolve(
        activeActor
          ? {
              id: actorId,
              role: { code: admin ? 'system_admin' : 'division_member' },
            }
          : null,
      ),
  };
  beforeAll(async () => {
    const authenticator = new AuthTokenProvider(
      jwt as unknown as JwtService,
      config as unknown as ConfigService<AppConfiguration, true>,
      repository as unknown as AuthSessionRepository,
    );
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        UserController,
        RolePermissionController,
        ActorProfileController,
      ],
      providers: [
        AccessTokenGuard,
        TenantContextGuard,
        AuthenticationGuard,
        SystemAdminGuard,
        { provide: ConfigService, useValue: config },
        { provide: SESSION_AUTHENTICATOR, useValue: authenticator },
        {
          provide: TenantActivationService,
          useValue: {
            isActive: (id: string) => {
              checkedTenants.push(id);
              return Promise.resolve(id === tenantA);
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: scoped,
            logout: () => {
              revoked = true;
              return Promise.resolve();
            },
            refresh: scoped,
            forgotPassword: () => Promise.resolve(),
          },
        },
        { provide: UserService, useValue: { findAll: scoped } },
        { provide: RolePermissionService, useValue: { findRoles: scoped } },
        {
          provide: ActorProfileService,
          useValue: { findForUser: scoped, activate: scoped },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    const middleware = new TenantContextMiddleware();
    app.use((req: Request, res: Response, next: NextFunction) =>
      middleware.use(req, res, next),
    );
    configureApplication(app);
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    await app.init();
  });
  beforeEach(() => {
    revoked = false;
    activeUser = true;
    activeActor = true;
    admin = true;
    checkedTenants.length = 0;
    token = jwt.sign(
      { sub: userId, sid: 'session', tenantId: tenantA, type: 'access' },
      { issuer: 'test', audience: 'test', expiresIn: 60 },
    );
  });
  afterAll(async () => {
    await app.close();
  });
  const get = (path: string) =>
    request(app.getHttpServer() as Server)
      .get('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  it.each(['/auth/me', '/user', '/role', '/actor-profiles'])(
    'uses the JWT Tenant at %s without a header',
    async (path) => {
      const response = await get(path).expect(200);
      const body = response.body as {
        data: { tenantId: string; actorId: string };
      };
      expect(body.data).toEqual({ tenantId: tenantA, actorId });
      expect(checkedTenants).toEqual([tenantA]);
      expect(response.headers['x-request-id']).toEqual(expect.any(String));
    },
  );
  it.each([tenantB, 'not-a-uuid'])(
    'ignores caller header %s through guards and interceptors',
    async (header) => {
      const response = await get('/auth/me')
        .set('x-tenant-id', header)
        .expect(200);
      expect(
        (response.body as { data: { tenantId: string } }).data.tenantId,
      ).toBe(tenantA);
      expect(checkedTenants).toEqual([tenantA]);
    },
  );
  it('logs out with no header and rejects the revoked session afterward', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer ' + token)
      .expect(204);
    await get('/auth/me').expect(401);
  });
  it('cannot select another Tenant by forging token claims', async () => {
    token = jwt.sign(
      { sub: userId, sid: 'session', tenantId: tenantB, type: 'access' },
      { secret: 'wrong-key', issuer: 'test', audience: 'test' },
    );
    await get('/user').set('x-tenant-id', tenantA).expect(401);
    expect(checkedTenants).toEqual([]);
  });
  it('checks activation in the verified Tenant, never the header Tenant', async () => {
    token = jwt.sign(
      { sub: userId, sid: 'session', tenantId: tenantB, type: 'access' },
      { issuer: 'test', audience: 'test' },
    );
    await get('/auth/me').set('x-tenant-id', tenantA).expect(403);
    expect(checkedTenants).toEqual([tenantB]);
  });
  it('preserves User, ActorProfile and admin authorization', async () => {
    activeUser = false;
    await get('/auth/me').expect(401);
    activeUser = true;
    activeActor = false;
    await get('/auth/me').expect(403);
    activeActor = true;
    admin = false;
    await get('/user').expect(403);
    await get('/role').expect(403);
    await get('/actor-profiles').expect(200);
  });
  it('does not use a header to authenticate a missing bearer token', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/auth/me')
      .set('x-tenant-id', tenantA)
      .expect(401);
    expect(checkedTenants).toEqual([]);
  });
  it('retains explicit Tenant headers for refresh and recovery', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'token' })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/forgot-password')
      .set('x-tenant-id', 'invalid')
      .send({ email: 'test@example.com' })
      .expect(400);
  });
  it('documents bearer-only authentication and reserves Tenant headers for public token flows', () => {
    const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
    for (const path of ['/auth/me', '/user', '/role', '/actor-profiles']) {
      expect(document.paths['/api/v1' + path].get?.security).toEqual([
        { bearer: [] },
      ]);
    }
    expect(document.paths['/api/v1/auth/logout'].post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/api/v1/auth/refresh'].post?.security).toEqual([
      { tenant: [] },
    ]);
    expect(document.paths['/api/v1/auth/login'].post?.security).toBeUndefined();
  });
});
