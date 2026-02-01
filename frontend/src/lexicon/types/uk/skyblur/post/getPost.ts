import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure("uk.skyblur.post.getPost", {
  params: null,
  input: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      /**
       * If the specified uri is password-protected, please provide the password. If no password is specified, the non-protected content will be returned.
       */
      password: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      /**
       * Skyblur post at-uri. It shoud be uk.skyblur.post collection.
       */
      uri: /*#__PURE__*/ v.resourceUriString(),
    }),
  },
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      additional: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      createdAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
      encryptCid: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      /**
       * Error code for restricted content. e.g. AuthRequired, NotFollower, NotFollowing, NotMutual
       */
      errorCode: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      /**
       * Description of the error code.
       */
      errorDescription: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      message: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      text: /*#__PURE__*/ v.string(),
      visibility: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
    }),
  },
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}
export interface $input extends v.InferXRPCBodyInput<mainSchema["input"]> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCProcedures {
    "uk.skyblur.post.getPost": mainSchema;
  }
}
