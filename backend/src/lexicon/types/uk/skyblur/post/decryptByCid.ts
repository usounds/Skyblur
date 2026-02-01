import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure("uk.skyblur.post.decryptByCid", {
  params: null,
  input: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      cid: /*#__PURE__*/ v.cidString(),
      password: /*#__PURE__*/ v.string(),
      pds: /*#__PURE__*/ v.genericUriString(),
      repo: /*#__PURE__*/ v.didString(),
    }),
  },
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      additional: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      message: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      text: /*#__PURE__*/ v.string(),
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
    "uk.skyblur.post.decryptByCid": mainSchema;
  }
}
