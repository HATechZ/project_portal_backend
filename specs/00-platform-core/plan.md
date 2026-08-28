# Technical Plan: 00 — Platform Core

**Status:** Approved (retro-spec)
**Related Spec:** `specs/00-platform-core/SPEC.md`
**Contracts:** `API_CONTRACT.md`

---

## 1. Module Tree

```
src/
├── main.ts                       # NestFactory + listen only; all wiring delegated
├── config/
│   ├── app-bootstrap.ts          # configureApplication() — the single wiring point
│   ├── configuration.ts          # the ONLY reader of process.env
│   ├── env.ts                    # EnvironmentVariables interface + key map
│   └── env.schema.ts             # Joi validation, applied by ConfigModule at boot
└── common/
    ├── context/request-context.ts        # AsyncLocalStorage { requestId, actorId? }
    ├── interceptors/
    │   ├── request-id.interceptior.ts    # (sic — filename typo, kept to avoid churn)
    │   ├── etag.interceptor.ts
    │   └── response.interceptor.ts
    ├── exceptions/
    │   ├── app-error-code.ts             # the closed set of error codes
    │   ├── app-exception.ts              # HttpException + code + details
    │   ├── prisma-exception.map.ts       # P2002/P2003/P2025/init → AppException
    │   └── http-exception.filter.ts      # @Catch() — the only error formatter
    ├── pagination/{paginate,paginated-result,pagination-query.dto}.ts
    ├── swagger/{openapi.module,wrap-envelope,api-paginated-response.decorator,shared-schemas}.ts
    └── utils/request-id.ts
```

`OpenApiModule.register()` returns a `global: true` DynamicModule; `OpenApiModule.setup(app)`
builds the document after all modules are resolved.

---

## 2. Wiring order — and why it matters

`configureApplication` registers interceptors in this order:

```
RequestIdInterceptor → EtagInterceptor → ResponseInterceptor
```

Nest chains them as `RequestId(Etag(Response(handler)))`. Pre-processing runs left to right;
**post-processing runs right to left.** So on the way out: the envelope is applied first, the
ETag is computed over the enveloped body, and the request id is set last.

This ordering is the cause of the ETag deviation in `API_CONTRACT.md` §4. Fixing it means
either moving `EtagInterceptor` after `ResponseInterceptor` in the array, or having it hash
`body.data` rather than `body`. The second is preferable — it keeps the ETag stable across
`meta.timestamp` changes, which is the actual intent.

---

## 3. Error flow

```
throw
  ↓
HttpExceptionFilter.catch()
  ↓
mapPrismaException(thrown) ?? thrown        ← Prisma normalized to AppException here
  ↓
status  = instanceof HttpException ? getStatus() : 500
error   = toErrorBody(exception, status)
  ↓
status >= 500 → logger.error(method, url, stack)
  ↓
res.status(status).json({ success: false, error, meta })
```

Modules never catch Prisma errors. A domain failure is `throw new AppException({ code, ... })`.

---

## 4. Configuration flow

```
.env → Joi (env.schema.ts) → process.env → configuration() → AppConfiguration tree
                                                                    ↓
                              ConfigService<AppConfiguration, true>.get('a.b', { infer: true })
```

Adding a variable touches four files together: `env.ts`, `env.schema.ts`, `configuration.ts`,
`.env.example`. Missing any one produces either an untyped read or a boot-time surprise.

---

## 5. Errors

| Case | Thrown | Mapped to |
|---|---|---|
| Validation failure | `BadRequestException` (by the pipe) | 400, `message: string[]` |
| Unique violation | *(nothing — Prisma P2002)* | `mapPrismaException` → 409 `CONFLICT` |
| Domain rule broken | `AppException({ code })` | passed through with its code |
| Unhandled | anything | 500 `INTERNAL_ERROR`, message withheld |
