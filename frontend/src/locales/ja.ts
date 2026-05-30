import { flattenLocale } from "./flatten";
import { localeFlatMapping } from "./flatMapping";
import messagesJson from "./messages/ja.json";

const messages = flattenLocale(messagesJson, localeFlatMapping);

export default messages;
