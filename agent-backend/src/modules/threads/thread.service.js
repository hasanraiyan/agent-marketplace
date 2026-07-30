import threadRepository from './thread.repository.js';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';

/**
 * Developer Platform (AD-04 §15.3, blueprint Phase 9, PR-39): a Thread
 * belongs to a **Subject** (who is chatting), not an **Owner** (who
 * manages a resource) — the same distinction the master implementation
 * blueprint's §13 draws explicitly. That's a narrower shape than every
 * other resource generalized so far (Agent/Skill/Knowledge/Mcp/Provider):
 * there is no "Project-owned Thread" concept (a Project itself doesn't
 * chat), only `PersonaUser` and `ExternalUser` subjects — so this file
 * defines its own small `isThreadSubject`/`subjectFieldsForContext`
 * instead of reusing `resourceOwnership.js`'s Owner-shaped helpers
 * (different field names — `userId`/`externalUserId` vs
 * `ownerId`/`externalOwnerId` — and one fewer case to support).
 *
 * `personaExecutionContext` is defined locally rather than imported from
 * `agent.service.js`, mirroring `knowledge.service.js`'s PR-31 fix — this
 * keeps `thread.service.js` a lean, dependency-light module that avoids
 * agent.service.js's heavy transitive import chain
 * (agent.repository.js -> tools/index.js -> agent.factory.js's
 * `ChatOpenAI` dependency), which has broken partial `@langchain/openai`
 * test mocks in unrelated modules before.
 */
export function personaExecutionContext(userId) {
  return { domain: PERSONA_DOMAIN, principalType: 'PersonaUser', personaUserId: userId };
}

/**
 * True if `context` represents the actual Subject of `thread`. Domain-
 * qualified first: a same-shaped identity in a DIFFERENT Domain is never
 * treated as the Subject.
 */
export function isThreadSubject(thread, context) {
  if (!thread || !context) return false;
  if (thread.domain && context.domain && thread.domain !== context.domain) return false;

  if (context.principalType === 'ProjectRuntime') {
    return (
      thread.subjectType === 'ExternalUser' &&
      Boolean(thread.externalUserId) &&
      String(thread.externalUserId) === String(context.externalUserId)
    );
  }

  const threadUserIdStr = thread.userId ? thread.userId.toString() : null;
  const contextUserIdStr = context.personaUserId ? context.personaUserId.toString() : null;
  return Boolean(contextUserIdStr && threadUserIdStr === contextUserIdStr);
}

/**
 * Builds the Mongoose Subject filter for `context` — for repository-layer
 * list/delete-all queries. For a Persona caller this is exactly
 * `{ userId }`, byte-for-byte the same filter `thread.repository.js` built
 * inline before this generalization.
 */
export function subjectFilterForContext(context) {
  if (context?.principalType === 'ProjectRuntime') {
    return {
      domain: context.domain,
      subjectType: 'ExternalUser',
      externalUserId: context.externalUserId,
    };
  }
  return { userId: context?.personaUserId };
}

/**
 * The `subjectType`/domain/externalUserId fields to merge into a new
 * Thread's create payload for `context`.
 */
export function subjectFieldsForContext(context) {
  if (context?.principalType === 'ProjectRuntime') {
    return {
      domain: context.domain,
      subjectType: 'ExternalUser',
      externalUserId: context.externalUserId,
    };
  }
  return { subjectType: 'PersonaUser', userId: context?.personaUserId };
}

class ThreadService {
  /**
   * Creates a Thread. `context` defaults to `personaExecutionContext(userId)`
   * — zero behavior change for the existing Persona `POST /threads` route.
   * Agent-existence validation stays in the caller (thread.controller.js),
   * unchanged from before this generalization.
   */
  async createThread(userId, threadData, context = personaExecutionContext(userId)) {
    return await threadRepository.create({
      ...threadData,
      ...subjectFieldsForContext(context),
    });
  }

  /**
   * Fetches a Thread by ID with a Subject check. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller.
   */
  async getThreadById(id, userId, context = personaExecutionContext(userId)) {
    const thread = await threadRepository.findById(id);
    if (!thread || !isThreadSubject(thread, context)) {
      throw new Error('Thread not found');
    }
    return thread;
  }

  /**
   * Lists a Subject's own Threads (paginated, excludes archived) — mirrors
   * the existing `GET /threads` behavior for Persona callers exactly.
   */
  async getThreadsForSubject(userId, options, context = personaExecutionContext(userId)) {
    return await threadRepository.findBySubject(subjectFilterForContext(context), options);
  }

  /**
   * Updates a Thread's title. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller.
   */
  async updateThreadTitle(id, userId, title, context = personaExecutionContext(userId)) {
    await this.getThreadById(id, userId, context);
    return await threadRepository.update(id, { title });
  }

  /**
   * Deletes a single Thread (fetch-then-check ownership, same pattern as
   * before). Returns the deleted document so the caller can cascade
   * checkpoint cleanup via its `threadId`.
   */
  async deleteThread(id, userId, context = personaExecutionContext(userId)) {
    await this.getThreadById(id, userId, context);
    return await threadRepository.delete(id);
  }

  /**
   * Deletes every Thread belonging to a Subject. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller (including `user.service.js`'s account-deletion
   * cascade, which now passes `{ userId }` directly to the repository
   * rather than going through this method — see thread.repository.js's
   * `deleteAllBySubject`).
   */
  async deleteAllThreadsForSubject(userId, context = personaExecutionContext(userId)) {
    return await threadRepository.deleteAllBySubject(subjectFilterForContext(context));
  }
}

export default new ThreadService();
