import { flattenLocale } from "./flatten";
import { localeFlatMapping } from "./flatMapping";
import messagesJson from "./messages/en.json";

const messages = flattenLocale(messagesJson, localeFlatMapping);

export default messages;
