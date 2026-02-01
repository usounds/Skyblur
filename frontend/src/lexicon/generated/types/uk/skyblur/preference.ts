import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.literal("self"),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("uk.skyblur.preference"),
    get myPage() {
      return /*#__PURE__*/ v.variant([myPageSchema]);
    },
  }),
);
const _myPageSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("uk.skyblur.preference#myPage"),
  ),
  /**
   * Define the description displayed on MyPage.
   * @maxLength 10000
   * @maxGraphemes 100000
   */
  description: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 10000),
      /*#__PURE__*/ v.stringGraphemes(0, 100000),
    ]),
  ),
  /**
   * If this item is true, MyPage will be displayed.
   */
  isUseMyPage: /*#__PURE__*/ v.boolean(),
});

type main$schematype = typeof _mainSchema;
type myPage$schematype = typeof _myPageSchema;

export interface mainSchema extends main$schematype {}
export interface myPageSchema extends myPage$schematype {}

export const mainSchema = _mainSchema as mainSchema;
export const myPageSchema = _myPageSchema as myPageSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
export interface MyPage extends v.InferInput<typeof myPageSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "uk.skyblur.preference": mainSchema;
  }
}
