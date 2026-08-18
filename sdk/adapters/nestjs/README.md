# @personaai/nestjs

NestJS adapter for the [persona.hasanraiyan.me](https://persona.hasanraiyan.me) Developer Platform API & Agent Runtime — provides a dynamic module, injectable `PersonaService`, and middleware for streaming AI agents.

> **Server-side only.** Every method on this adapter communicates using your Project's credential — a server-side secret, not something a browser or client is ever allowed to see.

---

## 📦 Installation

```bash
npm install @personaai/nestjs @personaai/runtime @personaai/sdk
# or
pnpm add @personaai/nestjs @personaai/runtime @personaai/sdk
```

---

## 🚀 Quick Start

### 1. Import `PersonaModule` in `AppModule`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersonaModule } from '@personaai/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Async Configuration with ConfigService
    PersonaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.get<string>('PERSONA_BASE_URL', 'https://api.persona.hasanraiyan.me'),
        credential: config.getOrThrow<string>('PERSONA_CREDENTIAL'),
        // Resolve user identity from request (after your Auth Guard runs)
        resolveUserFrom: (req) => req.user?.id ?? req.user?._id?.toString() ?? null,
        // Optional custom route prefix (defaults to '/api/persona')
        routePrefix: '/api/persona',
      }),
    }),
  ],
})
export class AppModule {}
```

---

### 2. Inject `PersonaService` in your Services

```typescript
import { Injectable } from '@nestjs/common';
import { PersonaService } from '@personaai/nestjs';

@Injectable()
export class FinancialAdvisorService {
  constructor(private readonly persona: PersonaService) {}

  /**
   * Run a streaming conversation with a Financial Agent for the current user
   */
  async *askAdvisor(userId: string, agentId: string, question: string) {
    const userClient = this.persona.forUser(userId);

    const stream = userClient.chat.stream(agentId, {
      messages: [{ role: 'user', content: question }],
    });

    for await (const event of stream) {
      if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) {
        yield event.delta;
      }
    }
  }
}
```

---

## 🛠️ Features

* **Dynamic NestJS Module**: Supports both `.forRoot()` and `.forRootAsync()`.
* **Automatic Middleware Mount**: Mounts the AG-UI streaming endpoints on your configured `routePrefix` (`/api/persona/*`).
* **Scoped User Context**: `personaService.forUser(userId)` creates on-demand client instances bound to your app's authenticated user.
* **Graceful Lifecycle**: Implements `OnModuleDestroy` to close background runtime pools and subscriptions cleanly.
