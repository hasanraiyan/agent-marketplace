/**
 * @openapi
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         statusCode:
 *           type: number
 *           example: 200
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         status:
 *           type: string
 *           example: error
 *         statusCode:
 *           type: number
 *           example: 400
 *         message:
 *           type: string
 *         code:
 *           type: string
 *           example: VALIDATION_ERROR
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: number
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *             pagination:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         clerkId:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [normal, admin]
 *         username:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Agent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         systemPrompt:
 *           type: string
 *         modelName:
 *           type: string
 *         webSearchEnabled:
 *           type: boolean
 *         visibility:
 *           type: string
 *           enum: [private, unlisted, public]
 *         category:
 *           type: string
 *           enum: [productivity, coding, creative, research, roleplay, other]
 *         isMainAgent:
 *           type: boolean
 *         messageCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Thread:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         agentId:
 *           type: string
 *         userId:
 *           type: string
 *         threadId:
 *           type: string
 *         title:
 *           type: string
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *         isArchived:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Provider:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         label:
 *           type: string
 *         baseURL:
 *           type: string
 *         defaultModel:
 *           type: string
 *         isDefault:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Skill:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         instructions:
 *           type: string
 *         isPublic:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Mcp:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         transport:
 *           type: string
 *           enum: [http, sse]
 *         url:
 *           type: string
 *         authType:
 *           type: string
 *           enum: [none, oauth, apiKey]
 *         authMode:
 *           type: string
 *           enum: [owner, user]
 *         isEnabled:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     KnowledgeBase:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         isPublic:
 *           type: boolean
 *         documentCount:
 *           type: integer
 *         chunkCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export {};
