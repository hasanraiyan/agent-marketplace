// Separate entry point (`@personaai/sdk/rest-tools`) so `zod` stays an
// optional peer dependency — importing from the package root never pulls
// this in.
export {
  defineRestTool,
  EXTERNAL_USER_ID_TOKEN,
  type DefineRestToolOptions,
  type RestToolTemplateHelpers,
} from './restTools/define.js';
