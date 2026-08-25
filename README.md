# Project Portal Backend

NestJS 11 API using Prisma 7, Neon PostgreSQL, Yarn, request validation, and
Swagger.

## Setup

1. Enable the Yarn version pinned by this project:

   ```bash
   corepack enable
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Copy `.env.example` to `.env` and replace `DATABASE_URL` with the complete
   connection string from your Neon dashboard.

4. Start Redis in Docker:

   ```bash
   yarn services:up
   ```

5. Start the NestJS development server directly on the host:

   ```bash
   yarn start:dev
   ```

Docker Compose runs infrastructure services only; it does not build or run the
NestJS application. Redis is exposed only on `127.0.0.1:6379`, matching
`REDIS_URL=redis://127.0.0.1:6379` in `.env.example`. This loopback-only binding
keeps Redis unavailable through the machine's external network interfaces.

The NestJS start command generates Prisma Client, applies pending migrations,
and then connects the application to Neon and Redis. Swagger UI is available at
`http://localhost:3000/api/docs`.

To stop the infrastructure services without deleting their persisted data:

```bash
yarn services:down
```

## User endpoints

- `POST /api/v1/user`
- `GET /api/v1/user`
- `GET /api/v1/user/:id`
- `PATCH /api/v1/user/:id`
- `DELETE /api/v1/user/:id`

User passwords must contain 6–8 characters and are stored only as bcrypt hashes.

## Role and permission endpoints

- `GET /api/v1/role`
- `GET /api/v1/role/:id`
- `PUT /api/v1/role/:id/permission`
- `GET /api/v1/permission`
- `GET /api/v1/permission/:id`
- `GET /api/v1/user/:userId/role`
- `POST /api/v1/user/:userId/role`
- `DELETE /api/v1/user/:userId/role/:roleId`

## Authentication endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Authentication uses short-lived HS256 access JWTs and rotating opaque refresh
tokens. Send the access token as `Authorization: Bearer <token>` and continue
to send `x-tenant-id` on tenant-scoped requests. Refresh tokens are stored only
as SHA-256 hashes and can be revoked through logout. Set a unique, random
`JWT_SECRET` of at least 32 characters in every deployed environment.

Successful login responses expose a stable public user contract with flat role
and permission arrays; database relation names are never returned:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "50000000-0000-4000-8000-000000000001",
      "fullName": "System Administrator",
      "email": "admin@project-portal.local",
      "avatarUrl": null,
      "roles": ["system_admin"],
      "permissions": ["ADD_COMPANY", "ADD_DIVISION"]
    },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "timestamp": "2026-08-24T04:43:01.258Z"
}
```

## Database commands

```bash
yarn db:setup
yarn prisma:migrate --name <migration-name>
yarn prisma:studio
```

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Project_Portal_backend
