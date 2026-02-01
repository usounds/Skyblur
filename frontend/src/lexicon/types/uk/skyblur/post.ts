import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("uk.skyblur.post"),
    /**
     * The post additional contents.
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
     * Created date assigned by client
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Encrypted post body. It shoud be decrypted by the client with AES-256.
     */
    encryptBody: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.blob()),
    /**
     * The post main contents. Blurred text must be enclosed in brackets [].
     * @maxLength 3000
     * @maxGraphemes 300
     */
    text: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 3000),
      /*#__PURE__*/ v.stringGraphemes(0, 300),
    ]),
    uri: /*#__PURE__*/ v.resourceUriString(),
    /**
     * For 'login', the post requires login to view (Bluesky account required). For 'password', the text only contains blurred text, and additional is always empty. The unblurred text and additional are included in the encryptBody.
     * @maxLength 100
     * @maxGraphemes 10
     */
    visibility: /*#__PURE__*/ v.literalEnum([
      "followers",
      "following",
      "login",
      "mutual",
      "password",
      "public",
    ]),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "uk.skyblur.post": mainSchema;
  }
}
