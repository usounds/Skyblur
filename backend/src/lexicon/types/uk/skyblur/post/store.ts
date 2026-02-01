import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.procedure("uk.skyblur.post.store", {
  params: null,
  input: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      /**
       * @maxLength 100000
       * @maxGraphemes 10000
       */
      additional: /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
          /*#__PURE__*/ v.stringLength(0, 100000),
          /*#__PURE__*/ v.stringGraphemes(0, 10000),
        ]),
      ),
      /**
       * @maxLength 3000
       * @maxGraphemes 300
       */
      text: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 3000),
        /*#__PURE__*/ v.stringGraphemes(0, 300),
      ]),
      uri: /*#__PURE__*/ v.resourceUriString(),
      visibility: /*#__PURE__*/ v.literalEnum([
        "followers",
        "following",
        "mutual",
      ]),
    }),
  },
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      message: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      success: /*#__PURE__*/ v.boolean(),
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
    "uk.skyblur.post.store": mainSchema;
  }
}
