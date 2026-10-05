import { getEncoding, getEncodingNameForModel } from "js-tiktoken";

const modelName = "gpt-4";
const encodingName = getEncodingNameForModel(modelName);
console.log(encodingName);